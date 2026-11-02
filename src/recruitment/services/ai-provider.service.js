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

    const effectiveEmail = Session.getActiveUser().getEmail() || payload.callerEmail || "";
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

    if (statusCode === 403) {
      throw new Error("403 Forbidden: Sai hoặc thiếu X-Gateway-Secret xác thực với n8n.");
    }

    if (statusCode !== 200 || body.ok === false) {
      const errMsg = body.error?.message || body.error || `HTTP ${statusCode}`;
      throw new Error(`n8n Gateway xử lý thất bại: ${errMsg}`);
    }

    return body;
  }

  /**
   * Tóm tắt CV ứng viên theo danh sách provider cấu hình (Hàm gốc)
   * @param {Object} cvContent - { kind, pdfBase64, text, fileName }
   * @param {Object} candidate - Thông tin ứng viên
   * @returns {{ text: string, provider: string, model: string, inputTokens: number, outputTokens: number }}
   */
  static summarizeCv(cvContent, candidate) {
    const prompt = AiProviderUtil.buildWelcomePrompt(candidate);
    const promptParts = [{ text: prompt }];

    if (cvContent && cvContent.kind === "pdf_inline") {
      promptParts.push({
        inline_data: {
          mime_type: "application/pdf",
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
      const response = this.callN8nGateway(payload);
      return {
        ok: true,
        introduction: response.introduction || response.text || "",
        raw: response,
      };
    } catch (err) {
      Logger.log("❌ Lỗi tại handleAiSummarize: " + err.message);
      return {
        ok: false,
        error: err.message || String(err),
      };
    }
  }
}

// =============================================================================
// GLOBAL BRIDGES (Cho sidebar HTML gọi qua google.script.run) & TEST FUNCTIONS
// =============================================================================

/**
 * Endpoint cầu nối để Sidebar HTML gọi thông qua google.script.run
 * @param {Object} payload
 * @returns {Object}
 */
function callN8nAiGateway(payload) {
  return AiProviderService.handleAiSummarize(payload);
}

/**
 * Hàm test kết nối Gateway gốc
 */
function testAiGatewayConnection() {
  try {
    Logger.log("🔄 Đang gửi test request sang Gateway...");
    const res = AiProviderService.callGateway({
      provider: "gemini",
      model: "gemini-2.5-flash",
      promptParts: [{ text: "Trả lời đúng 1 từ: PONG" }],
    });
    Logger.log("✅ KẾT NỐI THÀNH CÔNG!");
    Logger.log("Phản hồi từ AI: " + res.text);
    Logger.log("Provider: " + res.provider + " | Model: " + res.model);
    Logger.log("Input Tokens: " + res.inputTokens + " | Output Tokens: " + res.outputTokens);
  } catch (e) {
    Logger.log("❌ KẾT NỐI THẤT BẠI: " + e.message);
  }
}

/**
 * Hàm test kết nối n8n Gateway Webhook
 */
function testN8nGatewayConnection() {
  try {
    Logger.log("🔄 Đang gửi test request sang n8n Gateway...");
    const res = AiProviderService.callN8nGateway({
      candidate: { fullName: "Test User", title: "Tester" },
      promptParts: [{ text: "Hello from Apps Script" }],
    });
    Logger.log("✅ KẾT NỐI N8N THÀNH CÔNG!");
    Logger.log("Response: " + JSON.stringify(res));
  } catch (e) {
    Logger.log("❌ KẾT NỐI N8N THẤT BẠI: " + e.message);
  }
}
