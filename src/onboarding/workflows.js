/** ==========================================
 * WORKFLOWS.JS - CÁC LUỒNG EMAIL (BUSINESS LOGIC)
 * ==========================================
 * Mỗi hàm handle*Workflow(data) thực hiện 1 luồng nghiệp vụ và
 * RETURN kết quả thuần — KHÔNG gọi SpreadsheetApp.getUi().
 *
 * Contract chung của mọi handler:
 * - Thành công: ghi log thành công + return { ok: true, message: string, ...dữ liệu chi tiết }
 * - Thất bại nghiệp vụ: ghi log thất bại + throw WorkflowError(code, userMessage, details)
 * - Lỗi hệ thống khác: ghi log thất bại + throw bình thường
 */

/* ------------------------------------------------------------------ */
/* PRIVATE HELPERS                                                    */
/* ------------------------------------------------------------------ */

/**
 * Gửi 1 email TRỰC TIẾP qua GmailApp.
 * @param {string} to
 * @param {Object} mail - { subject, htmlBody }
 * @param {string} [cc] - Danh sách CC cách nhau bởi dấu phẩy
 */
function sendDirectEmail_(to, mail, cc) {
  GmailApp.sendEmail(to, mail.subject, "", {
    htmlBody: mail.htmlBody,
    cc: cc || "",
  });
}

/* ------------------------------------------------------------------ */
/* LUỒNG 1: OFFER ACCEPTED -> GỬI THẲNG CHO DEVOPS / HR / IT           */
/* ------------------------------------------------------------------ */

/**
 * Gửi Email TRỰC TIẾP cho các Phòng ban (DevOps, HR, IT) — không tạo draft.
 * @param {Object} data - Dữ liệu ứng viên đã chuẩn hóa
 * @returns {{ ok: true, message: string, sent: Array<{type: string, to: string}> }}
 * @throws {WorkflowError} SEND_FAILED khi gửi bất kỳ email nào thất bại
 */
