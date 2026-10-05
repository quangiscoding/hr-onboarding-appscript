/** ==========================================
 * RECRUITMENT/AI-PROVIDERS.JS - LỚI GỌI AI (OPENROUTER / GEMINI)
 * ==========================================
 * Sinh phần Introduction từ CV qua AI, hỗ trợ nhiều provider theo thứ tự
 * cấu hình trong CONFIG.AI_PROVIDERS (mặc định: openrouter trước, gemini dự phòng).
 *
 * Mỗi provider có cơ chế chống rate limit:
 *  - Xoay vòng API key (property chính + _2..10, hoặc 1 property nhiều key cách phẩy)
 *  - Retry với backoff khi gặp 429
 *  - Chuyển model kế trong chuỗi MODELS khi lỗi khác (404, 400...)
 *
 * Phụ thuộc: core/config.js
 */

/**
 * Gọi AI sinh phần Introduction từ CV.
 * Provider thử theo thứ tự trong CONFIG.AI_PROVIDERS; provider đầu lỗi sẽ
 * chuyển sang provider kế. Return text hoặc throw Error gộp tất cả lỗi.
 * @param {Object} cvContent - Kết quả từ readCvContent_: { kind: "pdf_inline", pdfBase64, fileName } hoặc { kind: "text", text }
 * @param {Object} candidate - Thông tin ứng viên để AI viết cho đúng ngữ cảnh
 * @returns {string} Phần Introduction tiếng Anh, văn phong giống các bài Welcome Onboard mẫu
 */
function callGeminiSummarizeCv_(cvContent, candidate) {
  const prompt = buildGeminiPrompt_(candidate);
  const providers = CONFIG.AI_PROVIDERS || ["gemini"];
  const errors = [];

  for (const provider of providers) {
    try {
      if (provider === "openrouter") return callOpenRouter_(cvContent, prompt);
      if (provider === "gemini") return callGeminiProvider_(cvContent, prompt);
      errors.push(`Không biết provider "${provider}" — bỏ qua.`);
    } catch (e) {
      errors.push(`[${provider}] ${e.message}`);
      Logger.log(`⚠️ Provider ${provider} lỗi, thử provider kế: ${e.message}`);
    }
  }

  throw new Error("Tất cả AI provider đều lỗi:\n" + errors.join("\n"));
}

/**
 * Dựng prompt tiếng Anh theo style bài Welcome Onboard mẫu (dùng chung mọi provider).
 * @param {Object} candidate
 * @returns {string} Prompt text
 */
function buildGeminiPrompt_(candidate) {
  return [
    "You are an HR teammate writing a warm, energetic, and professional 'Welcome Onboard' introduction paragraph.",
    "Write it in ENGLISH, 4-5 sentences. Follow the naming conventions, tone, and sentence structure shown in the examples below.",
    "",
    "Few-shot Examples (Learn the phrasing style based on seniority):",
    "",
    "[Example 1 - Senior/Experienced Role]:",
    '"We are thrilled to welcome Ms. Tuyen Tran as our People Specialist in Hera! 🌟 Tuyen brings over 5 years of hands-on experience in C&B and HR Operations across tech and corporate environments. She excels in payroll management, social insurance, and internal engagement. With her empathetic mindset and meticulous approach, she is well-equipped to bring fresh energy to our team. Welcome aboard, Tuyen! 🚀"',
    "",
    "[Example 2 - Experienced Role with English Name]:",
    '"We are excited to welcome Ms. Ngan Nguyen (Nancy) as our Talent Development Specialist in Hera! 🎉 Ms. Ngan brings over 7 years of professional experience in HR and TA within the tech industry across APAC, SEA, and EMEA regions. Her background highlights strong expertise in technical recruiting and global talent acquisition. With this extensive expertise, she will play a vital role in sourcing top-tier tech talents and driving recruitment excellence. Welcome aboard, Nancy! 🚀✨"',
    "",
    "[Example 3 - Intern/Junior Role]:",
    '"We are delighted to welcome Mr. Khoi Thanh Dinh as our Business Development Intern! 🌟 Khoi is a student majoring in Business Management at the University of Greenwich. He has proven hands-on experience in leadership, event coordination, and stakeholder negotiation from his role as President of the Peer Mentoring Club. Armed with solid skills in research, communication, and task management, he is ready to bring his proactive mindset to the team. Welcome aboard, Khoi! 🚀"',
    "",
    "Naming & Formatting Rules:",
    "1. Opening Sentence: Start with 'We are excited/thrilled/delighted to welcome <Ms./Mr.> <FullName (EnglishName if present)> as our <Job Title> in <Squad> Team! 🎉' (or 🌟 / ✨).",
    "2. Body & Closing Sentences: STRICTLY use ONLY the First Name or English Name (e.g., 'Nancy', 'Tuyen', 'Khoi', 'Ngan'). NEVER repeat the full name.",
    "3. Tailor Content:",
    "   - For Experienced roles: Focus on YOE, regional/industry experience, core domain mastery, and strategic impact.",
    "   - For Intern/Fresh roles: Focus on University, Major, Club leadership, GPA/IELTS, key soft skills, and readiness.",
    "4. Closing Sentence: Use 'Welcome aboard, <FirstName/EnglishName>! 🚀' or '🚀✨'.",
    "5. STRICT CONSTRAINT: Output ONLY the introduction paragraph. Do NOT include titles, 'First working day:', or markdown headers.",
    "",
    `Candidate context:`,
    `- Full name: ${candidate.fullName}`,
    `- Job title: ${candidate.title || "N/A"}`,
    `- Squad/Unit: ${candidate.squad || "N/A"}`,
    `- Employment type: ${candidate.employmentType || "N/A"}`,
  ].join("\n");
}

