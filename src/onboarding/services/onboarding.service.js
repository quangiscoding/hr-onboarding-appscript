/**
 * ONBOARDING/SERVICES/ONBOARDING.SERVICE.JS - Tầng Nghiệp vụ Onboarding
 */
class OnboardingService {
  /**
   * Helper gửi email trực tiếp qua GmailApp với cơ chế tự vệ chống lỗi Bad value
   * @param {string} to - Danh sách email nhận (cách nhau bởi dấu phẩy)
   * @param {Object} mail - { subject, htmlBody }
   * @param {string} [cc] - Danh sách email CC
   */
  static sendDirectEmail_(to, mail, cc) {
    const cleanTo = String(to || "").trim();
    if (!cleanTo) {
      throw new WorkflowError(
        "INVALID_RECIPIENT",
        "Địa chỉ email nhận (To) bị trống hoặc không hợp lệ.",
      );
    }

    try {
      GmailApp.sendEmail(cleanTo, mail.subject, "", {
        htmlBody: mail.htmlBody,
        cc: cc ? String(cc).trim() : "",
      });
    } catch (err) {
      Logger.log(
        `❌ Lỗi GmailApp.sendEmail tới (${cleanTo}): ${err.toString()}`,
      );
      throw new WorkflowError(
        "GMAIL_SEND_ERROR",
        `Lỗi khi gửi email tới ${cleanTo}: ${err.message}`,
        { originalError: err.message, stack: err.stack },
      );
    }
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
        const to = (recipients?.to || []).filter(Boolean).join(",");
        const cc = (recipients?.cc || []).filter(Boolean).join(",");

        if (!to) {
          throw new WorkflowError(
            "MISSING_RECIPIENT",
            `Không tìm thấy email cấu hình cho phòng ban ${type} trên tab Data.`,
          );
        }

        try {
          OnboardingService.sendDirectEmail_(to, mail, cc);
          sentEmails.push({ type, to });
        } catch (error) {
          Logger.log(`❌ Lỗi khi gửi email ${type}: ${error.toString()}`);
          const errorMsg = `Lỗi gửi email ${type} tới (${to}): ${error.message}`;
          logInternalWorkflow(data, sentEmails, "FAILED", errorMsg);
          throw new WorkflowError(
            "SEND_FAILED",
            `Không thể gửi email ${type} tới ${to}. Các email sau đó đã bị dừng.`,
            { originalError: error.message, stack: error.stack, type },
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
        Logger.log(`❌ Lỗi hệ thống trong handleOfferAccepted: ${error.stack}`);
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
      OnboardingService.sendDirectEmail_(data.taEmail, taMail, "");
      logTaNotificationWorkflow(data, data.taEmail, "EMAIL_SENT", "");

      return {
        ok: true,
        message: `Đã gửi Notification Email trực tiếp cho TA (${data.taEmail}) về nhân sự ${data.fullName}!`,
        sentTo: data.taEmail,
      };
    } catch (error) {
      Logger.log(`❌ Lỗi khi gửi Notification Email cho TA: ${error.stack}`);
      const errorMsg = `Không thể gửi Notification Email: ${error.message}`;
      logTaNotificationWorkflow(data, data.taEmail, "FAILED", errorMsg);
      throw new WorkflowError(
        "SEND_FAILED",
        `Không thể gửi Notification Email tới ${data.taEmail}. Vui lòng kiểm tra lại.`,
        {
          originalError: error.message,
          stack: error.stack,
          taEmail: data.taEmail,
        },
      );
    }
  }

  /* --- LUỒNG 3: CANDIDATE WELCOME EMAIL --- */
  static handleWelcomeEmail(data) {
    // Ưu tiên gửi Personal Email trước (nhân sự mới chưa đăng nhập được email công ty)
    const recipientEmail = String(
      data.personalEmail || data.workingEmail || "",
    ).trim();

    if (!recipientEmail) {
      throw new WorkflowError(
        "MISSING_RECIPIENT_EMAIL",
        `Không tìm thấy Email cá nhân hoặc Working Email của nhân sự ${data.fullName} để tạo bản nháp.`,
      );
    }

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
        message: `Đã tạo bản nháp Welcome Email gửi tới ${recipientEmail} kèm File PDF cho ${data.fullName}!`,
        draftId: draftId,
        hasAttachment: emailAttachments.length > 0,
      };
    } catch (error) {
      Logger.log(`❌ Lỗi khi tạo Welcome Draft: ${error.stack}`);
      const errorMsg = `Lỗi tạo bản nháp (${recipientEmail}): ${error.message}`;
      logCandidateWorkflow(data, "N/A", "FAILED", errorMsg);
      throw new WorkflowError(
        "DRAFT_FAILED",
        `Không thể tạo Welcome Draft cho ${data.fullName}: ${error.message}`,
        { originalError: error.message, stack: error.stack },
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

    if (!candidates || !candidates.length) {
      throw new WorkflowError(
        "NO_CANDIDATES_FOUND",
        `Không tìm thấy nhân sự onboard hôm nay (${todayDisplay}) thuộc quản lý của bạn (${currentAllocCode}).\nHãy kiểm tra lại cột Offer Status và Date of Onboard.`,
      );
    }

    // 2. Phân loại theo nghiệp vụ (Phòng vệ null/undefined personalEmail)
    const ready = [];
    const missing = [];
    const alreadyProcessed = candidates.filter((c) => c.isLocked);

    candidates
      .filter((c) => !c.isLocked)
      .forEach((c) => {
        const cleanEmail = String(c.personalEmail || c.workingEmail || "")
          .toLowerCase()
          .trim();
        const uc06 = cleanEmail ? avatarMap[cleanEmail] : null;

        if (AvatarUpdateUtil.classifyCandidate(c, uc06) === "READY") {
          ready.push(c);
        } else {
          missing.push(c);
        }
      });

    // 3. Gửi email & Khóa dòng cho nhóm Ready
    if (ready.length > 0) {
      const devops = getRecipientsByRole(
        ONBOARDING_CONFIG.RECIPIENT_ROLES.DEVOPS,
      );
      const to = (devops?.to || []).filter(Boolean).join(",");
      const cc = [(devops?.cc || []).filter(Boolean).join(","), currentUser]
        .filter(Boolean)
        .join(",");

      // Kiểm tra an toàn trước khi gọi sendDirectEmail_
      if (!to || to.trim() === "") {
        throw new WorkflowError(
          "MISSING_DEVOPS_RECIPIENT",
          "Chưa cấu hình email người nhận cho DevOps tại tab Data (Cột Send to).",
          { devopsRecipients: devops },
        );
      }

      const tpl = getAvatarUpdateDigestTemplate(ready, sheetUrl, todayDisplay);

      try {
        OnboardingService.sendDirectEmail_(to, tpl, cc);
      } catch (errMail) {
        throw new WorkflowError(
          "DEVOPS_MAIL_FAILED",
          `Gửi mail cho DevOps thất bại: ${errMail.message}`,
          { originalError: errMail.message, stack: errMail.stack },
        );
      }

      // Khóa dòng và ghi log an toàn
      ready.forEach((c) => {
        const lockEmail = String(
          c.personalEmail || c.workingEmail || "",
        ).trim();
        if (c.rowNumber && c.rowNumber >= 2 && lockEmail) {
          lockRowForWorkflow(c.rowNumber, TRIGGER, lockEmail);
        }
        logInternalWorkflow(
          c,
          [{ type: "DevOps Avatar Update", to }],
          "EMAIL_SENT",
          "",
        );
      });
    }

    // 4. Trả kết quả hiển thị cho Controller (Tính toán chiều cao Modal an toàn)
    const totalDisplayRows = (missing.length || 0) + (ready.length || 0);
    const calculatedHeight = Math.min(200 + totalDisplayRows * 38, 560);
    const safeHeight =
      isNaN(calculatedHeight) || calculatedHeight <= 0 ? 480 : calculatedHeight;

    return {
      ok: true,
      hasModal: true,
      modalConfig: {
        templatePath: ONBOARDING_CONFIG.TEMPLATES.DIALOG.TA_REMINDER,
        title: missing.length
          ? `⚠️ Cần xử lý Avatar cho ${missing.length} nhân sự`
          : `🎉 Đã gửi cập nhật Avatar cho ${ready.length} nhân sự`,
        width: 740,
        height: safeHeight,
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
