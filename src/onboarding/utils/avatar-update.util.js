/**
 * src/onboarding/utils/avatar-update.util.js
 * Utility Pattern: Xử lý dữ liệu thuần và truy xuất RAM độc lập cho luồng Avatar Update
 */
class AvatarUpdateUtil {
  /** Map mô tả hành động chi tiết hiển thị trên Modal cho TA */
  static get ISSUE_MESSAGES() {
    return {
      MISSING_ALLOC_CODE: "Nhân sự chưa có Alloc Code / Working Email.",
      MISSING_PERSONAL_EMAIL: "Nhân sự chưa có Email cá nhân trên Sheet Hera.",
      MISSING_EMPLOYEE_CODE: "Nhân sự chưa có Mã nhân viên (Code) trên UC06.", // Thêm thông báo này
      NOT_IN_SHEET: "Nhân sự chưa được thêm vào sheet Employee Avatar.",
      EMPTY_IMAGE: "Nhân sự chưa có link ảnh trên UC06.",
      INVALID_RATIO_MISSING_BACKUP: "Ảnh của nhân sự chưa đúng tỉ lệ 1:1.",
    };
  }

  /** Phân tích thông tin ảnh và Mã NV từ 1 dòng dữ liệu của file UC06 */
  static parseRow(row, indices, sheetUrl, rowIndex) {
    const rawEmail = row[indices.email];
    if (!rawEmail) return null;

    // ĐỌC MÃ NHÂN VIÊN THEO INDEX CỘT ĐƯỢC MAP ĐỘNG TỪ HEADER
    const employeeCode = indices.code >= 0 ? String(row[indices.code] || "").trim() : "";
    const pictureUrl = String(row[indices.picture] || "").trim();
    const squareBackupUrl = indices.square >= 0 ? String(row[indices.square] || "").trim() : "";
    let isSquare = false;
    let dimensions = null;
    let checkVal = "";

    // Ưu tiên 1: Đã có link ảnh cắt 1:1 tại cột Ảnh 1:1
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
        employeeCode: employeeCode,
        pictureUrl: pictureUrl,
        squareBackupUrl: squareBackupUrl,
        uc06RowNumber: rowIndex,
        uc06RowLink: `${sheetUrl}&range=${indices.pictureColLetter}${rowIndex}`,
        uc06SquareLink: indices.squareColLetter ? `${sheetUrl}&range=${indices.squareColLetter}${rowIndex}` : "",
        isSquare: isSquare,
        dimensions: dimensions,
      },
    };
  }

  /** Phân loại 1 ứng viên cụ thể */
  static classifyCandidate(candidate, uc06Info) {
    // 1. Kiểm tra Email cá nhân
    const personalEmail = String(candidate.personalEmail || "").trim();
    if (!personalEmail) {
      candidate.issueReason = "MISSING_PERSONAL_EMAIL";
      candidate.issueMessage = this.ISSUE_MESSAGES.MISSING_PERSONAL_EMAIL;
      return "MISSING";
    }

    // 2. Kiểm tra Alloc Code
    const allocCode = String(candidate.allocCode || "").trim();
    if (!allocCode) {
      candidate.issueReason = "MISSING_ALLOC_CODE";
      candidate.issueMessage = this.ISSUE_MESSAGES.MISSING_ALLOC_CODE;
      return "MISSING";
    }

    // Gán dữ liệu đọc được từ UC06
    candidate.employeeCode = uc06Info ? String(uc06Info.employeeCode || "").trim() : "";

    Object.assign(candidate, {
      avatarUrl: uc06Info?.pictureUrl || "",
      squareBackupUrl: uc06Info?.squareBackupUrl || "",
      uc06RowNumber: uc06Info?.uc06RowNumber || null,
      uc06RowLink: uc06Info?.uc06RowLink || "",
      uc06SquareLink: uc06Info?.uc06SquareLink || "",
      isSquare: uc06Info?.isSquare || false,
      dimensions: uc06Info?.dimensions || null,
    });

    // 3. Chưa có trên sheet UC06
    if (!candidate.uc06RowNumber) {
      candidate.issueReason = "NOT_IN_SHEET";
      candidate.issueMessage = this.ISSUE_MESSAGES.NOT_IN_SHEET;
      return "MISSING";
    }

    // ⛔ 4. BẮT BUỘC CÓ MÃ NHÂN VIÊN (CODE) - NẾU THIẾU THÌ BÁO THẲNG LỖI MÃ NV
    if (!candidate.employeeCode) {
      candidate.issueReason = "MISSING_EMPLOYEE_CODE";
      candidate.issueMessage = this.ISSUE_MESSAGES.MISSING_EMPLOYEE_CODE;
      return "MISSING";
    }

    // 5. Kiểm tra ảnh crop 1:1
    if (candidate.squareBackupUrl) {
      candidate.finalAvatarUrl = candidate.squareBackupUrl;
      candidate.finalAvatarCellLink = candidate.uc06SquareLink;
      candidate.isFromSquareBackup = true;
      return "READY";
    }

    // 6. Kiểm tra ảnh gốc vuông
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
    const ss = SpreadsheetApp.openById(spreadsheetId);
    const sheet = ss.getSheetByName("Cập nhật Avatar") || ss.getSheets()[0];
    const lastRow = sheet.getLastRow();
    const lastCol = sheet.getLastColumn();
    if (lastRow <= 1 || lastCol <= 0) return avatarMap;

    // Dùng getHeaderColumnMap để map động tên cột với vị trí cột (1-indexed)
    const colMap = getHeaderColumnMap(sheet);

    // Map cột mã nhân viên linh hoạt: hỗ trợ các tên "Code", "Employee Code", "Mã NV", "Mã nhân viên"
    const codeCol = colMap[normalizeHeaderKey("Code")] || colMap[normalizeHeaderKey("Employee Code")] || colMap[normalizeHeaderKey("Mã NV")] || colMap[normalizeHeaderKey("Mã nhân viên")] || 1; // Fallback an toàn về cột 1 nếu header không tìm thấy

    const emailCol = colMap[normalizeHeaderKey("Email Address")];
    const pictureCol = colMap[normalizeHeaderKey("Picture")];
    const checkCol = colMap[normalizeHeaderKey("Check 1:1")];
    const squareCol = colMap[normalizeHeaderKey("Ảnh 1:1")];

    if (!emailCol || !pictureCol) return avatarMap;

    const indices = {
      code: codeCol - 1, // Chuyển từ 1-indexed của colMap sang 0-indexed của mảng row
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

  /** Quét và trích xuất danh sách nhân sự Onboard hôm nay của TA đang thao tác */
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

      if (!d || !d.fullName) continue;

      const isStatusOk =
        String(d.status || "")
          .toLowerCase()
          .replace(/[-_ \t]/g, "") === "onboarded";
      const isDateOk = d.startDate === todayDisplay || d.startDate === todayStr;
      const isTaOk =
        String(d.taEmail || "")
          .split("@")[0]
          .trim()
          .toLowerCase() === currentAllocCode;

      if (isStatusOk && isDateOk && isTaOk) {
        const targetEmail = d.personalEmail || d.workingEmail || `row_${d.rowNumber}@missing.local`;
        const lockKey = buildWorkflowLockKey_(triggerType, targetEmail);
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

  /**
   * Helper lấy hoặc tạo mới Folder con trên Drive
   * @private
   */
  static _getOrCreateDriveFolder(parentFolder, folderName) {
    const safeName = String(folderName || "Others").trim();
    const folders = parentFolder.getFoldersByName(safeName);
    if (folders.hasNext()) {
      return folders.next();
    }
    return parentFolder.createFolder(safeName);
  }

  /**
   * Tự động sao chép ảnh gốc 1:1 vào thư mục nhân sự và cập nhật link vào cột "Ảnh 1:1" trên UC06
   * Cấu trúc: Root -> Squad -> [<Code>] <FullName>
   */
  static autoBackupSquareAvatars(candidates, avatarMap, spreadsheetUc06Id) {
    if (!candidates || !candidates.length || !spreadsheetUc06Id) return;

    let ss,
      sheet,
      lastCol,
      headers,
      squareColIdx = -1;
    let rootFolder = null;

    candidates.forEach((c) => {
      const cleanEmail = String(c.personalEmail || c.workingEmail || "")
        .toLowerCase()
        .trim();
      const uc06 = cleanEmail ? avatarMap[cleanEmail] : null;

      // Điều kiện: Đã có ảnh gốc, ảnh gốc đạt chuẩn 1:1, nhưng chưa có link tại cột "Ảnh 1:1"
      if (uc06 && uc06.isSquare && !uc06.squareBackupUrl && uc06.pictureUrl && uc06.uc06RowNumber) {
        const driveId = extractDriveFileId_(uc06.pictureUrl);
        if (!driveId) return;

        try {
          // Lazy load sheet UC06 và Root folder khi phát sinh nhân sự cần sao chép
          if (!sheet) {
            ss = SpreadsheetApp.openById(spreadsheetUc06Id);
            sheet = ss.getSheetByName("Cập nhật Avatar") || ss.getSheets()[0];
            lastCol = sheet.getLastColumn();
            headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];

            // Tìm cột "Ảnh 1:1"
            headers.forEach((h, idx) => {
              const norm = normalizeHeaderKey(h);
              if (norm === "anh11" || norm === "nh11" || norm === normalizeHeaderKey("Ảnh 1:1")) {
                squareColIdx = idx + 1;
              }
            });

            if (squareColIdx === -1) {
              squareColIdx = lastCol + 1;
              sheet.getRange(1, squareColIdx).setValue("Ảnh 1:1");
            }

            const userFolderId = PropertiesService.getUserProperties().getProperty("AVATAR_STORAGE_FOLDER_ID");
            if (userFolderId) {
              try {
                rootFolder = DriveApp.getFolderById(userFolderId);
              } catch (e) {
                rootFolder = DriveApp.getRootFolder();
              }
            } else {
              rootFolder = DriveApp.getRootFolder();
            }
          }

          const sourceFile = DriveApp.getFileById(driveId);

          // Cây thư mục: Root -> Squad -> [<Code>] <FullName>
          const squadFolder = this._getOrCreateDriveFolder(rootFolder, c.squad || "Others");
          const empCode = uc06.employeeCode || c.allocCode || "";
          const folderTitle = empCode ? `[${empCode}] ${c.fullName}` : c.fullName;
          const targetFolder = this._getOrCreateDriveFolder(squadFolder, folderTitle);

          // Nhân bản file với tên chuẩn
          const cleanName = String(c.fullName || "Candidate")
            .replace(/[\\/:*?"<>|]/g, "")
            .trim();
          const fileName = empCode ? `[${empCode}] ${cleanName}_1x1.jpg` : `${cleanName}_1x1.jpg`;
          const copiedFile = sourceFile.makeCopy(fileName, targetFolder);

          try {
            copiedFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
          } catch (e) {}

          const copiedUrl = copiedFile.getUrl();

          // Ghi trực tiếp URL vào ô cột "Ảnh 1:1" trên UC06
          sheet.getRange(uc06.uc06RowNumber, squareColIdx).setValue(copiedUrl);

          // Cập nhật lại bộ nhớ RAM để classifyCandidate chuyển trạng thái thành READY ngay lập tức
          uc06.squareBackupUrl = copiedUrl;
          uc06.uc06SquareLink = `${sheet.getParent().getUrl()}#gid=${sheet.getSheetId()}&range=${getColumnLetterFromIndex(squareColIdx)}${uc06.uc06RowNumber}`;
        } catch (err) {
          Logger.log(`⚠️ Lỗi tự động sao chép ảnh 1:1 cho ${c.fullName}: ${err.message}`);
        }
      }
    });
  }
}
