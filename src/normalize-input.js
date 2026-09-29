/** ==========================================
 * NORMALIZE-INPUT.JS - LOGIC CHÍNH & TRIGGER XỬ LÝ DỮ LIỆU
 * ========================================== */

/**
 * Lấy và chuẩn hóa (Normalize) dữ liệu của dòng trên Google Sheet.
 *
 * @param {string} [triggerType="MANUAL_TEST"] - Thuộc tính "OFFER_ACCEPTED", "WELCOME_EMAIL", "TA_NOTIFICATION"
 * @param {number} [targetRow=null] - Số dòng cụ thể cần lấy dữ liệu (Truyền từ Custom Menu)
 * @returns {Object} Đối tượng chứa toàn bộ dữ liệu nhân sự đã chuẩn hóa.
 */
function getNormalizedInput(triggerType = "MANUAL_TEST", targetRow = null) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();

  // 1. Xác định dòng cần lấy dữ liệu (Ưu tiên targetRow truyền vào từ Custom Menu)
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

  // 2. Đọc Headers (Dòng 1) và Data (Dòng chọn)
  const lastCol = sheet.getLastColumn();
  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  const rowValues = sheet.getRange(rowIndex, 1, 1, lastCol).getValues()[0];

  // Map Header Key chuẩn hóa với Giá trị ô
  const rowData = {};
  headers.forEach((header, index) => {
    if (header) {
      const safeKey = normalizeHeaderKey(header);
      rowData[safeKey] = rowValues[index];
    }
  });

  // 3. Chuẩn hóa Tên
  const rawFullName = toTitleCase(rowData[COLS.FULL_NAME]); // Giữ tên đầy đủ có dấu chuẩn "Trần Thị Tú Anh"
  const accentlessName = removeAccents(rawFullName);
  const parts = accentlessName.split(" ").filter(Boolean); // ["tran", "thi", "tu", "anh"]

  // Lấy "Tên Họ" không dấu viết hoa chữ cái đầu cho tên file (Ví dụ: "Anh Tran")
  let formattedName = "Candidate";
  if (parts.length >= 2) {
    const firstName = parts[parts.length - 1]; // "anh"
    const lastName = parts[0]; // "tran"
    formattedName = toTitleCase(`${firstName} ${lastName}`);
  } else if (parts.length === 1) {
    formattedName = toTitleCase(parts[0]);
  }

  // 4. Lấy Alloc Code & Working Email
  const allocCode = clean(rowData[COLS.ALLOC_CODE]);
  const workingEmail = formatKyanonEmail(allocCode);

  // 5. Trả về Kết Quả JSON Output
  return {
    triggerType: triggerType,
    rowNumber: rowIndex,
    rowLink: `${SpreadsheetApp.getActiveSpreadsheet().getUrl()}#gid=${sheet.getSheetId()}&range=${rowIndex}:${rowIndex}`,

    // Trạng thái & Chia nhánh Logic
    status: clean(rowData[COLS.OFFER_STATUS]),
    employmentType: clean(rowData[COLS.EMPLOYMENT_TYPE]),
    onboardingType: clean(rowData[COLS.ONBOARDING_TYPE]),
    deviceRequest: clean(rowData[COLS.DEVICE_REQUEST]),

    // Thông tin ứng viên
    fullName: rawFullName,
    accentlessFullName: accentlessName,
    formattedName: formattedName,
    customFileName: `${formattedName}_Essential Onboarding Steps.pdf`,
    position: toTitleCase(rowData[COLS.TITLE]),
    squad: toTitleCase(rowData[COLS.SQUAD]),
    level: clean(rowData[COLS.LEVEL]),
    startDate: formatDateValue(rowData[COLS.DATE_ONBOARD]),

    // Emails & Identifiers
    personalEmail: clean(rowData[COLS.PERSONAL_EMAIL]),
    workingEmail: workingEmail,
    allocCode: allocCode,

    // Emails liên quan
    taEmail: formatKyanonEmail(rowData[COLS.TA_IN_CHARGE]),
    managerEmail: formatKyanonEmail(rowData[COLS.LINE_MANAGER]),

    // Trạng thái cột checkbox gửi email cho TA
    sendTaNotification:
      String(rowData[COLS.SEND_TA_NOTIFICATION_EMAIL]) === "true",

    // Người thực thi
    currentUserEmail: Session.getEffectiveUser().getEmail(),
  };
}

/**
 * Lấy Trigger Type dựa trên ô/cột vừa bị chỉnh sửa trên Sheet
 * @param {Object} e - Event Object tự động truyền từ trigger onEdit(e)
 * @return {string|null} - Khóa "OFFER_ACCEPTED", "WELCOME_EMAIL" hoặc null
 */
function getTriggerType(e) {
  if (!e?.range || e.range.getRow() < 2) return null;

  const sheet = e.range.getSheet();
  const rowIndex = e.range.getRow();
  const colIndex = e.range.getColumn();

  const headerRange = sheet.getRange(1, 1, 1, sheet.getLastColumn());
  const headers = headerRange.getValues()[0].map(normalizeHeaderKey);

  const editedCol = headers[colIndex - 1];
  const newValue = clean(e.value);
  const oldValue = clean(e.oldValue);

  if (editedCol === COLS.OFFER_STATUS) {
    return newValue === "offer accepted" && oldValue !== "offer accepted"
      ? "OFFER_ACCEPTED"
      : null;
  }

  if (editedCol === COLS.SEND_WELCOME_EMAIL) {
    const isChecked = e.value === "TRUE" || e.value === true;
    if (isChecked) {
      const allocCodeCol = headers.indexOf(COLS.ALLOC_CODE) + 1;
      const allocCode =
        allocCodeCol > 0
          ? sheet.getRange(rowIndex, allocCodeCol).getValue()
          : null;

      if (!allocCode || String(allocCode).trim() === "") {
        SpreadsheetApp.getUi().alert(
          "⚠️ Thiếu Alloc Code!",
          "Vui lòng nhập Alloc Code cho ứng viên trước khi tích chọn gửi Welcome Email.",
          SpreadsheetApp.getUi().ButtonSet.OK,
        );
        e.range.setValue(false);
        return null;
      }
      return "WELCOME_EMAIL";
    }
  }

  if (editedCol === COLS.SEND_TA_NOTIFICATION_EMAIL) {
    const isChecked = e.value === "TRUE" || e.value === true;
    if (isChecked) {
      const taCol = headers.indexOf(COLS.TA_IN_CHARGE) + 1;
      const taEmail =
        taCol > 0 ? sheet.getRange(rowIndex, taCol).getValue() : null;

      if (!taEmail || String(taEmail).trim() === "") {
        SpreadsheetApp.getUi().alert(
          "⚠️ Thiếu TA In Charge!",
          "Vui lòng nhập TA In Charge cho ứng viên trước khi tích chọn gửi Notification Email.",
          SpreadsheetApp.getUi().ButtonSet.OK,
        );
        e.range.setValue(false);
        return null;
      }
      return "TA_NOTIFICATION";
    }
  }

  return null;
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
