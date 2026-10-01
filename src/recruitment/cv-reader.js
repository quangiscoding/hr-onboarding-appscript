/** ==========================================
 * RECRUITMENT/CV-READER.JS - ĐỌC & TRÍCH TEXT TỪ CV
 * ==========================================
 * Đọc CV từ nguồn (upload từ máy hoặc link/tên file trong cột CV của sheet)
 * và trích xuất nội dung theo định dạng:
 *  - PDF  -> base64 inline (AI đọc trực tiếp)
 *  - DOCX -> giải nén word/document.xml, strip XML
 *  - GDoc -> DocumentApp
 *  - TXT  -> đọc thẳng
 * Phụ thuộc: core/utils.js (không trực tiếp nhưng cùng ecosystem)
 */

/**
 * Đọc nội dung CV: ưu tiên file upload từ formData,
 * fallback link CV trong cột CV của dòng đang chọn.
 * @param {Object} cvFileMeta - { dataBase64, fileName, mimeType } | null (upload từ máy)
 * @param {Object} candidate - { cvUrl, ... } từ sheet
 * @returns {Object}
 *   - PDF:   { kind: "pdf_inline", pdfBase64, fileName } (gửi thẳng PDF base64 cho AI)
 *   - Khác:  { kind: "text", text }
 */
function readCvContent_(cvFileMeta, candidate) {
  let blob = null;
  let fileName = "cv";

  // 1. CV upload trực tiếp từ sidebar (base64) — dựng blob trong bộ nhớ, KHÔNG tạo file Drive
  if (cvFileMeta && cvFileMeta.dataBase64) {
    const bytes = Utilities.base64Decode(cvFileMeta.dataBase64);
    blob = Utilities.newBlob(
      bytes,
      cvFileMeta.mimeType || "application/pdf",
      cvFileMeta.fileName || "cv.pdf",
    );
    fileName = cvFileMeta.fileName || "cv.pdf";
  } else if (candidate && candidate.cvUrl) {
    // 2. Link CV trong cột CV của sheet
    let fileId = extractDriveFileId_(candidate.cvUrl);
    if (!fileId) {
      // Cột CV chỉ chứa TÊN FILE (không phải link) -> tìm file trong Drive theo tên
      fileId = findDriveFileIdByName_(candidate.cvUrl);
      if (!fileId) {
        throw new Error(
          `Cột CV không chứa link Drive hợp lệ và không tìm thấy file nào tên "${candidate.cvUrl}" trong Drive của bạn. Hãy dán link Drive của CV vào cột CV hoặc upload file từ máy.`,
        );
      }
    }
    const file = DriveApp.getFileById(fileId);
    blob = file.getBlob();
    fileName = file.getName() || fileName;
  } else {
    throw new Error(
      "Không tìm thấy CV: cột CV trên sheet trống và bạn chưa upload file CV. Hãy upload CV hoặc điền link CV vào cột CV.",
    );
  }

  const mimeType = blob.getContentType() || "";
  const nameForDetect = fileName || "";

  // PDF: gửi thẳng base64 cho AI (Gemini đọc PDF native, không cần convert sang GDoc)
  if (mimeType === MimeType.PDF || /\.pdf$/i.test(nameForDetect)) {
    return {
      kind: "pdf_inline",
      pdfBase64: Utilities.base64Encode(blob.getBytes()),
      fileName,
    };
  }

  // Google Docs: mở DocumentApp trực tiếp
  if (mimeType === MimeType.GOOGLE_DOCS) {
    const fileId =
      extractDriveFileId_(candidate && candidate.cvUrl) ||
      findDriveFileIdByName_(nameForDetect);
    let text = "";
    try {
      text = DocumentApp.openById(fileId).getBody().getText();
    } catch (e) {
      text = "";
    }
    if (text) return { kind: "text", text };
  }

  // DOCX (zip): giải nén lấy word/document.xml rồi strip tag XML
  if (mimeType === MimeType.MICROSOFT_WORD || /\.docx$/i.test(nameForDetect)) {
    return { kind: "text", text: extractTextFromDocx_(blob) };
  }

  // DOC cũ (binary): không đọc được — yêu cầu đổi định dạng
  if (/\.doc$/i.test(nameForDetect) || mimeType === "application/msword") {
    throw new Error(
      "File CV là .doc cũ — script không đọc được. Hãy lưu lại thành .docx hoặc PDF rồi upload lại (hoặc upload PDF).",
    );
  }

  // Plain text / các định dạng khác
  const text = blob.getDataAsString("UTF-8");
  if (!text || !/[a-zA-Z]/.test(text.slice(0, 500))) {
    throw new Error(
      "Không trích xuất được text từ file CV. Các định dạng hỗ trợ: PDF, DOCX, Google Docs, TXT.",
    );
  }
  return { kind: "text", text };
}

/**
 * Trích text từ file DOCX (một file zip chứa XML).
 * Đọc word/document.xml, tách paragraph rồi strip tag XML.
 */
function extractTextFromDocx_(blob) {
  let xml = null;
  try {
    // Utilities.unzip yêu cầu ContentType = application/zip — docx mang MIME Word riêng nên phải ép lại
    blob.setContentType("application/zip");
    const entries = Utilities.unzip(blob);
    for (let i = 0; i < entries.length; i++) {
      if (entries[i].getName() === "word/document.xml") {
        xml = entries[i].getDataAsString("UTF-8");
        break;
      }
    }
  } catch (e) {
    throw new Error("File DOCX hỏng hoặc không đọc được: " + e.message);
  }
  if (!xml) {
    throw new Error(
      'Không tìm thấy nội dung "word/document.xml" trong file DOCX.',
    );
  }

  return xml
    .replace(/<w:p[ >]/g, "\n<w:p ") // mỗi paragraph = 1 dòng
    .replace(/<w:tab[^>]*\/>/g, "\t")
    .replace(/<w:br[^>]*\/>/g, "\n")
    .replace(/<[^>]+>/g, "") // strip toàn bộ tag còn lại
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Tìm file trong Drive theo TÊN (khi cột CV chỉ chứa tên file, không phải link).
 * Trả về File ID của kết quả khớp đầu tiên, hoặc null nếu không thấy.
 */
function findDriveFileIdByName_(name) {
  if (!name) return null;
  const escaped = String(name).replace(/'/g, "\\'");
  const it = DriveApp.searchFiles(
    `title contains '${escaped}' and trashed = false`,
  );
  while (it.hasNext()) {
    return it.next().getId(); // lấy kết quả khớp đầu tiên
  }
  return null;
}

/** Trích Drive File ID từ nhiều dạng link Drive phổ biến */
function extractDriveFileId_(url) {
  if (!url) return null;
  const patterns = [
    /\/file\/d\/([a-zA-Z0-9_-]+)/, // /file/d/<ID>/view
    /[?&]id=([a-zA-Z0-9_-]+)/, // ?id=<ID>
    /\/document\/d\/([a-zA-Z0-9_-]+)/, // docs.google.com/document/d/<ID>
  ];
  for (const p of patterns) {
    const m = String(url).match(p);
    if (m) return m[1];
  }
  // Trả về nguyên chuỗi nếu nó tự là File ID (dạng uuid)
  if (/^[a-zA-Z0-9_-]{20,}$/.test(String(url).trim()))
    return String(url).trim();
  return null;
}
