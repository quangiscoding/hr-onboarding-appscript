/**
 * src/onboarding/utils/avatar-update.util.js
 * Utility Pattern: Xử lý dữ liệu thuần và truy xuất RAM độc lập cho luồng Avatar Update
 */
class AvatarUpdateUtil {
  /** Map mô tả hành động chi tiết hiển thị trên Modal cho TA */
  static get ISSUE_MESSAGES() {
    return {
      NOT_IN_SHEET: "Nhân sự chưa được thêm vào sheet Employee Avatar.",
      EMPTY_IMAGE: "Nhân sự chưa có link ảnh",
      INVALID_RATIO_MISSING_BACKUP: "Ảnh của nhân sự chưa đúng tỉ lệ 1:1",
    };
  }

  /** Phân tích thông tin ảnh từ 1 dòng dữ liệu của file UC06 */
  static parseRow(row, indices, sheetUrl, rowIndex) {
    const rawEmail = row[indices.email];
    if (!rawEmail) return null;

    const pictureUrl = String(row[indices.picture] || "").trim();
    const squareBackupUrl = indices.square >= 0 ? String(row[indices.square] || "").trim() : "";

    let isSquare = false;
    let dimensions = null;
    let checkVal = "";

    // Ưu tiên 1: Đã có link ảnh cắt 1:1 tại cột Ảnh 1:1 (Cột H)
    if (squareBackupUrl) {
      isSquare = true;
      checkVal = "1:1 (Đã crop)";
    }
    // Ưu tiên 2: Ảnh gốc tại cột Picture đã tự chuẩn 1:1
    else if (pictureUrl) {
      const fileId = extractDriveFileId_(pictureUrl);
      dimensions = fileId ? getImageDimensionsFromDriveId_(fileId) : null;
      if (dimensions) {
        isSquare = dimensions.isSquare;
        checkVal = isSquare ? "1:1" : `${dimensions.width}x${dimensions.height}`;
      }
    }

    return {
      email: String(rawEmail).trim().toLowerCase(),
      checkVal,
      data: {
        pictureUrl,
        squareBackupUrl,
        uc06RowNumber: rowIndex,
        uc06RowLink: `${sheetUrl}&range=${indices.pictureColLetter}${rowIndex}`,
        uc06SquareLink: indices.squareColLetter ? `${sheetUrl}&range=${indices.squareColLetter}${rowIndex}` : "",
        isSquare,
        dimensions,
      },
    };
  }

  /** Phân loại 1 ứng viên cụ thể */
  static classifyCandidate(candidate, uc06Info) {
    Object.assign(candidate, {
      avatarUrl: uc06Info?.pictureUrl || "",
      squareBackupUrl: uc06Info?.squareBackupUrl || "",
      uc06RowNumber: uc06Info?.uc06RowNumber || null,
      uc06RowLink: uc06Info?.uc06RowLink || "",
      uc06SquareLink: uc06Info?.uc06SquareLink || "",
      isSquare: uc06Info?.isSquare || false,
      dimensions: uc06Info?.dimensions || null,
    });

    if (!candidate.uc06RowNumber) {
      candidate.issueReason = "NOT_IN_SHEET";
      candidate.issueMessage = this.ISSUE_MESSAGES.NOT_IN_SHEET;
      return "MISSING";
    }

    // Đã có link ảnh crop 1:1
    if (candidate.squareBackupUrl) {
      candidate.finalAvatarUrl = candidate.squareBackupUrl;
      candidate.finalAvatarCellLink = candidate.uc06SquareLink;
      candidate.isFromSquareBackup = true;
      return "READY";
    }

    // Ảnh gốc đã đạt chuẩn vuông 1:1
    if (candidate.avatarUrl && candidate.isSquare) {
      candidate.finalAvatarUrl = candidate.avatarUrl;
      candidate.finalAvatarCellLink = candidate.uc06RowLink;
      candidate.isFromSquareBackup = false;
      return "READY";
    }

    candidate.issueReason = !candidate.avatarUrl ? "EMPTY_IMAGE" : "INVALID_RATIO_MISSING_BACKUP";
    candidate.issueMessage = this.ISSUE_MESSAGES[candidate.issueReason];
    return "MISSING";
  }

