/**
 * ONBOARDING/SERVICES/ONBOARDING.SERVICE.JS - Tầng Nghiệp vụ Onboarding
 */
class OnboardingService {
  static sendDirectEmail_(to, mail, cc) {
    GmailApp.sendEmail(to, mail.subject, "", {
      htmlBody: mail.htmlBody,
      cc: cc || "",
    });
  }

  /* --- LUỒNG 1: OFFER ACCEPTED --- */
  static handleOfferAccepted(data) {
    const sentEmails = [];
    const roles = ONBOARDING_CONFIG.RECIPIENT_ROLES;

    try {
      const devopsRecipients = getRecipientsByRole(roles.DEVOPS);
      const hrRecipients = getRecipientsByRole(roles.HR);
      const itRecipients = getRecipientsByRole(roles.IT);

      const sendTo = (type, recipients, mail) => {
        const to = (recipients?.to || []).join(",");
        const cc = (recipients?.cc || []).join(",");
        try {
          OnboardingService.sendDirectEmail_(to, mail, cc);
          sentEmails.push({ type, to });
        } catch (error) {
          Logger.log(`❌ Lỗi khi gửi email ${type}: ` + error.toString());
          const errorMsg = `Lỗi gửi email ${type} tới (${to}): ${error.message}`;
          logInternalWorkflow(data, sentEmails, "FAILED", errorMsg);
          throw new WorkflowError(
            "SEND_FAILED",
            `Không thể gửi email ${type} tới ${to}. Các email sau đó đã bị dừng.`,
            { originalError: error.message, type },
          );
        }
      };

      sendTo("DevOps", devopsRecipients, getDevOpsEmailTemplate(data));
      sendTo("HR", hrRecipients, getHREmailTemplate(data));

      if (isStandardDevice(data.deviceRequest)) {
        sendTo("IT", itRecipients, getITEmailTemplate(data));
      }

      logInternalWorkflow(data, sentEmails, "EMAIL_SENT", "");

      return {
        ok: true,
        message: `Đã gửi thành công ${sentEmails.length} email nhắc việc cho ${data.fullName}!\n\nNgười nhận: ${sentEmails.map((e) => e.type).join(", ")}`,
        sent: sentEmails,
      };
    } catch (error) {
      if (!(error instanceof WorkflowError)) {
        Logger.log(
          "❌ Lỗi hệ thống trong handleOfferAccepted: " + error.toString(),
        );
        logInternalWorkflow(data, sentEmails, "FAILED", error.message);
      }
      throw error;
    }
  }

  /* --- LUỒNG 2: TA NOTIFICATION --- */
  static handleTaNotification(data) {
    if (!data.taEmail) {
      const errorMsg = "Không tìm thấy email của TA In Charge.";
      logTaNotificationWorkflow(data, "N/A", "FAILED", errorMsg);
      throw new WorkflowError("MISSING_TA_EMAIL", errorMsg);
    }

    try {
      const taMail = getTaNotificationEmailTemplate(data);
      GmailApp.sendEmail(data.taEmail, taMail.subject, "", {
        htmlBody: taMail.htmlBody,
      });

      logTaNotificationWorkflow(data, data.taEmail, "EMAIL_SENT", "");

      return {
        ok: true,
        message: `Đã gửi Notification Email trực tiếp cho TA (${data.taEmail}) về nhân sự ${data.fullName}!`,
        sentTo: data.taEmail,
      };
    } catch (error) {
      Logger.log(
        "❌ Lỗi khi gửi Notification Email cho TA: " + error.toString(),
      );
      const errorMsg = `Không thể gửi Notification Email: ${error.message}`;
      logTaNotificationWorkflow(data, data.taEmail, "FAILED", errorMsg);
      throw new WorkflowError(
        "SEND_FAILED",
        `Không thể gửi Notification Email tới ${data.taEmail}. Vui lòng kiểm tra lại.`,
        { originalError: error.message, taEmail: data.taEmail },
      );
    }
  }