function handleOfferAcceptedWorkflow(data) {
  const sentEmails = [];
  try {
    // Đọc recipients động từ sheet Data (Role | Send to | CC)
    const devopsRecipients = getRecipientsByRole(CONFIG.RECIPIENT_ROLES.DEVOPS);
    const hrRecipients = getRecipientsByRole(CONFIG.RECIPIENT_ROLES.HR);
    const itRecipients = getRecipientsByRole(CONFIG.RECIPIENT_ROLES.IT);

    // Helper gửi 1 email, nếu lỗi thì log thất bại rồi ném WorkflowError
    const sendTo = (type, recipients, mail) => {
      const to = (recipients?.to || []).join(",");
      const cc = (recipients?.cc || []).join(",");
      try {
        sendDirectEmail_(to, mail, cc);
        sentEmails.push({ type, to });
      } catch (error) {
        Logger.log(`❌ Lỗi khi gửi email ${type}: ` + error.toString());
        const errorMsg = `Lỗi gửi email ${type} tới (${to}): ${error.message}`;
        // Ghi log trạng thái FAILED kèm chi tiết lỗi
        logInternalWorkflow(data, sentEmails, "FAILED", errorMsg);
        throw new WorkflowError(
          "SEND_FAILED",
          `Không thể gửi email ${type} tới ${to}. Các email sau đó đã bị dừng.`,
          { originalError: error.message, type },
        );
      }
    };

    // 1. Gửi thẳng DevOps
    sendTo("DevOps", devopsRecipients, getDevOpsEmailTemplate(data));

    // 2. Gửi thẳng HR (Role "OKR" trong sheet Data)
    sendTo("HR", hrRecipients, getHREmailTemplate(data));

    // 3. Gửi thẳng IT - chỉ khi Device Request là "as company standard"
    if (isStandardDevice(data.deviceRequest)) {
      sendTo("IT", itRecipients, getITEmailTemplate(data));
    }

    // 4. Ghi log THÀNH CÔNG
    logInternalWorkflow(data, sentEmails, "EMAIL_SENT", "");

    // 5. Trả kết quả cho tầng hiển thị
    return {
      ok: true,
      message: `Đã gửi thành công ${sentEmails.length} email nhắc việc cho ${data.fullName}!\n\nNgười nhận: ${sentEmails.map((e) => e.type).join(", ")}`,
      sent: sentEmails,
    };
  } catch (error) {
    // Nếu lỗi xảy ra ngoài hàm sendTo (ví dụ: đọc recipients hay render template thất bại)
    if (!(error instanceof WorkflowError)) {
      Logger.log(
        "❌ Lỗi hệ thống trong handleOfferAcceptedWorkflow: " +
          error.toString(),
      );
      logInternalWorkflow(data, sentEmails, "FAILED", error.message);
    }
    throw error;
  }
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
    const errorMsg = "Không tìm thấy email của TA In Charge.";
    logTaNotificationWorkflow(data, "N/A", "FAILED", errorMsg);
    throw new WorkflowError("MISSING_TA_EMAIL", errorMsg);
  }

  // 2. Gửi Email trực tiếp, bọc try...catch
  try {
    const taMail = getTaNotificationEmailTemplate(data);
    GmailApp.sendEmail(data.taEmail, taMail.subject, "", {
      htmlBody: taMail.htmlBody,
    });

    // 3. Ghi log THÀNH CÔNG
    logTaNotificationWorkflow(data, data.taEmail, "EMAIL_SENT", "");

    // 4. Trả kết quả cho tầng hiển thị
    return {
      ok: true,
      message: `Đã gửi Notification Email trực tiếp cho TA (${data.taEmail}) về nhân sự ${data.fullName}!`,
      sentTo: data.taEmail,
    };
  } catch (error) {
    Logger.log("❌ Lỗi khi gửi Notification Email cho TA: " + error.toString());
    const errorMsg = `Không thể gửi Notification Email: ${error.message}`;
    // Ghi log THẤT BẠI
    logTaNotificationWorkflow(data, data.taEmail, "FAILED", errorMsg);
    throw new WorkflowError(
      "SEND_FAILED",
      `Không thể gửi Notification Email tới ${data.taEmail}. Vui lòng kiểm tra lại.`,
      { originalError: error.message, taEmail: data.taEmail },
    );
  }
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
  const recipientEmail = data.workingEmail || data.personalEmail;

  try {
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

    const candidateMail = getWelcomeCandidateEmailTemplate(
      data,
      guidePreviewUrl,
    );

    // 2. Danh sách file đính kèm
    const emailAttachments = [];
    if (pdfInfo && pdfInfo.pdfBlob) {
      emailAttachments.push(pdfInfo.pdfBlob);
    } else {
      Logger.log(
        "⚠️ Cảnh báo: Không tìm thấy file PDF đính kèm cho Welcome Email!",
      );
    }

    // 3. Danh sách CC (TA in charge, People Team - đọc động từ sheet Data)
    const peopleTeamRecipients = getRecipientsByRole(
      CONFIG.RECIPIENT_ROLES.PEOPLE_TEAM,
    );
    const ccList = [
      data.taEmail,
      ...(peopleTeamRecipients?.to || []),
      ...(peopleTeamRecipients?.cc || []),
    ]
      .filter(Boolean)
      .join(",");

    // 4. Tạo Draft (ưu tiên Working Email, fallback Personal Email)
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

    // 5. Ghi log THÀNH CÔNG
    logCandidateWorkflow(data, draftId, "DRAFT_CREATED", "");

    // 6. Trả kết quả cho tầng hiển thị
    return {
      ok: true,
      message: `Đã tạo bản nháp Welcome Email kèm File PDF cho ${data.fullName}!`,
      draftId: draftId,
      hasAttachment: emailAttachments.length > 0,
    };
  } catch (error) {
    Logger.log("❌ Lỗi khi tạo Welcome Draft: " + error.toString());
    const errorMsg = `Lỗi tạo bản nháp (${recipientEmail || "N/A"}): ${error.message}`;
    // Ghi log THẤT BẠI
    logCandidateWorkflow(data, "N/A", "FAILED", errorMsg);
    throw new WorkflowError(
      "DRAFT_FAILED",
      `Không thể tạo Welcome Draft cho ${data.fullName}: ${error.message}`,
      { originalError: error.message },
    );
  }
}