  /** Phân loại toàn bộ danh sách nhân sự thành 2 nhóm Ready và Missing */
  static partitionCandidates(candidates, avatarMap) {
    const ready = [];
    const missing = [];

    (candidates || []).forEach((c) => {
      const cleanEmail = String(c.personalEmail || c.workingEmail || "")
        .toLowerCase()
        .trim();
      const uc06 = cleanEmail ? avatarMap[cleanEmail] : null;

      if (this.classifyCandidate(c, uc06) === "READY") {
        ready.push(c);
      } else {
        missing.push(c);
      }
    });

    return { ready, missing };
  }

  /** Đọc file UC06 về RAM Map tra cứu O(1) và đồng bộ cột Check 1:1 */
  static loadMapAndSync(spreadsheetId) {
    const avatarMap = {};
    if (!spreadsheetId) return avatarMap;

    const sheet = SpreadsheetApp.openById(spreadsheetId).getSheets()[0];
    const lastRow = sheet.getLastRow();
    const lastCol = sheet.getLastColumn();
    if (lastRow <= 1 || lastCol <= 0) return avatarMap;

    const colMap = getHeaderColumnMap(sheet);
    const emailCol = colMap[normalizeHeaderKey("Email Address")];
    const pictureCol = colMap[normalizeHeaderKey("Picture")];
    const checkCol = colMap[normalizeHeaderKey("Check 1:1")];

    // Tìm cột Ảnh 1:1 an toàn qua nhiều biến thể
    const squareCol = colMap[normalizeHeaderKey("Ảnh 1:1")] || colMap[normalizeHeaderKey("Picture 1:1")] || colMap[normalizeHeaderKey("Anh 1:1")] || (checkCol ? checkCol + 1 : null);

    if (!emailCol || !pictureCol) return avatarMap;

    const indices = {
      email: emailCol - 1,
      picture: pictureCol - 1,
      square: squareCol ? squareCol - 1 : -1,
      pictureColLetter: getColumnLetterFromIndex(pictureCol),
      squareColLetter: squareCol ? getColumnLetterFromIndex(squareCol) : "",
    };

    const sheetUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit#gid=${sheet.getSheetId()}`;
    const rawData = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
    const checkOutputs = [];
    let hasChanges = false;

    rawData.forEach((row, i) => {
      const parsed = this.parseRow(row, indices, sheetUrl, i + 2);
      const currentCheck = checkCol ? String(row[checkCol - 1] || "") : "";
      const newCheck = parsed ? parsed.checkVal : "";

      if (newCheck !== currentCheck) hasChanges = true;
      checkOutputs.push([newCheck]);

      if (parsed) avatarMap[parsed.email] = parsed.data;
    });

    if (hasChanges && checkCol) {
      sheet.getRange(2, checkCol, checkOutputs.length, 1).setValues(checkOutputs);
    }

    return avatarMap;
  }

  /** Tải toàn bộ dữ liệu Sheet Hera và Developer Metadata vào RAM một lần duy nhất */
  static loadBatchContext() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getActiveSheet();
    const sheetUrl = ss.getUrl();
    const rawLastRow = sheet.getLastRow();

    if (rawLastRow <= 1) {
      return { isEmpty: true, message: "Sheet dữ liệu hiện đang rỗng." };
    }

    const colMap = getHeaderColumnMap(sheet);
    const allRowsData = sheet.getRange(1, 1, rawLastRow, sheet.getLastColumn()).getValues();

    const cachedContext = {
      colMap,
      allRowsData,
      sheetUrl,
      sheetId: sheet.getSheetId(),
      currentUserEmail: Session.getEffectiveUser().getEmail(),
    };

    const lockedKeysSet = new Set();
    try {
      const allMetadata = sheet.getDeveloperMetadata();
      allMetadata.forEach((meta) => {
        const key = meta.getKey();
        const val = meta.getValue();
        if (key) lockedKeysSet.add(key);
        if (val) lockedKeysSet.add(val);
      });
    } catch (err) {
      Logger.log("⚠️ Không tải được Metadata theo lô: " + err.message);
    }

