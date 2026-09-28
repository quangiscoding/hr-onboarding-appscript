/**
 * Lấy Tab theo tên. Nếu chưa có thì TỰ ĐỘNG TẠO MỚI + Tạo dòng Tiêu đề (Header)
 * @param {string} sheetName - Tên tab cần lấy/tạo
 * @param {Array<string>} headers - Danh sách tiêu đề cột nếu phải tạo tab mới
 */
function getOrCreateLogSheet(sheetName, headers) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(sheetName);

  // Nếu chưa có sheet thì tạo mới
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);

    // Tạo dòng Header và định dạng đậm
    if (headers && headers.length > 0) {
      sheet.appendRow(headers);
      sheet
        .getRange(1, 1, 1, headers.length)
        .setFontWeight("bold")
        .setBackground("#f3f3f3"); // Tô màu nền xám nhẹ cho đẹp
      sheet.setFrozenRows(1); // Khóa hàng tiêu đề lại
    }
  }

  return sheet;
}

/**
 * Ghi log Internal Draft (Tự động khởi tạo tab nếu thiếu)
 * Tiêu đề: Timestamp | Fullname | Position | Request Type | Draft ID | Status
 */
function logInternalWorkflow(data, drafts) {
  try {
    const headers = [
      "Timestamp",
      "Fullname",
      "Position",
      "Request Type",
      "Draft ID",
      "Status",
    ];
    const sheet = getOrCreateLogSheet("Internal Draft Log", headers);

    drafts.forEach((draft) => {
      sheet.appendRow([
        new Date(), // Timestamp
        data.fullName, // Fullname
        data.position, // Position
        draft.type, // Request Type (DevOps / HR / IT)
        draft.id, // Draft ID
        "DRAFT_CREATED", // Status
      ]);
    });
  } catch (error) {
    Logger.log("❌ Lỗi ghi Internal Log: " + error.message);
  }
}

/**
 * Ghi log Candidate Draft (Tự động khởi tạo tab nếu thiếu)
 * Tiêu đề: Timestamp | Fullname | Position | Alloc Code | Draft ID | Status
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
      data.position, // Position
      data.allocCode, // Alloc Code
      draftId, // Draft ID
      "DRAFT_CREATED", // Status
    ]);
  } catch (error) {
    Logger.log("❌ Lỗi ghi Candidate Log: " + error.message);
  }
}
