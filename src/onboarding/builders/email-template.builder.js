/** ==========================================
 * ONBOARDING/BUILDERS/EMAIL-TEMPLATE.BUILDER.JS
 * ==========================================
 */
class EmailTemplateBuilder {
  /**
   * Render file HTML bất kỳ từ full path
   * @private
   */
  static renderView_(fullPath, data) {
    const template = HtmlService.createTemplateFromFile(fullPath);
    // Gán cả direct keys và data.it để hỗ trợ cả cú pháp <?= fullName ?> lẫn <?= it.fullName ?>
    Object.assign(template, data);
    template.it = data;
    return template.evaluate().getContent();
  }

  /**
   * Chuẩn bị payload cơ sở
   * @private
   */
  static buildBasePayload_(data, extra = {}) {
    return {
      ...data,
      positionTitle: toTitleCase(data.position || ""),
      squadTitle: toTitleCase(data.squad || ""),
      ...extra,
    };
  }

  /** Draft DevOps */
  static getDevOpsEmail(data) {
    const payload = this.buildBasePayload_(data);
    const subject = `Yêu cầu khởi tạo tài khoản email công ty cho nhân sự mới - ${data.fullName || ""}`;
    return {
      subject,
      htmlBody: this.renderView_(
        ONBOARDING_CONFIG.TEMPLATES.EMAIL.DEVOPS,
        payload,
      ),
    };
  }

  /** Draft HR */
  static getHREmail(data) {
    const payload = this.buildBasePayload_(data);
    const subject = `Yêu cầu tạo folder OKR onboarding cho nhân sự mới – ${data.fullName || ""}`;
    return {
      subject,
      htmlBody: this.renderView_(ONBOARDING_CONFIG.TEMPLATES.EMAIL.HR, payload),
    };
  }

  /** Draft IT */
  static getITEmail(data) {
    const payload = this.buildBasePayload_(data);
    const subject = `[Thông báo cấp máy] Nhân sự mới ${data.fullName} - ${payload.positionTitle}`;
    return {
      subject,
      htmlBody: this.renderView_(ONBOARDING_CONFIG.TEMPLATES.EMAIL.IT, payload),
    };
  }

  /** TA Notification */
  static getTaNotificationEmail(data) {
    const taUsername = toEmailUsername(data.taEmail, "bạn");
    const hasOkr = Boolean(String(data.okrFolderUrl || "").trim());
    const hasEmail = Boolean(String(data.allocCode || "").trim());

    let subjectDetail = "Thông tin tiến độ đã được cập nhật";
    let statusMessage = `Dòng <strong>${data.rowNumber}</strong> vừa được cập nhật tiến độ mới cho nhân sự <strong>${data.fullName || ""}</strong>.`;

    if (hasOkr && hasEmail) {
      subjectDetail = "Cả Folder OKRs và Email công ty đã sẵn sàng";
      statusMessage = `Cả <strong>Folder OKRs</strong> và <strong>Email công ty (Working Email)</strong> cho nhân sự <strong>${data.fullName || ""}</strong> (dòng <strong>${data.rowNumber}</strong>) đã được tạo hoàn tất.`;
    } else if (hasOkr) {
      subjectDetail = "Folder OKRs đã sẵn sàng";
      statusMessage = `Đã có <strong>Folder OKRs</strong> cho nhân sự <strong>${data.fullName || ""}</strong> tại dòng <strong>${data.rowNumber}</strong>.`;
    } else if (hasEmail) {
      subjectDetail = "Working Email đã được tạo";
      statusMessage = `<strong>Working email</strong> đã được tạo cho nhân sự <strong>${data.fullName || ""}</strong> tại dòng <strong>${data.rowNumber}</strong>.`;
    }

    const payload = this.buildBasePayload_(data, { taUsername, statusMessage });
    const subject = `[Cập nhật Onboarding] ${subjectDetail} - ${data.fullName || ""} (Dòng ${data.rowNumber})`;

    return {
      subject,
      htmlBody: this.renderView_(
        ONBOARDING_CONFIG.TEMPLATES.EMAIL.TA_NOTIFICATION,
        payload,
      ),
    };
  }

  /** Welcome Candidate Email */
  static getWelcomeCandidateEmail(data, guidePreviewUrl) {
    const positionTitle = toTitleCase(data.position || "");
    const squadTitle = toTitleCase(data.squad || "");

    const onboardType = clean(data.onboardingType);
    const officeCfg = ONBOARDING_CONFIG.OFFICE_ADDRESS;
    let officeAddress = officeCfg.DEFAULT;

    if (onboardType.includes("danang")) {
      officeAddress = officeCfg.DANANG;
    } else if (onboardType.includes("hoa cau")) {
      officeAddress = officeCfg.HOA_CAU;
    }

    const payload = this.buildBasePayload_(data, {
      officeAddress,
      guidePreviewUrl,
    });

    const subjectDetail = squadTitle
      ? `${positionTitle}_${squadTitle}`
      : positionTitle;
    const subject = `Welcome to Kyanon Digital: Essential Onboarding Steps for ${subjectDetail}`;

    return {
      subject,
      htmlBody: this.renderView_(
        ONBOARDING_CONFIG.TEMPLATES.EMAIL.WELCOME_CANDIDATE,
        payload,
      ),
    };
  }

  /** Avatar Digest Email cho DevOps */
  static getAvatarUpdateDigest(candidates, sheetUrl, todayStr) {
    const subject = `[Avatar Updated] Danh sách cập nhật Avatar nhân sự onboard ngày ${todayStr} (${candidates.length} nhân sự)`;
    const payload = { candidates, sheetUrl, todayStr };

    return {
      subject,
      htmlBody: this.renderView_(
        ONBOARDING_CONFIG.TEMPLATES.EMAIL.AVATAR_DIGEST,
        payload,
      ),
    };
  }

  /** Avatar Reminder Digest cho TA */
  static getAvatarTaReminderDigest(candidates, taName, todayStr) {
    const subject = `[REMINDER] Nhắc nhở bổ sung Link Avatar nhân sự onboard ngày ${todayStr} (${candidates.length} nhân sự)`;
    const payload = { candidates, taName, todayStr };

    return {
      subject,
      htmlBody: this.renderView_(
        ONBOARDING_CONFIG.TEMPLATES.EMAIL.AVATAR_TA_REMINDER,
        payload,
      ),
    };
  }
}

/* Backward compatibility aliases */
const getDevOpsEmailTemplate = (d) => EmailTemplateBuilder.getDevOpsEmail(d);
const getHREmailTemplate = (d) => EmailTemplateBuilder.getHREmail(d);
const getITEmailTemplate = (d) => EmailTemplateBuilder.getITEmail(d);
const getTaNotificationEmailTemplate = (d) =>
  EmailTemplateBuilder.getTaNotificationEmail(d);
const getWelcomeCandidateEmailTemplate = (d, url) =>
  EmailTemplateBuilder.getWelcomeCandidateEmail(d, url);
const getAvatarUpdateDigestTemplate = (c, s, d) =>
  EmailTemplateBuilder.getAvatarUpdateDigest(c, s, d);
const getAvatarTaReminderDigestTemplate = (c, t, d) =>
  EmailTemplateBuilder.getAvatarTaReminderDigest(c, t, d);