  /* --- LUỒNG 3: CANDIDATE WELCOME EMAIL --- */
  static handleWelcomeEmail(data) {
    const recipientEmail = data.personalEmail || data.workingEmail;

    try {
      const pdfInfo = getGuidePdfFileInfo(
        data.employmentType,
        data.onboardingType,
        data.customFileName,
      );

      const guidePreviewUrl = pdfInfo?.fileId
        ? `https://drive.google.com/file/d/${pdfInfo.fileId}/view`
        : "";

      const candidateMail = getWelcomeCandidateEmailTemplate(
        data,
        guidePreviewUrl,
      );

      const emailAttachments = [];
      if (pdfInfo && pdfInfo.pdfBlob) {
        emailAttachments.push(pdfInfo.pdfBlob);
      } else {
        Logger.log(
          "⚠️ Cảnh báo: Không tìm thấy file PDF đính kèm cho Welcome Email!",
        );
      }

      const peopleTeamRecipients = getRecipientsByRole(
        ONBOARDING_CONFIG.RECIPIENT_ROLES.PEOPLE_TEAM,
      );

      const ccList = [
        data.taEmail,
        ...(peopleTeamRecipients?.to || []),
        ...(peopleTeamRecipients?.cc || []),
      ]
        .filter(Boolean)
        .join(",");

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
      logCandidateWorkflow(data, draftId, "DRAFT_CREATED", "");

      return {
        ok: true,
        message: `Đã tạo bản nháp Welcome Email kèm File PDF cho ${data.fullName}!`,
        draftId: draftId,
        hasAttachment: emailAttachments.length > 0,
      };
    } catch (error) {
      Logger.log("❌ Lỗi khi tạo Welcome Draft: " + error.toString());
      const errorMsg = `Lỗi tạo bản nháp (${recipientEmail || "N/A"}): ${error.message}`;
      logCandidateWorkflow(data, "N/A", "FAILED", errorMsg);
      throw new WorkflowError(
        "DRAFT_FAILED",
        `Không thể tạo Welcome Draft cho ${data.fullName}: ${error.message}`,
        { originalError: error.message },
      );
    }
  }

