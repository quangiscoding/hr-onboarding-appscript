/** ==========================================
 * CONFIG.JS - CẤU HÌNH & TỪ ĐIỂN CỘT
 * ========================================== */

const CONFIG = {
  RECIPIENTS: {
    DEVOPS: "quang.nguyenminh@kyanon.digital",
    HR: "quang.nguyenminh@kyanon.digital",
    IT: "quang.nguyenminh@kyanon.digital",
    PEOPLE_TEAM: "people@kyanon.digital",
  },
  GUIDE_PDF_MAP: {
    intern_danang: "1soQu_zY8ZWrKwu3MqA7TGgEQibWQgXht",
    intern_hcm: "1fk9H4gvXn2CzIoQSbNUvnMEqQrsrKd2_",
    probation_danang: "1aAr-bRUjRxonjSLgANHhEgCSvnDdSrwZ",
    probation_hcm: "1be3OS8_KnNEJKk3RqwcqpuFaR-4uLb2e",
  },
};

// Từ điển Key đã được chuẩn hóa qua normalizeHeaderKey()
const COLS = {
  FULL_NAME: normalizeHeaderKey("Full Name"),
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
  REMARKS: normalizeHeaderKey("Remarks\n(update by Atlas)"),
  ALLOC_CODE: normalizeHeaderKey("Alloc Code\n(update by Atlas)"),
  SEND_WELCOME_EMAIL: normalizeHeaderKey("Send Welcome Email"), // Cột Checkbox
  SEND_TA_NOTIFICATION_EMAIL: normalizeHeaderKey(
    "Send Notification Email to TA\n(update by Atlas)",
  ), // Cột Checkbox
};
