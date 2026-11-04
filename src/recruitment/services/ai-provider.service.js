/**
 * services/ai-provider.service.js
 * Quản lý gửi request qua Gateway độc lập & n8n Gateway
 */
class AiProviderService {
  /**
   * Bắn HTTP request sang Gateway Web App (Apps Script Gateway gốc)
   * @param {Object} params - { provider, model, promptParts }
   * @returns {Object}
   */
  static callGateway({ provider, model, promptParts }) {
    const gatewayUrl = OUTLINE_CV_SUMMARIZER_CONFIG.GATEWAY.WEB_APP_URL;
    const payload = {
      userEmail: Session.getActiveUser().getEmail(),
      sourceApp: "Recruitment Onboarding",
      provider: provider,
      model: model,
      promptParts: promptParts,
    };

    const response = UrlFetchApp.fetch(gatewayUrl, {
      method: "post",
      contentType: "application/json",
      headers: {
        Authorization: "Bearer " + ScriptApp.getOAuthToken(),
      },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true,
    });

    const statusCode = response.getResponseCode();
    const rawText = response.getContentText() || "{}";
    let body = {};
    try {
      body = JSON.parse(rawText);
    } catch (e) {
      throw new Error(`Gateway phản hồi không đúng JSON (HTTP ${statusCode}): ${rawText}`);
    }

    if (statusCode !== 200 || !body.ok) {
      throw new Error(body.error || `Gateway lỗi (HTTP ${statusCode})`);
    }

    return body;
  }

  /**
   * Bắn HTTP request sang n8n Webhook Gateway (Xác thực qua X-Gateway-Secret)
   * @param {Object} payload - Dữ liệu cần gửi sang n8n
   * @returns {Object}
   */
  static callN8nGateway(payload) {
    const n8nWebhookUrl = OUTLINE_CV_SUMMARIZER_CONFIG.GATEWAY.N8N_WEBHOOK_URL;
    const gatewaySecret = OUTLINE_CV_SUMMARIZER_CONFIG.GATEWAY.SECRET;

    const effectiveEmail = (Session.getActiveUser().getEmail() || payload.callerEmail || "").trim().toLowerCase();
    if (!effectiveEmail.endsWith("@kyanon.digital")) {
      throw new Error(`403 Forbidden: Tài khoản '${effectiveEmail}' không thuộc domain @kyanon.digital.`);
    }
    payload.callerEmail = effectiveEmail;

    const options = {
      method: "post",
      contentType: "application/json",
      headers: {
        "X-Gateway-Secret": gatewaySecret,
      },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true,
    };

    const response = UrlFetchApp.fetch(n8nWebhookUrl, options);
    const statusCode = response.getResponseCode();
    const rawText = response.getContentText() || "{}";
    let body = {};

    try {
      body = JSON.parse(rawText);
    } catch (e) {
      throw new Error(`n8n Gateway phản hồi không đúng JSON (HTTP ${statusCode}): ${rawText}`);
    }

    if (statusCode === 401 || statusCode === 403) {
      throw new Error(body.error?.message || body.error || `HTTP ${statusCode}: Lỗi xác thực quyền truy cập.`);
    }

    if (statusCode !== 200 || body.ok === false) {
      const errMsg = body.error?.message || body.error || `HTTP ${statusCode}`;
      throw new Error(`n8n Gateway xử lý thất bại: ${errMsg}`);
    }

    return body;
  }

