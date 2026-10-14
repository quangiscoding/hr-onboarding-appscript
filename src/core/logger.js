/** ==========================================
 * LOGGER.JS - GHI LOG WORKFLOW VÀO TAB BẢNG TÍNH
 * ========================================== */

function getOrCreateLogSheet(sheetName, headers) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) {
    Logger.log("❌ Không tìm thấy Active Spreadsheet.");
    return null;
  }

  let sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    if (headers && headers.length > 0) {
      sheet.appendRow(headers);
      sheet
        .getRange(1, 1, 1, headers.length)
        .setFontWeight("bold")
        .setBackground("#f3f3f3");
      sheet.setFrozenRows(1);
    }
  }
  return sheet;
}

function appendWorkflowLog(config, values) {
  try {
    if (!config || !config.SHEET_NAME) return;
    const sheet = getOrCreateLogSheet(config.SHEET_NAME, config.HEADERS);
    if (sheet) {
      sheet.appendRow([new Date(), ...values]);
    }
  } catch (error) {
    Logger.log(
      `❌ Lỗi ghi log vào tab "${config?.SHEET_NAME}": ` + error.message,
    );
  }
}

function safeTitleCase_(str) {
  if (!str) return "";
  return typeof toTitleCase === "function" ? toTitleCase(str) : String(str);
}

/**
 * Ghi log luồng Internal Email
 */
function logInternalWorkflow(
  data,
  sentEmails,
  status = "EMAIL_SENT",
  errorDetail = "",
) {
  if (!Array.isArray(sentEmails) || sentEmails.length === 0) {
    // Trường hợp chưa gửi được mail nào đã fail
    appendWorkflowLog(CONFIG.LOG.INTERNAL, [
      data?.fullName || "",
      safeTitleCase_(data?.position),
      "N/A",
      "N/A",
      status,
      errorDetail,
    ]);
    return;
  }

  sentEmails.forEach((sent) => {
    appendWorkflowLog(CONFIG.LOG.INTERNAL, [
      data?.fullName || "",
      safeTitleCase_(data?.position),
      sent.type || "",
      sent.to || "",
      status,
      errorDetail,
    ]);
  });
}

/**
 * Ghi log luồng TA Notification
 */
function logTaNotificationWorkflow(
  data,
  sentTo,
  status = "EMAIL_SENT",
  errorDetail = "",
) {
  appendWorkflowLog(CONFIG.LOG.TA_NOTIFICATION, [
    data?.fullName || "",
    safeTitleCase_(data?.position),
    data?.allocCode || "",
    sentTo || "",
    status,
    errorDetail,
  ]);
}

/**
 * Ghi log luồng Candidate Welcome Draft
 */
function logCandidateWorkflow(
  data,
  draftId,
  status = "DRAFT_CREATED",
  errorDetail = "",
) {
  appendWorkflowLog(CONFIG.LOG.CANDIDATE, [
    data?.fullName || "",
    safeTitleCase_(data?.position),
    data?.allocCode || "",
    draftId || "",
    status,
    errorDetail,
  ]);
}

/**
 * Ghi log chi phí, Token và Thời gian gọi AI
 */
function logAiCostWorkflow(data) {
  try {
    const config = CONFIG?.LOG?.AI_COST;
    if (!config) return;

    let userEmail = "";
    try {
      userEmail =
        Session.getActiveUser().getEmail() ||
        Session.getEffectiveUser().getEmail();
    } catch (e) {
      userEmail = "N/A";
    }

    const provider = data?.provider || "N/A";
    const model = data?.model || "N/A";
    const pricing = CONFIG?.AI_PRICING?.[model] ||
      CONFIG?.AI_PRICING?.DEFAULT || { input: 0, output: 0 };

    const inputTokens = Number(data?.inputTokens) || 0;
    const outputTokens = Number(data?.outputTokens) || 0;

    const inputCost = (inputTokens / 1000000) * pricing.input;
    const outputCost = (outputTokens / 1000000) * pricing.output;
    const totalCost = inputCost + outputCost;

    // Định dạng thời gian hiển thị hh:mm:ss.sss
    const formatTime = (d) =>
      d instanceof Date
        ? Utilities.formatDate(d, Session.getScriptTimeZone(), "HH:mm:ss.SSS")
        : "";

    const timeStart = data?.timeStart ? formatTime(data.timeStart) : "";
    const timeEnd = data?.timeEnd ? formatTime(data.timeEnd) : "";
    const latencySec =
      data?.timeStart && data?.timeEnd
        ? Number(
            (
              (data.timeEnd.getTime() - data.timeStart.getTime()) /
              1000
            ).toFixed(2),
          )
        : 0;

    appendWorkflowLog(config, [
      userEmail, // User Call
      data?.fullName || "", // Fullname
      provider, // Provider
      model, // Model
      timeStart, // Time Start
      timeEnd, // Time End
      latencySec, // Latency (s)
      inputTokens, // Input Tokens
      outputTokens, // Output Tokens
      pricing.input, // Price Input ($/1M)
      pricing.output, // Price Output ($/1M)
      totalCost, // Total Cost ($)
      data?.status || "SUCCESS", // Status
      data?.errorDetail || "", // Error Details
    ]);
  } catch (error) {
    Logger.log("❌ Lỗi logAiCostWorkflow: " + error.message);
  }
}
