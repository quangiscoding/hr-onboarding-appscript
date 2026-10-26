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
 * Business Logic cho luồng AVATAR_UPDATE (Detailed Popup Output & TA Email)
 */
function handleAvatarUpdateWorkflow() {
  const SPREADSHEET_UC06_ID = CONFIG.SPREADSHEET_UC06_ID;
  const TRIGGER_TYPE = "AVATAR_UPDATE";

  // 1. Lấy Alloc Code người dùng thao tác
  const currentUserEmail = Session.getActiveUser()
    .getEmail()
    .toLowerCase()
    .trim();
  const currentAllocCode = currentUserEmail.split("@")[0].trim();

  // 2. TRA CỨU FILE UC06 (Lấy trước dữ liệu Avatar về RAM để tra cứu nhanh)
  let avatarMap = {};
  let uc06SheetUrl = "";

  try {
    // 2.1. Mở bảng tính UC06 và lấy link gốc đến Sheet đầu tiên
    const uc06Ss = SpreadsheetApp.openById(SPREADSHEET_UC06_ID);
    const uc06Sheet = uc06Ss.getSheets()[0];
    uc06SheetUrl = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_UC06_ID}/edit#gid=${uc06Sheet.getSheetId()}`;

    const lastRowUC06 = uc06Sheet.getLastRow();
    const lastColUC06 = uc06Sheet.getLastColumn();

    // 2.2. Kiểm tra bảng tính có dữ liệu hay không (dòng > 1 và cột > 0)
    if (lastRowUC06 > 1 && lastColUC06 > 0) {
      // Đọc hàng tiêu đề để tìm vị trí cột "Email Address" và "Picture" động
      const uc06ColMap = getHeaderColumnMap(uc06Sheet);
      const emailColNumber = uc06ColMap[normalizeHeaderKey("Email Address")];
      const pictureColNumber = uc06ColMap[normalizeHeaderKey("Picture")];

      // Chỉ thực hiện khi tìm thấy cả 2 cột cần thiết
      if (emailColNumber && pictureColNumber) {
        // emailColIdx & pictureColIdx (0-indexed): Dùng để truy xuất phần tử trong mảng Javascript (row[...])
        const emailColIdx = emailColNumber - 1;
        const pictureColIdx = pictureColNumber - 1;

        // pictureColLetter (1-indexed): Đổi số thứ tự cột trên Sheet sang ký tự A1 (VD: 1 -> "A", 27 -> "AA")
        // Dùng để tạo đường link trực tiếp đến đúng ô (cell) chứa avatar trên Google Sheets
        const pictureColLetter = getColumnLetterFromIndex(pictureColNumber);

        // Đọc toàn bộ bảng dữ liệu UC06 (từ dòng 2 đến hết) vào bộ nhớ RAM một lần duy nhất (Batch Read)
        const uc06Data = uc06Sheet
          .getRange(2, 1, lastRowUC06 - 1, lastColUC06)
          .getValues();

        // Duyệt qua từng dòng để xây dựng từ điển tra cứu avatarMap theo Email
        for (let i = 0; i < uc06Data.length; i++) {
          const row = uc06Data[i];
          const rawEmail = row[emailColIdx];
          if (!rawEmail) continue; // Bỏ qua nếu dòng này không có email

          const personalEmail = String(rawEmail).trim().toLowerCase();
          const pictureUrl = String(row[pictureColIdx] || "").trim();

          if (personalEmail) {
            // Chỉ số dòng hiển thị thực tế trên Google Sheets (dữ liệu bắt đầu từ dòng 2, nên dòng = i + 2)
            const uc06RowNumber = i + 2;

            // Lưu thông tin vào map: Khóa tra cứu là Email cá nhân dạng chữ thường
            avatarMap[personalEmail] = {
              pictureUrl: pictureUrl,
              uc06RowNumber: uc06RowNumber,
              // Link mở trực tiếp đến ô chứa ảnh trên sheet UC06 (VD: ...#gid=0&range=F5)
              uc06RowLink: `${uc06SheetUrl}&range=${pictureColLetter}${uc06RowNumber}`,
            };
          }
        }
      }
    }
  } catch (e) {
    // Ghi log cảnh báo nếu có lỗi xảy ra (ví dụ: không có quyền truy cập file UC06, sai ID,...)
    Logger.log("⚠️ Lỗi tải bảng tra cứu Avatar UC06: " + e.message);
  }

  // 3. ĐỌC BATCH TOÀN BỘ SHEET HERA & METADATA VỀ RAM (1 LẦN DUY NHẤT)
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getActiveSheet();
  const sheetUrl = ss.getUrl();
  const rawLastRow = sheet.getLastRow(); // Dòng cuối cùng có format/data

  // Kiểm tra Sheet rỗng (chỉ có 0 hoặc 1 dòng tiêu đề) -> Dừng sớm
  if (rawLastRow <= 1) return { message: "Sheet dữ liệu Hera hiện đang rỗng." };

  // --- A. Lấy bản đồ cột động + Tải toàn bộ bảng tính vào RAM (Batch Read) ---
  // heraColMap: Từ điển ánh xạ tiêu đề cột -> số thứ tự cột 1-indexed (VD: {"fullname": 1})
  const heraColMap = getHeaderColumnMap(sheet);

  // heraAllRowsData: Mảng 2 chiều chứa toàn bộ dữ liệu dòng 1 đến hết bảng tính
  const heraAllRowsData = sheet
    .getRange(1, 1, rawLastRow, sheet.getLastColumn())
    .getValues();

  // --- B. Đóng gói Cache Context cho hàm getNormalizedInput ---
  // Truyền object này vào các hàm chuẩn hóa để đọc dữ liệu trên RAM, tránh gọi API Sheet nhiều lần
  const cachedContext = {
    colMap: heraColMap,
    allRowsData: heraAllRowsData,
    sheetUrl: sheetUrl, // Đã có từ đầu hàm
    sheetId: sheet.getSheetId(), // Lấy 1 lần duy nhất
    currentUserEmail: Session.getEffectiveUser().getEmail(), // Lấy 1 lần duy nhất
  };

  // --- C. Tải toàn bộ trạng thái Lock Metadata về RAM một lần duy nhất ---
  // Giúp thao tác kiểm tra lock ở Bước 4 đạt tốc độ O(1), hạn chế gọi API độc lập từng dòng
  const lockedKeysSet = new Set();
  try {
    const allMetadata = sheet.getDeveloperMetadata();
    allMetadata.forEach((meta) => {
      const key = meta.getKey();
      const val = meta.getValue();
      if (key) lockedKeysSet.add(key);
      if (val) lockedKeysSet.add(val);
    });
  } catch (errMeta) {
    // Không ném lỗi: Nếu tải lô thất bại, Bước 4 sẽ fallback tự động sang kiểm tra đơn lẻ từng ô
    Logger.log("⚠️ Không tải được Metadata theo lô: " + errMeta.message);
  }

  // --- D. Xác định dòng dữ liệu thực tế (actualLastRow) dựa trên RAM ---
  // sheet.getLastRow() thường tính cả dòng rỗng có viền/format. Quét ngược để tìm dòng có text thật.
  let actualLastRow = 1;
  for (let r = heraAllRowsData.length - 1; r >= 1; r--) {
    // heraAllRowsData[r][1]: Cột thứ 2 (chỉ số 1 trong JS) - Thường là cột Họ tên / Mã định danh
    if (heraAllRowsData[r][1] && String(heraAllRowsData[r][1]).trim() !== "") {
      actualLastRow = r + 1; // Quy đổi từ index 0 (JS) sang số dòng 1-indexed của Sheets
      break;
    }
  }

  // Nếu duyệt xong mà không có dòng dữ liệu hợp lệ nào
  if (actualLastRow <= 1) {
    return { message: "Không tìm thấy dòng dữ liệu nhân sự hợp lệ nào." };
  }

  // --- E. Khởi tạo mốc thời gian đối soát theo múi giờ kịch bản ---
  const scriptTimeZone = Session.getScriptTimeZone();
  const todayStr = Utilities.formatDate(
    new Date(),
    scriptTimeZone,
    "yyyy-MM-dd", // Chuẩn định dạng ISO
  );
  const todayDisplayStr = Utilities.formatDate(
    new Date(),
    scriptTimeZone,
    "dd/MM/yyyy", // Chuẩn định dạng hiển thị ngày/tháng VN
  );

  const readyForDevOps = [];
  const missingForTA = [];
  const alreadyProcessed = []; // Mảng lưu các nhân sự đã gửi/khóa trước đó

  // 4. QUÉT MẢNG TRÊN RAM
  for (let r = actualLastRow; r >= 2; r--) {
    let candidateData;
    try {
      candidateData = getNormalizedInput(TRIGGER_TYPE, r, cachedContext);
    } catch (err) {
      continue;
    }
    if (!candidateData) continue;

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

    // Fast Check 1: Trạng thái On-boarded
    const rawStatus = String(status || "")
      .toLowerCase()
      .replace(/[-_ \t]/g, "");
    if (rawStatus !== "onboarded") continue;

    // Fast Check 2: Ngày Onboard trùng HÔM NAY
    if (startDate !== todayDisplayStr && startDate !== todayStr) continue;

    // Fast Check 3: Alloc Code của TA trùng người đang thao tác
    const taAllocCode = String(taEmail || "")
      .split("@")[0]
      .trim()
      .toLowerCase();
    if (taAllocCode !== currentAllocCode) continue;

    // 🔒 Fast Check 4: Check Lock Metadata trực tiếp qua RAM Set
    let isLocked = false;
    if (lockedKeysSet.size > 0) {
      const lockKey = `${TRIGGER_TYPE}_${rowNumber}_${targetLockEmail.toLowerCase()}`;
      isLocked = lockedKeysSet.has(lockKey);
    } else {
      isLocked = isRowLockedForWorkflow(
        rowNumber,
        TRIGGER_TYPE,
        targetLockEmail,
      );
    }

    // Nếu ĐÃ KHÓA -> Đưa vào danh sách đã xử lý
    if (isLocked) {
      alreadyProcessed.push(candidateData);
      continue;
    }

    // Tra cứu UC06 theo Email cá nhân trên RAM Map
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

  // 5. Kiểm tra nếu không có ứng viên MỚI nào cần xử lý
  if (readyForDevOps.length === 0 && missingForTA.length === 0) {
    if (alreadyProcessed.length > 0) {
      const dialogTemplate = HtmlService.createTemplateFromFile(
        "onboarding/dialog-templates/ta-reminder-dialog",
      );
      dialogTemplate.candidates = alreadyProcessed;
      dialogTemplate.noticeType = "PROCESSED";
      dialogTemplate.uc06Url = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_UC06_ID}/edit`;

      const calculatedHeight = Math.min(
        185 + alreadyProcessed.length * 38,
        480,
      );
      const htmlOutput = dialogTemplate
        .evaluate()
        .setWidth(680)
        .setHeight(calculatedHeight);

      SpreadsheetApp.getUi().showModalDialog(
        htmlOutput,
        `ℹ️ Danh sách nhân sự đã xử lý Avatar (${alreadyProcessed.length} nhân sự)`,
      );

      return {
        ok: true,
        suppressPopup: true,
        message: `Đã hiển thị ${alreadyProcessed.length} nhân sự đã được xử lý và khóa trước đó.`,
      };
    }

    throw new WorkflowError(
      "NO_CANDIDATES_FOUND",
      `Không tìm thấy nhân sự onboard hôm nay (${todayDisplayStr}) thuộc quản lý của bạn (${currentAllocCode}).
      \nHãy kiểm tra và đảm bảo cột Offer Status đang ở trạng thái On-boarded`,
    );
  }

  let summaryMsg = [];

  // 6. Gửi Mail Digest cho DevOps & KHÓA DÒNG tương ứng
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
      `✅ Đã gửi email nhắc DevOps cập nhật Avatar thành công cho ${readyForDevOps.length} nhân sự (đã khóa dòng tương ứng).`,
    );
  }

  // 7. Bật Modal HTML nhắc nhở bổ sung link cho TA
  if (missingForTA.length > 0) {
    const dialogTemplate = HtmlService.createTemplateFromFile(
      "onboarding/dialog-templates/ta-reminder-dialog",
    );
    dialogTemplate.candidates = missingForTA;
    dialogTemplate.noticeType = "MISSING";
    dialogTemplate.uc06Url = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_UC06_ID}/edit`;

    const calculatedHeight = Math.min(180 + missingForTA.length * 38, 480);
    const htmlOutput = dialogTemplate
      .evaluate()
      .setWidth(680)
      .setHeight(calculatedHeight);

    SpreadsheetApp.getUi().showModalDialog(
      htmlOutput,
      `⚠️ Nhắc nhở bổ sung Avatar cho TA (${missingForTA.length} nhân sự)`,
    );

    if (readyForDevOps.length === 0) {
      summaryMsg.push(
        `⚠️ Đã hiển thị danh sách ${missingForTA.length} nhân sự thiếu link Avatar trên UC06.`,
      );
    }
  }

  return {
    ok: true,
    status: missingForTA.length > 0 ? "HAS_MISSING" : "SUCCESS",
    alreadyProcessed: alreadyProcessed,
    readyForDevOps: readyForDevOps,
    suppressPopup: readyForDevOps.length === 0 && missingForTA.length > 0,
    message: summaryMsg.join("\n\n"),
  };
}
