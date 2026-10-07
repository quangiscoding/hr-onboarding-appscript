/** ==========================================
 * LOGGER.JS - GHI LOG WORKFLOW VÀO TAB BẢNG TÍNH
 * ========================================== */

function getOrCreateLogSheet(sheetName, headers) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) {
    Logger.log("❌ Không tìm thấy Active Spreadsheet.");
    return null;
  }

  let sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    if (headers && headers.length > 0) {
      sheet.appendRow(headers);
      sheet
        .getRange(1, 1, 1, headers.length)
        .setFontWeight("bold")
        .setBackground("#f3f3f3");
      sheet.setFrozenRows(1);
    }
  }
  return sheet;
}

function appendWorkflowLog(config, values) {
  try {
    if (!config || !config.SHEET_NAME) return;
    const sheet = getOrCreateLogSheet(config.SHEET_NAME, config.HEADERS);
    if (sheet) {
      sheet.appendRow([new Date(), ...values]);
    }
  } catch (error) {
    Logger.log(
      `❌ Lỗi ghi log vào tab "${config?.SHEET_NAME}": ` + error.message,
    );
  }
}

function safeTitleCase_(str) {
  if (!str) return "";
  return typeof toTitleCase === "function" ? toTitleCase(str) : String(str);
}

/**
 * Ghi log luồng Internal Email
 */
function logInternalWorkflow(
  data,
  sentEmails,
  status = "EMAIL_SENT",
  errorDetail = "",
) {
  if (!Array.isArray(sentEmails) || sentEmails.length === 0) {
    // Trường hợp chưa gửi được mail nào đã fail
    appendWorkflowLog(CONFIG.LOG.INTERNAL, [
      data?.fullName || "",
      safeTitleCase_(data?.position),
      "N/A",
      "N/A",
      status,
      errorDetail,
    ]);
    return;
  }

  sentEmails.forEach((sent) => {
    appendWorkflowLog(CONFIG.LOG.INTERNAL, [
      data?.fullName || "",
      safeTitleCase_(data?.position),
      sent.type || "",
      sent.to || "",
      status,
      errorDetail,
    ]);
  });
}

/**
 * Ghi log luồng TA Notification
 */
function logTaNotificationWorkflow(
  data,
  sentTo,
  status = "EMAIL_SENT",
  errorDetail = "",
) {
  appendWorkflowLog(CONFIG.LOG.TA_NOTIFICATION, [
    data?.fullName || "",
    safeTitleCase_(data?.position),
    data?.allocCode || "",
    sentTo || "",
    status,
    errorDetail,
  ]);
}

/**
 * Ghi log luồng Candidate Welcome Draft
 */
function logCandidateWorkflow(
  data,
  draftId,
  status = "DRAFT_CREATED",
  errorDetail = "",
) {
  appendWorkflowLog(CONFIG.LOG.CANDIDATE, [
    data?.fullName || "",
    safeTitleCase_(data?.position),
    data?.allocCode || "",
    draftId || "",
    status,
    errorDetail,
  ]);
}
