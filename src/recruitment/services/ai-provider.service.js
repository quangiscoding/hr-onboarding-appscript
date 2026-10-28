/**
 * services/ai-provider.service.js
 * Quản lý gửi request qua Gateway độc lập
 */
class AiProviderService {
  /**
   * Bắn HTTP request sang Gateway Web App
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
      throw new Error(
        `Gateway phản hồi không đúng JSON (HTTP ${statusCode}): ${rawText}`,
      );
    }

    if (statusCode !== 200 || !body.ok) {
      throw new Error(body.error || `Gateway lỗi (HTTP ${statusCode})`);
    }

    return body;
  }

  /**
   * Tóm tắt CV ứng viên theo danh sách provider cấu hình
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
      promptParts[0].text +=
        "\n\nCV content:\n" +
        String((cvContent && cvContent.text) || "").slice(0, 15000);
    }

    const providers = OUTLINE_CV_SUMMARIZER_CONFIG.AI_PROVIDERS || ["gemini"];
    const errors = [];

    for (const provider of providers) {
      try {
        const models =
          provider === "openrouter"
            ? OUTLINE_CV_SUMMARIZER_CONFIG.OPENROUTER?.MODELS
            : OUTLINE_CV_SUMMARIZER_CONFIG.GEMINI?.MODELS;

        const targetModel = models && models.length ? models[0] : null;

        return this.callGateway({
          provider: provider,
          model: targetModel,
          promptParts: promptParts,
        });
      } catch (err) {
        errors.push(`[${provider}] ${err.message}`);
        Logger.log(
          `⚠️ Provider ${provider} qua Gateway lỗi, thử provider kế: ${err.message}`,
        );
      }
    }

    throw new Error(
      "Tất cả AI provider qua Gateway đều thất bại:\n" + errors.join("\n"),
    );
  }
}

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
    Logger.log(
      "Input Tokens: " +
        res.inputTokens +
        " | Output Tokens: " +
        res.outputTokens,
    );
  } catch (e) {
    Logger.log("❌ KẾT NỐI THẤT BẠI: " + e.message);
  }
}