/* ------------------------------------------------------------------ */
/* LUỒNG 4: NHỜ CẬP NHẬT AVATAR CHO IT OPS (UC06)                     */
/* ------------------------------------------------------------------ */
/**
 * Business Logic cho luồng AVATAR_UPDATE (Batch Processing)
 * Được gọi trực tiếp từ Controller main.js thông qua WORKFLOW_REGISTRY.AVATAR_UPDATE.run()
 */
/**
 * Business Logic cho luồng AVATAR_UPDATE (Batch Processing)
 * Được gọi trực tiếp từ Controller main.js thông qua WORKFLOW_REGISTRY.AVATAR_UPDATE.run()
 */
function handleAvatarUpdateWorkflow() {
  const SPREADSHEET_UC06_ID = "1NoTqsI8oiV0ilqlhLYiAKK6igsyw1n4Z50OxDR3eKcw";
  const TRIGGER_TYPE = "AVATAR_UPDATE";

  // 1. Lấy Alloc Code người dùng thao tác
  const currentUserEmail = Session.getActiveUser()
    .getEmail()
    .toLowerCase()
    .trim();
  const currentAllocCode = currentUserEmail.split("@")[0].trim();

  // 2. Tra cứu file UC06 bằng getHeaderColumnMap (không dùng fallback)
  let avatarMap = {};
  let uc06SheetUrl = "";
  try {
    const uc06Ss = SpreadsheetApp.openById(SPREADSHEET_UC06_ID);
    const uc06Sheet = uc06Ss.getSheets()[0];
    uc06SheetUrl = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_UC06_ID}/edit#gid=${uc06Sheet.getSheetId()}`;

    const lastRow = uc06Sheet.getLastRow();
    const lastCol = uc06Sheet.getLastColumn();

    if (lastRow > 1) {
      const uc06ColMap = getHeaderColumnMap(uc06Sheet);

      // Lấy trực tiếp cột Email Address và Picture, không chế fallback
      const emailColNumber = uc06ColMap[normalizeHeaderKey("Email Address")];
      const pictureColNumber = uc06ColMap[normalizeHeaderKey("Picture")];

      if (emailColNumber && pictureColNumber) {
        const emailColIdx = emailColNumber - 1;
        const pictureColIdx = pictureColNumber - 1;
        const pictureColLetter = String.fromCharCode(64 + pictureColNumber);

        const uc06Data = uc06Sheet
          .getRange(2, 1, lastRow - 1, lastCol)
          .getValues();

        for (let i = 0; i < uc06Data.length; i++) {
          const row = uc06Data[i];
          const rawEmail = row[emailColIdx];
          if (!rawEmail) continue;

          const personalEmail = String(rawEmail).trim().toLowerCase();
          const pictureUrl = String(row[pictureColIdx] || "").trim();

          if (personalEmail) {
            const uc06RowNumber = i + 2;
            avatarMap[personalEmail] = {
              pictureUrl: pictureUrl,
              uc06RowNumber: uc06RowNumber,
              uc06RowLink: `${uc06SheetUrl}&range=${pictureColLetter}${uc06RowNumber}`,
            };
          }
        }
      }
    }
  } catch (e) {
    Logger.log("⚠️ Lỗi tải bảng tra cứu Avatar UC06: " + e.message);
  }

  // 3. Đọc dữ liệu Sheet Hera chính
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getActiveSheet();
  const sheetUrl = ss.getUrl();
  const lastRow = sheet.getLastRow();

  if (lastRow <= 1) {
    return { message: "Sheet dữ liệu Hera hiện đang rỗng." };
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

  // 4. Quét BATCH từ dòng dưới cùng ngược lên dòng 2
  for (let r = lastRow; r >= 2; r--) {
    let candidateData;
    try {
      candidateData = getNormalizedInput(TRIGGER_TYPE, r);
    } catch (err) {
      continue;
    }

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

    // Điều kiện 1: Trạng thái On-boarded
    const rawStatus = String(status || "")
      .toLowerCase()
      .replace(/[-_ \t]/g, "");
    if (rawStatus !== "onboarded") continue;

    // Điều kiện 2: Ngày Onboard trùng HÔM NAY
    if (startDate !== todayDisplayStr && startDate !== todayStr) continue;

    // Điều kiện 3: Alloc Code của TA trùng người đang thao tác
    const taAllocCode = String(taEmail || "")
      .split("@")[0]
      .trim()
      .toLowerCase();
    if (taAllocCode !== currentAllocCode) continue;

    // 🔒 Check Lock: Dòng VÀ Email này đã được gửi cho DevOps và khóa trước đó chưa?
    if (isRowLockedForWorkflow(rowNumber, TRIGGER_TYPE, targetLockEmail)) {
      continue;
    }

    // Tra cứu UC06 theo Email cá nhân
    const cleanPersonalEmail = personalEmail.toLowerCase();
    const uc06Info = avatarMap[cleanPersonalEmail] || null;

    candidateData.avatarUrl = uc06Info ? uc06Info.pictureUrl : "";
    candidateData.uc06RowNumber = uc06Info ? uc06Info.uc06RowNumber : null;
    candidateData.uc06RowLink = uc06Info ? uc06Info.uc06RowLink : "";

    if (candidateData.avatarUrl) {
      readyForDevOps.push(candidateData);
    } else {
      missingForTA.push(candidateData);
    }
  }

  if (readyForDevOps.length === 0 && missingForTA.length === 0) {
    return {
      message: `Không tìm thấy nhân sự onboard hôm nay (${todayDisplayStr}) thuộc quản lý của bạn (${currentAllocCode}) cần xử lý (hoặc tất cả đã được gửi và khóa trước đó).`,
    };
  }

  let summaryMsg = [];

  // 5. Gửi 1 Mail Digest cho DevOps & ĐÓNG DẤU KHÓA METADATA
  if (readyForDevOps.length > 0) {
    const devopsRecipients = getRecipientsByRole(CONFIG.RECIPIENT_ROLES.DEVOPS);
    const mailTemplate = getAvatarUpdateDigestTemplate(
      readyForDevOps,
      sheetUrl,
      todayDisplayStr,
    );

    const to = (devopsRecipients?.to || []).join(",");
    const cc = [(devopsRecipients?.cc || []).join(","), currentUserEmail]
      .filter(Boolean)
      .join(",");

    sendDirectEmail_(to, mailTemplate, cc);

    // Khóa metadata & Ghi log thành công cho các dòng đã gửi DevOps
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
      `✅ Đã gửi 1 Digest Email cho DevOps (${readyForDevOps.length} nhân sự có ảnh) và KHÓA dòng tương ứng.`,
    );
  }

  // 6. Gửi 1 Mail Digest Nhắc Nhở cho TA in charge (KHÔNG KHÓA METADATA)
  if (missingForTA.length > 0) {
    const mailTemplate = getAvatarTaReminderDigestTemplate(
      missingForTA,
      currentAllocCode,
      todayDisplayStr,
    );

    sendDirectEmail_(currentUserEmail, mailTemplate, "");

    summaryMsg.push(
      `⚠️ Đã gửi 1 Email nhắc nhở cho TA (${missingForTA.length} nhân sự thiếu ảnh). Các dòng này CHƯA KHÓA để tiếp tục quét lại sau khi bổ sung.`,
    );
  }

  // Trả kết quả về cho main.js gọi notifySuccess()
  return {
    message: summaryMsg.join("\n\n"),
  };
}
