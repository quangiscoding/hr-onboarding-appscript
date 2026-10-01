/** ==========================================
 * CONFIG.JS - CẤU HÌNH & TỪ ĐIỂN CỘT
 * ==========================================
 * Nơi duy nhất chứa mọi hằng số cấu hình của hệ thống.
 * Khi đổi email phòng ban / File ID Drive / tên cột, chỉ cần sửa file này.
 */

const CONFIG = {
  /** Tên sheet chứa bảng cấu hình động (Role | Send to | CC) */
  DATA_SHEET_NAME: "Data",

  /** Tên các Role tra cứu trong cột "Role" của sheet Data */
  RECIPIENT_ROLES: {
    DEVOPS: "DevOps",
    HR: "OKR",
    IT: "IT Support",
    PEOPLE_TEAM: "People Team",
  },

  /** File PDF hướng dẫn onboarding: tra theo `${employmentType}_${location}` */
  GUIDE_PDF_MAP: {
    intern_danang: "1soQu_zY8ZWrKwu3MqA7TGgEQibWQgXht",
    intern_hcm: "1fk9H4gvXn2CzIoQSbNUvnMEqQrsrKd2_",
    probation_danang: "1aAr-bRUjRxonjSLgANHhEgCSvnDdSrwZ",
    probation_hcm: "1be3OS8_KnNEJKk3RqwcqpuFaR-4uLb2e",
  },

  /** Địa chỉ văn phòng dùng trong Welcome Email, tra theo Onboarding Type */
  OFFICE_ADDRESS: {
    DEFAULT:
      "Floor 2, Room 2.6, 294-296 Truong Sa, Cau Kieu Ward, Ho Chi Minh City",
    DANANG: "Floor 3, 433-435 Nguyen Huu Tho, Cam Le, Da Nang",
    HOA_CAU: "Floor 1, Room 1.2, 09 Hoa Cau, Cau Kieu Ward, Ho Chi Minh City",
  },

  /**
   * Outline Wiki (AI Recruitment module)
   * ⚠️ API token KHÔNG hardcode ở đây — đặt Script Property "OUTLINE_API_TOKEN"
   * trong Apps Script (Project Settings → Script Properties) thay vì commit lên git.
   * publish: false -> document nằm trong Drafts cá nhân của tài khoản token.
   */
  OUTLINE: {
    BASE_URL: "https://outline.kyanon.digital",
    PUBLISH: false, // false = tạo draft (mục Drafts), true = publish vào collection
    // COLLECTION_ID: "", // chỉ cần khi PUBLISH = true
  },

  /**
   * AI provider cho việc tóm tắt CV — thử theo thứ tự, provider đầu lỗi
   * (rate limit, key thiếu, API lỗi...) sẽ tự chuyển sang provider kế.
   * Lưu ý: OpenRouter yêu cầu tài khoản có tối thiểu $0.50 credit mới gửi
   * được file đính kèm (PDF) — chưa nạp tiền thì nên để "gemini" trước.
   * Chọn: "openrouter" | "gemini"
   */
  AI_PROVIDERS: ["gemini", "openrouter"],

  /**
   * OpenRouter (ưu tiên dùng — 1 API key thống nhất cho mọi model, free tier
   * rộng hơn). ⚠️ Key đặt Script Property "OPENROUTER_API_KEY" — KHÔNG hardcode.
   * Lấy key tại https://openrouter.ai/settings/keys
   */
  OPENROUTER: {
    BASE_URL: "https://openrouter.ai/api/v1",
    MODELS: ["google/gemini-2.5-flash"],
  },

  /**
   * Google Gemini (AI provider dự phòng)
   * ⚠️ API key đặt Script Property "GEMINI_API_KEY" — KHÔNG hardcode.
   * Lấy key miễn phí tại https://aistudio.google.com/apikey
   */
  GEMINI: {
    // Thử lần lượt theo thứ tự: model chính bị rate limit (429), quá tải (503)
    // hoặc không tồn tại (404) sẽ tự chuyển sang model dự phòng tiếp theo.
    // "gemini-flash-latest": alias tự trỏ model flash mới nhất, "gemini-2.5-flash": ổn định nhất.
    MODELS: [
      "gemini-flash-latest",
      "gemini-2.5-flash",
      "gemini-3.8-flash",
      "gemini-3.7-flash",
    ],
    BASE_URL: "https://generativelanguage.googleapis.com/v1beta",
    RETRY_DELAYS_MS: [2000, 5000], // backoff giữa các lần retry khi gặp 429
  },

  /** Cấu hình tab log: tên sheet + header của từng luồng */
  LOG: {
    INTERNAL: {
      SHEET_NAME: "Internal Email Log",
      HEADERS: [
        "Timestamp",
        "Fullname",
        "Position",
        "Request Type",
        "Sent To",
        "Status",
      ],
    },
    TA_NOTIFICATION: {
      SHEET_NAME: "TA Notification Log",
      HEADERS: [
        "Timestamp",
        "Fullname",
        "Position",
        "Alloc Code",
        "Sent To",
        "Status",
      ],
    },
    CANDIDATE: {
      SHEET_NAME: "Candidate Draft Log",
      HEADERS: [
        "Timestamp",
        "Fullname",
        "Position",
        "Alloc Code",
        "Draft ID",
        "Status",
      ],
    },
  },
};

// Từ điển Key đã được chuẩn hóa qua normalizeHeaderKey()
// Key = normalizeHeaderKey(<tên header trên Sheet>) -> đảm bảo khớp sheet thật.
const COLS = {
  FULL_NAME: normalizeHeaderKey("Full Name"),
  ACCENTLESS_FULL_NAME: normalizeHeaderKey("Accentless Full Name"),
  LEVEL: normalizeHeaderKey("Level"),
  EMPLOYMENT_TYPE: normalizeHeaderKey("Employment Type"),
  TITLE: normalizeHeaderKey("Title"),
  SQUAD: normalizeHeaderKey("Squad/ Unit"),
  LINE_MANAGER: normalizeHeaderKey("Line Manager"),
  TA_IN_CHARGE: normalizeHeaderKey("TA In Charge"),
  DATE_ONBOARD: normalizeHeaderKey("Date of Onboard"),
  OFFER_STATUS: normalizeHeaderKey("Offer Status"),
  DEVICE_REQUEST: normalizeHeaderKey("Device Request from newcomer"),
  ONBOARDING_TYPE: normalizeHeaderKey("Onboarding Type"),
  WORKING_EMAIL: normalizeHeaderKey("Working Email"),
  PERSONAL_EMAIL: normalizeHeaderKey("Personal Email"),
  CV: normalizeHeaderKey("CV"),
  LINK_FOLDER_OKRS: normalizeHeaderKey("Link Folder OKRs"),
  REMARKS: normalizeHeaderKey("Remarks\n(update by Atlas)"),
  ALLOC_CODE: normalizeHeaderKey("Alloc Code\n(update by Atlas)"),
};
