/**
 * Cấu hình module tóm tắt CV trên Onboarding Sheet
 */
function getGatewayConfig_() {
  const props = PropertiesService.getScriptProperties().getProperties();
  return {
    WEB_APP_URL: props.GATEWAY_WEB_APP_URL || "",
    N8N_WEBHOOK_URL: props.GATEWAY_N8N_WEBHOOK_URL || "",
    SECRET: props.GATEWAY_SECRET || "",
  };
}

const OUTLINE_CV_SUMMARIZER_CONFIG = {
  get GATEWAY() {
    return getGatewayConfig_();
  },

  OUTLINE: {
    BASE_URL: "https://outline.kyanon.digital",
    PUBLISH: false,
  },

  AI_PROVIDERS: ["openrouter", "gemini"],

  GEMINI: {
    MODELS: ["gemini-flash-latest", "gemini-2.5-flash", "gemini-3.8-flash"],
  },

  OPENROUTER: {
    MODELS: ["google/gemini-2.5-flash"],
  },

  AI_PRICING: {
    "gemini-3.5-flash-lite": { input: 0.3, output: 2.5 }, // <--- THÊM DÒNG NÀY
    "gemini-2.5-flash": { input: 0.3, output: 2.5 },
    "gemini-flash-latest": { input: 0.3, output: 2.5 },
    "google/gemini-2.5-flash": { input: 0.3, output: 2.5 },
    "gemini-2.5-flash-lite": { input: 0.1, output: 0.4 },
    "gemini-3.8-flash": { input: 0.75, output: 3.75 },
    "gemini-3.7-flash": { input: 0.75, output: 3.75 },
    DEFAULT: { input: 0.3, output: 2.5 },
  },

  LOG: {
    SHEET_NAME: "AI Cost Log",
    HEADERS: ["Timestamp", "User Call", "Fullname", "Provider", "Model", "Time Start", "Time End", "Latency (s)", "Input Tokens", "Output Tokens", "Price Input ($/1M)", "Price Output ($/1M)", "Total Cost ($)", "Status", "Error Details"],
  },

  COLS: {
    CV: normalizeHeaderKey("CV"),
    FULL_NAME: normalizeHeaderKey("Full Name"),
    TITLE: normalizeHeaderKey("Title"),
    LEVEL: normalizeHeaderKey("Level"),
    REMARKS: normalizeHeaderKey("Remarks\n(update by Atlas)"),
  },
};
