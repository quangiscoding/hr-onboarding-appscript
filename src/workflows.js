/** ==========================================
 * WORKFLOWS.JS - QUẢN LÝ CÁC LUỒNG GỬI EMAIL TRỰC TIẾP & TẠO DRAFT
 * ========================================== */

/**
 * LUỒNG 1: Gửi Email TRỰC TIẾP cho các Phòng ban (DevOps, HR, IT)
 * @param {Object} data - Dữ liệu ứng viên đã chuẩn hóa
 */
function handleOfferAcceptedWorkflow(data) {
  const sentEmails = [];

  // Đọc recipients động từ sheet Data (Role | Send to | CC)
  const devopsRecipients = getRecipientsByRole(CONFIG.RECIPIENT_ROLES.DEVOPS);
  const hrRecipients = getRecipientsByRole(CONFIG.RECIPIENT_ROLES.HR);
  const itRecipients = getRecipientsByRole(CONFIG.RECIPIENT_ROLES.IT);

  // Helper gửi 1 email trực tiếp, lỗi thì dừng luồng + báo user
  const sendDirect = (type, to, cc, mail) => {
    try {
      GmailApp.sendEmail(to, mail.subject, "", {
        htmlBody: mail.htmlBody,
        cc: cc || "",
      });
      sentEmails.push({ type: type, to: to });
      return true;
    } catch (error) {
      Logger.log(`❌ Lỗi khi gửi email ${type}: ` + error.toString());
      SpreadsheetApp.getUi().alert(
        "Lỗi ❌",
        `Không thể gửi email ${type} tới ${to}.\n\nChi tiết: ${error.message}`,
        SpreadsheetApp.getUi().ButtonSet.OK,
      );
      return false;
    }
  };

  // 1. Gửi thẳng DevOps
  const devopsMail = getDevOpsEmailTemplate(data);
  if (
    !sendDirect(
      "DevOps",
      devopsRecipients.to.join(","),
      devopsRecipients.cc.join(","),
      devopsMail,
    )
  )
    return;

  // 2. Gửi thẳng HR (Role "OKR" trong sheet Data)
  const hrMail = getHREmailTemplate(data);
  if (
    !sendDirect(
      "HR",
      hrRecipients.to.join(","),
      hrRecipients.cc.join(","),
      hrMail,
    )
  )
    return;

  // 3. Gửi thẳng IT - Chỉ gửi khi Device Request chứa "as company standard"
  const deviceRequested = isStandardDevice(data.deviceRequest);
  if (deviceRequested) {
    const itMail = getITEmailTemplate(data);
    if (
      !sendDirect(
        "IT",
        itRecipients.to.join(","),
        itRecipients.cc.join(","),
        itMail,
      )
    )
      return;
  }

  // 4. 📝 GHI LOG INTERNAL (Lưu người nhận theo loại Request)
  logInternalWorkflow(data, sentEmails);

  // 5. Hiện Pop-up Alert thông báo giữa màn hình
  SpreadsheetApp.getUi().alert(
    "Thành công 🎉",
    `Đã gửi thành công ${sentEmails.length} email nhắc việc cho ${data.fullName}!\n\nNgười nhận: ${sentEmails.map((e) => e.type).join(", ")}`,
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