    let actualLastRow = 1;
    for (let r = allRowsData.length - 1; r >= 1; r--) {
      if (allRowsData[r][1] && String(allRowsData[r][1]).trim() !== "") {
        actualLastRow = r + 1;
        break;
      }
    }

    return {
      isEmpty: actualLastRow <= 1,
      cachedContext,
      lockedKeysSet,
      actualLastRow,
      sheetUrl,
    };
  }

  /** Quét và trích xuất danh sách nhân sự Onboard hôm nay của TA đang thao tác (chạy thuần RAM) */
  static getTodayOnboardCandidates(currentAllocCode, triggerType) {
    const ctx = this.loadBatchContext();
    if (ctx.isEmpty) {
      return { candidates: [], sheetUrl: "", todayDisplay: "" };
    }

    const scriptTz = Session.getScriptTimeZone();
    const todayStr = Utilities.formatDate(new Date(), scriptTz, "yyyy-MM-dd");
    const todayDisplay = Utilities.formatDate(new Date(), scriptTz, "dd/MM/yyyy");
    const list = [];

    for (let r = ctx.actualLastRow; r >= 2; r--) {
      let d;
      try {
        d = this._extractCandidateRow(r, ctx.cachedContext, triggerType);
      } catch (e) {
        continue;
      }

      if (!d || !d.fullName || !d.personalEmail) continue;

      // 1. Trạng thái On-boarded
      const isStatusOk =
        String(d.status || "")
          .toLowerCase()
          .replace(/[-_ \t]/g, "") === "onboarded";

      // 2. Ngày Onboard là hôm nay
      const isDateOk = d.startDate === todayDisplay || d.startDate === todayStr;

      // 3. Đúng Alloc Code của TA
      const isTaOk =
        String(d.taEmail || "")
          .split("@")[0]
          .trim()
          .toLowerCase() === currentAllocCode;

      if (isStatusOk && isDateOk && isTaOk) {
        const targetEmail = d.personalEmail || d.workingEmail;
        const lockKey = `${triggerType}_${d.rowNumber}_${targetEmail.toLowerCase()}`;

        d.isLocked = ctx.lockedKeysSet.size > 0 ? ctx.lockedKeysSet.has(lockKey) : isRowLockedForWorkflow(d.rowNumber, triggerType, targetEmail);

        list.push(d);
      }
    }

    return { candidates: list, sheetUrl: ctx.sheetUrl, todayDisplay };
  }

  /**
   * Helper trích xuất 1 dòng ứng viên trực tiếp từ RAM Context
   * @private
   */
  static _extractCandidateRow(rowIndex, cachedContext, triggerType) {
    const colMap = cachedContext.colMap;
    const rowValues = cachedContext.allRowsData[rowIndex - 1] || [];

    const rowData = {};
    Object.keys(colMap).forEach((key) => {
      rowData[key] = rowValues[colMap[key] - 1];
    });

    const rawFullName = toTitleCase(rowData[COLS.FULL_NAME]);
    const allocCode = clean(rowData[COLS.ALLOC_CODE]);
    const workingEmail = formatKyanonEmail(allocCode);

    return {
      triggerType: triggerType,
      rowNumber: rowIndex,
      rowLink: `${cachedContext.sheetUrl}#gid=${cachedContext.sheetId}&range=${rowIndex}:${rowIndex}`,
      status: clean(rowData[COLS.OFFER_STATUS]),
      fullName: rawFullName,
      position: toTitleCase(rowData[COLS.TITLE]),
      squad: toTitleCase(rowData[COLS.SQUAD]),
      startDate: formatDateValue(rowData[COLS.DATE_ONBOARD]),
      personalEmail: clean(rowData[COLS.PERSONAL_EMAIL]),
      workingEmail: workingEmail,
      allocCode: allocCode,
      taEmail: formatKyanonEmail(rowData[COLS.TA_IN_CHARGE]),
    };
  }
}
