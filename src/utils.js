/** ==========================================
 * UTILS.JS - HẰNG SỐ VÀ TIỆN ÍCH DÙNG CHUNG
 * ========================================== */

// Cấu hình Email mặc định của các phòng ban
const CONFIG = {
  RECIPIENTS: {
    DEVOPS: "quang.nguyenminh@kyanon.digital", // Thay email thật anh Tuấn khi bàn giao
    HR: "quang.nguyenminh@kyanon.digital", // Email chị Tuyền
    IT: "quang.nguyenminh@kyanon.digital", // Email anh Trung
    PEOPLE_TEAM: "people@kyanon.digital",
  },
};

/**
 * Helper: Chuẩn hóa key của Header (bỏ ký tự đặc biệt, khoảng trắng, viết thường)
 */
function normalizeHeaderKey(header) {
  if (!header) return "";
  return String(header)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

// Từ điển Key đã được chuẩn hóa
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
};

/**
 * Helper: Chuẩn hóa chuỗi input
 */
function clean(str) {
  return String(str || "")
    .normalize("NFC")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

/**
 * Helper: Bỏ dấu tiếng Việt
 */
function removeAccents(str) {
  if (!str) return "";
  return clean(
    String(str)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[đĐ]/g, (m) => (m === "đ" ? "d" : "D")),
  );
}

/**
 * Helper: Viết hoa chữ cái đầu của mỗi từ (Title Case)
 * Ví dụ: "tran thi tu anh" -> "Tran Thi Tu Anh"
 */
function toTitleCase(str) {
  if (!str) return "";
  return clean(str).replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Helper: Chuẩn hóa Email Kyanon. Nếu chỉ có username sẽ tự thêm đuôi '@kyanon.digital'
 */
function formatKyanonEmail(alloc) {
  let cleanAlloc = clean(alloc);
  if (!cleanAlloc) return "";
  return cleanAlloc.includes("@") ? cleanAlloc : `${cleanAlloc}@kyanon.digital`;
}

/**
 * Helper: Định dạng hiển thị Ngày tháng (dd/MM/yyyy)
 */
function formatDateValue(dateVal) {
  if (!dateVal) return "";
  if (dateVal instanceof Date) {
    return Utilities.formatDate(
      dateVal,
      Session.getScriptTimeZone(),
      "dd/MM/yyyy",
    );
  }
  return clean(dateVal);
}

/**
 * Helper: Kiểm tra nhu cầu thiết bị có phải "as company standard" hay không
 */
function isStandardDevice(deviceRequestStr) {
  return clean(deviceRequestStr).includes("as company standard");
}

/**
 * Helper: Lấy File PDF + File ID trực tiếp dựa trên Employment Type và Onboarding Type
 * @param {string} employmentType - Loại hợp đồng (intern/probation)
 * @param {string} onboardingType - Địa điểm làm việc (danang/hcm/onsite)
 * @returns {Object|null} { file, fileId }
 */
function getGuidePdfFileInfo(employmentType, onboardingType) {
  try {
    const DRIVE_FILE_MAP = {
      intern_danang: "1soQu_zY8ZWrKwu3MqA7TGgEQibWQgXht",
      intern_hcm: "1fk9H4gvXn2CzIoQSbNUvnMEqQrsrKd2_",
      probation_danang: "1aAr-bRUjRxonjSLgANHhEgCSvnDdSrwZ",
      probation_hcm: "1be3OS8_KnNEJKk3RqwcqpuFaR-4uLb2e",
    };

    const empStr = clean(employmentType);
    const onboardStr = clean(onboardingType);

    const category = empStr.includes("intern") ? "intern" : "probation";
    const location = onboardStr.includes("danang") ? "danang" : "hcm";
    const lookupKey = `${category}_${location}`;

    const fileId = DRIVE_FILE_MAP[lookupKey];

    if (fileId) {
      return {
        file: DriveApp.getFileById(fileId),
        fileId: fileId,
      };
    } else {
      Logger.log("Không tìm thấy File ID khớp với Key: " + lookupKey);
    }
  } catch (err) {
    Logger.log("Lỗi khi lấy file PDF từ Drive ID: " + err.toString());
  }
  return null;
}
