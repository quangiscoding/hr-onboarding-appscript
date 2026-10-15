/** ==========================================
 * LOGGER.JS - GHI LOG WORKFLOW VÀO TAB BẢNG TÍNH
 * ========================================== */

/**
 * Format Date object thành chuỗi "'HH:mm:ss.SSS"
 * Ép cứng padding 2 chữ số và dùng dấu ' đằng trước để Google Sheets không auto-format mất số 0
 */
function formatTime_(d) {
  if (!(d instanceof Date) || isNaN(d.getTime())) return "";
  const pad = (num) => String(num).padStart(2, "0");
  const padMs = (num) => String(num).padStart(3, "0");
  const hours = pad(d.getHours());
  const minutes = pad(d.getMinutes());
  const seconds = pad(d.getSeconds());
  return `'${hours}:${minutes}:${seconds}`;
}

/**
 * Format đầy đủ Ngày & Giờ cho cột Timestamp ('MM/DD/YYYY HH:mm:ss)
 */
function formatTimestamp_(d) {
  if (!(d instanceof Date) || isNaN(d.getTime())) return "";
  const pad = (num) => String(num).padStart(2, "0");
  const day = pad(d.getDate());
  const month = pad(d.getMonth() + 1);
  const year = d.getFullYear();
  const hours = pad(d.getHours());
  const minutes = pad(d.getMinutes());
  const seconds = pad(d.getSeconds());
  return `'${month}/${day}/${year} ${hours}:${minutes}:${seconds}`;
}

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

/**
 * Thêm 1 dòng log vào tab tương ứng, tự động thêm và format Timestamp đầu tiên
 */
function appendWorkflowLog(config, values) {
  try {
    if (!config || !config.SHEET_NAME) return;
    const sheet = getOrCreateLogSheet(config.SHEET_NAME, config.HEADERS);
    if (sheet) {
      // Định dạng Timestamp chuẩn 2 chữ số cho giờ/ngày
      const formattedTimestamp = formatTimestamp_(new Date());

      // Tạo mảng dòng log mới với Timestamp nằm ở cột A
      const rowData = [formattedTimestamp, ...values];

      sheet.appendRow(rowData);
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

    const timeStart = data?.timeStart ? formatTime_(data.timeStart) : "";
    const timeEnd = data?.timeEnd ? formatTime_(data.timeEnd) : "";

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
      timeStart, // Time Start ('HH:mm:ss.SSS)
      timeEnd, // Time End ('HH:mm:ss.SSS)
      latencySec, // Latency (s)
      inputTokens, // Input Tokens
      outputTokens, // Output Tokens
      pricing.input, // Price Input (\$/1M)
      pricing.output, // Price Output (\$/1M)
      totalCost, // Total Cost (\$)
      data?.status || "SUCCESS", // Status
      data?.errorDetail || "", // Error Details
    ]);
  } catch (error) {
    Logger.log("❌ Lỗi logAiCostWorkflow: " + error.message);
  }
}
