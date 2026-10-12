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
/* LUỒNG 4: NHỜ CẬP NHẬT AVATAR CHO ANH TUẤN / IT OPS (UC06)            */
/* ------------------------------------------------------------------ */

/**
 * Quét danh sách ứng viên onboard HÔM NAY thuộc quản lý của TA đang thao tác (quét từ dưới lên)
 * và gửi mail trực tiếp cho anh Tuấn / IT Ops nhờ cập nhật Avatar (UC06).
 *
 * @returns {{ ok: true, message: string, sentCount: number, candidates: Array<string> }}
 * @throws {WorkflowError} NO_MATCHED_CANDIDATES khi không tìm thấy ứng viên, SEND_FAILED khi gửi lỗi
 */
function handleAvatarUpdateWorkflow() {
  // 1. Lấy email của TA đang thao tác bấm nút trên Sheet
  const currentUserEmail = Session.getActiveUser()
    .getEmail()
    .toLowerCase()
    .trim();
  if (!currentUserEmail) {
    throw new WorkflowError(
      "UNAUTHORIZED",
      "Không thể xác định email người dùng đang thao tác. Vui lòng kiểm tra tài khoản đăng nhập.",
    );
  }

  const extractAllocCode = (str) => {
    if (!str) return "";
    const cleanStr = String(str).trim().toLowerCase();
    return cleanStr.includes("@") ? cleanStr.split("@")[0] : cleanStr;
  };

  const currentAllocCode = extractAllocCode(currentUserEmail);

  // 2. Lấy đúng tab dữ liệu người dùng đang thao tác
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const mainSheet = ss.getActiveSheet();

  // Tìm dòng thực sự có dữ liệu tên nhân sự (Cột 2 / Cột B)
  const rawLastRow = mainSheet.getLastRow();
  if (rawLastRow <= 1) {
    throw new WorkflowError(
      "EMPTY_SHEET",
      "Sheet dữ liệu Hera hiện đang rỗng.",
    );
  }

  const colValues = mainSheet.getRange(1, 2, rawLastRow, 1).getValues();
  let actualLastRow = 1;
  for (let r = colValues.length - 1; r >= 0; r--) {
    if (colValues[r][0] && String(colValues[r][0]).trim() !== "") {
      actualLastRow = r + 1;
      break;
    }
  }

  if (actualLastRow <= 1) {
    throw new WorkflowError(
      "EMPTY_SHEET",
      "Không tìm thấy dòng dữ liệu nhân sự hợp lệ nào.",
    );
  }

  // 3. Đọc recipients động cho IT Ops từ tab Data
  const itRecipients = getRecipientsByRole(CONFIG.RECIPIENT_ROLES.IT);
  const tuanEmail = (itRecipients?.to || []).join(",");
  const tuanCc = (itRecipients?.cc || []).join(",");

  if (!tuanEmail) {
    throw new WorkflowError(
      "MISSING_IT_RECIPIENT",
      "Không tìm thấy email người nhận của IT Ops trong tab Data.",
    );
  }

  // 4. Tra cứu bảng Avatar UC06
  const avatarLookupMap = {};
  try {
    const AVATAR_SHEET_ID = "1NoTqsI8oiV0ilqlhLYiAKK6igsyw1n4Z50OxDR3eKcw";
    let targetSs;
    try {
      targetSs = SpreadsheetApp.openById(AVATAR_SHEET_ID);
    } catch (e) {
      targetSs = ss;
    }

    const avatarSheet = targetSs.getSheets()[0];
    const avatarValues = avatarSheet.getDataRange().getValues();

    for (let i = 1; i < avatarValues.length; i++) {
      const row = avatarValues[i];
      const email = String(row[1] || "")
        .trim()
        .toLowerCase();
      const pictureUrl = String(row[5] || "").trim();

      if (email && pictureUrl) {
        avatarLookupMap[email] = pictureUrl;
      }
    }
  } catch (err) {
    Logger.log(
      "⚠️ Cảnh báo: Không thể tải bảng tra cứu Avatar UC06: " + err.message,
    );
  }

  const scriptTimeZone = Session.getScriptTimeZone();
  const todayStr = Utilities.formatDate(
    new Date(),
    scriptTimeZone,
    "yyyy-MM-dd",
  );

  const parseToDateStr_ = (val) => {
    if (!val) return "";

    // 1. Nếu trên Sheet là dạng Ngày (Date object)
    if (val instanceof Date) {
      return !isNaN(val.getTime())
        ? Utilities.formatDate(val, scriptTimeZone, "yyyy-MM-dd")
        : "";
    }

    // 2. Chuyển thành chuỗi và xóa khoảng trắng
    const strVal = String(val).trim();

    // 3. Xử lý dạng chữ: "12-Oct-2026" hoặc "12 Oct 2026"
    const monthMap = {
      jan: "01",
      feb: "02",
      mar: "03",
      apr: "04",
      may: "05",
      jun: "06",
      jul: "07",
      aug: "08",
      sep: "09",
      oct: "10",
      nov: "11",
      dec: "12",
    };
    const textMatch = strVal.match(/^(\d{1,2})[-/ ]([A-Za-z]{3})[-/ ](\d{4})/);
    if (textMatch) {
      const day = textMatch[1].padStart(2, "0");
      const month = monthMap[textMatch[2].toLowerCase()];
      const year = textMatch[3];
      if (month) return `${year}-${month}-${day}`;
    }

    // 4. Xử lý dạng số: "12/10/2026" (LUÔN HIỂU LÀ: Ngày/Tháng/Năm)
    const parts = strVal.split(/[-/]+/);
    if (parts.length === 3) {
      const day = parts[0].padStart(2, "0");
      const month = parts[1].padStart(2, "0");
      const year = parts[2];
      // Đảm bảo là Ngày/Tháng/Năm hợp lệ
      if (day <= 31 && month <= 12 && year.length === 4) {
        return `${year}-${month}-${day}`;
      }
    }

    return "";
  };

  const matchedCandidates = [];

  // 5. Quét TỪ DÒNG THỰC TẾ CUỐI CÙNG ngược lên (tối đa 50 dòng)
  const SCAN_LIMIT = 10;
  const startRow = actualLastRow;
  const endRow = Math.max(2, actualLastRow - SCAN_LIMIT + 1);

  for (let rowIndex = startRow; rowIndex >= endRow; rowIndex--) {
    const rowData = getNormalizedInput("AVATAR_UPDATE", rowIndex);
    if (!rowData || !rowData.startDate) continue;

    const onboardDateStr = parseToDateStr_(rowData.startDate);
    const taAllocCode = extractAllocCode(rowData.taEmail);
    const rawStatus = String(rowData.status || "")
      .toLowerCase()
      .replace(/[-_ \t]/g, "");

    const isOnboardedStatus = rawStatus === "onboarded";
    const isTodayOnboard = onboardDateStr === todayStr;
    const isMyCandidate = taAllocCode === currentAllocCode;

    // ⚡ IN LOG CHẨN ĐOÁN 5 DÒNG GẦN NHẤT
    if (rowIndex > startRow - 5) {
      Logger.log(`--- Dòng ${rowIndex}: ${rowData.fullName} ---`);
      Logger.log(
        `- Raw Date: ${rowData.startDate} => Parsed: '${onboardDateStr}' (Match Today ${todayStr}: ${isTodayOnboard})`,
      );
      Logger.log(
        `- Status: '${rowData.status}' => Clean: '${rawStatus}' (Match Onboarded: ${isOnboardedStatus})`,
      );
      Logger.log(
        `- TA Email: '${rowData.taEmail}' => Alloc: '${taAllocCode}' (Match Current ${currentAllocCode}: ${isMyCandidate})`,
      );
    }

    // ĐIỀU KIỆN STRICT 3-IN-1: Onboard Đúng Hôm nay + Status "On-boarded" + Trùng TA In Charge
    if (isTodayOnboard && isOnboardedStatus && isMyCandidate) {
      const personalEmail = String(rowData.personalEmail || "")
        .trim()
        .toLowerCase();

      const avatarUrl =
        avatarLookupMap[personalEmail] || rowData.masterCvFolderUrl || "";

      matchedCandidates.push({
        data: rowData,
        avatarUrl: avatarUrl,
      });
    }
  }

  // 6. Kiểm tra nếu không có ứng viên phù hợp -> Tự log & ném lỗi
  if (matchedCandidates.length === 0) {
    throw new WorkflowError(
      "NO_MATCHED_CANDIDATES",
      `Không tìm thấy nhân sự nào onboard hôm nay (${todayStr}) có trạng thái "On-boarded" thuộc quản lý của bạn (${currentAllocCode}).`,
      {
        todayStr,
        currentAllocCode,
        scannedRows:
          actualLastRow - Math.max(2, actualLastRow - SCAN_LIMIT + 1) + 1,
      },
    );
  }

  // 7. Tiến hành gửi mail từng ứng viên cho IT Ops (Anh Tuấn)
  const sentCandidateNames = [];
  try {
    matchedCandidates.forEach((item) => {
      const mailContent = getAvatarUpdateEmailTemplate(item);
      const combinedCc = [tuanCc, currentUserEmail].filter(Boolean).join(",");
      sendDirectEmail_(tuanEmail, mailContent, combinedCc);
      sentCandidateNames.push(item.data.fullName);
    });

    Logger.log(
      `✅ TA ${currentUserEmail} đã gửi thành công ${sentCandidateNames.length} email UC06 cập nhật avatar.`,
    );

    return {
      ok: true,
      message: `Đã gửi thành công ${sentCandidateNames.length} email nhờ IT Ops (anh Tuấn) cập nhật avatar!\n\nNhân sự: ${sentCandidateNames.join(", ")}`,
      sentCount: sentCandidateNames.length,
      candidates: sentCandidateNames,
    };
  } catch (error) {
    throw new WorkflowError(
      "SEND_FAILED",
      `Quá trình gửi email cập nhật avatar thất bại: ${error.message}`,
      { originalError: error.message },
    );
  }
}
