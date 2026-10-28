const OUTLINE_CV_SUMMARIZER_CONFIG = {
  // Outline Wiki cấu hình tài liệu
  OUTLINE: {
    BASE_URL: "https://outline.kyanon.digital",
    PUBLISH: false, // false = tạo draft, true = publish vào collection
  },

  // Thứ tự ưu tiên AI provider cho luồng tóm tắt CV
  AI_PROVIDERS: ["openrouter", "gemini"],

  /**
   * OpenRouter API Config
   * API Key lấy qua Script Properties: "OPENROUTER_API_KEY"
   */
  OPENROUTER: {
    BASE_URL: "https://openrouter.ai/api/v1",
    MODELS: ["google/gemini-2.5-flash"],
  },

  /**
   * Google Gemini API Config
   * API Key lấy qua Script Properties: "GEMINI_API_KEY"
   */
  GEMINI: {
    MODELS: [
      "gemini-flash-latest",
      "gemini-2.5-flash",
      "gemini-3.8-flash",
      "gemini-3.7-flash",
    ],
    BASE_URL: "https://generativelanguage.googleapis.com/v1beta",
    RETRY_DELAYS_MS: [2000, 5000],
  },

  /**
   * Bảng đơn giá token ($ / 1 triệu tokens) dùng để tính chi phí
   */
  AI_PRICING: {
    // Gemini 2.5 Flash ($0.30 Input / $2.50 Output)
    "gemini-2.5-flash": { input: 0.3, output: 2.5 },
    "gemini-flash-latest": { input: 0.3, output: 2.5 },
    "google/gemini-2.5-flash": { input: 0.3, output: 2.5 },

    // Gemini 2.5 Flash-Lite ($0.10 Input / $0.40 Output)
    "gemini-2.5-flash-lite": { input: 0.1, output: 0.4 },

    // Gemini 3.x Flash ($0.75 Input / $3.75 Output)
    "gemini-3.8-flash": { input: 0.75, output: 3.75 },
    "gemini-3.7-flash": { input: 0.75, output: 3.75 },

    DEFAULT: { input: 0.3, output: 2.5 },
  },

  /**
   * Cấu hình Sheet log chi phí và hiệu suất AI
   */
  LOG: {
    SHEET_NAME: "AI Cost Log",
    HEADERS: [
      "Timestamp",
      "User Call",
      "Fullname",
      "Provider",
      "Model",
      "Time Start",
      "Time End",
      "Latency (s)",
      "Input Tokens",
      "Output Tokens",
      "Price Input ($/1M)",
      "Price Output ($/1M)",
      "Total Cost ($)",
      "Status",
      "Error Details",
    ],
  },

  // Mapping các cột từ Sheet cần đọc/ghi cho luồng này
  COLS: {
    CV: normalizeHeaderKey("CV"),
    FULL_NAME: normalizeHeaderKey("Full Name"),
    TITLE: normalizeHeaderKey("Title"),
    LEVEL: normalizeHeaderKey("Level"),
    REMARKS: normalizeHeaderKey("Remarks\n(update by Atlas)"),
  },
};
