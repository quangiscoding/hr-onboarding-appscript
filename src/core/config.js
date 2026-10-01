/** ==========================================
 * CONFIG.JS - CẤU HÌNH & TỪ ĐIỂN CỘT
 * ==========================================
 * Nơi duy nhất chứa mọi hằng số cấu hình của hệ thống.
 * Khi đổi email phòng ban / File ID Drive / tên cột, chỉ cần sửa file này.
 */

const CONFIG = {
  /** Người nhận mặc định của các luồng email nội bộ */
  RECIPIENTS: {
    DEVOPS: "quang.nguyenminh@kyanon.digital",
    HR: "quang.nguyenminh@kyanon.digital",
    IT: "quang.nguyenminh@kyanon.digital",
    PEOPLE_TEAM: "people@kyanon.digital",
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
    HOA_CAU:
      "Floor 1, Room 1.2, 09 Hoa Cau, Cau Kieu Ward, Ho Chi Minh City",
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
   * Google Gemini (AI tóm tắt CV cho phần Introduction)
   * ⚠️ API key đặt Script Property "GEMINI_API_KEY" — KHÔNG hardcode.
   * Lấy key miễn phí tại https://aistudio.google.com/apikey
   */
  GEMINI: {
    MODEL: "gemini-2.0-flash",
    BASE_URL: "https://generativelanguage.googleapis.com/v1beta",
  },

  /**
   * Upload ảnh ứng viên: lưu vào Drive folder này rồi embed vào bài Outline.
   * FOLDER_ID: ID của Google Drive folder chứa ảnh nhân sự (để trống = lưu vào root của My Drive).
   */
  PHOTO_UPLOAD: {
    FOLDER_ID: "",
    MAX_SIZE_MB: 5,
  },

  /** Cấu hình tab log: tên sheet + header của từng luồng */
  LOG: {
    INTERNAL: {
      SHEET_NAME: "Internal Draft Log",
      HEADERS: [
        "Timestamp",
        "Fullname",
        "Position",
        "Request Type",
        "Draft ID",
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
}

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
