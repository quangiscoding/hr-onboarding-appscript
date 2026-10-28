/**
 * services/ai-provider.service.js
 * Quản lý các nhà cung cấp AI Model, cơ chế retry, rotate keys.
 */
class AiProviderService {
  /**
   * Gọi AI sinh phần Introduction từ CV theo danh sách provider cấu hình.
   * @param {Object} cvContent - { kind: "pdf_inline", pdfBase64, fileName } hoặc { kind: "text", text }
   * @param {Object} candidate - Thông tin ứng viên
   * @returns {{ text: string, provider: string, model: string, inputTokens: number, outputTokens: number }}
   */
  static summarizeCv(cvContent, candidate) {
    const prompt = AiProviderUtil.buildWelcomePrompt(candidate);
    const providers = OUTLINE_CV_SUMMARIZER_CONFIG.AI_PROVIDERS || [
      "openrouter",
      "gemini",
    ];
    const errors = [];

    for (const provider of providers) {
      try {
        if (provider === "openrouter") {
          return this.callOpenRouter(cvContent, prompt);
        }
        if (provider === "gemini") {
          return this.callGemini(cvContent, prompt);
        }
        errors.push(`Không biết provider "${provider}" — bỏ qua.`);
      } catch (e) {
        errors.push(`[${provider}] ${e.message}`);
        Logger.log(`⚠️ Provider ${provider} lỗi, chuyển kế tiếp: ${e.message}`);
      }
    }

    throw new Error("Tất cả AI provider đều lỗi:\n" + errors.join("\n"));
  }

  /* ---------------- OPENROUTER ---------------- */

  static callOpenRouter(cvContent, prompt) {
    const contentParts = [{ type: "text", text: prompt }];
    if (cvContent.kind === "pdf_inline") {
      contentParts.push({
        type: "file",
        file: {
          filename: cvContent.fileName || "cv.pdf",
          file_data: `data:application/pdf;base64,${cvContent.pdfBase64}`,
        },
      });
    } else {
      contentParts[0].text +=
        "\n\nCV content:\n" + String(cvContent.text || "").slice(0, 15000);
    }

    const config = OUTLINE_CV_SUMMARIZER_CONFIG.OPENROUTER;
    const models = (
      config.MODELS && config.MODELS.length
        ? config.MODELS
        : ["google/gemini-2.5-flash"]
    ).filter(Boolean);
    const delays = OUTLINE_CV_SUMMARIZER_CONFIG.GEMINI.RETRY_DELAYS_MS || [
      2000, 5000,
    ];
    const keys = AiProviderUtil.extractApiKeysFromProps("OPENROUTER_API_KEY");

    if (keys.length === 0) {
      throw new Error('Thiếu Script Property "OPENROUTER_API_KEY".');
    }

    const errors = [];
    for (const model of models) {
      for (let attempt = 0; attempt <= delays.length; attempt++) {
        if (attempt > 0) {
          Logger.log(
            `⏳ OpenRouter ${model}: rate limit, retry sau ${delays[attempt - 1]}ms`,
          );
          Utilities.sleep(delays[attempt - 1]);
        }
        const key = keys[attempt % keys.length];
        const res = this.callOpenRouterOnce_(
          model,
          contentParts,
          key,
          config.BASE_URL,
        );

        if (res.ok) {
          return {
            text: res.text,
            provider: "openrouter",
            model: model,
            inputTokens: res.inputTokens,
            outputTokens: res.outputTokens,
          };
        }

        if (res.status !== 429) {
          errors.push(
            `${model} [key #${(attempt % keys.length) + 1}]: ${res.message}`,
          );
          break;
        }
        errors.push(
          `${model} [key #${(attempt % keys.length) + 1}] (attempt ${attempt + 1}): ${res.message}`,
        );
      }
    }

    throw new Error("OpenRouter thất bại:\n" + errors.join("\n"));
  }

