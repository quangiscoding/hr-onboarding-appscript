/** ==========================================
 * WORKFLOWS.JS - CÁC LUỒNG EMAIL (BUSINESS LOGIC)
 * ==========================================
 * Mỗi hàm handle*Workflow(data) thực hiện 1 luồng nghiệp vụ và
 * RETURN kết quả thuần — KHÔNG gọi SpreadsheetApp.getUi().
 *
 * Contract chung của mọi handler:
 * - Thành công: ghi log thành công + return { ok: true, message: string, ...dữ liệu chi tiết }
 * - Thất bại nghiệp vụ: ghi log thất bại + throw WorkflowError(code, userMessage, details)
 * - Lỗi hệ thống khác: ghi log thất bại + throw bình thường
 */

/* ------------------------------------------------------------------ */
/* PRIVATE HELPERS                                                    */
/* ------------------------------------------------------------------ */

/**
 * Gửi 1 email TRỰC TIẾP qua GmailApp.
 * @param {string} to
 * @param {Object} mail - { subject, htmlBody }
 * @param {string} [cc] - Danh sách CC cách nhau bởi dấu phẩy
 */
function sendDirectEmail_(to, mail, cc) {
  GmailApp.sendEmail(to, mail.subject, "", {
    htmlBody: mail.htmlBody,
    cc: cc || "",
  });
}

/* ------------------------------------------------------------------ */
/* LUỒNG 1: OFFER ACCEPTED -> GỬI THẲNG CHO DEVOPS / HR / IT           */
/* ------------------------------------------------------------------ */

/**
 * Gửi Email TRỰC TIẾP cho các Phòng ban (DevOps, HR, IT) — không tạo draft.
 * @param {Object} data - Dữ liệu ứng viên đã chuẩn hóa
 * @returns {{ ok: true, message: string, sent: Array<{type: string, to: string}> }}
 * @throws {WorkflowError} SEND_FAILED khi gửi bất kỳ email nào thất bại
 */
function handleOfferAcceptedWorkflow(data) {
  const sentEmails = [];
  try {
    // Đọc recipients động từ sheet Data (Role | Send to | CC)
    const devopsRecipients = getRecipientsByRole(CONFIG.RECIPIENT_ROLES.DEVOPS);
    const hrRecipients = getRecipientsByRole(CONFIG.RECIPIENT_ROLES.HR);
    const itRecipients = getRecipientsByRole(CONFIG.RECIPIENT_ROLES.IT);

    // Helper gửi 1 email, nếu lỗi thì log thất bại rồi ném WorkflowError
    const sendTo = (type, recipients, mail) => {
      const to = (recipients?.to || []).join(",");
      const cc = (recipients?.cc || []).join(",");
      try {
        sendDirectEmail_(to, mail, cc);
        sentEmails.push({ type, to });
      } catch (error) {
        Logger.log(`❌ Lỗi khi gửi email ${type}: ` + error.toString());
        const errorMsg = `Lỗi gửi email ${type} tới (${to}): ${error.message}`;
        // Ghi log trạng thái FAILED kèm chi tiết lỗi
        logInternalWorkflow(data, sentEmails, "FAILED", errorMsg);
        throw new WorkflowError(
          "SEND_FAILED",
          `Không thể gửi email ${type} tới ${to}. Các email sau đó đã bị dừng.`,
          { originalError: error.message, type },
        );
      }
    };

    // 1. Gửi thẳng DevOps
    sendTo("DevOps", devopsRecipients, getDevOpsEmailTemplate(data));

    // 2. Gửi thẳng HR (Role "OKR" trong sheet Data)
    sendTo("HR", hrRecipients, getHREmailTemplate(data));

    // 3. Gửi thẳng IT - chỉ khi Device Request là "as company standard"
    if (isStandardDevice(data.deviceRequest)) {
      sendTo("IT", itRecipients, getITEmailTemplate(data));
    }

    // 4. Ghi log THÀNH CÔNG
    logInternalWorkflow(data, sentEmails, "EMAIL_SENT", "");

    // 5. Trả kết quả cho tầng hiển thị
    return {
      ok: true,
      message: `Đã gửi thành công ${sentEmails.length} email nhắc việc cho ${data.fullName}!\n\nNgười nhận: ${sentEmails.map((e) => e.type).join(", ")}`,
      sent: sentEmails,
    };
  } catch (error) {
    // Nếu lỗi xảy ra ngoài hàm sendTo (ví dụ: đọc recipients hay render template thất bại)
    if (!(error instanceof WorkflowError)) {
      Logger.log(
        "❌ Lỗi hệ thống trong handleOfferAcceptedWorkflow: " +
          error.toString(),
      );
      logInternalWorkflow(data, sentEmails, "FAILED", error.message);
    }
    throw error;
  }
}

