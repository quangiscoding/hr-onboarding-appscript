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
/**
 * Đọc nội dung CV từ upload hoặc link trên Sheet
 */
function readCvContent_(cvFileMeta, candidate) {
  // 1. Nếu có file upload trực tiếp từ Sidebar
  if (cvFileMeta && cvFileMeta.dataBase64) {
    const bytes = Utilities.base64Decode(cvFileMeta.dataBase64);
    const blob = Utilities.newBlob(
      bytes,
      cvFileMeta.mimeType || "application/pdf",
      cvFileMeta.fileName || "cv.pdf",
    );

    // Nếu là PDF upload từ máy -> gửi base64
    if (
      blob.getContentType() === MimeType.PDF ||
      /\.pdf\$/i.test(cvFileMeta.fileName || "")
    ) {
      return {
        kind: "pdf_inline",
        pdfBase64: Utilities.base64Encode(blob.getBytes()),
        fileName: cvFileMeta.fileName || "cv.pdf",
      };
    }
  }

  // 2. Nếu đọc từ Link/Tên file trong cột CV trên Sheet
  if (candidate && candidate.cvUrl) {
    let fileId = extractDriveFileId_(candidate.cvUrl);
    if (!fileId) {
      fileId = findDriveFileIdByName_(candidate.cvUrl);
    }

    if (!fileId) {
      throw new Error(
        `Không tìm thấy file CV từ link/tên "${candidate.cvUrl}".`,
      );
    }

    // TH1: Thử mở bằng Google Docs (Nếu link dán vào là Google Docs)
    try {
      const doc = DocumentApp.openById(fileId);
      const docText = doc.getBody().getText().trim();
      if (docText) {
        Logger.log(
          "✅ Đã đọc CV dạng Google Docs thành công! Số ký tự: " +
            docText.length,
        );
        return { kind: "text", text: docText };
      }
    } catch (e) {
      // Không phải Google Doc, bỏ qua chuyển xuống thử đọc dạng File/PDF
    }

    // TH2: Mở bằng DriveApp (Nếu link dán vào là file PDF / Word / File mã hóa)
    const file = DriveApp.getFileById(fileId);
    const mimeType = file.getMimeType();
    const fileName = file.getName();

    // Nếu là Google Doc loại MimeType
    if (mimeType === MimeType.GOOGLE_DOCS) {
      const docText = DocumentApp.openById(fileId).getBody().getText().trim();
      return { kind: "text", text: docText };
    }

    // Nếu là file PDF
    if (mimeType === MimeType.PDF || /\.pdf\$/i.test(fileName)) {
      return {
        kind: "pdf_inline",
        pdfBase64: Utilities.base64Encode(file.getBlob().getBytes()),
        fileName: fileName,
      };
    }

    // Nếu là file DOCX
    if (mimeType === MimeType.MICROSOFT_WORD || /\.docx\$/i.test(fileName)) {
      return { kind: "text", text: extractTextFromDocx_(file.getBlob()) };
    }
  }

  throw new Error("Không tìm thấy CV hợp lệ để xử lý.");
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