  /**
   * Tóm tắt CV ứng viên theo danh sách provider cấu hình (Hàm gốc)
   */
  static summarizeCv(cvContent, candidate) {
    const prompt = AiProviderUtil.buildWelcomePrompt(candidate);
    const promptParts = [{ text: prompt }];

    if (cvContent && cvContent.kind === "pdf_inline") {
      promptParts.push({
        inlineData: {
          mimeType: "application/pdf",
          data: cvContent.pdfBase64,
        },
      });
    } else {
      promptParts[0].text += "\n\nCV content:\n" + String((cvContent && cvContent.text) || "").slice(0, 15000);
    }

    const providers = OUTLINE_CV_SUMMARIZER_CONFIG.AI_PROVIDERS || ["gemini"];
    const errors = [];

    for (const provider of providers) {
      try {
        const models = provider === "openrouter" ? OUTLINE_CV_SUMMARIZER_CONFIG.OPENROUTER?.MODELS : OUTLINE_CV_SUMMARIZER_CONFIG.GEMINI?.MODELS;
        const targetModel = models && models.length ? models[0] : null;

        return this.callGateway({
          provider: provider,
          model: targetModel,
          promptParts: promptParts,
        });
      } catch (err) {
        errors.push(`[${provider}] ${err.message}`);
        Logger.log(`⚠️ Provider ${provider} qua Gateway lỗi, thử provider kế: ${err.message}`);
      }
    }

    throw new Error("Tất cả AI provider qua Gateway đều thất bại:\n" + errors.join("\n"));
  }

  /**
   * Xử lý tóm tắt CV trực tiếp từ dữ liệu payload gửi lên từ Sidebar qua n8n
   * @param {Object} payload - { candidate, cvFile, spreadsheetId, secondarySpreadsheetId }
   * @returns {{ ok: boolean, introduction?: string, error?: string }}
   */
  static handleAiSummarize(payload) {
    try {
      // 1. Trích xuất text từ Google Doc / Word nếu có url mà chưa có cvText
      if (payload.candidate && payload.candidate.cvUrl && !payload.candidate.cvText) {
        payload.candidate.cvText = this.extractDocTextFromUrl(payload.candidate.cvUrl);
      }

      // 2. Bỏ file nhị phân để n8n không bị gửi nhầm base64 rác
      delete payload.cvFile;

      const rawRes = this.callN8nGateway(payload);

      // Bóc tách mảng nếu n8n trả về [ { ... } ]
      const response = Array.isArray(rawRes) ? rawRes[0] : rawRes;

      if (!response || response.ok === false) {
        throw new Error(response?.error || "n8n xử lý tóm tắt CV không thành công.");
      }

      const log = response.logRow || {};

      // Ghi log chi phí vào tab "AI Cost Log"
      if (typeof logAiCostWorkflow === "function") {
        logAiCostWorkflow({
          userEmail: log["User Call"] || payload.callerEmail,
          fullName: log["Fullname"] || payload.candidate?.fullName,
          provider: log["Provider"] || "gemini",
          model: log["Model"] || "gemini-3.5-flash-lite",
          timeStart: log["Time Start"] || "",
          timeEnd: log["Time End"] || "",
          latency: Number(log["Latency (s)"]) || 0,
          inputTokens: Number(log["Input Tokens"]) || 0,
          outputTokens: Number(log["Output Tokens"]) || 0,
          priceInput: Number(log["Price Input ($/1M)"]) || 0.3,
          priceOutput: Number(log["Price Output ($/1M)"]) || 2.5,
          totalCost: Number(log["Total Cost ($)"]) || 0,
          status: log["Status"] || "SUCCESS",
          errorDetail: log["Error Details"] || "",
        });
      }

      return {
        ok: true,
        introduction: response.introduction || response.text || "",
        raw: response,
      };
    } catch (err) {
      Logger.log("❌ Lỗi tại handleAiSummarize: " + err.message);

      // Ghi log FAILED nếu lỗi
      try {
        if (typeof logAiCostWorkflow === "function") {
          logAiCostWorkflow({
            userEmail: payload.callerEmail,
            fullName: payload.candidate?.fullName || "N/A",
            provider: "gemini",
            model: "gemini-3.5-flash-lite",
            status: "FAILED",
            errorDetail: err.message || String(err),
          });
        }
      } catch (logErr) {
        Logger.log("⚠️ Không thể ghi log lỗi: " + logErr.message);
      }

      return {
        ok: false,
        error: err.message || String(err),
      };
    }
  }