/* ------------------------------------------------------------------ */
/* LUỒNG 2: GỬI NOTIFICATION TRỰC TIẾP CHO TA IN CHARGE                */
/* ------------------------------------------------------------------ */

/**
 * Gửi Email Notification TRỰC TIẾP cho TA In Charge (không tạo Draft)
 * @param {Object} data - Dữ liệu ứng viên đã chuẩn hóa
 * @returns {{ ok: true, message: string, sentTo: string }}
 * @throws {WorkflowError} MISSING_TA_EMAIL khi thiếu TA, SEND_FAILED khi GmailApp lỗi
 */
function handleTaNotificationWorkflow(data) {
  // 1. Kiểm tra TA Email hợp lệ trước khi gửi
  if (!data.taEmail) {
    const errorMsg = "Không tìm thấy email của TA In Charge.";
    logTaNotificationWorkflow(data, "N/A", "FAILED", errorMsg);
    throw new WorkflowError("MISSING_TA_EMAIL", errorMsg);
  }

  // 2. Gửi Email trực tiếp, bọc try...catch
  try {
    const taMail = getTaNotificationEmailTemplate(data);
    GmailApp.sendEmail(data.taEmail, taMail.subject, "", {
      htmlBody: taMail.htmlBody,
    });

    // 3. Ghi log THÀNH CÔNG
    logTaNotificationWorkflow(data, data.taEmail, "EMAIL_SENT", "");

    // 4. Trả kết quả cho tầng hiển thị
    return {
      ok: true,
      message: `Đã gửi Notification Email trực tiếp cho TA (${data.taEmail}) về nhân sự ${data.fullName}!`,
      sentTo: data.taEmail,
    };
  } catch (error) {
    Logger.log("❌ Lỗi khi gửi Notification Email cho TA: " + error.toString());
    const errorMsg = `Không thể gửi Notification Email: ${error.message}`;
    // Ghi log THẤT BẠI
    logTaNotificationWorkflow(data, data.taEmail, "FAILED", errorMsg);
    throw new WorkflowError(
      "SEND_FAILED",
      `Không thể gửi Notification Email tới ${data.taEmail}. Vui lòng kiểm tra lại.`,
      { originalError: error.message, taEmail: data.taEmail },
    );
  }
}

/* ------------------------------------------------------------------ */
/* LUỒNG 3: WELCOME EMAIL CHO NHÂN SỰ MỚI (KÈM PDF)                    */
/* ------------------------------------------------------------------ */

/**
 * Tạo Draft Welcome Email cho Nhân sự mới kèm File PDF
 * @param {Object} data - Dữ liệu ứng viên đã chuẩn hóa
 * @returns {{ ok: true, message: string, draftId: string, hasAttachment: boolean }}
 */
