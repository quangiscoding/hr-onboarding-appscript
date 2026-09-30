/** ==========================================
 * LOGGER.JS - GHI LOG WORKFLOW VÀO TAB BẢNG TÍNH
 * ==========================================
 * Mỗi luồng có 1 tab log riêng, cấu hình tập trung trong CONFIG.LOG.
 * Ghi log là side-effect: luôn fail-safe (không làm crash workflow).
 */

/**
 * Lấy tab log theo tên. Nếu chưa có thì TỰ ĐỘNG TẠO MỚI + format header.
 */
function getOrCreateLogSheet(sheetName, headers) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
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

/**
 * Generic writer: append 1 bản ghi vào tab log.
 * @param {Object} config - Phần tử của CONFIG.LOG (SHEET_NAME, HEADERS)
 * @param {Array} values - Mảng giá trị, thứ tự khớp HEADERS
 */
function appendWorkflowLog(config, values) {
  try {
    const sheet = getOrCreateLogSheet(config.SHEET_NAME, config.HEADERS);
    sheet.appendRow([new Date(), ...values]);
  } catch (error) {
    Logger.log(
      `❌ Lỗi ghi log vào tab "${config.SHEET_NAME}": ` + error.message,
    );
  }
}

/**
 * Ghi log luồng Internal (Offer Accepted -> DevOps, HR, IT)
 * @param {Object} data
 * @param {Array<{type: string, id: string}>} drafts
 */
function logInternalWorkflow(data, drafts) {
  drafts.forEach((draft) => {
    appendWorkflowLog(CONFIG.LOG.INTERNAL, [
      data.fullName,
      toTitleCase(data.position),
      draft.type,
      draft.id,
      "DRAFT_CREATED",
    ]);
  });
}

/**
 * Ghi log luồng TA Notification (gửi trực tiếp)
 */
function logTaNotificationWorkflow(data, sentTo) {
  appendWorkflowLog(CONFIG.LOG.TA_NOTIFICATION, [
    data.fullName,
    toTitleCase(data.position),
    data.allocCode,
    sentTo,
    "EMAIL_SENT",
  ]);
}

/**
 * Ghi log luồng Candidate Welcome Draft
 */
function logCandidateWorkflow(data, draftId) {
  appendWorkflowLog(CONFIG.LOG.CANDIDATE, [
    data.fullName,
    toTitleCase(data.position),
    data.allocCode,
    draftId,
    "DRAFT_CREATED",
  ]);
}
