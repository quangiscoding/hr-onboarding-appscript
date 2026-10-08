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
/* RECIPIENT HELPERS - danh sách người nhận email (sheet Data)          */
/* ------------------------------------------------------------------ */

/**
 * Tách 1 ô thành danh sách email Kyanon.
 * Ô có thể chứa 1 hoặc nhiều Alloc Code / email, ngăn cách bởi dấu phẩy,
 * chấm phẩy hoặc xuống dòng.
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
 * Đọc bảng phân công recipient (Role | Send to | CC) từ sheet cấu hình
 * (CONFIG.DATA_SHEET_NAME). Tìm header động (không phụ thuộc tọa độ
 * cột/dòng), trả về map theo role đã normalizeHeaderKey.
 * @returns {Object} { devops: { to: [...], cc: [...] }, okr: {...}, ... }
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
  const filePath = `onboarding/email-templates/${templateName}`;
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

/* ------------------------------------------------------------------ */
/* DEVELOPER METADATA LOCK HELPERS                                    */
/* ------------------------------------------------------------------ */

/**
 * Tạo Key chuẩn định danh ngầm theo: TriggerType + Email
 * Ví dụ Key: LOCK_WF_OFFER_ACCEPTED_tttuanh99@gmail.com
 */
function buildWorkflowLockKey_(triggerType, email) {
  const cleanEmail = clean(String(email || "")).toLowerCase();
  const cleanTrigger = clean(String(triggerType || "")).toUpperCase();
  return `LOCK_WF_${cleanTrigger}_${cleanEmail}`;
}

/**
 * Kiểm tra xem Dòng này VÀ Email này đã bị khóa cho Workflow hay chưa
 * @param {number} rowNumber - Số dòng trên Sheet (1-based index)
 * @param {string} triggerType - Loại workflow ("OFFER_ACCEPTED", "TA_NOTIFICATION", "WELCOME_EMAIL")
 * @param {string} email - Email cá nhân hoặc Email làm việc của nhân sự
 * @returns {boolean} true nếu đã chạy và bị khóa, false nếu chưa
 */
function isRowLockedForWorkflow(rowNumber, triggerType, email) {
  if (!rowNumber || !triggerType || !email) return false;

  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    const targetKey = buildWorkflowLockKey_(triggerType, email);

    // 1. Kiểm tra trên Entire Row ("3:3")
    const entireRowRange = sheet.getRange(`${rowNumber}:${rowNumber}`);
    const metadataList = entireRowRange.getDeveloperMetadata();

    const isLockedOnRow = metadataList.some(
      (meta) => meta.getKey() === targetKey && meta.getValue() === "COMPLETED",
    );

    if (isLockedOnRow) return true;

    // 2. Dự phòng: Quét toàn Sheet xem email + workflow này đã từng bị khóa ở dòng khác chưa
    const finder = sheet.createDeveloperMetadataFinder();
    const globalMatch = finder.withKey(targetKey).find();

    return globalMatch.length > 0;
  } catch (error) {
    Logger.log(`[isRowLockedForWorkflow Error]: ${error.stack}`);
    return false; // Fail-safe
  }
}

/**
 * Đánh dấu KHÓA gắn chặt theo Dòng VÀ Email của nhân sự
 * @param {number} rowNumber - Số dòng trên Sheet (1-based index)
 * @param {string} triggerType - Loại workflow vừa chạy xong
 * @param {string} email - Email cá nhân hoặc Email làm việc của nhân sự
 */
function lockRowForWorkflow(rowNumber, triggerType, email) {
  if (!rowNumber || !triggerType || !email) return;

  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    const targetKey = buildWorkflowLockKey_(triggerType, email);
    const entireRowRange = sheet.getRange(`${rowNumber}:${rowNumber}`);

    if (!isRowLockedForWorkflow(rowNumber, triggerType, email)) {
      entireRowRange.addDeveloperMetadata(
        targetKey,
        "COMPLETED",
        SpreadsheetApp.DeveloperMetadataVisibility.DOCUMENT,
      );
      Logger.log(
        `[LOCK SUCCESS] Đã khóa "${targetKey}" cho Dòng ${rowNumber}:${rowNumber}`,
      );
    }
  } catch (error) {
    Logger.log(`[lockRowForWorkflow Error]: ${error.stack}`);
  }
}

/**
 * 🔓 HÀM XÓA LOCK (ĐÃ FIX): Xóa sạch toàn bộ khóa DeveloperMetadata trên dòng đang chọn
 */
function dev_unlockCurrentRow() {
  const ui = SpreadsheetApp.getUi();
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const activeRange = sheet.getActiveRange();

  if (!activeRange) {
    ui.alert(
      "⚠️ Vui lòng chọn một dòng chứa dữ liệu trên Sheet trước khi mở khóa!",
    );
    return;
  }

  const rowNumber = activeRange.getRow();

  // ⚡ CỐT LÕI: Phải lấy Entire Row Range ("3:3") thì mới lấy đúng Metadata đã gắn
  const entireRowRange = sheet.getRange(`${rowNumber}:${rowNumber}`);
  const metadataList = entireRowRange.getDeveloperMetadata();

  if (metadataList.length === 0) {
    ui.alert(`ℹ️ Thông báo: Dòng ${rowNumber} hiện tại KHÔNG CÓ vết khóa nào!`);
    return;
  }

  let count = 0;
  metadataList.forEach((meta) => {
    // Xóa tất cả metadata khóa theo chuẩn cũ hoặc chuẩn mới
    if (meta.getKey().startsWith("LOCK_")) {
      meta.remove(); // ❌ Thực thi xóa vết khóa khỏi Google Sheet API
      count++;
    }
  });

  ui.alert(`🎉 Đã xóa thành công ${count} vết khóa cho Dòng ${rowNumber}!`);
}
