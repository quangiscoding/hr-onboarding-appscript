/** ==========================================
 * UTILS.JS - TIỆN ÍCH DÙNG CHUNG (PURE HELPERS)
 * ========================================== */

/**
 * Helper: Chuẩn hóa key của Header (bỏ ký tự đặc biệt, khoảng trắng, viết thường)
 */
function normalizeHeaderKey(header) {
  if (!header) return "";
  return String(header)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

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
 * Chuẩn hóa chuỗi về dạng Title Case (Viết hoa chữ cái đầu mỗi từ)
 * Ví dụ: "trầN thị TÚ anH" -> "Trần Thị Tú Anh"
 */
function toTitleCase(str) {
  if (!str) return "";

  return str
    .toString()
    .toLowerCase()
    .split(" ")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
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
    const empStr = clean(employmentType);
    const onboardStr = clean(onboardingType);

    const category = empStr.includes("intern") ? "intern" : "probation";
    const location = onboardStr.includes("danang") ? "danang" : "hcm";
    const lookupKey = `${category}_${location}`;

    const fileId = CONFIG.GUIDE_PDF_MAP[lookupKey];

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
