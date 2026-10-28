/* ------------------------------------------------------------------ */
/* SIDEBAR ENTRY & DATA                                                */
/* ------------------------------------------------------------------ */

/** Mở sidebar (được gọi từ menu "Mở AI Introduction Generator") */
function showSidebar() {
  // Dùng template (thay vì createHtmlOutputFromFile) để inject khung Welcome Card
  // mặc định dưới dạng data URI — sidebar mở là hiện sẵn khung, không phụ thuộc mạng.
  const template = HtmlService.createTemplateFromFile(
    "recruitment/welcome-onboard",
  );
  template.frameDataUrl = getWelcomeFrameDataUrl_();
  SpreadsheetApp.getUi().showSidebar(
    template
      .evaluate()
      .setTitle("AI Recruitment — Welcome Onboard")
      .setWidth(420),
  );
}

/**
 * UI Controller: Popup cài đặt token Outline cho feature Recruitment
 */
function promptSetupOutlineToken() {
  const ui = SpreadsheetApp.getUi();
  const currentToken = OutlineApiService.getPersonalToken();

  let msg =
    "Nhập API Token cá nhân Outline của bạn để tạo bài draft dưới tên bạn.";
  if (currentToken) {
    const masked = OutlineApiUtil.maskToken(currentToken);
    msg += `\n\n(Token hiện tại: ${masked})`;
  }

  const result = ui.prompt(
    "🔑 Cài đặt Outline API Token",
    msg,
    ui.ButtonSet.OK_CANCEL,
  );

  if (result.getSelectedButton() === ui.Button.OK) {
    const newToken = result.getResponseText().trim();
    if (!newToken) {
      ui.alert("⚠️ Bạn chưa nhập token. Cài đặt không thay đổi.");
      return;
    }

    try {
      OutlineApiService.setPersonalToken(newToken);
      ui.alert(
        "✅ Đã lưu Outline API Token cá nhân thành công!\nTừ giờ bài draft sẽ được tạo trực tiếp trên tài khoản Outline của bạn.",
      );
    } catch (err) {
      ui.alert(`❌ Lỗi: ${err.message}`);
    }
  }
}

// ... các hàm showSidebar, handleSummarize khác của recruitment nằm ở đây ...

/**
 * Đọc data URI khung Welcome Card mặc định từ file HTML riêng
 * (recruitment/welcome-frame.html — sinh bởi scripts/update-welcome-frame.sh
 * từ src/assets/frame.webp). Trả "" nếu file chưa có/nội dung không hợp lệ
 * -> sidebar vẽ fallback nền đỏ như cũ.
 */
function getWelcomeFrameDataUrl_() {
  try {
    const content = HtmlService.createHtmlOutputFromFile(
      "recruitment/welcome-frame",
    )
      .getContent()
      .trim();
    return content.startsWith("data:image") ? content : "";
  } catch (e) {
    return "";
  }
}

/**
 * Đọc thông tin ứng viên tại dòng đang chọn để fill form trong sidebar,
 * đồng thời đối chiếu qua Sheet UC06 để lấy ảnh avatar nếu có.
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

    // Cột CV: cell thường chứa HYPERLINK
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
      workingEmail: formatKyanonEmail(readCol(COLS.ALLOC_CODE)),
      personalEmail: readCol(COLS.PERSONAL_EMAIL),
      phoneNumber: readCol("phonenumber"),
      cvUrl: cvUrl,
      avatarBase64: null,
      avatarSource: null,
    };

    if (!candidate.fullName) {
      return {
        ok: false,
        error: `Dòng ${rowIndex} không có Full Name. Hãy chọn đúng dòng nhân sự.`,
      };
    }

    // ------------------------------------------------------------------
    // ĐỐI CHIẾU SANG SHEET UC06 ĐỂ LẤY AVATAR
    // ------------------------------------------------------------------
    const uc06AvatarUrl = findUc06AvatarUrl_(
      candidate.personalEmail,
      candidate.workingEmail,
    );
    if (uc06AvatarUrl) {
      const base64Str = getDriveFileBase64(uc06AvatarUrl);
      if (base64Str) {
        candidate.avatarBase64 = `data:image/jpeg;base64,${base64Str}`;
        candidate.avatarSource = "UC06";
      }
    }

    return { ok: true, candidate };
  } catch (error) {
    Logger.log("❌ getSelectedCandidate lỗi: " + error.toString());
    return { ok: false, error: error.toString() };
  }
}

/**
 * Helper tra cứu link ảnh trên sheet UC06 theo email cá nhân hoặc working email.
 * Ưu tiên lấy cột "Ảnh 1:1" (đã cắt vuông), nếu không có mới lấy cột "Picture" (ảnh gốc).
 * @param {string} personalEmail
 * @param {string} workingEmail
 * @returns {string} Drive URL hoặc rỗng
 */
