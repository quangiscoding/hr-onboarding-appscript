/** ==========================================
 * WORKFLOWS.JS - CÁC LUỒNG EMAIL (BUSINESS LOGIC)
 * ==========================================
 * Mỗi hàm handle*Workflow(data) thực hiện 1 luồng nghiệp vụ và
 * RETURN kết quả thuần — KHÔNG gọi SpreadsheetApp.getUi() (xem docs/refactor-plan.md, Phase 1).
 *
 * Contract chung của mọi handler:
 * - Thành công: return { ok: true, message: string, ...dữ liệu chi tiết }
 * - Thất nghiệp vụ: throw WorkflowError(code, userMessage, details)
 * - Lỗi hệ thống khác: throw bình thường, tầng gọi tự catch
 *
 * Nhờ vậy các luồng tái sử dụng được từ Menu, Sidebar, Web App hoặc trigger nền.
 */

/* ------------------------------------------------------------------ */
/* PRIVATE HELPERS                                                     */
/* ------------------------------------------------------------------ */

/**
 * Tạo Gmail Draft và trả về { type, id } để ghi log.
 * @param {string} to
 * @param {Object} mail - { subject, htmlBody }
 * @param {string} type - Nhãn loại draft (DevOps / HR / IT)
 */
function createLabeledDraft(to, mail, type) {
  const draft = GmailApp.createDraft(to, mail.subject, "", {
    htmlBody: mail.htmlBody,
  });
  return { type, id: draft.getId() };
}

/* ------------------------------------------------------------------ */
/* LUỒNG 1: OFFER ACCEPTED -> DRAFT CHO DEVOPS / HR / IT               */
/* ------------------------------------------------------------------ */

/**
 * Tạo bản nháp Email gửi cho các Phòng ban (DevOps, HR, IT)
 * @param {Object} data - Dữ liệu ứng viên đã chuẩn hóa
 * @returns {{ ok: true, message: string, drafts: Array<{type: string, id: string}> }}
 */
function handleOfferAcceptedWorkflow(data) {
  const createdDrafts = [];

  // 1. Draft gửi DevOps
  createdDrafts.push(
    createLabeledDraft(
      CONFIG.RECIPIENTS.DEVOPS,
      getDevOpsEmailTemplate(data),
      "DevOps",
    ),
  );

  // 2. Draft gửi HR
  createdDrafts.push(
    createLabeledDraft(
      CONFIG.RECIPIENTS.HR,
      getHREmailTemplate(data),
      "HR",
    ),
  );

  // 3. Draft gửi IT - chỉ khi Device Request là "as company standard"
  if (isStandardDevice(data.deviceRequest)) {
    createdDrafts.push(
      createLabeledDraft(
        CONFIG.RECIPIENTS.IT,
        getITEmailTemplate(data),
        "IT",
      ),
    );
  }

  // 4. Ghi log
  logInternalWorkflow(data, createdDrafts);

  // 5. Trả kết quả cho tầng hiển thị
  return {
    ok: true,
    message: `Đã tạo thành công ${createdDrafts.length} bản nháp Email nhắc việc cho ${data.fullName}!`,
    drafts: createdDrafts,
  };
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
    throw new WorkflowError(
      "MISSING_TA_EMAIL",
      "Không tìm thấy email của TA In Charge, không thể gửi Notification Email.",
    );
  }

  // 2. Gửi Email trực tiếp, bọc try...catch (Defensive Programming)
  try {
    const taMail = getTaNotificationEmailTemplate(data);
    GmailApp.sendEmail(data.taEmail, taMail.subject, "", {
      htmlBody: taMail.htmlBody,
    });
  } catch (error) {
    Logger.log("❌ Lỗi khi gửi Notification Email cho TA: " + error.toString());
    throw new WorkflowError(
      "SEND_FAILED",
      `Không thể gửi Notification Email tới ${data.taEmail}. Vui lòng kiểm tra lại.`,
      { originalError: error.message, taEmail: data.taEmail },
    );
  }

  // 3. Ghi log
  logTaNotificationWorkflow(data, data.taEmail);

  // 4. Trả kết quả cho tầng hiển thị
  return {
    ok: true,
    message: `Đã gửi Notification Email trực tiếp cho TA (${data.taEmail}) về nhân sự ${data.fullName}!`,
    sentTo: data.taEmail,
  };
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

  const candidateMail = getWelcomeCandidateEmailTemplate(data, guidePreviewUrl);

  // 2. Danh sách file đính kèm
  const emailAttachments = [];
  if (pdfInfo && pdfInfo.pdfBlob) {
    emailAttachments.push(pdfInfo.pdfBlob);
  } else {
    Logger.log(
      "⚠️ Cảnh báo: Không tìm thấy file PDF đính kèm cho Welcome Email!",
    );
  }

  // 3. Danh sách CC (TA in charge, Line Manager, People Team)
  const ccList = [
    data.taEmail,
    data.managerEmail,
    CONFIG.RECIPIENTS.PEOPLE_TEAM,
  ]
    .filter(Boolean)
    .join(",");

  // 4. Tạo Draft (ưu tiên Working Email, fallback Personal Email)
  const recipientEmail = data.workingEmail || data.personalEmail;
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

  // 5. Ghi log
  logCandidateWorkflow(data, candidateDraft.getId());

  // 6. Trả kết quả cho tầng hiển thị
  return {
    ok: true,
    message: `Đã tạo bản nháp Welcome Email kèm File PDF cho ${data.fullName}!`,
    draftId: candidateDraft.getId(),
    hasAttachment: emailAttachments.length > 0,
  };
}
