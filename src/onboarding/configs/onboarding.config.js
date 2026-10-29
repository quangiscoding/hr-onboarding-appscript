/**
 * ONBOARDING/CONFIGS/ONBOARDING.CONFIG.JS - Cấu hình tập trung cho Onboarding
 */

const ONBOARDING_CONFIG = {
  /** ID file UC06 tra cứu Avatar */
  SPREADSHEET_UC06_ID: "1NoTqsI8oiV0ilqlhLYiAKK6igsyw1n4Z50OxDR3eKcw",

  /** Tên tab cấu hình động trong file hiện tại */
  DATA_SHEET_NAME: "Data",

  /** Tên các Role tra cứu trong sheet Data */
  RECIPIENT_ROLES: {
    DEVOPS: "DevOps",
    HR: "OKR",
    IT: "IT Support",
    PEOPLE_TEAM: "People Team",
  },

  /** Định danh các luồng trigger */
  TRIGGERS: {
    WELCOME_EMAIL: "WELCOME_EMAIL",
    OFFER_ACCEPTED: "OFFER_ACCEPTED",
    TA_NOTIFICATION: "TA_NOTIFICATION",
    AVATAR_UPDATE: "AVATAR_UPDATE",
  },

  /** Map File ID PDF hướng dẫn onboarding: ${employmentType}_${location} */
  GUIDE_PDF_MAP: {
    intern_danang: "1soQu_zY8ZWrKwu3MqA7TGgEQibWQgXht",
    intern_hcm: "1fk9H4gvXn2CzIoQSbNUvnMEqQrsrKd2_",
    probation_danang: "1aAr-bRUjRxonjSLgANHhEgCSvnDdSrwZ",
    probation_hcm: "1be3OS8_KnNEJKk3RqwcqpuFaR-4uLb2e",
  },

  /** Địa chỉ văn phòng theo Onboarding Type */
  OFFICE_ADDRESS: {
    DEFAULT:
      "Floor 2, Room 2.6, 294-296 Truong Sa, Cau Kieu Ward, Ho Chi Minh City",
    DANANG: "Floor 3, 433-435 Nguyen Huu Tho, Cam Le, Da Nang",
    HOA_CAU: "Floor 1, Room 1.2, 09 Hoa Cau, Cau Kieu Ward, Ho Chi Minh City",
  },

  /** Tên các cột thô trên sheet Hera (chưa qua normalizeHeaderKey) */
  RAW_HEADERS: {
    FULL_NAME: "Full Name",
    ACCENTLESS_FULL_NAME: "Accentless Full Name",
    LEVEL: "Level",
    EMPLOYMENT_TYPE: "Employment Type",
    TITLE: "Title",
    SQUAD: "Squad/ Unit",
    LINE_MANAGER: "Line Manager",
    TA_IN_CHARGE: "TA In Charge",
    DATE_ONBOARD: "Date of Onboard",
    OFFER_STATUS: "Offer Status",
    DEVICE_REQUEST: "Device Request from newcomer",
    ONBOARDING_TYPE: "Onboarding Type",
    WORKING_EMAIL: "Working Email",
    PERSONAL_EMAIL: "Personal Email",
    CV: "CV",
    LINK_FOLDER_OKRS: "Link Folder OKRs",
    REMARKS: "Remarks\n(update by Atlas)",
    ALLOC_CODE: "Alloc Code\n(update by Atlas)",
  },

  /** Cấu hình tab log riêng cho từng luồng Onboarding */
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
        "Error Details",
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
        "Error Details",
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
        "Error Details",
      ],
    },
  },

  /** Đường dẫn các file HTML templates của Onboarding */
  TEMPLATES: {
    DIALOG: {
      TA_REMINDER: "onboarding/dialog-templates/ta-reminder-dialog",
    },
    EMAIL: {
      AVATAR_UPDATE: "onboarding/email-templates/avatar-update-email",
      AVATAR_TA_REMINDER: "onboarding/email-templates/avatar-ta-reminder-email",
      DEVOPS: "onboarding/email-templates/devops-email",
      HR: "onboarding/email-templates/hr-email",
      IT: "onboarding/email-templates/it-email",
      TA_NOTIFICATION: "onboarding/email-templates/ta-notification-email",
      WELCOME_CANDIDATE: "onboarding/email-templates/welcome-candidate-email",
    },
  },
};
