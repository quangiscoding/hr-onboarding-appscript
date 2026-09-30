/** ==========================================
 * UTILS.JS - TIỆN ÍCH DÙNG CHUNG (PURE HELPERS)
 * ==========================================
 * Toàn bộ hàm trong file này là "pure" hoặc chỉ đọc dữ liệu,
 * không phụ thuộc nghiệp vụ cụ thể — có thể tái sử dụng ở mọi module.
 */

/**
 * Chuẩn hóa key của Header (bỏ ký tự đặc biệt, khoảng trắng, viết thường)
 * Dùng làm "khóa" tra cứu cột trên Google Sheet.
 */
function normalizeHeaderKey(header) {
  if (!header) return "";
  return String(header)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

/**
 * Chuẩn hóa chuỗi input: NFC, lowercase, trim, gọn khoảng trắng.
 * Luôn dùng hàm này cho các chuỗi dùng để SO SÁNH.
 */
function clean(str) {
  return String(str || "")
    .normalize("NFC")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

/** Bỏ dấu tiếng Việt (ví dụ "Trần" -> "Tran") */
function removeAccents(str) {
  if (!str) return "";
  return clean(
    String(str)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[đĐ]/g, (m) => (m === "đ" ? "d" : "D")),
  );
}

/** Viết hoa chữ cái đầu mỗi từ: "trầN thị TÚ anH" -> "Trần Thị Tú Anh" */
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

/** Chuẩn hóa Email Kyanon: chỉ có username thì tự thêm đuôi '@kyanon.digital' */
function formatKyanonEmail(alloc) {
  const cleanAlloc = clean(alloc);
  if (!cleanAlloc) return "";
  return cleanAlloc.includes("@") ? cleanAlloc : `${cleanAlloc}@kyanon.digital`;
}

/** Định dạng ngày tháng hiển thị (dd/MM/yyyy) */
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

/** Kiểm tra nhu cầu thiết bị có phải "as company standard" hay không */
function isStandardDevice(deviceRequestStr) {
  return clean(deviceRequestStr).includes("as company standard");
}

/** Rút gọn email về username: "nguyen.trt@kyanon.digital" -> "nguyen.trt" */
function toEmailUsername(email, fallback = "") {
  const raw = String(email || "").trim();
  if (!raw) return fallback;
  return raw.includes("@") ? raw.split("@")[0] : raw;
}

/* ------------------------------------------------------------------ */
/* SHEET HELPERS - tiện ích thao tác trên Google Sheet                 */
/* ------------------------------------------------------------------ */

/**
 * Đọc headers (dòng 1) của sheet và trả về Map: [normalizedKey] -> số cột (1-based)
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet
 * @returns {Object} { key: columnIndex }
 */
function getHeaderColumnMap(sheet) {
  const lastCol = sheet.getLastColumn();
  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  const map = {};
  headers.forEach((header, index) => {
    if (header) map[normalizeHeaderKey(header)] = index + 1;
  });
  return map;
}

/* ------------------------------------------------------------------ */
/* TEMPLATE & DRIVE HELPERS                                            */
/* ------------------------------------------------------------------ */

/**
 * Load file HTML từ thư mục email-templates và inject dữ liệu
 * @param {string} templateName - Tên file html (vd: 'welcome-candidate-email')
 * @param {Object} data - Payload truyền vào template
 * @returns {string} Chuỗi HTML string đã render
 */
function renderHtmlTemplate(templateName, data) {
  const filePath = `email-templates/${templateName}`;
  const template = HtmlService.createTemplateFromFile(filePath);

  template.it = data;
  return template.evaluate().getContent();
}

/**
 * Lấy File PDF hướng dẫn (Blob đã đổi tên) dựa trên Employment Type + Onboarding Type
 * @param {string} employmentType - Loại hợp đồng (intern/probation)
 * @param {string} onboardingType - Địa điểm làm việc (danang/hcm/onsite)
 * @param {string} customFileName - Tên hiển thị của file đính kèm
 * @returns {Object|null} { pdfBlob, fileId } hoặc null nếu lỗi/không tìm thấy
 */
function getGuidePdfFileInfo(employmentType, onboardingType, customFileName) {
  try {
    const category = clean(employmentType).includes("intern")
      ? "intern"
      : "probation";
    const location = clean(onboardingType).includes("danang")
      ? "danang"
      : "hcm";
    const lookupKey = `${category}_${location}`;

    const fileId = CONFIG.GUIDE_PDF_MAP[lookupKey];
    if (!fileId) {
      Logger.log("⚠️ Không tìm thấy File ID khớp với Key: " + lookupKey);
      return null;
    }

    const file = DriveApp.getFileById(fileId);
    const pdfBlob = file.getBlob();

    // Đổi tên Blob đính kèm (không đổi tên file gốc trên Drive)
    if (customFileName) {
      pdfBlob.setName(customFileName);
    }

    return { pdfBlob, fileId };
  } catch (err) {
    Logger.log("❌ Lỗi khi lấy file PDF từ Drive ID: " + err.toString());
    return null;
  }
}