function findUc06AvatarUrl_(personalEmail, workingEmail) {
  try {
    const uc06Id = CONFIG.SPREADSHEET_UC06_ID;
    if (!uc06Id) return "";

    const uc06Ss = SpreadsheetApp.openById(uc06Id);
    const uc06Sheet = uc06Ss.getSheets()[0];
    const lastRow = uc06Sheet.getLastRow();
    const lastCol = uc06Sheet.getLastColumn();

    if (lastRow <= 1 || lastCol <= 0) return "";

    const uc06ColMap = getHeaderColumnMap(uc06Sheet);
    const emailCol = uc06ColMap[normalizeHeaderKey("Email Address")];
    const pictureCol = uc06ColMap[normalizeHeaderKey("Picture")];
    const croppedCol = uc06ColMap[normalizeHeaderKey("Ảnh 1:1")];

    if (!emailCol || (!pictureCol && !croppedCol)) return "";

    const data = uc06Sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
    const searchEmails = [personalEmail, workingEmail]
      .filter(Boolean)
      .map((e) => String(e).trim().toLowerCase());

    if (searchEmails.length === 0) return "";

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const rawEmail = String(row[emailCol - 1] || "")
        .trim()
        .toLowerCase();
      if (!rawEmail) continue;

      if (searchEmails.includes(rawEmail)) {
        // Ưu tiên 1: Cột "Ảnh 1:1"
        const croppedUrl = croppedCol
          ? String(row[croppedCol - 1] || "").trim()
          : "";
        if (croppedUrl) return croppedUrl;

        // Ưu tiên 2: Cột "Picture" gốc
        const rawPicUrl = pictureCol
          ? String(row[pictureCol - 1] || "").trim()
          : "";
        if (rawPicUrl) return rawPicUrl;
      }
    }
    return "";
  } catch (err) {
    Logger.log("⚠️ Không thể tra cứu avatar từ UC06: " + err.message);
    return "";
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
  const candidate = formData && formData.candidate;

  if (!candidate || !candidate.fullName) {
    return {
      ok: false,
      error: "Thiếu thông tin ứng viên. Hãy chọn lại dòng và mở lại sidebar.",
    };
  }

  let aiRes = null;
  const timeStart = new Date(); // Mốc bắt đầu gọi AI

  try {
    const cvContent = readCvContent_(formData && formData.cvFile, candidate);

    // Gọi AI
    aiRes = callGeminiSummarizeCv_(cvContent, candidate);

    const timeEnd = new Date(); // Mốc kết thúc

    // Ghi log thành công
    logAiCostWorkflow({
      fullName: candidate.fullName,
      provider: aiRes?.provider,
      model: aiRes?.model,
      timeStart: timeStart,
      timeEnd: timeEnd,
      inputTokens: aiRes?.inputTokens,
      outputTokens: aiRes?.outputTokens,
      status: "SUCCESS",
    });

    return { ok: true, introduction: aiRes.text };
  } catch (error) {
    const timeEnd = new Date(); // Mốc kết thúc (nếu lỗi)
    Logger.log("❌ summarizeCvToIntro lỗi: " + error.toString());

    // Ghi log thất bại
    logAiCostWorkflow({
      fullName: candidate?.fullName || "N/A",
      provider: aiRes?.provider || "N/A",
      model: aiRes?.model || "N/A",
      timeStart: timeStart,
      timeEnd: timeEnd,
      inputTokens: aiRes?.inputTokens || 0,
      outputTokens: aiRes?.outputTokens || 0,
      status: "FAILED",
      errorDetail: error.message || error.toString(),
    });

    return { ok: false, error: error.message || error.toString() };
  }
}

/* ------------------------------------------------------------------ */
/* SUBMIT HANDLER (google.script.run)                                  */
/* ------------------------------------------------------------------ */

/**
 * Nhận dữ liệu form từ sidebar, tạo draft trên Outline.
 * Ảnh ứng viên KHÔNG upload qua tool — sau khi draft được tạo, người dùng
 * tự chèn ảnh trực tiếp trên Outline.
 * @param {Object} formData - { introduction, candidate }
 * @returns {Object} { ok, url?, error? }
 */
function submitIntroductionPost(formData) {
  try {
    const introduction = String(
      (formData && formData.introduction) || "",
    ).trim();
    const candidate = formData && formData.candidate;

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

    // 1. Xây markdown của bài
    const { title, text } = OutlineApiUtil.buildWelcomePostMarkdown(
      candidate,
      introduction,
    );

    // 2. Tạo draft Outline
    const doc = OutlineApiService.createDocument({ title, text });

    return {
      ok: true,
      message: `Đã tạo draft "${title}" trên Outline! Ảnh ứng viên hãy chèn trực tiếp trên Outline nhé.`,
      url:
        doc && doc.url
          ? doc.url
          : `${OUTLINE_CV_SUMMARIZER_CONFIG.OUTLINE.BASE_URL}/drafts`,
    };
  } catch (error) {
    Logger.log("❌ submitIntroductionPost lỗi: " + error.toString());
    return { ok: false, error: error.message || error.toString() };
  }
}
