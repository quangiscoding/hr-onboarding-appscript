/**
 * LUỒNG 1: Tạo bản nháp Email gửi cho các Phòng ban (DevOps, HR, IT)
 * @param {Object} data - Dữ liệu ứng viên
 */
function handleOfferAcceptedWorkflow(data) {
  let createdCount = 0;

  // 1. Tạo Draft gửi DevOps (Anh Tuấn)
  const devopsMail = getDevOpsEmailTemplate(data);
  GmailApp.createDraft(CONFIG.RECIPIENTS.DEVOPS, devopsMail.subject, "", {
    htmlBody: devopsMail.htmlBody,
  });
  createdCount++;

  // 2. Tạo Draft gửi HR (Chị Tuyền)
  const hrMail = getHREmailTemplate(data);
  GmailApp.createDraft(CONFIG.RECIPIENTS.HR, hrMail.subject, "", {
    htmlBody: hrMail.htmlBody,
  });
  createdCount++;

  // 3. Tạo Draft gửi IT (Anh Trung) - Đã sửa so sánh chữ thường
  const deviceRequested = data.deviceRequest
    ?.toLowerCase()
    .includes("as company standard");
  if (deviceRequested) {
    const itMail = getITEmailTemplate(data);
    GmailApp.createDraft(CONFIG.RECIPIENTS.IT, itMail.subject, "", {
      htmlBody: itMail.htmlBody,
    });
    createdCount++;
  }

  // 4. Bật Toast Popup thông báo góc dưới màn hình
  SpreadsheetApp.getActiveSpreadsheet().toast(
    `Đã tạo thành công ${createdCount} bản nháp Email nhắc việc cho ${data.fullName}`,
    "Thành công 🎉",
    5,
  );
}

/**
 * LUỒNG 2: Gửi / Tạo Draft Welcome Email cho Nhân sự mới kèm File PDF
 * @param {Object} data - Dữ liệu ứng viên
 */
function handleWelcomeEmailWorkflow(data) {
  // 1. Đọc file PDF đính kèm & lấy file ID để tạo URL preview
  const pdfFileInfo = getGuidePdfFileInfo(
    data.employmentType,
    data.onboardingType,
  );
  const guidePreviewUrl = pdfFileInfo?.fileId
    ? `https://drive.google.com/file/d/${pdfFileInfo.fileId}/view`
    : "#";

  // 2. Lấy Template Email Candidate
  const candidateMail = getWelcomeCandidateEmailTemplate(data, guidePreviewUrl);

  // 3. Chuẩn bị danh sách CC (TA, Manager, People Team)
  const ccList = [
    data.taEmail,
    data.managerEmail,
    CONFIG.RECIPIENTS.PEOPLE_TEAM,
  ]
    .filter(Boolean)
    .join(",");

  // 4. Tạo Cấu hình Options cho Gmail Draft
  const options = {
    htmlBody: candidateMail.htmlBody,
    cc: ccList,
  };

  // Đổi tên file PDF đính kèm theo customFileName
  if (pdfFileInfo?.file) {
    options.attachments = [pdfFileInfo.file.setName(data.customFileName)];
  }

  // 5. Tạo Draft Welcome Email
  GmailApp.createDraft(data.personalEmail, candidateMail.subject, "", options);

  // 6. Bật Toast Popup thông báo góc dưới màn hình
  SpreadsheetApp.getActiveSpreadsheet().toast(
    `Đã tạo bản nháp Welcome Email kèm File PDF cho ${data.fullName}`,
    "Thành công 🎉",
    5,
  );
}
