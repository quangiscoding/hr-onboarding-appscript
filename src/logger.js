/** ==========================================
 * LOGGER.JS - QUẢN LÝ TẠO & GHI LOG BẢNG TÍNH
 * ========================================== */

/**
 * Lấy Tab log theo tên. Nếu chưa có thì TỰ ĐỘNG TẠO MỚI + Format Header
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
 * Ghi log cho Luồng Internal (Offer Accepted -> gửi trực tiếp DevOps, HR, IT)
 * Cột: Timestamp | Fullname | Position | Request Type | Sent To | Status
 */
function logInternalWorkflow(data, sentEmails) {
  try {
    const headers = [
      "Timestamp",
      "Fullname",
      "Position",
      "Request Type",
      "Sent To",
      "Status",
    ];
    const sheet = getOrCreateLogSheet("Internal Email Log", headers);

    sentEmails.forEach((sent) => {
      sheet.appendRow([
        new Date(), // Timestamp
        data.fullName, // Fullname
        toTitleCase(data.position), // Position
        sent.type, // Request Type (DevOps / HR / IT)
        sent.to, // Sent To (email phòng ban)
        "EMAIL_SENT", // Status
      ]);
    });
  } catch (error) {
    Logger.log("❌ Lỗi ghi Internal Log: " + error.message);
  }
}

/**
 * Ghi log cho Luồng Gửi Notification Email Trực Tiếp cho TA In Charge
 * Cột: Timestamp | Fullname | Position | Alloc Code | Sent To | Status
 */
function logTaNotificationWorkflow(data, sentTo) {
  try {
    const headers = [
      "Timestamp",
      "Fullname",
      "Position",
      "Alloc Code",
      "Sent To",
      "Status",
    ];
    const sheet = getOrCreateLogSheet("TA Notification Log", headers);

    sheet.appendRow([
      new Date(), // Timestamp
      data.fullName, // Fullname
      toTitleCase(data.position), // Position
      data.allocCode, // Alloc Code
      sentTo, // Sent To (TA email)
      "EMAIL_SENT", // Status
    ]);
  } catch (error) {
    Logger.log("❌ Lỗi ghi TA Notification Log: " + error.message);
  }
}

/**
 * Ghi log cho Luồng Candidate Draft Welcome Email
 * Cột: Timestamp | Fullname | Position | Alloc Code | Draft ID | Status
 */
function logCandidateWorkflow(data, draftId) {
  try {
    const headers = [
      "Timestamp",
      "Fullname",
      "Position",
      "Alloc Code",
      "Draft ID",
      "Status",
    ];
    const sheet = getOrCreateLogSheet("Candidate Draft Log", headers);

    sheet.appendRow([
      new Date(), // Timestamp
      data.fullName, // Fullname
      toTitleCase(data.position), // Position
      data.allocCode, // Alloc Code
      draftId, // Draft ID
      "DRAFT_CREATED", // Status
    ]);
  } catch (error) {
    Logger.log("❌ Lỗi ghi Candidate Log: " + error.message);
  }
}