  /**
   * Trích xuất text trực tiếp trong bộ nhớ (In-Memory)
   * Hỗ trợ: Google Docs gốc & DOCX tải lên Drive
   * Không tạo file tạm, không cần bật Drive API, không lo 403
   */
  static extractDocTextFromUrl(cvUrl) {
    if (!cvUrl || typeof cvUrl !== "string") return "";

    const match = cvUrl.match(/\/d\/([a-zA-Z0-9-_]+)/);
    if (!match || !match[1]) return "";
    const fileId = match[1];

    try {
      const file = DriveApp.getFileById(fileId);
      const mimeType = file.getMimeType();

      // TH1: File Google Docs chuẩn -> đọc thẳng qua DocumentApp
      if (mimeType === MimeType.GOOGLE_DOCS) {
        return DocumentApp.openById(fileId).getBody().getText().trim();
      }

      // TH2: File DOCX tải lên từ máy tính -> Giải nén trực tiếp trong RAM và lọc thẻ XML
      if (mimeType === MimeType.MICROSOFT_WORD || mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" || file.getName().toLowerCase().endsWith(".docx")) {
        // Ép blob về dạng zip để unzip
        const zipBlob = file.getBlob().setContentType("application/zip");
        const unzippedFiles = Utilities.unzip(zipBlob);

        // Tìm file word/document.xml chứa toàn bộ nội dung văn bản
        const docXmlFile = unzippedFiles.find((f) => f.getName() === "word/document.xml");
        if (!docXmlFile) {
          throw new Error("Không tìm thấy cấu trúc văn bản trong file docx.");
        }

        const xmlContent = docXmlFile.getDataAsString();

        // 1. Chuyển thẻ xuống dòng/đoạn thành dấu xuống dòng thật
        let text = xmlContent.replace(/<\/w:p>/g, "\n");
        // 2. Bỏ tất cả các thẻ XML <w:...>
        text = text.replace(/<[^>]+>/g, "");
        // 3. Giải mã các ký tự entity XML cơ bản
        text = text
          .replace(/&amp;/g, "&")
          .replace(/&lt;/g, "<")
          .replace(/&gt;/g, ">")
          .replace(/&quot;/g, '"')
          .replace(/&apos;/g, "'");

        return text.trim();
      }

      throw new Error("Định dạng chưa hỗ trợ: " + mimeType);
    } catch (err) {
      Logger.log("❌ Lỗi extractDocTextFromUrl: " + err.message);
      throw new Error(err.message);
    }
  }
}

// =============================================================================
// GLOBAL BRIDGES (Cho sidebar HTML gọi qua google.script.run) & TEST FUNCTIONS
// =============================================================================

function callN8nAiGateway(payload) {
  return AiProviderService.handleAiSummarize(payload);
}

/**
 * Lấy thông tin dòng đang được chọn trên Sheet
 * Hỗ trợ bóc tách link trần, Rich Text Hyperlink và công thức =HYPERLINK()
 */
