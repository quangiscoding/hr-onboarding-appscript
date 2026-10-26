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

// Chuyển đổi chỉ số cột dạng số (bắt đầu từ 1: 1-indexed) thành ký tự cột tương ứng theo chuẩn A1 trong Google Sheets / Excel
function getColumnLetterFromIndex(colIndex) {
  let temp,
    letter = "";
  while (colIndex > 0) {
    temp = (colIndex - 1) % 26;
    letter = String.fromCharCode(temp + 65) + letter;
    colIndex = Math.floor((colIndex - temp) / 26);
  }
  return letter;
}

/**
 * Trích xuất width & height của file ảnh từ Google Drive ID bằng binary header.
 * @param {string} fileId - ID của file trên Google Drive
 * @returns {{ width: number, height: number, isSquare: boolean, ratio: number } | null}
 */
function getImageDimensionsFromDriveId_(fileId) {
  try {
    const file = DriveApp.getFileById(fileId);
    const blob = file.getBlob();
    const bytes = blob.getBytes();
    const contentType = blob.getContentType().toLowerCase();

    let width = 0;
    let height = 0;

    // 1. Định dạng PNG
    if (contentType.includes("png")) {
      if (bytes.length >= 24) {
        width =
          ((bytes[16] & 0xff) << 24) |
          ((bytes[17] & 0xff) << 16) |
          ((bytes[18] & 0xff) << 8) |
          (bytes[19] & 0xff);
        height =
          ((bytes[20] & 0xff) << 24) |
          ((bytes[21] & 0xff) << 16) |
          ((bytes[22] & 0xff) << 8) |
          (bytes[23] & 0xff);
      }
    }
    // 2. Định dạng JPEG / JPG
    else if (contentType.includes("jpeg") || contentType.includes("jpg")) {
      let offset = 2;
      while (offset < bytes.length) {
        if ((bytes[offset] & 0xff) === 0xff) {
          const marker = bytes[offset + 1] & 0xff;
          // SOF0, SOF1, SOF2 markers chứa kích thước ảnh
          if (
            (marker >= 0xc0 && marker <= 0xc3) ||
            (marker >= 0xc5 && marker <= 0xc7) ||
            (marker >= 0xc9 && marker <= 0xcb) ||
            (marker >= 0xcd && marker <= 0xcf)
          ) {
            height =
              ((bytes[offset + 5] & 0xff) << 8) | (bytes[offset + 6] & 0xff);
            width =
              ((bytes[offset + 7] & 0xff) << 8) | (bytes[offset + 8] & 0xff);
            break;
          }
          const length =
            ((bytes[offset + 2] & 0xff) << 8) | (bytes[offset + 3] & 0xff);
          offset += 2 + length;
        } else {
          offset++;
        }
      }
    }
    // 3. Định dạng GIF
    else if (contentType.includes("gif")) {
      if (bytes.length >= 10) {
        width = (bytes[6] & 0xff) | ((bytes[7] & 0xff) << 8);
        height = (bytes[8] & 0xff) | ((bytes[9] & 0xff) << 8);
      }
    }
    // 4. Định dạng WEBP
    else if (contentType.includes("webp")) {
      if (bytes.length >= 30) {
        // Simple VP8
        if (
          bytes[12] === 0x56 &&
          bytes[13] === 0x50 &&
          bytes[14] === 0x38 &&
          bytes[15] === 0x20
        ) {
          width = ((bytes[26] & 0xff) | ((bytes[27] & 0xff) << 8)) & 0x3fff;
          height = ((bytes[28] & 0xff) | ((bytes[29] & 0xff) << 8)) & 0x3fff;
        }
        // Extended VP8X
        else if (
          bytes[12] === 0x56 &&
          bytes[13] === 0x50 &&
          bytes[14] === 0x38 &&
          bytes[15] === 0x58
        ) {
          width =
            1 +
            ((bytes[24] & 0xff) |
              ((bytes[25] & 0xff) << 8) |
              ((bytes[26] & 0xff) << 16));
          height =
            1 +
            ((bytes[27] & 0xff) |
              ((bytes[28] & 0xff) << 8) |
              ((bytes[29] & 0xff) << 16));
        }
      }
    }

    if (width > 0 && height > 0) {
      // 1. Tính toán trên số thực chính xác (không làm tròn trước)
      const rawRatio = width / height;
      const pixelDiff = Math.abs(width - height);
      const ratioDiff = Math.abs(rawRatio - 1.0);

      // 2. Tiêu chí: Lệch <= 4 pixel HOẶC lệch tỉ lệ <= 2% (0.02)
      const isSquare = pixelDiff <= 4 || ratioDiff <= 0.02;

      // 3. Làm tròn ratio để hiển thị/ghi log cho gọn
      const displayRatio = Number(rawRatio.toFixed(2));

      return {
        width: width,
        height: height,
        ratio: displayRatio,
        isSquare: isSquare,
      };
    }
  } catch (err) {
    Logger.log("❌ Lỗi đọc file ID: " + fileId + " - Chi tiết: " + err.message);
  }
  return null;
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
  if (lastCol < 1) return {}; // Tránh ném lỗi khi sheet trống

  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  const map = {};

  headers.forEach((header, index) => {
    if (header && String(header).trim() !== "") {
      const key = normalizeHeaderKey(header);
      // Chỉ gán nếu chưa tồn tại (giữ lại cột đầu tiên nếu bị trùng)
      if (!map[key]) {
        map[key] = index + 1; // 1-indexed
      }
    }
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

/**
 * Trích xuất Google Drive / Docs / Sheets / Folder ID chuẩn xác và chống bắt nhầm chuỗi thừa.
 * Hỗ trợ URL đầy đủ, URL có query params, và mã ID thô.
 * @param {string} url - Link Google Drive hoặc chuỗi ID thuần
 * @returns {string|null} ID hợp lệ hoặc null
 */
function extractDriveFileId_(url) {
  if (!url) return null;
  const str = String(url).trim();

  // 1. Khớp theo URL chuẩn: Sau /d/ hoặc /folders/ hoặc ?id=
  // Giới hạn độ dài ID từ 25-50 ký tự, chặn biên bằng [/&#?] hoặc hết chuỗi
  const urlMatch = str.match(
    /(?:\/(?:d|folders)\/|[?&]id=)([-\w]{25,50})(?:[/?&#]|$)/,
  );
  if (urlMatch) return urlMatch[1];

  // 2. Khớp chuỗi ID thô (toàn bộ chuỗi chỉ gồm ký tự Base64, độ dài đúng chuẩn 25-50)
  if (/^[-\w]{25,50}$/.test(str)) {
    return str;
  }

  return null;
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

/**
 * Hàm chạy thử nghiệm độc lập trong Script Editor
 */
function test_getImageDimensions() {
  // Thay bằng File ID thực tế lấy từ link cột F trên Sheet UC06 của bạn
  const sampleTestIds = [
    {
      label: "Test Ảnh 1 (Dòng 2 UC06)",
      id: "1KmXllBW8qy5g8WABjeRWME6AlX5Nkot8",
    },
    {
      label: "Test Ảnh 2 (Dòng 3 UC06)",
      id: "12eYdZzEDttN9Q01yC_p_CVTYlSQ6zz12",
    },
    {
      label: "Test Ảnh 3 (Dòng 4 UC06)",
      id: "18LTemcygQH-nxTgev1iGTs5wTSEFblUu",
    },
  ];

  sampleTestIds.forEach((item) => {
    Logger.log(`\n========================================`);
    Logger.log(`🔍 Đang kiểm tra: ${item.label} (ID: ${item.id})`);

    const result = getImageDimensionsFromDriveId_(item.id);

    if (result) {
      Logger.log(`- Kích thước: ${result.width} x ${result.height} px`);
      Logger.log(`- Tỉ lệ (Width/Height): ${result.ratio}`);
      Logger.log(
        `- Kết luận: ${result.isSquare ? "✅ ĐẠT CHUẨN 1:1" : "❌ SAI TỈ LỆ 1:1"}`,
      );
    } else {
      Logger.log(
        `⚠️ Không đọc được metadata hoặc không có quyền truy cập file ID này.`,
      );
    }
  });
}
