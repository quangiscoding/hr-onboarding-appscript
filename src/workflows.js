/** ==========================================
 * WORKFLOWS.JS - QUẢN LÝ CÁC LUỒNG TẠO DRAFT EMAIL & GỬI EMAIL TRỰC TIẾP
 * ========================================== */

/**
 * LUỒNG 1: Tạo bản nháp Email gửi cho các Phòng ban (DevOps, HR, IT)
 * @param {Object} data - Dữ liệu ứng viên đã chuẩn hóa
 */
function handleOfferAcceptedWorkflow(data) {
  const createdDrafts = [];

  // Đọc recipients động từ sheet Data (Role | Send to | CC)
  const devopsRecipients = getRecipientsByRole(CONFIG.RECIPIENT_ROLES.DEVOPS);
  const hrRecipients = getRecipientsByRole(CONFIG.RECIPIENT_ROLES.HR);
  const itRecipients = getRecipientsByRole(CONFIG.RECIPIENT_ROLES.IT);

  // 1. Tạo Draft gửi DevOps
  const devopsMail = getDevOpsEmailTemplate(data);
  const devopsDraft = GmailApp.createDraft(
    devopsRecipients.to.join(","),
    devopsMail.subject,
    "",
    {
      htmlBody: devopsMail.htmlBody,
      cc: devopsRecipients.cc.join(","),
    },
  );
  createdDrafts.push({ type: "DevOps", id: devopsDraft.getId() });

  // 2. Tạo Draft gửi HR (Role "OKR" trong sheet Data)
  const hrMail = getHREmailTemplate(data);
  const hrDraft = GmailApp.createDraft(
    hrRecipients.to.join(","),
    hrMail.subject,
    "",
    {
      htmlBody: hrMail.htmlBody,
      cc: hrRecipients.cc.join(","),
    },
  );
  createdDrafts.push({ type: "HR", id: hrDraft.getId() });

  // 3. Tạo Draft gửi IT - Chỉ gửi khi Device Request chứa "as company standard"
  const deviceRequested = isStandardDevice(data.deviceRequest);
  if (deviceRequested) {
    const itMail = getITEmailTemplate(data);
    const itDraft = GmailApp.createDraft(
      itRecipients.to.join(","),
      itMail.subject,
      "",
      {
        htmlBody: itMail.htmlBody,
        cc: itRecipients.cc.join(","),
      },
    );
    createdDrafts.push({ type: "IT", id: itDraft.getId() });
  }

  // 4. 📝 GHI LOG INTERNAL (Lưu từng Draft ID theo loại Request)
  logInternalWorkflow(data, createdDrafts);

  // 5. Hiện Pop-up Alert thông báo giữa màn hình
  SpreadsheetApp.getUi().alert(
    "Thành công 🎉",
    `Đã tạo thành công ${createdDrafts.length} bản nháp Email nhắc việc cho ${data.fullName}!`,
    SpreadsheetApp.getUi().ButtonSet.OK,
  );
}

/**
 * LUỒNG 2: Gửi Email Notification TRỰC TIẾP cho TA In Charge (không tạo Draft)
 * @param {Object} data - Dữ liệu ứng viên đã chuẩn hóa
 */
function handleTaNotificationWorkflow(data) {
  // 1. Kiểm tra TA Email hợp lệ trước khi gửi
  if (!data.taEmail) {
    SpreadsheetApp.getUi().alert(
      "⚠️ Thiếu TA In Charge!",
      "Không tìm thấy email của TA In Charge, không thể gửi Notification Email.",
      SpreadsheetApp.getUi().ButtonSet.OK,
    );
    return;
  }

  // 2. Gọi Template Email cho TA
  const taMail = getTaNotificationEmailTemplate(data);

  // 3. Gửi Email TRỰC TIẾP (không tạo Draft), bọc try...catch theo nguyên tắc Defensive Programming
  let sentEmail = null;
  try {
    GmailApp.sendEmail(data.taEmail, taMail.subject, "", {
      htmlBody: taMail.htmlBody,
    });
    sentEmail = { to: data.taEmail };
  } catch (error) {
    Logger.log("❌ Lỗi khi gửi Notification Email cho TA: " + error.toString());
    SpreadsheetApp.getUi().alert(
      "Lỗi ❌",
      `Không thể gửi Notification Email tới ${data.taEmail}. Vui lòng kiểm tra lại.\n\nChi tiết: ${error.message}`,
      SpreadsheetApp.getUi().ButtonSet.OK,
    );
    return;
  }

  // 4. 📝 GHI LOG TA NOTIFICATION (Trạng thái EMAIL_SENT)
  logTaNotificationWorkflow(data, sentEmail.to);

  // 5. Tự động đổi màu nhẹ ô Checkbox báo hiệu hoàn tất (UX)
  if (data.rowNumber) {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    const headerRange = sheet.getRange(1, 1, 1, sheet.getLastColumn());
    const headers = headerRange.getValues()[0].map(normalizeHeaderKey);
    const checkboxCol = headers.indexOf(COLS.SEND_TA_NOTIFICATION_EMAIL) + 1;

    if (checkboxCol > 0) {
      sheet.getRange(data.rowNumber, checkboxCol).setBackground("#e2e3e5");
    }
  }

  // 6. Hiện Pop-up Alert thông báo giữa màn hình
  SpreadsheetApp.getUi().alert(
    "Thành công 🎉",
    `Đã gửi Notification Email trực tiếp cho TA (${data.taEmail}) về nhân sự ${data.fullName}!`,
    SpreadsheetApp.getUi().ButtonSet.OK,
  );
}

