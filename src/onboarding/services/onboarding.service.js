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
    const TRIGGER = ONBOARDING_CONFIG.TRIGGERS.AVATAR_UPDATE;
    const currentUser = Session.getActiveUser().getEmail().toLowerCase().trim();
    const currentAllocCode = currentUser.split("@")[0].trim();

    // 1. Lấy dữ liệu từ Repo/Util
    const avatarMap = AvatarUpdateUtil.loadMapAndSync(
      ONBOARDING_CONFIG.SPREADSHEET_UC06_ID,
    );
    const { candidates, sheetUrl, todayDisplay } =
      OnboardingUtil.getTodayOnboardCandidates(currentAllocCode, TRIGGER);

    if (!candidates.length) {
      throw new WorkflowError(
        "NO_CANDIDATES_FOUND",
        `Không tìm thấy nhân sự onboard hôm nay (${todayDisplay}) thuộc quản lý của bạn.`,
      );
    }

    // 2. Phân loại theo nghiệp vụ
    const ready = [];
    const missing = [];
    const alreadyProcessed = candidates.filter((c) => c.isLocked);

    candidates
      .filter((c) => !c.isLocked)
      .forEach((c) => {
        const uc06 = avatarMap[c.personalEmail.toLowerCase()];
        AvatarUpdateUtil.classifyCandidate(c, uc06) === "READY"
          ? ready.push(c)
          : missing.push(c);
      });

    // 3. Gửi email & Khóa dòng cho nhóm Ready
    if (ready.length > 0) {
      const devops = getRecipientsByRole(
        ONBOARDING_CONFIG.RECIPIENT_ROLES.DEVOPS,
      );
      const tpl = getAvatarUpdateDigestTemplate(ready, sheetUrl, todayDisplay);
      const to = (devops?.to || []).join(",");
      const cc = [(devops?.cc || []).join(","), currentUser]
        .filter(Boolean)
        .join(",");

      OnboardingService.sendDirectEmail_(to, tpl, cc);

      ready.forEach((c) => {
        lockRowForWorkflow(
          c.rowNumber,
          TRIGGER,
          c.personalEmail || c.workingEmail,
        );
        logInternalWorkflow(
          c,
          [{ type: "DevOps Avatar Update", to }],
          "EMAIL_SENT",
          "",
        );
      });
    }

    // 4. Trả kết quả hiển thị cho Controller
    return {
      ok: true,
      hasModal: true,
      modalConfig: {
        templatePath: ONBOARDING_CONFIG.TEMPLATES.DIALOG.TA_REMINDER,
        title: missing.length
          ? `⚠️ Cần xử lý Avatar cho ${missing.length} nhân sự`
          : `🎉 Đã gửi cập nhật Avatar cho ${ready.length} nhân sự`,
        width: 740,
        height: 480,
        data: {
          readyForDevOps: ready,
          missingForTA: missing,
          alreadyProcessed,
          uc06Url: `https://docs.google.com/spreadsheets/d/${ONBOARDING_CONFIG.SPREADSHEET_UC06_ID}/edit`,
        },
      },
      status: missing.length ? "HAS_MISSING" : "SUCCESS",
      message: ready.length
        ? `✅ Đã gửi email nhắc DevOps cho ${ready.length} nhân sự.`
        : "",
    };
  }
}

/* Aliases tương thích ngược */
const handleOfferAcceptedWorkflow = OnboardingService.handleOfferAccepted;
const handleTaNotificationWorkflow = OnboardingService.handleTaNotification;
const handleWelcomeEmailWorkflow = OnboardingService.handleWelcomeEmail;
const handleAvatarUpdateWorkflow = OnboardingService.handleAvatarUpdate;
