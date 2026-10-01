/** ==========================================
 * RECRUITMENT/SIDEBAR.JS - MODULE AI RECRUITMENT (CONTROLLER)
 * ==========================================
 * Entry points public của module AI Recruitment — các hàm được bind qua
 * google.script.run (welcome-onboard.html) hoặc menu. KHÔNG ĐỔI TÊN.
 *  - showSidebar(): mở sidebar (menu "🚀 AI Recruitment")
 *  - getSelectedCandidate(): đọc dòng đang chọn trên sheet
 *  - summarizeCvToIntro(): nút "✨ AI tóm tắt CV"
 *  - submitIntroductionPost(): nút Submit -> tạo draft Outline
 *
 * Logic nội bộ nằm ở các file cùng thư mục:
 *  - recruitment/outline-api.js  (Outline documents.create + attachments upload)
 *  - recruitment/cv-reader.js    (đọc & trích text CV: PDF/DOCX/GDoc/TXT)
 *  - recruitment/ai-providers.js (OpenRouter + Gemini providers, retry/fallback)
 *
 * Phụ thuộc: core/config.js, core/utils.js (getHeaderColumnMap)
 */

/* ------------------------------------------------------------------ */
/* SIDEBAR ENTRY & DATA                                                */
/* ------------------------------------------------------------------ */

/** Mở sidebar (được gọi từ menu "Mở AI Introduction Generator") */
function showSidebar() {
  const html = HtmlService.createHtmlOutputFromFile(
    "recruitment/welcome-onboard",
  )
    .setTitle("AI Recruitment — Welcome Onboard")
    .setWidth(320);
  SpreadsheetApp.getUi().showSidebar(html);
}

/**
 * Đọc thông tin ứng viên tại dòng đang chọn để fill form trong sidebar.
 * Được gọi từ sidebar qua google.script.run khi mở.
 * @returns {Object} { ok, error?, candidate: {...} }
 */
function getSelectedCandidate() {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    const activeRange = sheet.getActiveRange();
    if (!activeRange || activeRange.getRow() < 2) {
      return {
        ok: false,
        error: "Hãy chọn trước một dòng nhân sự trên Sheet rồi mở lại sidebar.",
      };
    }

    const rowIndex = activeRange.getRow();
    const colMap = getHeaderColumnMap(sheet);
    const readCol = (key) => {
      const col = colMap[key];
      return col
        ? String(sheet.getRange(rowIndex, col).getDisplayValue()).trim()
        : "";
    };

    // Cột CV: cell thường chứa HYPERLINK (text hiển thị là tên file, URL nằm trong link).
    // Ưu tiên: hyperlink của cell -> URL trong formula HYPERLINK() -> giá trị hiển thị.
    let cvUrl = "";
    if (colMap[COLS.CV]) {
      const cvCell = sheet.getRange(rowIndex, colMap[COLS.CV]);
      const richText = cvCell.getRichTextValue();
      cvUrl = (richText && richText.getLinkUrl()) || "";
      if (!cvUrl) {
        const formula = cvCell.getFormula() || "";
        const m = formula.match(/HYPERLINK\(\s*"([^"]+)"/i);
        if (m) cvUrl = m[1];
      }
      if (!cvUrl) cvUrl = String(cvCell.getDisplayValue()).trim();
    }

    const candidate = {
      rowNumber: rowIndex,
      fullName: readCol(COLS.FULL_NAME),
      accentlessFullName: readCol(COLS.ACCENTLESS_FULL_NAME),
      level: readCol(COLS.LEVEL),
      employmentType: readCol(COLS.EMPLOYMENT_TYPE),
      title: readCol(COLS.TITLE),
      squad: readCol(COLS.SQUAD),
      lineManager: readCol(COLS.LINE_MANAGER),
      taInCharge: readCol(COLS.TA_IN_CHARGE),
      dateOfOnboard: readCol(COLS.DATE_ONBOARD),
      workingEmail: readCol(COLS.WORKING_EMAIL),
      personalEmail: readCol(COLS.PERSONAL_EMAIL),
      phoneNumber: readCol("phonenumber"),
      cvUrl: cvUrl,
    };

    if (!candidate.fullName) {
      return {
        ok: false,
        error: `Dòng ${rowIndex} không có Full Name. Hãy chọn đúng dòng nhân sự.`,
      };
    }

    return { ok: true, candidate };
  } catch (error) {
    Logger.log("❌ getSelectedCandidate lỗi: " + error.toString());
    return { ok: false, error: error.toString() };
  }
}

