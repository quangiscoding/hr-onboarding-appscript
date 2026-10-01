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
 * Helper: Tách 1 ô thành danh sách email Kyanon.
 * Ô có thể chứa 1 hoặc nhiều Alloc Code / email, ngăn cách bởi dấu phẩy, chấm phẩy hoặc xuống dòng.
 * @param {string} raw - Giá trị ô (vd: "tuan.le" hoặc "tuan.le, nhi.tran")
 * @returns {string[]} Mảng email đã chuẩn hóa (đã thêm @kyanon.digital nếu là Alloc Code)
 */
function getEmailList_(raw) {
  if (!raw) return [];
  return String(raw)
    .split(/[,;\n]+/)
    .map((part) => formatKyanonEmail(part))
    .filter(Boolean);
}

/**
 * Đọc bảng phân công recipient (Role | Send to | CC) từ sheet cấu hình (mặc định "Data").
 * Tìm header động (không phụ thuộc tọa độ cột/dòng), trả về map theo role đã normalizeHeaderKey.
 * @returns {Object} { devops: { to: [...], cc: [...] }, okr: {...}, itsupport: {...} }
 */
function getRecipientsMap() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.DATA_SHEET_NAME);
  if (!sheet) {
    throw new Error(
      `Không tìm thấy sheet "${CONFIG.DATA_SHEET_NAME}" để đọc danh sách recipient!`,
    );
  }

  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();
  if (lastRow < 2 || lastCol < 1) return {};

  const values = sheet.getRange(1, 1, lastRow, lastCol).getValues();

  // 1. Tìm dòng header chứa cột "Role" (quét động, không hardcode vị trí)
  let headerRowIdx = -1;
  let roleCol = -1;
  let sendToCol = -1;
  let ccCol = -1;

  for (let r = 0; r < Math.min(values.length, 20); r++) {
    const rowKeys = values[r].map(normalizeHeaderKey);
    const rIdx = rowKeys.indexOf(normalizeHeaderKey("Role"));
    if (rIdx !== -1) {
      headerRowIdx = r;
      roleCol = rIdx;
      sendToCol = rowKeys.indexOf(normalizeHeaderKey("Send to"));
      ccCol = rowKeys.indexOf(normalizeHeaderKey("CC"));
      break;
    }
  }

  if (headerRowIdx === -1) {
    throw new Error(
      `Không tìm thấy cột "Role" trong sheet "${CONFIG.DATA_SHEET_NAME}"!`,
    );
  }

  // 2. Duyệt các dòng bên dưới header, gom Send to / CC theo Role
  const map = {};
  for (let r = headerRowIdx + 1; r < values.length; r++) {
    const role = clean(values[r][roleCol]);
    if (!role) continue;

    const key = normalizeHeaderKey(role);
    if (!map[key]) map[key] = { to: [], cc: [] };

    if (sendToCol >= 0) {
      map[key].to = map[key].to.concat(getEmailList_(values[r][sendToCol]));
    }
    if (ccCol >= 0) {
      map[key].cc = map[key].cc.concat(getEmailList_(values[r][ccCol]));
    }
  }

  return map;
}

/**
 * Lấy recipients cho 1 role cụ thể từ sheet Data.
 * @param {string} roleName - Tên role trong cột "Role" (vd: "DevOps", "IT Support", "OKR", "People Team")
 * @returns {{ to: string[], cc: string[] }} Mảng email nhận chính + CC
 */
function getRecipientsByRole(roleName) {
  const map = getRecipientsMap();
  const key = normalizeHeaderKey(roleName);
  return map[key] || { to: [], cc: [] };
}

/**
 * Helper: Kiểm tra nhu cầu thiết bị có phải "as company standard" hay không
 */
function isStandardDevice(deviceRequestStr) {
  return clean(deviceRequestStr).includes("as company standard");
}

/**
 * Load file HTML từ thư mục email-templates và inject dữ liệu
 * @param {string} templateName - Tên file html (vd: 'welcome-candidate-email')
 * @param {Object} data - Payload truyền vào template
 * @returns {string} Chuỗi HTML string đã render
 */
function renderHtmlTemplate(templateName, data) {
  // Bỏ 'src/' ở đầu, chỉ giữ lại 'email-templates/'
  const filePath = `email-templates/${templateName}`;
  const template = HtmlService.createTemplateFromFile(filePath);

  template.it = data;
  return template.evaluate().getContent();
}

/**
 * Helper: Lấy File PDF + File ID trực tiếp dựa trên Employment Type và Onboarding Type
 * @param {string} employmentType - Loại hợp đồng (intern/probation)
 * @param {string} onboardingType - Địa điểm làm việc (danang/hcm/onsite)
 * @returns {Object|null} { file, fileId }
 */
function getGuidePdfFileInfo(employmentType, onboardingType, customFileName) {
  try {
    const empStr = clean(employmentType);
    const onboardStr = clean(onboardingType);

    const category = empStr.includes("intern") ? "intern" : "probation";
    const location = onboardStr.includes("danang") ? "danang" : "hcm";
    const lookupKey = `${category}_${location}`;

    const fileId = CONFIG.GUIDE_PDF_MAP[lookupKey];

    if (fileId) {
      const file = DriveApp.getFileById(fileId);

      // 1. Tải Blob của file PDF vào RAM
      let pdfBlob = file.getBlob();

      // 2. Đổi tên Blob đính kèm (không đổi tên file gốc trên Drive)
      if (customFileName) {
        pdfBlob.setName(customFileName);
      }

      return {
        pdfBlob: pdfBlob,
        fileId: fileId,
      };
    } else {
      Logger.log("⚠️ Không tìm thấy File ID khớp với Key: " + lookupKey);
    }
  } catch (err) {
    Logger.log("❌ Lỗi khi lấy file PDF từ Drive ID: " + err.toString());
  }
  return null;
}
