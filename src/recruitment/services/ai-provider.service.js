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
   * Bóc tách text thuần từ URL Google Docs hoặc file DOCX trên Google Drive
   * @param {string} cvUrl
   * @returns {string}
   */
  static extractDocTextFromUrl(cvUrl) {
    if (!cvUrl || typeof cvUrl !== "string") return "";

    const match = cvUrl.match(/\/d\/([a-zA-Z0-9-_]+)/);
    if (!match || !match[1]) return "";
    const fileId = match[1];

    try {
      const file = DriveApp.getFileById(fileId);
      const mimeType = file.getMimeType();

      // Trường hợp 1: File Google Docs chuẩn
      if (mimeType === MimeType.GOOGLE_DOCS) {
        return DocumentApp.openById(fileId).getBody().getText().trim();
      }

      // Trường hợp 2: File Microsoft Word (.docx) lưu trên Google Drive
      if (mimeType === MimeType.MICROSOFT_WORD || mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
        // Tạo bản copy tạm dạng Google Doc để đọc text
        const tempFile = Drive.Files.copy({ mimeType: MimeType.GOOGLE_DOCS }, fileId);
        const text = DocumentApp.openById(tempFile.id).getBody().getText().trim();
        DriveApp.getFileById(tempFile.id).setTrashed(true); // Xóa file tạm
        return text;
      }
    } catch (e) {
      Logger.log("⚠️ Lỗi trích xuất Doc/Docx: " + e.message);
    }

    return "";
  }
}

// =============================================================================
// GLOBAL BRIDGES (Cho sidebar HTML gọi qua google.script.run) & TEST FUNCTIONS
// =============================================================================

function callN8nAiGateway(payload) {
  return AiProviderService.handleAiSummarize(payload);
}

function testExtractCvText() {
  const testUrl = "https://docs.google.com/document/d/1kwwlGsdb2CjtF1qz93s2tjxU7LrRJSJlIEvl1gHUE3s/edit?tab=t.0";
  const text = AiProviderService.extractDocTextFromUrl(testUrl);
  Logger.log("Độ dài text: " + text.length);
  Logger.log("Full text: " + text);
}
