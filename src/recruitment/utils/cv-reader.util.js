/**
 * utils/cv-reader.util.js
 * Xử lý dữ liệu thuần cho việc đọc và bóc tách CV.
 */
class CvReaderUtil {
  /**
   * Trích xuất Google Drive File/Folder ID an toàn theo Engineering Guidelines Mục C:
   * - Bắt khớp: /d/, /folders/, hoặc tham số ?id= / &id=
   * - Giới hạn độ dài: 25 đến 50 ký tự
   * - Có ký tự biên chặn ([/?&#]|$)
   * - Fallback về chuỗi thô nếu người dùng dán trực tiếp ID
   * @param {string} input - URL hoặc ID thô
   * @returns {string|null}
   */
  static extractDriveId(input) {
    if (!input || typeof input !== "string") return null;
    const str = input.trim();

    // 1. Khớp theo URL Drive (/d/<id>, /folders/<id>, ?id=<id>, &id=<id>)
    const urlPattern =
      /(?:\/d\/|\/folders\/|[?&]id=)([a-zA-Z0-9_-]{25,50})(?=[/?&#]|$)/;
    const match = str.match(urlPattern);
    if (match && match[1]) {
      return match[1];
    }

    // 2. Fallback: Nếu dán trực tiếp ID thô hợp lệ (25-50 ký tự không chứa ký tự URL đặc biệt)
    if (/^[a-zA-Z0-9_-]{25,50}$/.test(str)) {
      return str;
    }

    return null;
  }

  /**
   * Trích text từ file DOCX (zip chứa word/document.xml)
   * @param {GoogleAppsScript.Base.Blob} blob
   * @returns {string}
   */
  static extractTextFromDocxBlob(blob) {
    if (!blob) throw new Error("Blob DOCX không tồn tại.");

    let xml = null;
    try {
      // Utilities.unzip yêu cầu ContentType = application/zip
      blob.setContentType("application/zip");
      const entries = Utilities.unzip(blob);
      for (let i = 0; i < entries.length; i++) {
        if (entries[i].getName() === "word/document.xml") {
          xml = entries[i].getDataAsString("UTF-8");
          break;
        }
      }
    } catch (e) {
      throw new Error("File DOCX hỏng hoặc không giải nén được: " + e.message);
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
      .replace(/<[^>]+>/g, "") // strip toàn bộ XML tag
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }
}