function testExtractCvFromSelectedRow() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getActiveSheet();
  const activeCell = sheet.getActiveCell();
  const selectedRowIndex = activeCell.getRow();

  if (selectedRowIndex < 2) {
    SpreadsheetApp.getUi().alert("⚠️ Vui lòng click chọn vào một dòng dữ liệu ứng viên (dòng 2 trở đi).");
    return;
  }

  const lastCol = sheet.getLastColumn();
  const headers = sheet
    .getRange(1, 1, 1, lastCol)
    .getValues()[0]
    .map((h) => String(h).trim());
  const rowData = sheet.getRange(selectedRowIndex, 1, 1, lastCol).getValues()[0];

  const cvColIdx = headers.indexOf("CV");
  const nameColIdx = headers.indexOf("Full Name");
  const titleColIdx = headers.indexOf("Title");
  const squadColIdx = headers.indexOf("Squad/ Unit") !== -1 ? headers.indexOf("Squad/ Unit") : headers.indexOf("Squad");

  if (cvColIdx === -1) {
    SpreadsheetApp.getUi().alert("❌ Không tìm thấy cột 'CV' ở dòng 1. Vui lòng kiểm tra lại tên cột.");
    return;
  }

  // --- BÓC TÁCH LINK CHUẨN (Xử lý hyperlink ẩn) ---
  const cellCv = sheet.getRange(selectedRowIndex, cvColIdx + 1);
  let cvUrl = "";

  // 1. Kiểm tra nếu là Rich Text có gắn link
  const richText = cellCv.getRichTextValue();
  if (richText && richText.getLinkUrl()) {
    cvUrl = richText.getLinkUrl();
  }

  // 2. Kiểm tra nếu ô dùng công thức =HYPERLINK("url", "text")
  if (!cvUrl) {
    const formula = cellCv.getFormula();
    const matchFormula = formula.match(/HYPERLINK\(\s*["']([^"']+)["']/i);
    if (matchFormula) {
      cvUrl = matchFormula[1];
    }
  }

  // 3. Nếu là chuỗi text trần
  if (!cvUrl) {
    cvUrl = String(cellCv.getValue()).trim();
  }

  const fullName = nameColIdx !== -1 ? String(rowData[nameColIdx]).trim() : "N/A";
  const title = titleColIdx !== -1 ? String(rowData[titleColIdx]).trim() : "N/A";
  const squad = squadColIdx !== -1 ? String(rowData[squadColIdx]).trim() : "N/A";

  Logger.log(`👉 Dòng ${selectedRowIndex}: ${fullName} - ${title} (${squad})`);
  Logger.log(`🔗 Link CV phát hiện: ${cvUrl}`);

  if (!cvUrl) {
    SpreadsheetApp.getUi().alert(`⚠️ Dòng ${selectedRowIndex} (${fullName}) không tìm thấy URL nào trong ô CV!`);
    return;
  }

  let extractedText = "";
  let statusMessage = "Thành công";

  try {
    // Gọi hàm trích xuất
    extractedText = AiProviderService.extractDocTextFromUrl(cvUrl);
    if (!extractedText) {
      statusMessage = "⚠️ Hàm trả về rỗng (Kiểm tra xem file có nội dung chữ không hoặc quyền truy cập file).";
    }
  } catch (err) {
    statusMessage = "❌ Lỗi: " + err.message;
    Logger.log("❌ Lỗi trích xuất: " + err.message);
  }

  const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <base target="_top">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 15px; color: #202124; margin: 0; }
          .badge { display: inline-block; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: 600; background: #e8f0fe; color: #1a73e8; }
          .meta-table { width: 100%; margin: 12px 0; border-collapse: collapse; font-size: 13px; }
          .meta-table td { padding: 6px 4px; border-bottom: 1px solid #f1f3f4; }
          .meta-label { color: #5f6368; font-weight: 500; width: 110px; }
          .cv-box { background: #f8f9fa; border: 1px solid #dadce0; border-radius: 6px; padding: 12px; height: 260px; overflow-y: auto; white-space: pre-wrap; font-size: 12px; line-height: 1.5; color: #3c4043; }
          .url-link { color: #1a73e8; text-decoration: none; word-break: break-all; }
        </style>
      </head>
      <body>
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <h3 style="margin: 0; color: #202124;">Thông tin dòng ${selectedRowIndex}</h3>
          <span class="badge">${extractedText.length} ký tự</span>
        </div>
        <table class="meta-table">
          <tr><td class="meta-label">Ứng viên:</td><td><b>${escapeHtml(fullName)}</b></td></tr>
          <tr><td class="meta-label">Chức danh:</td><td>${escapeHtml(title)} (${escapeHtml(squad)})</td></tr>
          <tr><td class="meta-label">Link đọc được:</td><td><a class="url-link" href="${cvUrl}" target="_blank">${escapeHtml(cvUrl)}</a></td></tr>
          <tr><td class="meta-label">Trạng thái:</td><td>${escapeHtml(statusMessage)}</td></tr>
        </table>
        <div><b>Nội dung trích xuất:</b></div>
        <div class="cv-box">${extractedText ? escapeHtml(extractedText) : "(Không có nội dung)"}</div>
      </body>
    </html>
  `;

  const htmlOutput = HtmlService.createHtmlOutput(htmlContent).setWidth(680).setHeight(480);
  SpreadsheetApp.getUi().showModalDialog(htmlOutput, "Xem trước CV Text ứng viên");
}

function escapeHtml(text) {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}
