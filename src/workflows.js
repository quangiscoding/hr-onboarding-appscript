/**
 * LUỒNG 1: Tạo bản nháp Email gửi cho các Phòng ban (DevOps, HR, IT)
 * @param {Object} data - Dữ liệu ứng viên
 */
function handleOfferAcceptedWorkflow(data) {
  const createdDrafts = [];

  // 1. Tạo Draft gửi DevOps
  const devopsMail = getDevOpsEmailTemplate(data);
  const devopsDraft = GmailApp.createDraft(
    CONFIG.RECIPIENTS.DEVOPS,
    devopsMail.subject,
    "",
    {
      htmlBody: devopsMail.htmlBody,
    },
  );
  createdDrafts.push({ type: "DevOps", id: devopsDraft.getId() });

  // 2. Tạo Draft gửi HR
  const hrMail = getHREmailTemplate(data);
  const hrDraft = GmailApp.createDraft(
    CONFIG.RECIPIENTS.HR,
    hrMail.subject,
    "",
    {
      htmlBody: hrMail.htmlBody,
    },
  );
  createdDrafts.push({ type: "HR", id: hrDraft.getId() });

  // 3. Tạo Draft gửi IT - Chỉ gửi khi Device Request chứa "as company standard"
  const deviceRequested = data.deviceRequest
    ?.toLowerCase()
    .includes("as company standard");
  if (deviceRequested) {
    const itMail = getITEmailTemplate(data);
    const itDraft = GmailApp.createDraft(
      CONFIG.RECIPIENTS.IT,
      itMail.subject,
      "",
      {
        htmlBody: itMail.htmlBody,
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
 * LUỒNG 2: Gửi / Tạo Draft Welcome Email cho Nhân sự mới kèm File PDF
 * @param {Object} data - Dữ liệu ứng viên
 */
function handleWelcomeEmailWorkflow(data) {
  // 1. Đọc file PDF đính kèm
  const pdfFileInfo = getGuidePdfFileInfo(
    data.employmentType,
    data.onboardingType,
  );
  const guidePreviewUrl = pdfFileInfo?.fileId
    ? `https://drive.google.com/file/d/${pdfFileInfo.fileId}/view`
    : "#";

  // 2. Lấy Template Email Candidate
  const candidateMail = getWelcomeCandidateEmailTemplate(data, guidePreviewUrl);

  // 3. Chuẩn bị danh sách CC
  const ccList = [
    data.taEmail,
    data.managerEmail,
    CONFIG.RECIPIENTS.PEOPLE_TEAM,
  ]
    .filter(Boolean)
    .join(",");

  // 4. Cấu hình Options cho Gmail Draft
  const options = {
    htmlBody: candidateMail.htmlBody,
    cc: ccList,
  };

  if (pdfFileInfo?.file) {
    options.attachments = [pdfFileInfo.file.setName(data.customFileName)];
  }

  // 5. Tạo Draft Welcome Email & Lấy Draft ID
  const candidateDraft = GmailApp.createDraft(
    data.workingEmail,
    candidateMail.subject,
    "",
    options,
  );

  // 6. 📝 GHI LOG CANDIDATE
  logCandidateWorkflow(data, candidateDraft.getId());

  // 7. Hiện Pop-up Alert thông báo giữa màn hình
  SpreadsheetApp.getUi().alert(
    "Thành công 🎉",
    `Đã tạo bản nháp Welcome Email kèm File PDF cho ${data.fullName}!`,
    SpreadsheetApp.getUi().ButtonSet.OK,
  );
}