function handleWelcomeEmailWorkflow(data) {
  const recipientEmail = data.workingEmail || data.personalEmail;

  try {
    // 1. Lấy thông tin PDF & Blob đính kèm
    const pdfInfo = getGuidePdfFileInfo(
      data.employmentType,
      data.onboardingType,
      data.customFileName,
    );

    // URL xem trước PDF cho nút bấm trong Email
    const guidePreviewUrl = pdfInfo?.fileId
      ? `https://drive.google.com/file/d/${pdfInfo.fileId}/view`
      : "";

    const candidateMail = getWelcomeCandidateEmailTemplate(
      data,
      guidePreviewUrl,
    );

    // 2. Danh sách file đính kèm
    const emailAttachments = [];
    if (pdfInfo && pdfInfo.pdfBlob) {
      emailAttachments.push(pdfInfo.pdfBlob);
    } else {
      Logger.log(
        "⚠️ Cảnh báo: Không tìm thấy file PDF đính kèm cho Welcome Email!",
      );
    }

    // 3. Danh sách CC (TA in charge, People Team - đọc động từ sheet Data)
    const peopleTeamRecipients = getRecipientsByRole(
      CONFIG.RECIPIENT_ROLES.PEOPLE_TEAM,
    );
    const ccList = [
      data.taEmail,
      ...(peopleTeamRecipients?.to || []),
      ...(peopleTeamRecipients?.cc || []),
    ]
      .filter(Boolean)
      .join(",");

    // 4. Tạo Draft (ưu tiên Working Email, fallback Personal Email)
    const candidateDraft = GmailApp.createDraft(
      recipientEmail,
      candidateMail.subject,
      "",
      {
        htmlBody: candidateMail.htmlBody,
        cc: ccList,
        attachments: emailAttachments,
      },
    );

    const draftId = candidateDraft.getId();

    // 5. Ghi log THÀNH CÔNG
    logCandidateWorkflow(data, draftId, "DRAFT_CREATED", "");

    // 6. Trả kết quả cho tầng hiển thị
    return {
      ok: true,
      message: `Đã tạo bản nháp Welcome Email kèm File PDF cho ${data.fullName}!`,
      draftId: draftId,
      hasAttachment: emailAttachments.length > 0,
    };
  } catch (error) {
    Logger.log("❌ Lỗi khi tạo Welcome Draft: " + error.toString());
    const errorMsg = `Lỗi tạo bản nháp (${recipientEmail || "N/A"}): ${error.message}`;
    // Ghi log THẤT BẠI
    logCandidateWorkflow(data, "N/A", "FAILED", errorMsg);
    throw new WorkflowError(
      "DRAFT_FAILED",
      `Không thể tạo Welcome Draft cho ${data.fullName}: ${error.message}`,
      { originalError: error.message },
    );
  }
}

/* ------------------------------------------------------------------ */
/* LUỒNG 4: NHỜ CẬP NHẬT AVATAR CHO IT OPS (UC06)                     */
/* ------------------------------------------------------------------ */
/**
 * Business Logic cho luồng AVATAR_UPDATE (Detailed Popup Output & TA Email)
 */