/* ------------------------------------------------------------------ */
/* PROVIDER: OPENROUTER (ưu tiên)                                       */
/* ------------------------------------------------------------------ */

/**
 * Provider OPENROUTER: OpenAI-compatible chat completions, PDF gửi dạng file
 * content part (base64 data URL). Xoay vòng OPENROUTER_API_KEY(S) khi 429,
 * thử lần lượt CONFIG.OPENROUTER.MODELS.
 * @returns {string} Introduction text
 */
function callOpenRouter_(cvContent, prompt) {
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
      "\n\nCV content:\n" + cvContent.text.slice(0, 15000);
  }

  const models = (
    CONFIG.OPENROUTER.MODELS && CONFIG.OPENROUTER.MODELS.length
      ? CONFIG.OPENROUTER.MODELS
      : ["google/gemini-2.5-flash"]
  ).filter(Boolean);
  const delays = CONFIG.GEMINI.RETRY_DELAYS_MS || [];
  const keys = getOpenRouterApiKeys_();
  const errors = [];

  for (const model of models) {
    for (let attempt = 0; attempt <= delays.length; attempt++) {
      if (attempt > 0) {
        Logger.log(
          `⏳ OpenRouter ${model}: rate limit, thử lại sau ${delays[attempt - 1]}ms (lần ${attempt}/${delays.length})`,
        );
        Utilities.sleep(delays[attempt - 1]);
      }

      const key = keys[attempt % keys.length];
      const result = callOpenRouterOnce_(model, contentParts, key);
      if (result.ok) return result.text;

      const { status, message } = result;
      if (status !== 429) {
        errors.push(
          `${model} [key #${(attempt % keys.length) + 1}]: ${message}`,
        );
        break;
      }
      errors.push(
        `${model} [key #${(attempt % keys.length) + 1}] (lần ${attempt + 1}): ${message}`,
      );
    }
  }

  throw new Error(
    "OpenRouter lỗi sau khi thử " +
      models.length +
      " model × " +
      keys.length +
      " key:\n" +
      errors.join("\n"),
  );
}

/**
 * Gọi OpenRouter chat completions 1 lần. Không retry ở đây.
 * @returns {Object} { ok: true, text } hoặc { ok: false, status, message }
 */
function callOpenRouterOnce_(model, contentParts, apiKey) {
  const response = UrlFetchApp.fetch(
    `${CONFIG.OPENROUTER.BASE_URL}/chat/completions`,
    {
      method: "post",
      contentType: "application/json",
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      payload: JSON.stringify({
        model: model,
        messages: [{ role: "user", content: contentParts }],
        max_tokens: 1024,
      }),
      muteHttpExceptions: true,
    },
  );

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
  return { ok: true, text: text };
}

/**
 * Đọc danh sách OpenRouter API keys để xoay vòng khi rate limit.
 * Cách cung cấp (Script Properties): OPENROUTER_API_KEY (có thể chứa nhiều key
 * cách nhau bằng dấu phẩy) và/hoặc OPENROUTER_API_KEY_2..10.
 * @returns {string[]}
 */
function getOpenRouterApiKeys_() {
  const props = PropertiesService.getScriptProperties();
  const keys = [];
  const first = props.getProperty("OPENROUTER_API_KEY");
  if (first)
    keys.push(
      ...first
        .split(",")
        .map((k) => k.trim())
        .filter(Boolean),
    );
  for (let i = 2; i <= 10; i++) {
    const k = props.getProperty(`OPENROUTER_API_KEY_${i}`);
    if (k) keys.push(k.trim());
    else break;
  }
  if (keys.length === 0) {
    throw new Error(
      'Thiếu Script Property "OPENROUTER_API_KEY". Lấy key tại https://openrouter.ai/settings/keys (miễn phí, có quota free model hằng ngày).',
    );
  }
  return keys;
}

/* ------------------------------------------------------------------ */
/* PROVIDER: GEMINI (dự phòng)                                          */
/* ------------------------------------------------------------------ */

