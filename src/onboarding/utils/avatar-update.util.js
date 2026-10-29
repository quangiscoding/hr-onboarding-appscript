/**
 * ONBOARDING/UTILS/AVATAR-UPDATE.UTIL.JS
 */
class AvatarUpdateUtil {
  /** Phân tích thông tin ảnh từ 1 dòng UC06 */
  static parseRow(row, indices, sheetUrl, rowIndex) {
    const rawEmail = row[indices.email];
    if (!rawEmail) return null;

    const pictureUrl = String(row[indices.picture] || "").trim();
    const squareBackupUrl =
      indices.square >= 0 ? String(row[indices.square] || "").trim() : "";

    let isSquare = false;
    let dimensions = null;
    let checkVal = "";

    if (pictureUrl) {
      const fileId = extractDriveFileId_(pictureUrl);
      dimensions = fileId ? getImageDimensionsFromDriveId_(fileId) : null;
      if (dimensions) {
        isSquare = dimensions.isSquare;
        checkVal = isSquare
          ? "1:1"
          : `${dimensions.width}x${dimensions.height}`;
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
        uc06SquareLink: `${sheetUrl}&range=${indices.squareColLetter}${rowIndex}`,
        isSquare,
        dimensions,
      },
    };
  }

  /** Phân loại ứng viên (Strategy pattern gọn gàng) */
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
      return "MISSING";
    }
    if (candidate.avatarUrl && candidate.isSquare) {
      candidate.finalAvatarUrl = candidate.avatarUrl;
      candidate.finalAvatarCellLink = candidate.uc06RowLink;
      candidate.isFromSquareBackup = false;
      return "READY";
    }
    if (candidate.squareBackupUrl) {
      candidate.finalAvatarUrl = candidate.squareBackupUrl;
      candidate.finalAvatarCellLink = candidate.uc06SquareLink;
      candidate.isFromSquareBackup = true;
      return "READY";
    }

    candidate.issueReason = !candidate.avatarUrl
      ? "EMPTY_IMAGE"
      : "INVALID_RATIO_MISSING_BACKUP";
    return "MISSING";
  }

  /** Đọc file UC06 và đồng bộ Check 1:1 */
  static loadMapAndSync(spreadsheetId) {
    const avatarMap = {};
    if (!spreadsheetId) return avatarMap;

    const sheet = SpreadsheetApp.openById(spreadsheetId).getSheets()[0];
    const lastRow = sheet.getLastRow();
    if (lastRow <= 1) return avatarMap;

    const colMap = getHeaderColumnMap(sheet);
    const emailCol = colMap[normalizeHeaderKey("Email Address")];
    const pictureCol = colMap[normalizeHeaderKey("Picture")];
    const checkCol = colMap[normalizeHeaderKey("Check 1:1")];
    const squareCol =
      colMap[normalizeHeaderKey("Ảnh 1:1")] ||
      colMap[normalizeHeaderKey("Picture 1:1")] ||
      (checkCol ? checkCol + 1 : null);

    if (!emailCol || !pictureCol) return avatarMap;

    const indices = {
      email: emailCol - 1,
      picture: pictureCol - 1,
      square: squareCol ? squareCol - 1 : -1,
      pictureColLetter: getColumnLetterFromIndex(pictureCol),
      squareColLetter: squareCol
        ? getColumnLetterFromIndex(squareCol)
        : getColumnLetterFromIndex(pictureCol),
    };

    const sheetUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit#gid=${sheet.getSheetId()}`;
    const rawData = sheet
      .getRange(2, 1, lastRow - 1, sheet.getLastColumn())
      .getValues();
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
      sheet
        .getRange(2, checkCol, checkOutputs.length, 1)
        .setValues(checkOutputs);
    }
    return avatarMap;
  }
}