/**
 * LUỒNG 3: Gửi / Tạo Draft Welcome Email cho Nhân sự mới kèm File PDF
 * @param {Object} data - Dữ liệu ứng viên đã chuẩn hóa
 */
function handleWelcomeEmailWorkflow(data) {
  // 1. Lấy thông tin PDF & Blob đính kèm trước
  const pdfInfo = getGuidePdfFileInfo(
    data.employmentType,
    data.onboardingType,
    data.customFileName,
  );

  // Tạo URL xem trước file PDF cho nút bấm trong Email
  const guidePreviewUrl = pdfInfo?.fileId
    ? `https://drive.google.com/file/d/${pdfInfo.fileId}/view`
    : "";

  // 2. Gọi ĐÚNG tên hàm Template: getWelcomeCandidateEmailTemplate
  const candidateMail = getWelcomeCandidateEmailTemplate(data, guidePreviewUrl);

  // 3. Chuẩn bị mảng đính kèm (Blob)
  const emailAttachments = [];
  if (pdfInfo && pdfInfo.pdfBlob) {
    emailAttachments.push(pdfInfo.pdfBlob);
  } else {
    Logger.log(
      "⚠️ Cảnh báo: Không tìm thấy file PDF đính kèm cho Welcome Email!",
    );
  }

  // 4. Danh sách CC (TA in charge, Line Manager, People Team - đọc động từ sheet Data)
  const peopleTeamRecipients = getRecipientsByRole(
    CONFIG.RECIPIENT_ROLES.PEOPLE_TEAM,
  );
  const ccList = [
    data.taEmail,
    data.managerEmail,
    ...peopleTeamRecipients.to,
    ...peopleTeamRecipients.cc,
  ]
    .filter(Boolean)
    .join(",");

  // 5. Cấu hình Options cho Gmail Draft
  const options = {
    htmlBody: candidateMail.htmlBody,
    cc: ccList,
    attachments: emailAttachments,
  };

  // 6. Tạo Draft Welcome Email duy nhất
  const recipientEmail = data.personalEmail || data.workingEmail;
  const candidateDraft = GmailApp.createDraft(
    recipientEmail,
    candidateMail.subject,
    "",
    options,
  );

  // 7. 📝 GHI LOG CANDIDATE DRAFT
  logCandidateWorkflow(data, candidateDraft.getId());

  // 8. Tự động đổi màu nhẹ ô Checkbox báo hiệu hoàn tất (UX)
  if (data.rowNumber) {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    const headerRange = sheet.getRange(1, 1, 1, sheet.getLastColumn());
    const headers = headerRange.getValues()[0].map(normalizeHeaderKey);
    const checkboxCol = headers.indexOf(COLS.SEND_WELCOME_EMAIL) + 1;

    if (checkboxCol > 0) {
      sheet.getRange(data.rowNumber, checkboxCol).setBackground("#e2e3e5");
    }
  }

  // 9. Hiện Pop-up Alert thông báo giữa màn hình
  SpreadsheetApp.getUi().alert(
    "Thành công 🎉",
    `Đã tạo bản nháp Welcome Email kèm File PDF cho ${data.fullName}!`,
    SpreadsheetApp.getUi().ButtonSet.OK,
  );
}
