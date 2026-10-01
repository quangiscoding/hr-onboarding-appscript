/** ==========================================
 * EMAIL-TEMPLATES.JS - XÂY DỰNG NỘI DUNG EMAIL
 * ==========================================
 * Mỗi hàm get*Template(data) trả về { subject, htmlBody }.
 * HTML nằm ở các file .html trong thư mục email-templates/,
 * file này chỉ chuẩn bị payload + subject.
 */

/**
 * Payload dùng chung cho mọi template:
 * thêm các bản "đã format sẵn" (positionTitle, squadTitle) để HTML không tự format.
 * @param {Object} data - Payload gốc từ getNormalizedInput()
 * @param {Object} [extra] - Các field bổ sung riêng của từng template
 */
function buildTemplatePayload(data, extra = {}) {
  return {
    ...data,
    positionTitle: toTitleCase(data.position || ""),
    squadTitle: toTitleCase(data.squad || ""),
    ...extra,
  };
}

/** Draft gửi DevOps: yêu cầu khởi tạo tài khoản email công ty */
function getDevOpsEmailTemplate(data) {
  const payload = buildTemplatePayload(data);
  const subject = `Yêu cầu khởi tạo tài khoản email công ty cho nhân sự mới - ${data.fullName || ""}`;

  return { subject, htmlBody: renderHtmlTemplate("devops-email", payload) };
}

/** Draft gửi HR: yêu cầu tạo folder OKR onboarding */
function getHREmailTemplate(data) {
  const payload = buildTemplatePayload(data);
  const subject = `Yêu cầu tạo folder OKR onboarding cho nhân sự mới – ${data.fullName || ""}`;

  return { subject, htmlBody: renderHtmlTemplate("hr-email", payload) };
}

/** Draft gửi IT: thông báo cấp máy (chỉ khi "as company standard") */
function getITEmailTemplate(data) {
  const payload = buildTemplatePayload(data);
  const subject = `[Thông báo cấp máy] Nhân sự mới ${data.fullName} - ${payload.positionTitle}`;

  return { subject, htmlBody: renderHtmlTemplate("it-email", payload) };
}

/**
 * Email Notification gửi cho TA In Charge
 * Subject + nội dung thay đổi theo tiến độ (có OKR folder? có Working Email?)
 */
function getTaNotificationEmailTemplate(data) {
  const taUsername = toEmailUsername(data.taEmail, "bạn");

  // Xác định tiến độ hiện tại của 2 đầu việc
  const hasOkr = Boolean(String(data.okrFolderUrl || "").trim());
  const hasEmail = Boolean(String(data.allocCode || "").trim());

  let subjectDetail = "";
  let statusMessage = "";

  if (hasOkr && hasEmail) {
    subjectDetail = "Cả Folder OKRs và Email công ty đã sẵn sàng";
    statusMessage = `Cả <strong>Folder OKRs</strong> và <strong>Email công ty (Working Email)</strong> cho nhân sự <strong>${data.fullName || ""}</strong> (dòng <strong>${data.rowNumber}</strong>) đã được tạo hoàn tất.`;
  } else if (hasOkr) {
    subjectDetail = "Folder OKRs đã sẵn sàng";
    statusMessage = `Đã có <strong>Folder OKRs</strong> cho nhân sự <strong>${data.fullName || ""}</strong> tại dòng <strong>${data.rowNumber}</strong>.`;
  } else if (hasEmail) {
    subjectDetail = "Working Email đã được tạo";
    statusMessage = `<strong>Working email</strong> đã được tạo cho nhân sự <strong>${data.fullName || ""}</strong> tại dòng <strong>${data.rowNumber}</strong>.`;
  } else {
    subjectDetail = "Thông tin tiến độ đã được cập nhật";
    statusMessage = `Dòng <strong>${data.rowNumber}</strong> vừa được cập nhật tiến độ mới cho nhân sự <strong>${data.fullName || ""}</strong>.`;
  }

  const payload = buildTemplatePayload(data, { taUsername, statusMessage });

  const subject = `[Cập nhật Onboarding] ${subjectDetail} - ${data.fullName || ""} (Dòng ${data.rowNumber})`;
  return { subject, htmlBody: renderHtmlTemplate("ta-notification-email", payload) };
}

/** Draft Welcome Email cho ứng viên (kèm PDF hướng dẫn) */
function getWelcomeCandidateEmailTemplate(data, guidePreviewUrl) {
  const positionTitle = toTitleCase(data.position || "");
  const squadTitle = toTitleCase(data.squad || "");

  // Địa chỉ văn phòng theo Onboarding Type
  const onboardType = clean(data.onboardingType);
  let officeAddress = CONFIG.OFFICE_ADDRESS.DEFAULT;
  if (onboardType.includes("danang")) {
    officeAddress = CONFIG.OFFICE_ADDRESS.DANANG;
  } else if (onboardType.includes("hoa cau")) {
    officeAddress = CONFIG.OFFICE_ADDRESS.HOA_CAU;
  }

  const payload = buildTemplatePayload(data, {
    officeAddress,
    guidePreviewUrl,
  });

  // Ghép subject: "... for <Chức danh>_<Squad>" (bỏ Squad nếu rỗng để tránh đuôi "_")
  const subjectDetail = squadTitle
    ? `${positionTitle}_${squadTitle}`
    : positionTitle;
  const subject = `Welcome to Kyanon Digital: Essential Onboarding Steps for ${subjectDetail}`;
  return { subject, htmlBody: renderHtmlTemplate("welcome-candidate-email", payload) };
}