/* ------------------------------------------------------------------ */
/* AI SUMMARIZE HANDLER (google.script.run)                            */
/* ------------------------------------------------------------------ */

/**
 * Handler cho nút "AI tóm tắt CV": đọc CV (upload hoặc cột CV) → AI → trả về Introduction.
 * @param {Object} formData - { candidate: Object, cvFile?: { dataBase64, fileName, mimeType } | null }
 * @returns {Object} { ok, introduction?, error? }
 */
function summarizeCvToIntro(formData) {
  try {
    const candidate = formData && formData.candidate;
    if (!candidate || !candidate.fullName) {
      return {
        ok: false,
        error: "Thiếu thông tin ứng viên. Hãy chọn lại dòng và mở lại sidebar.",
      };
    }

    const cvContent = readCvContent_(formData && formData.cvFile, candidate);
    const introduction = callGeminiSummarizeCv_(cvContent, candidate);

    return { ok: true, introduction };
  } catch (error) {
    Logger.log("❌ summarizeCvToIntro lỗi: " + error.toString());
    return { ok: false, error: error.message || error.toString() };
  }
}

/* ------------------------------------------------------------------ */
/* SUBMIT HANDLER (google.script.run)                                  */
/* ------------------------------------------------------------------ */

/**
 * Nhận dữ liệu form từ sidebar, tạo draft trên Outline.
 * @param {Object} formData - { introduction, candidate, photo?: { dataBase64, fileName, mimeType } | null }
 * @returns {Object} { ok, url?, error? }
 */
function submitIntroductionPost(formData) {
  try {
    const introduction = String(
      (formData && formData.introduction) || "",
    ).trim();
    const candidate = formData && formData.candidate;
    const photo = formData && formData.photo;

    if (!introduction) {
      return { ok: false, error: "Introduction không được để trống." };
    }
    if (!candidate || !candidate.fullName) {
      return {
        ok: false,
        error:
          "Thiếu thông tin ứng viên. Hãy đóng sidebar, chọn lại dòng và mở lại.",
      };
    }

    // 1. Nếu có ảnh: upload vào Outline trước để lấy URL nhúng vào bài
    let photoMarkdownLine = "";
    let photoWarning = "";
    if (photo && photo.dataBase64) {
      const uploadResult = uploadCandidatePhoto(photo, candidate);
      if (uploadResult.ok) {
        photoMarkdownLine = `![${candidate.fullName}](${uploadResult.url})`;
        if (uploadResult.warning) {
          photoWarning = `⚠️ ${uploadResult.warning}`;
        }
      } else {
        // Ảnh lỗi không chặn việc tạo post — chỉ cảnh báo
        photoWarning = `⚠️ Ảnh không upload được: ${uploadResult.error}`;
        Logger.log(photoWarning);
      }
    }

    // 2. Xây markdown (chèn ảnh lên đầu nếu có)
    const { title, text: baseText } = buildWelcomePostMarkdown(
      candidate,
      introduction,
    );
    const text = photoMarkdownLine
      ? `${photoMarkdownLine}\n\n${baseText}`
      : baseText;

    // 3. Tạo draft Outline
    const doc = callOutlineCreateDocument_(title, text);

    return {
      ok: true,
      message: `Đã tạo draft "${title}" trên Outline!${photoWarning ? " " + photoWarning : ""}`,
      url: doc && doc.url ? doc.url : `${CONFIG.OUTLINE.BASE_URL}/drafts`,
    };
  } catch (error) {
    Logger.log("❌ submitIntroductionPost lỗi: " + error.toString());
    return { ok: false, error: error.message || error.toString() };
  }
}
