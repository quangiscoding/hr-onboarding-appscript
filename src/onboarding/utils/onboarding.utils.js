/**
 * ONBOARDING/UTILS/ONBOARDING.UTIL.JS - Bộ tiện ích xử lý dữ liệu Onboarding
 */
class OnboardingUtil {
  /**
   * 1. Lấy dữ liệu dòng thô và map cột (hỗ trợ cả Single-row lẫn Batch RAM)
   * @private
   */
  static extractRowContext_(targetRow, cachedContext) {
    if (cachedContext && cachedContext.colMap && cachedContext.allRowsData) {
      return {
        rowIndex: targetRow,
        colMap: cachedContext.colMap,
        rowValues: cachedContext.allRowsData[targetRow - 1] || [],
        sheetUrl: cachedContext.sheetUrl || "",
        sheetId: cachedContext.sheetId || "",
        currentUserEmail: cachedContext.currentUserEmail || "",
      };
    }

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getActiveSheet();
    const activeRange = sheet.getActiveRange();
    const rowIndex = targetRow || (activeRange ? activeRange.getRow() : null);

    if (!rowIndex) {
      throw new WorkflowError(
        "NO_ROW_SELECTED",
        "Vui lòng chọn một ô/dòng trên bảng tính!",
      );
    }
    if (rowIndex < 2) {
      throw new WorkflowError(
        "INVALID_ROW",
        "Vui lòng chọn dòng chứa dữ liệu nhân sự (không chọn dòng tiêu đề)!",
      );
    }

    const lastCol = sheet.getLastColumn();
    return {
      rowIndex,
      colMap: getHeaderColumnMap(sheet),
      rowValues: sheet.getRange(rowIndex, 1, 1, lastCol).getValues()[0],
      sheetUrl: ss.getUrl(),
      sheetId: sheet.getSheetId(),
      currentUserEmail: Session.getEffectiveUser().getEmail(),
    };
  }

  /**
   * 2. Chuẩn hóa Họ Tên thành dạng 'Tên Họ' (Display Name cho PDF & Email)
   * @param {string} rawFullName - Họ tên gốc từ sheet
   * @returns {{ rawFullName: string, accentlessName: string, formattedName: string }}
   */
  static formatCandidateName(rawFullName) {
    const raw = toTitleCase(rawFullName);
    const accentless = removeAccents(raw);
    const parts = accentless.split(" ").filter(Boolean);

    let formatted = "Candidate";
    if (parts.length >= 2) {
      const firstName = parts[parts.length - 1];
      const lastName = parts[0];
      formatted = toTitleCase(`${firstName} ${lastName}`);
    } else if (parts.length === 1) {
      formatted = toTitleCase(parts[0]);
    }

    return {
      rawFullName: raw,
      accentlessName: accentless,
      formattedName: formatted,
    };
  }

  /**
   * 3. Sinh link trỏ thẳng tới dòng trên Sheet
   * @param {string} sheetUrl
   * @param {string|number} sheetId
   * @param {number} rowIndex
   * @returns {string} URL dẫn trực tiếp đến row
   */
  static buildRowDirectLink(sheetUrl, sheetId, rowIndex) {
    if (!sheetUrl) return "";
    return `${sheetUrl}#gid=${sheetId}&range=${rowIndex}:${rowIndex}`;
  }

  /**
   * 4. Tạo tên file PDF đính kèm onboarding
   * @param {string} formattedName - Tên hiển thị (ví dụ: 'An Nguyen')
   * @returns {string} Ví dụ: 'An Nguyen_Essential Onboarding Steps.pdf'
   */
  static buildGuidePdfFilename(formattedName) {
    return `${formattedName || "Candidate"}_Essential Onboarding Steps.pdf`;
  }

  /**
   * 5. Hàm điều phối chính: Đọc và ráp JSON payload hoàn chỉnh
   * @param {string} [triggerType="MANUAL_TEST"]
   * @param {number} [targetRow=null]
   * @param {Object} [cachedContext=null]
   * @returns {Object} Payload nhân sự chuẩn hóa
   */
  static getNormalizedInput(
    triggerType = "MANUAL_TEST",
    targetRow = null,
    cachedContext = null,
  ) {
    // 1. Trích xuất ngữ cảnh dòng
    const ctx = OnboardingUtil.extractRowContext_(targetRow, cachedContext);

    // 2. Map giá trị ô theo header
    const rowData = {};
    Object.keys(ctx.colMap).forEach((key) => {
      rowData[key] = ctx.rowValues[ctx.colMap[key] - 1];
    });

    // 3. Xử lý tên & thông tin liên hệ
    const nameInfo = OnboardingUtil.formatCandidateName(
      rowData[COLS.FULL_NAME],
    );
    const allocCode = clean(rowData[COLS.ALLOC_CODE]);
    const workingEmail = formatKyanonEmail(allocCode);
    const okrFolderUrl = clean(rowData[COLS.LINK_FOLDER_OKRS]);

    // 4. Trả về đúng 100% key payload cũ
    return {
      triggerType: triggerType,
      rowNumber: ctx.rowIndex,
      rowLink: OnboardingUtil.buildRowDirectLink(
        ctx.sheetUrl,
        ctx.sheetId,
        ctx.rowIndex,
      ),
      status: clean(rowData[COLS.OFFER_STATUS]),
      employmentType: clean(rowData[COLS.EMPLOYMENT_TYPE]),
      onboardingType: clean(rowData[COLS.ONBOARDING_TYPE]),
      deviceRequest: clean(rowData[COLS.DEVICE_REQUEST]),
      fullName: nameInfo.rawFullName,
      accentlessFullName: nameInfo.accentlessName,
      formattedName: nameInfo.formattedName,
      customFileName: OnboardingUtil.buildGuidePdfFilename(
        nameInfo.formattedName,
      ),
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
      currentUserEmail: ctx.currentUserEmail,
    };
  }
}

/* Alias tương thích ngược cho code cũ */
const getNormalizedInput = OnboardingUtil.getNormalizedInput;

function testOnboardingUtil() {
  // Chọn sẵn 1 ô bất kỳ ở dòng 3 trên Sheet trước khi bấm Run
  const res = OnboardingUtil.getNormalizedInput("MANUAL_TEST", 3);
  Logger.log("✅ Kết quả format name: " + res.formattedName);
  Logger.log("✅ File PDF: " + res.customFileName);
  Logger.log("✅ Link dòng: " + res.rowLink);
}