function handleAvatarUpdateWorkflow() {
  const SPREADSHEET_UC06_ID = CONFIG.SPREADSHEET_UC06_ID;
  const TRIGGER_TYPE = "AVATAR_UPDATE";

  // 1. Lấy Alloc Code người dùng thao tác
  const currentUserEmail = Session.getActiveUser()
    .getEmail()
    .toLowerCase()
    .trim();
  const currentAllocCode = currentUserEmail.split("@")[0].trim();

  // =========================================================================
  // 2. TRA CỨU FILE UC06, CHECK TỈ LỆ & CHỈ GHI VÀO CỘT G (TRÁNH GÃY QUERY A1)
  // =========================================================================
  let avatarMap = {};
  let uc06SheetUrl = "";

  try {
    const uc06Ss = SpreadsheetApp.openById(SPREADSHEET_UC06_ID);
    const uc06Sheet = uc06Ss.getSheets()[0];
    uc06SheetUrl = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_UC06_ID}/edit#gid=${uc06Sheet.getSheetId()}`;

    const lastRowUC06 = uc06Sheet.getLastRow();
    const lastColUC06 = uc06Sheet.getLastColumn();

    if (lastRowUC06 > 1 && lastColUC06 > 0) {
      const uc06ColMap = getHeaderColumnMap(uc06Sheet);
      const emailColNumber = uc06ColMap[normalizeHeaderKey("Email Address")];
      const pictureColNumber = uc06ColMap[normalizeHeaderKey("Picture")]; // Cột F
      const checkColNumber = uc06ColMap[normalizeHeaderKey("Check 1:1")]; // Cột G

      // Hỗ trợ tìm cột H linh hoạt
      const squareImgColNumber =
        uc06ColMap[normalizeHeaderKey("Ảnh 1:1")] ||
        uc06ColMap[normalizeHeaderKey("Anh 1:1")] ||
        uc06ColMap[normalizeHeaderKey("Picture 1:1")] ||
        (checkColNumber ? checkColNumber + 1 : null); // Fallback: cột ngay sau Check 1:1

      if (emailColNumber && pictureColNumber) {
        const emailColIdx = emailColNumber - 1;
        const pictureColIdx = pictureColNumber - 1;
        const squareImgColIdx = squareImgColNumber
          ? squareImgColNumber - 1
          : -1;

        const pictureColLetter = getColumnLetterFromIndex(pictureColNumber);
        const squareColLetter = squareImgColNumber
          ? getColumnLetterFromIndex(squareImgColNumber)
          : pictureColLetter;

        // Đọc toàn bộ bảng tính hiện có về RAM 1 lần duy nhất
        const uc06Data = uc06Sheet
          .getRange(2, 1, lastRowUC06 - 1, lastColUC06)
          .getValues();

        // Mảng 2 chiều CHỈ ghi riêng vào Cột G (Check 1:1)
        const checkColumnOutputs = [];
        let hasChanges = false;

        for (let i = 0; i < uc06Data.length; i++) {
          const row = uc06Data[i];
          const rawEmail = row[emailColIdx];
          const currentCheckVal = checkColNumber
            ? String(row[checkColNumber - 1] || "")
            : "";

          if (!rawEmail) {
            checkColumnOutputs.push([currentCheckVal]);
            continue;
          }

          const personalEmail = String(rawEmail).trim().toLowerCase();
          const pictureUrl = String(row[pictureColIdx] || "").trim();
          const squareBackupUrl =
            squareImgColIdx >= 0
              ? String(row[squareImgColIdx] || "").trim()
              : "";
          const uc06RowNumber = i + 2;

          let isSquare = false;
          let dimensions = null;
          let newCheckVal = currentCheckVal;

          // Kiểm tra ảnh gốc ở cột Picture (F)
          if (pictureUrl) {
            const fileId = extractDriveFileId_(pictureUrl);
            if (fileId) {
              dimensions = getImageDimensionsFromDriveId_(fileId);
              if (dimensions) {
                isSquare = dimensions.isSquare;
                newCheckVal = isSquare
                  ? "1:1"
                  : `${dimensions.width}x${dimensions.height}`;
              }
            }
          } else {
            newCheckVal = "";
          }

          if (newCheckVal !== currentCheckVal) {
            hasChanges = true;
          }
          checkColumnOutputs.push([newCheckVal]);

          if (personalEmail) {
            avatarMap[personalEmail] = {
              pictureUrl: pictureUrl,
              squareBackupUrl: squareBackupUrl,
              uc06RowNumber: uc06RowNumber,
              // Link mở ô ảnh gốc (cột F)
              uc06RowLink: `${uc06SheetUrl}&range=${pictureColLetter}${uc06RowNumber}`,
              // Link mở ô ảnh 1:1 (cột H)
              uc06SquareLink: `${uc06SheetUrl}&range=${squareColLetter}${uc06RowNumber}`,
              isSquare: isSquare,
              dimensions: dimensions,
            };
          }
        }

        // CHỈ GHI ĐÚNG CỘT G (bảo toàn công thức QUERY ô A1 và cột H nhập tay)
        if (hasChanges && checkColNumber) {
          uc06Sheet
            .getRange(2, checkColNumber, checkColumnOutputs.length, 1)
            .setValues(checkColumnOutputs);
        }
      }
    }
  } catch (e) {
    Logger.log("⚠️ Lỗi tra cứu và ghi nhận Avatar UC06: " + e.message);
  }

  // =========================================================================
  // 3. ĐỌC BATCH TOÀN BỘ SHEET HERA & METADATA VỀ RAM (1 LẦN DUY NHẤT)
  // =========================================================================
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getActiveSheet();
  const sheetUrl = ss.getUrl();
  const rawLastRow = sheet.getLastRow();

  if (rawLastRow <= 1) return { message: "Sheet dữ liệu Hera hiện đang rỗng." };

  const heraColMap = getHeaderColumnMap(sheet);
  const heraAllRowsData = sheet
    .getRange(1, 1, rawLastRow, sheet.getLastColumn())
    .getValues();

  const cachedContext = {
    colMap: heraColMap,
    allRowsData: heraAllRowsData,
    sheetUrl: sheetUrl,
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
  } catch (errMeta) {
    Logger.log("⚠️ Không tải được Metadata theo lô: " + errMeta.message);
  }

  let actualLastRow = 1;
  for (let r = heraAllRowsData.length - 1; r >= 1; r--) {
    if (heraAllRowsData[r][1] && String(heraAllRowsData[r][1]).trim() !== "") {
      actualLastRow = r + 1;
      break;
    }
  }

  if (actualLastRow <= 1) {
    return { message: "Không tìm thấy dòng dữ liệu nhân sự hợp lệ nào." };
  }

  const scriptTimeZone = Session.getScriptTimeZone();
  const todayStr = Utilities.formatDate(
    new Date(),
    scriptTimeZone,
    "yyyy-MM-dd",
  );
  const todayDisplayStr = Utilities.formatDate(
    new Date(),
    scriptTimeZone,
    "dd/MM/yyyy",
  );

  const readyForDevOps = [];
  const missingForTA = [];
  const alreadyProcessed = [];

  // =========================================================================
  // 4. QUÉT MẢNG TRÊN RAM & PHÂN LOẠI NGHIỆP VỤ ẢNH 1:1
  // =========================================================================
  for (let r = actualLastRow; r >= 2; r--) {
    let candidateData;
    try {
      candidateData = getNormalizedInput(TRIGGER_TYPE, r, cachedContext);
    } catch (err) {
      continue;
    }
    if (!candidateData) continue;

    const {
      status,
      startDate,
      taEmail,
      fullName,
      personalEmail,
      workingEmail,
      rowNumber,
    } = candidateData;
    const targetLockEmail = personalEmail || workingEmail;
    if (!fullName || !personalEmail) continue;

    // Fast Check 1: Trạng thái On-boarded
    const rawStatus = String(status || "")
      .toLowerCase()
      .replace(/[-_ \t]/g, "");
    if (rawStatus !== "onboarded") continue;

    // Fast Check 2: Ngày Onboard hôm nay
    if (startDate !== todayDisplayStr && startDate !== todayStr) continue;

    // Fast Check 3: Trùng Alloc Code TA thao tác
    const taAllocCode = String(taEmail || "")
      .split("@")[0]
      .trim()
      .toLowerCase();
    if (taAllocCode !== currentAllocCode) continue;

    // Fast Check 4: Check Lock
    let isLocked = false;
    if (lockedKeysSet.size > 0) {
      const lockKey = `${TRIGGER_TYPE}_${rowNumber}_${targetLockEmail.toLowerCase()}`;
      isLocked = lockedKeysSet.has(lockKey);
    } else {
      isLocked = isRowLockedForWorkflow(
        rowNumber,
        TRIGGER_TYPE,
        targetLockEmail,
      );
    }

    if (isLocked) {
      alreadyProcessed.push(candidateData);
      continue;
    }

    // Tra cứu UC06 theo Email cá nhân trên RAM Map
    const cleanPersonalEmail = personalEmail.toLowerCase();
    const uc06Info = avatarMap[cleanPersonalEmail] || null;

    candidateData.avatarUrl = uc06Info ? uc06Info.pictureUrl : "";
    candidateData.squareBackupUrl = uc06Info ? uc06Info.squareBackupUrl : "";
    candidateData.uc06RowNumber = uc06Info ? uc06Info.uc06RowNumber : null;
    candidateData.uc06RowLink = uc06Info ? uc06Info.uc06RowLink : "";
    candidateData.uc06SquareLink = uc06Info ? uc06Info.uc06SquareLink : "";
    candidateData.isSquare = uc06Info ? uc06Info.isSquare : false;
    candidateData.dimensions = uc06Info ? uc06Info.dimensions : null;

    // --- PHÂN LOẠI NGHIỆP VỤ ---
    if (!candidateData.uc06RowNumber) {
      // 1. Chưa có dòng trên sheet UC06
      candidateData.issueReason = "NOT_IN_SHEET";
      missingForTA.push(candidateData);
    } else if (candidateData.avatarUrl && candidateData.isSquare) {
      // 2. Ảnh gốc ở cột F đã chuẩn 1:1 -> Gửi ảnh gốc
      candidateData.finalAvatarUrl = candidateData.avatarUrl;
      candidateData.finalAvatarCellLink = candidateData.uc06RowLink;
      candidateData.isFromSquareBackup = false;
      readyForDevOps.push(candidateData);
    } else if (candidateData.squareBackupUrl) {
      // 3. Ảnh gốc sai tỉ lệ, NHƯNG cột H (Ảnh 1:1) ĐÃ CÓ ẢNH -> Gửi ảnh ở cột H
      candidateData.finalAvatarUrl = candidateData.squareBackupUrl;
      candidateData.finalAvatarCellLink = candidateData.uc06SquareLink;
      candidateData.isFromSquareBackup = true;
      readyForDevOps.push(candidateData);
    } else if (!candidateData.avatarUrl) {
      // 4. Có dòng nhưng chưa có bất kỳ ảnh nào
      candidateData.issueReason = "EMPTY_IMAGE";
      missingForTA.push(candidateData);
    } else {
      // 5. Ảnh gốc sai tỉ lệ và cột H chưa có ảnh -> Nhắc TA bổ sung
      candidateData.issueReason = "INVALID_RATIO_MISSING_BACKUP";
      missingForTA.push(candidateData);
    }
  }

  // =========================================================================
  // 5. GỬI MAIL DEVOPS & KHÓA DÒNG (CHỈ GỬI CHO NHÂN SỰ ĐÃ CÓ ẢNH VUÔNG)
  // =========================================================================
  let summaryMsg = [];
  if (readyForDevOps.length > 0) {
    const devopsRecipients = getRecipientsByRole(CONFIG.RECIPIENT_ROLES.DEVOPS);
    const mailTemplate = getAvatarUpdateDigestTemplate(
      readyForDevOps,
      sheetUrl,
      todayDisplayStr,
    );
    const to = (devopsRecipients?.to || []).join(",");
    const cc = [(devopsRecipients?.cc || []).join(","), currentUserEmail]
      .filter(Boolean)
      .join(",");

    sendDirectEmail_(to, mailTemplate, cc);

    readyForDevOps.forEach((item) => {
      lockRowForWorkflow(
        item.rowNumber,
        TRIGGER_TYPE,
        item.personalEmail || item.workingEmail,
      );
      logInternalWorkflow(
        item,
        [{ type: "DevOps Avatar Update", to: to }],
        "EMAIL_SENT",
        "",
      );
    });

    summaryMsg.push(
      `✅ Đã gửi email nhắc DevOps cho ${readyForDevOps.length} nhân sự (đã khóa dòng).`,
    );
  }

  // =========================================================================
  // 6. HIỂN THỊ MODAL DIALOG TỔNG QUAN
  // =========================================================================
  const totalCount =
    readyForDevOps.length + missingForTA.length + alreadyProcessed.length;
  if (totalCount === 0) {
    throw new WorkflowError(
      "NO_CANDIDATES_FOUND",
      `Không tìm thấy nhân sự onboard hôm nay (${todayDisplayStr}) thuộc quản lý của bạn (${currentAllocCode}).\nHãy kiểm tra và đảm bảo cột Offer Status đang ở trạng thái On-boarded.`,
    );
  }

  const dialogTemplate = HtmlService.createTemplateFromFile(
    "onboarding/dialog-templates/ta-reminder-dialog",
  );
  dialogTemplate.readyForDevOps = readyForDevOps;
  dialogTemplate.missingForTA = missingForTA;
  dialogTemplate.alreadyProcessed = alreadyProcessed;
  dialogTemplate.uc06Url = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_UC06_ID}/edit`;

  const htmlOutput = dialogTemplate.evaluate().setWidth(740).setHeight(480);

  let dialogTitle = `📋 Báo cáo Avatar Onboard (${todayDisplayStr})`;
  if (missingForTA.length > 0) {
    dialogTitle = `⚠️ Cần xử lý Avatar cho ${missingForTA.length} nhân sự`;
  } else if (readyForDevOps.length > 0) {
    dialogTitle = `🎉 Đã gửi cập nhật Avatar cho ${readyForDevOps.length} nhân sự`;
  }

  SpreadsheetApp.getUi().showModalDialog(htmlOutput, dialogTitle);

  return {
    ok: true,
    status: missingForTA.length > 0 ? "HAS_MISSING" : "SUCCESS",
    readyForDevOps: readyForDevOps,
    missingForTA: missingForTA,
    alreadyProcessed: alreadyProcessed,
    suppressPopup: true,
    message: summaryMsg.join("\n\n"),
  };
}