  static callOpenRouterOnce_(model, contentParts, apiKey, baseUrl) {
    const response = UrlFetchApp.fetch(`${baseUrl}/chat/completions`, {
      method: "post",
      contentType: "application/json",
      headers: { Authorization: `Bearer ${apiKey}` },
      payload: JSON.stringify({
        model: model,
        messages: [{ role: "user", content: contentParts }],
        max_tokens: 1024,
      }),
      muteHttpExceptions: true,
    });

    const statusCode = response.getResponseCode();
    const body = JSON.parse(response.getContentText() || "{}");

    if (statusCode !== 200 || !body.choices || !body.choices[0]) {
      const errMsg =
        body.error && body.error.message
          ? body.error.message
          : response.getContentText();
      return { ok: false, status: statusCode, message: errMsg };
    }

    const text = String(
      (body.choices[0].message && body.choices[0].message.content) || "",
    ).trim();
    if (!text) {
      return {
        ok: false,
        status: statusCode,
        message: "OpenRouter trả về nội dung rỗng.",
      };
    }

    const usage = body.usage || {};
    return {
      ok: true,
      text: text,
      inputTokens: usage.prompt_tokens || 0,
      outputTokens: usage.completion_tokens || 0,
    };
  }

  /* ---------------- GEMINI DIRECT ---------------- */

  static callGemini(cvContent, prompt) {
    const promptParts = [{ text: prompt }];
    if (cvContent.kind === "pdf_inline") {
      promptParts.push({
        inline_data: {
          mime_type: "application/pdf",
          data: cvContent.pdfBase64,
        },
      });
    } else {
      promptParts[0].text +=
        "\n\nCV content:\n" + String(cvContent.text || "").slice(0, 15000);
    }

    const config = OUTLINE_CV_SUMMARIZER_CONFIG.GEMINI;
    const models = (
      config.MODELS && config.MODELS.length
        ? config.MODELS
        : ["gemini-2.5-flash"]
    ).filter(Boolean);
    const delays = config.RETRY_DELAYS_MS || [2000, 5000];
    const keys = AiProviderUtil.extractApiKeysFromProps("GEMINI_API_KEY");

    if (keys.length === 0) {
      throw new Error('Thiếu Script Property "GEMINI_API_KEY".');
    }

    const errors = [];
    for (const model of models) {
      for (let attempt = 0; attempt <= delays.length; attempt++) {
        if (attempt > 0) {
          Logger.log(
            `⏳ Gemini ${model}: rate limit, retry sau ${delays[attempt - 1]}ms`,
          );
          Utilities.sleep(delays[attempt - 1]);
        }
        const key = keys[attempt % keys.length];
        const res = this.callGeminiOnce_(
          model,
          promptParts,
          key,
          config.BASE_URL,
        );

        if (res.ok) {
          return {
            text: res.text,
            provider: "gemini",
            model: model,
            inputTokens: res.inputTokens,
            outputTokens: res.outputTokens,
          };
        }

        if (res.status !== 429) {
          errors.push(
            `${model} [key #${(attempt % keys.length) + 1}]: ${res.message}`,
          );
          break;
        }
        errors.push(
          `${model} [key #${(attempt % keys.length) + 1}] (attempt ${attempt + 1}): ${res.message}`,
        );
      }
    }

    throw new Error("Gemini API thất bại:\n" + errors.join("\n"));
  }

  static callGeminiOnce_(model, promptParts, apiKey, baseUrl) {
    const response = UrlFetchApp.fetch(
      `${baseUrl}/models/${model}:generateContent?key=${apiKey}`,
      {
        method: "post",
        contentType: "application/json",
        payload: JSON.stringify({
          contents: [{ parts: promptParts }],
          generationConfig: {},
        }),
        muteHttpExceptions: true,
      },
    );

    const statusCode = response.getResponseCode();
    const body = JSON.parse(response.getContentText() || "{}");

    if (statusCode !== 200 || !body.candidates || !body.candidates[0]) {
      const errMsg =
        body.error && body.error.message
          ? body.error.message
          : response.getContentText();
      return { ok: false, status: statusCode, message: errMsg };
    }

    const parts =
      body.candidates[0].content && body.candidates[0].content.parts;
    const text =
      parts &&
      parts
        .map((p) => p.text || "")
        .join("")
        .trim();

    if (!text) {
      return {
        ok: false,
        status: statusCode,
        message: "Gemini trả về nội dung rỗng.",
      };
    }

    const usage = body.usageMetadata || {};
    return {
      ok: true,
      text: text,
      inputTokens: usage.promptTokenCount || 0,
      outputTokens: usage.candidatesTokenCount || 0,
    };
  }
}