  /* --- LUỒNG 4: AVATAR UPDATE --- */
  static handleAvatarUpdate() {
    const SPREADSHEET_UC06_ID = ONBOARDING_CONFIG.SPREADSHEET_UC06_ID;
    const TRIGGER_TYPE = ONBOARDING_CONFIG.TRIGGERS.AVATAR_UPDATE;

    const currentUserEmail = Session.getActiveUser()
      .getEmail()
      .toLowerCase()
      .trim();
    const currentAllocCode = currentUserEmail.split("@")[0].trim();

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
        const pictureColNumber = uc06ColMap[normalizeHeaderKey("Picture")];
        const checkColNumber = uc06ColMap[normalizeHeaderKey("Check 1:1")];
        const squareImgColNumber =
          uc06ColMap[normalizeHeaderKey("Ảnh 1:1")] ||
          uc06ColMap[normalizeHeaderKey("Anh 1:1")] ||
          uc06ColMap[normalizeHeaderKey("Picture 1:1")] ||
          (checkColNumber ? checkColNumber + 1 : null);

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

          const uc06Data = uc06Sheet
            .getRange(2, 1, lastRowUC06 - 1, lastColUC06)
            .getValues();

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
                pictureUrl,
                squareBackupUrl,
                uc06RowNumber,
                uc06RowLink: `${uc06SheetUrl}&range=${pictureColLetter}${uc06RowNumber}`,
                uc06SquareLink: `${uc06SheetUrl}&range=${squareColLetter}${uc06RowNumber}`,
                isSquare,
                dimensions,
              };
            }
          }

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

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getActiveSheet();
    const sheetUrl = ss.getUrl();
    const rawLastRow = sheet.getLastRow();

    if (rawLastRow <= 1) {
      return { ok: false, message: "Sheet dữ liệu Hera hiện đang rỗng." };
    }

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
      if (
        heraAllRowsData[r][1] &&
        String(heraAllRowsData[r][1]).trim() !== ""
      ) {
        actualLastRow = r + 1;
        break;
      }
    }

    if (actualLastRow <= 1) {
      return {
        ok: false,
        message: "Không tìm thấy dòng dữ liệu nhân sự hợp lệ nào.",
      };
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

    for (let r = actualLastRow; r >= 2; r--) {
      let candidateData;
      try {
        candidateData = OnboardingUtil.getNormalizedInput(
          TRIGGER_TYPE,
          r,
          cachedContext,
        );
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

      const rawStatus = String(status || "")
        .toLowerCase()
        .replace(/[-_ \t]/g, "");
      if (rawStatus !== "onboarded") continue;
      if (startDate !== todayDisplayStr && startDate !== todayStr) continue;

      const taAllocCode = String(taEmail || "")
        .split("@")[0]
        .trim()
        .toLowerCase();
      if (taAllocCode !== currentAllocCode) continue;

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

      const cleanPersonalEmail = personalEmail.toLowerCase();
      const uc06Info = avatarMap[cleanPersonalEmail] || null;

      candidateData.avatarUrl = uc06Info ? uc06Info.pictureUrl : "";
      candidateData.squareBackupUrl = uc06Info ? uc06Info.squareBackupUrl : "";
      candidateData.uc06RowNumber = uc06Info ? uc06Info.uc06RowNumber : null;
      candidateData.uc06RowLink = uc06Info ? uc06Info.uc06RowLink : "";
      candidateData.uc06SquareLink = uc06Info ? uc06Info.uc06SquareLink : "";
      candidateData.isSquare = uc06Info ? uc06Info.isSquare : false;
      candidateData.dimensions = uc06Info ? uc06Info.dimensions : null;

      if (!candidateData.uc06RowNumber) {
        candidateData.issueReason = "NOT_IN_SHEET";
        missingForTA.push(candidateData);
      } else if (candidateData.avatarUrl && candidateData.isSquare) {
        candidateData.finalAvatarUrl = candidateData.avatarUrl;
        candidateData.finalAvatarCellLink = candidateData.uc06RowLink;
        candidateData.isFromSquareBackup = false;
        readyForDevOps.push(candidateData);
      } else if (candidateData.squareBackupUrl) {
        candidateData.finalAvatarUrl = candidateData.squareBackupUrl;
        candidateData.finalAvatarCellLink = candidateData.uc06SquareLink;
        candidateData.isFromSquareBackup = true;
        readyForDevOps.push(candidateData);
      } else if (!candidateData.avatarUrl) {
        candidateData.issueReason = "EMPTY_IMAGE";
        missingForTA.push(candidateData);
      } else {
        candidateData.issueReason = "INVALID_RATIO_MISSING_BACKUP";
        missingForTA.push(candidateData);
      }
    }

    const summaryMsg = [];
    if (readyForDevOps.length > 0) {
      const devopsRecipients = getRecipientsByRole(
        ONBOARDING_CONFIG.RECIPIENT_ROLES.DEVOPS,
      );
      const mailTemplate = getAvatarUpdateDigestTemplate(
        readyForDevOps,
        sheetUrl,
        todayDisplayStr,
      );
      const to = (devopsRecipients?.to || []).join(",");
      const cc = [(devopsRecipients?.cc || []).join(","), currentUserEmail]
        .filter(Boolean)
        .join(",");

      OnboardingService.sendDirectEmail_(to, mailTemplate, cc);

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

    const totalCount =
      readyForDevOps.length + missingForTA.length + alreadyProcessed.length;
    if (totalCount === 0) {
      throw new WorkflowError(
        "NO_CANDIDATES_FOUND",
        `Không tìm thấy nhân sự onboard hôm nay (${todayDisplayStr}) thuộc quản lý của bạn (${currentAllocCode}).\nHãy kiểm tra và đảm bảo cột Offer Status đang ở trạng thái On-boarded.`,
      );
    }

    let dialogTitle = `📋 Báo cáo Avatar Onboard (${todayDisplayStr})`;
    if (missingForTA.length > 0) {
      dialogTitle = `⚠️ Cần xử lý Avatar cho ${missingForTA.length} nhân sự`;
    } else if (readyForDevOps.length > 0) {
      dialogTitle = `🎉 Đã gửi cập nhật Avatar cho ${readyForDevOps.length} nhân sự`;
    }

    return {
      ok: true,
      hasModal: true,
      modalConfig: {
        templatePath: ONBOARDING_CONFIG.TEMPLATES.DIALOG.TA_REMINDER,
        title: dialogTitle,
        width: 740,
        height: 480,
        data: {
          readyForDevOps,
          missingForTA,
          alreadyProcessed,
          uc06Url: `https://docs.google.com/spreadsheets/d/${SPREADSHEET_UC06_ID}/edit`,
        },
      },
      status: missingForTA.length > 0 ? "HAS_MISSING" : "SUCCESS",
      readyForDevOps,
      missingForTA,
      alreadyProcessed,
      message: summaryMsg.join("\n\n"),
    };
  }
}

/* Aliases tương thích ngược */
const handleOfferAcceptedWorkflow = OnboardingService.handleOfferAccepted;
const handleTaNotificationWorkflow = OnboardingService.handleTaNotification;
const handleWelcomeEmailWorkflow = OnboardingService.handleWelcomeEmail;
const handleAvatarUpdateWorkflow = OnboardingService.handleAvatarUpdate;