/**
 * Provider GEMINI: với mỗi model trong CONFIG.GEMINI.MODELS — xoay vòng key và
 * retry theo RETRY_DELAYS_MS khi gặp 429; lỗi khác thì chuyển model kế.
 */
function callGeminiProvider_(cvContent, prompt) {
  const promptParts = [{ text: prompt }];

  if (cvContent.kind === "pdf_inline") {
    promptParts.push({
      inline_data: { mime_type: "application/pdf", data: cvContent.pdfBase64 },
    });
  } else {
    promptParts[0].text += "\n\nCV content:\n" + cvContent.text.slice(0, 15000);
  }

  const models = (
    CONFIG.GEMINI.MODELS && CONFIG.GEMINI.MODELS.length
      ? CONFIG.GEMINI.MODELS
      : [CONFIG.GEMINI.MODEL || "gemini-3.1-flash"]
  ).filter(Boolean);
  const delays = CONFIG.GEMINI.RETRY_DELAYS_MS || [];
  const keys = getGeminiApiKeys_(); // xoay vòng khi gặp 429
  const errors = [];

  for (const model of models) {
    for (let attempt = 0; attempt <= delays.length; attempt++) {
      if (attempt > 0) {
        Logger.log(
          `⏳ Gemini ${model}: rate limit, thử lại sau ${delays[attempt - 1]}ms (lần ${attempt}/${delays.length})`,
        );
        Utilities.sleep(delays[attempt - 1]);
      }

      // Xoay vòng key: mỗi attempt (kể cả lần đầu) dùng key kế tiếp trong danh sách
      const key = keys[attempt % keys.length];
      const result = callGeminiOnce_(model, promptParts, key);
      if (result.ok) return result.text;

      const { status, message } = result;
      // 429 = rate limit -> retry với key kế tiếp; lỗi khác -> bỏ sang model kế
      if (status !== 429) {
        errors.push(
          `${model} [key #${(attempt % keys.length) + 1}]: ${message}`,
        );
        break;
      }
      errors.push(
        `${model} [key #${(attempt % keys.length) + 1}] (lần ${attempt + 1}): ${message}`,
      );
    }
  }

  throw new Error(
    "Gemini API lỗi sau khi thử " +
      models.length +
      " model × " +
      keys.length +
      " key:\n" +
      errors.join("\n"),
  );
}

/**
 * Gọi generateContent 1 lần với 1 model. Không retry ở đây.
 * @returns {Object} { ok: true, text } hoặc { ok: false, status, message }
 */
function callGeminiOnce_(model, promptParts, apiKey) {
  const response = UrlFetchApp.fetch(
    `${CONFIG.GEMINI.BASE_URL}/models/${model}:generateContent?key=${apiKey}`,
    {
      method: "post",
      contentType: "application/json",
      payload: JSON.stringify({
        contents: [{ parts: promptParts }],
        // Lưu ý: Gemini 3.x từ chối temperature/top_p/top_k trong generateContent
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

  const parts = body.candidates[0].content && body.candidates[0].content.parts;
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
  return { ok: true, text: text };
}

/**
 * Lấy Gemini API key đầu tiên (helper tiện dụng khi chỉ cần 1 key).
 */
function getGeminiApiKey_() {
  return getGeminiApiKeys_()[0];
}

/**
 * Đọc danh sách Gemini API keys để xoay vòng khi gặp rate limit (429).
 * Cách cung cấp (chọn 1 trong 2, Apps Script → Project Settings → Script Properties):
 *  1. Nhiều property: GEMINI_API_KEY, GEMINI_API_KEY_2, GEMINI_API_KEY_3, ... (đọc đến khi trống)
 *  2. Một property duy nhất: GEMINI_API_KEY chứa nhiều key cách nhau bằng dấu phẩy
 * @returns {string[]} Danh sách key (ít nhất 1, nếu không sẽ throw)
 */
function getGeminiApiKeys_() {
  const props = PropertiesService.getScriptProperties();
  const keys = [];

  // Cách 1: GEMINI_API_KEY, GEMINI_API_KEY_2, GEMINI_API_KEY_3, ...
  const first = props.getProperty("GEMINI_API_KEY");
  if (first)
    keys.push(
      ...first
        .split(",")
        .map((k) => k.trim())
        .filter(Boolean),
    );
  for (let i = 2; i <= 10; i++) {
    const k = props.getProperty(`GEMINI_API_KEY_${i}`);
    if (k) keys.push(k.trim());
    else break;
  }

  if (keys.length === 0) {
    throw new Error(
      'Thiếu Script Property "GEMINI_API_KEY". Hãy vào Apps Script → Project Settings → Script Properties và thêm Gemini API key (lấy tại https://aistudio.google.com/apikey). Có thể thêm nhiều key để xoay vòng khi rate limit: GEMINI_API_KEY_2, GEMINI_API_KEY_3, ... hoặc cùng 1 property cách nhau bằng dấu phẩy.',
    );
  }
  return keys;
}
