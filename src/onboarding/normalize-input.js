/** ==========================================
 * NORMALIZE-INPUT.JS - ĐỌC & CHUẨN HÓA DỮ LIỆU NHÂN SỰ
 * ==========================================
 * Trách nhiệm duy nhất: biến 1 dòng dữ liệu trên Google Sheet
 * thành 1 JSON Payload chuẩn để các workflow sử dụng.
 */

/**
 * Lấy và chuẩn hóa (Normalize) dữ liệu của dòng trên Google Sheet.
 *
 * @param {string} [triggerType="MANUAL_TEST"] - "OFFER_ACCEPTED" | "WELCOME_EMAIL" | "TA_NOTIFICATION"
 * @param {number} [targetRow=null] - Số dòng cụ thể cần lấy dữ liệu (truyền từ Custom Menu)
 * @returns {Object} Đối tượng chứa toàn bộ dữ liệu nhân sự đã chuẩn hóa.
 */
function getNormalizedInput(
  triggerType = "MANUAL_TEST",
  targetRow = null,
  cachedContext = null,
) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();

  // 1. Xác định dòng cần lấy dữ liệu
  let rowIndex = targetRow;
  if (!rowIndex) {
    const activeRange = sheet.getActiveRange();
    if (!activeRange)
      throw new Error("Vui lòng chọn một ô/dòng trên bảng tính!");
    rowIndex = activeRange.getRow();
  }
  if (rowIndex < 2) {
    throw new Error(
      "Vui lòng chọn dòng chứa dữ liệu nhân sự (không chọn dòng tiêu đề)!",
    );
  }

  let colMap, rowValues;

  // 2. Phân nhánh: Lấy dữ liệu từ RAM (Batch) hoặc Đọc từ Sheet (Single Row)
  if (cachedContext && cachedContext.colMap && cachedContext.allRowsData) {
    colMap = cachedContext.colMap;
    // index trong mảng JS (0-based) tương ứng rowIndex - 1
    rowValues = cachedContext.allRowsData[rowIndex - 1] || [];
  } else {
    const lastCol = sheet.getLastColumn();
    rowValues = sheet.getRange(rowIndex, 1, 1, lastCol).getValues()[0];
    colMap = getHeaderColumnMap(sheet);
  }

  const rowData = {};
  Object.keys(colMap).forEach((key) => {
    rowData[key] = rowValues[colMap[key] - 1];
  });

  // 3. Chuẩn hóa Tên
  const rawFullName = toTitleCase(rowData[COLS.FULL_NAME]);
  const accentlessName = removeAccents(rawFullName);
  const parts = accentlessName.split(" ").filter(Boolean);

  let formattedName = "Candidate";
  if (parts.length >= 2) {
    const firstName = parts[parts.length - 1];
    const lastName = parts[0];
    formattedName = toTitleCase(`${firstName} ${lastName}`);
  } else if (parts.length === 1) {
    formattedName = toTitleCase(parts[0]);
  }

  // 4. Lấy Alloc Code & Working Email
  const allocCode = clean(rowData[COLS.ALLOC_CODE]);
  const workingEmail = formatKyanonEmail(allocCode);
  const okrFolderUrl = clean(rowData[COLS.LINK_FOLDER_OKRS]);

  // 5. Trả về Kết Quả JSON Output
  return {
    triggerType: triggerType,
    rowNumber: rowIndex,
    rowLink: `${SpreadsheetApp.getActiveSpreadsheet().getUrl()}#gid=${sheet.getSheetId()}&range=${rowIndex}:${rowIndex}`,
    status: clean(rowData[COLS.OFFER_STATUS]),
    employmentType: clean(rowData[COLS.EMPLOYMENT_TYPE]),
    onboardingType: clean(rowData[COLS.ONBOARDING_TYPE]),
    deviceRequest: clean(rowData[COLS.DEVICE_REQUEST]),
    fullName: rawFullName,
    accentlessFullName: accentlessName,
    formattedName: formattedName,
    customFileName: `${formattedName}_Essential Onboarding Steps.pdf`,
    position: toTitleCase(rowData[COLS.TITLE]),
    squad: toTitleCase(rowData[COLS.SQUAD]),
    level: clean(rowData[COLS.LEVEL]),
    startDate: formatDateValue(rowData[COLS.DATE_ONBOARD]),
    personalEmail: clean(rowData[COLS.PERSONAL_EMAIL]),
    workingEmail: workingEmail,
    allocCode: allocCode,
    okrFolderUrl: okrFolderUrl,
    taEmail: formatKyanonEmail(rowData[COLS.TA_IN_CHARGE]),
    managerEmail: formatKyanonEmail(rowData[COLS.LINE_MANAGER]),
    currentUserEmail: Session.getEffectiveUser().getEmail(),
  };
}

/**
 * Hàm TEST: Tự động chọn Sheet "New" và Dòng 3 để test
 */
function testNormalizeOutput() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("New");
  if (!sheet) {
    throw new Error("Không tìm thấy sheet tên là 'New'!");
  }
  sheet.setActiveRange(sheet.getRange(3, 1));
  const result = getNormalizedInput("MANUAL_TEST", 3);
  Logger.log(JSON.stringify(result, null, 2));
}
