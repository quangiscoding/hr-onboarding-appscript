/** ==========================================
 * RECRUITMENT/SIDEBAR.JS - MODULE AI RECRUITMENT
 * ==========================================
 * Sidebar "Welcome Onboard Post Generator":
 *  1. Đọc thông tin ứng viên đang chọn trên sheet -> hiển thị form
 *  2. Người dùng nhập/édit Introduction -> Submit
 *  3. Gọi Outline API (documents.create, publish=false) tạo draft trên Outline Wiki
 *
 * Phụ thuộc: core/config.js, core/utils.js (getHeaderColumnMap, clean, toTitleCase)
 */

/* ------------------------------------------------------------------ */
/* SIDEBAR ENTRY & DATA                                                */
/* ------------------------------------------------------------------ */

/** Mở sidebar (được gọi từ menu "Mở AI Introduction Generator") */
function showSidebar() {
  const html = HtmlService.createHtmlOutputFromFile("recruitment/welcome-onboard")
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
      return { ok: false, error: "Hãy chọn trước một dòng nhân sự trên Sheet rồi mở lại sidebar." };
    }

    const rowIndex = activeRange.getRow();
    const colMap = getHeaderColumnMap(sheet);
    const readCol = (key) => {
      const col = colMap[key];
      return col ? String(sheet.getRange(rowIndex, col).getDisplayValue()).trim() : "";
    };

    const candidate = {
      rowNumber: rowIndex,
      fullName: readCol(COLS.FULL_NAME),
      accentlessFullName: readCol(COLS.PERSONAL_EMAIL) ? "" : readCol("accentlessfullname"),
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
    };

    if (!candidate.fullName) {
      return { ok: false, error: `Dòng ${rowIndex} không có Full Name. Hãy chọn đúng dòng nhân sự.` };
    }

    return { ok: true, candidate };
  } catch (error) {
    Logger.log("❌ getSelectedCandidate lỗi: " + error.toString());
    return { ok: false, error: error.toString() };
  }
}

/* ------------------------------------------------------------------ */
/* OUTLINE API                                                         */
/* ------------------------------------------------------------------ */

/**
 * Lấy API token từ Script Property "OUTLINE_API_TOKEN"
 * (Apps Script → Project Settings → Script Properties).
 * Không hardcode token trong code để tránh leak qua git.
 */
function getOutlineApiToken_() {
  const token = PropertiesService.getScriptProperties().getProperty("OUTLINE_API_TOKEN");
  if (!token) {
    throw new Error(
      'Thiếu Script Property "OUTLINE_API_TOKEN". Hãy vào Apps Script → Project Settings → Script Properties và thêm token Outline (dạng ol_api_...).',
    );
  }
  return token;
}

/**
 * Xây markdown của post "Welcome Onboard" theo mẫu bài đăng internal.
 * @param {Object} candidate
 * @param {string} introduction - Nội dung do người dùng soạn trong sidebar
 * @returns {{ title: string, text: string }}
 */
function buildWelcomePostMarkdown(candidate, introduction) {
  const name = candidate.fullName || "New Member";
  const jobTitle = candidate.title || "N/A";
  const firstDay = candidate.dateOfOnboard || "N/A";
  const manager = candidate.lineManager || "N/A";
  const squad = candidate.squad ? `${candidate.squad} — ` : "";

  const title = `Welcome Onboard: ${name}`;

  const text = [
    `**First working day:** ${firstDay}`,
    `**Job Title:** ${jobTitle}`,
    `**Line Manager:** ${manager}`,
    `**Introduction:** ${introduction.trim()}`,
    "",
    `_Squad/Unit: ${squad || "N/A"} | Employment Type: ${candidate.employmentType || "N/A"} | Level: ${candidate.level || "N/A"}_`,
  ].join("\n");

  return { title, text };
}

/**
 * Gọi Outline API documents.create để tạo draft.
 * publish=false + không truyền collectionId -> nằm ở Drafts cá nhân của tài khoản token
 * (giống hệt khi bấm "New draft" ở trang /drafts).
 * @param {string} title
 * @param {string} text - Markdown content
 * @returns {Object} data từ Outline (chứa document.id, document.url...)
 */
function callOutlineCreateDocument_(title, text) {
  const payload = {
    title: title,
    text: text,
    publish: CONFIG.OUTLINE.PUBLISH === true,
  };
  if (payload.publish && CONFIG.OUTLINE.COLLECTION_ID) {
    payload.collectionId = CONFIG.OUTLINE.COLLECTION_ID;
  }

  const response = UrlFetchApp.fetch(`${CONFIG.OUTLINE.BASE_URL}/api/documents.create`, {
    method: "post",
    contentType: "application/json",
    headers: { Authorization: `Bearer ${getOutlineApiToken_()}` },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  });

  const statusCode = response.getResponseCode();
  const body = JSON.parse(response.getContentText() || "{}");

  if (statusCode !== 200 || body.ok !== true) {
    throw new Error(`Outline API lỗi (HTTP ${statusCode}): ${body.error || response.getContentText()}`);
  }
  return body.data;
}

/* ------------------------------------------------------------------ */
/* SUBMIT HANDLER (được gọi từ sidebar form)                           */
/* ------------------------------------------------------------------ */

/**
 * Nhận dữ liệu form từ sidebar, tạo draft trên Outline.
 * @param {Object} formData - { introduction: string, candidate: Object (từ getSelectedCandidate) }
 * @returns {Object} { ok, url?, error? }
 */
function submitIntroductionPost(formData) {
  try {
    const introduction = String(formData && formData.introduction || "").trim();
    const candidate = formData && formData.candidate;

    if (!introduction) {
      return { ok: false, error: "Introduction không được để trống." };
    }
    if (!candidate || !candidate.fullName) {
      return { ok: false, error: "Thiếu thông tin ứng viên. Hãy đóng sidebar, chọn lại dòng và mở lại." };
    }

    const { title, text } = buildWelcomePostMarkdown(candidate, introduction);
    const doc = callOutlineCreateDocument_(title, text);

    return {
      ok: true,
      message: `Đã tạo draft "${title}" trên Outline!`,
      url: doc && doc.url ? doc.url : `${CONFIG.OUTLINE.BASE_URL}/drafts`,
    };
  } catch (error) {
    Logger.log("❌ submitIntroductionPost lỗi: " + error.toString());
    return { ok: false, error: error.message || error.toString() };
  }
}
