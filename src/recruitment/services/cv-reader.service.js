/**
 * services/cv-reader.service.js
 * Quản lý logic đọc file CV từ client upload hoặc Drive/Sheet.
 */
class CvReaderService {
  /**
   * Đọc nội dung CV từ upload hoặc link/tên trên Sheet.
   * Return Contract:
   *   - PDF:  { kind: "pdf_inline", pdfBase64: string, fileName: string }
   *   - Khác: { kind: "text", text: string }
   * @param {Object|null} cvFileMeta - { dataBase64, fileName, mimeType }
   * @param {Object|null} candidate - { cvUrl, ... }
   * @returns {{ kind: "pdf_inline"|"text", pdfBase64?: string, fileName?: string, text?: string }}
   */
  static readCvContent(cvFileMeta, candidate) {
    // 1. Ưu tiên: File tải trực tiếp từ Sidebar
    if (cvFileMeta && cvFileMeta.dataBase64) {
      return this.processUploadedCv_(cvFileMeta);
    }

    // 2. Fallback: Đọc từ Drive thông qua link/tên file từ dữ liệu ứng viên
    if (candidate && candidate.cvUrl) {
      return this.processDriveCv_(candidate.cvUrl);
    }

    throw new Error("Không tìm thấy thông tin hoặc tệp CV hợp lệ để xử lý.");
  }

  /**
   * Xử lý file upload trực tiếp
   * @private
   */
  static processUploadedCv_(cvFileMeta) {
    const bytes = Utilities.base64Decode(cvFileMeta.dataBase64);
    const fileName = cvFileMeta.fileName || "cv.pdf";
    const mimeType = cvFileMeta.mimeType || "application/pdf";
    const blob = Utilities.newBlob(bytes, mimeType, fileName);

    const isPdf =
      blob.getContentType() === MimeType.PDF || /\.pdf$/i.test(fileName);
    if (isPdf) {
      return {
        kind: "pdf_inline",
        pdfBase64: Utilities.base64Encode(blob.getBytes()),
        fileName: fileName,
      };
    }

    // Nếu upload DOCX
    const isDocx =
      blob.getContentType() === MimeType.MICROSOFT_WORD ||
      /\.docx$/i.test(fileName);
    if (isDocx) {
      return {
        kind: "text",
        text: CvReaderUtil.extractTextFromDocxBlob(blob),
      };
    }

    throw new Error(
      "Định dạng file tải lên chưa được hỗ trợ (chỉ nhận PDF hoặc DOCX).",
    );
  }

  /**
   * Xử lý file từ Google Drive
   * @private
   */
  static processDriveCv_(cvUrlOrName) {
    let fileId = CvReaderUtil.extractDriveId(cvUrlOrName);
    if (!fileId) {
      fileId = this.findDriveFileIdByName_(cvUrlOrName);
    }

    if (!fileId) {
      throw new Error(
        `Không tìm thấy file CV từ link hoặc tên "${cvUrlOrName}".`,
      );
    }

    // TH1: Thử mở bằng Google Docs
    try {
      const doc = DocumentApp.openById(fileId);
      const docText = doc.getBody().getText().trim();
      if (docText) {
        return { kind: "text", text: docText };
      }
    } catch (e) {
      // Không phải Google Doc, tiếp tục đọc qua DriveApp
    }

    // TH2: Mở qua DriveApp
    const file = DriveApp.getFileById(fileId);
    const mimeType = file.getMimeType();
    const fileName = file.getName();

    if (mimeType === MimeType.GOOGLE_DOCS) {
      const docText = DocumentApp.openById(fileId).getBody().getText().trim();
      return { kind: "text", text: docText };
    }

    if (mimeType === MimeType.PDF || /\.pdf$/i.test(fileName)) {
      return {
        kind: "pdf_inline",
        pdfBase64: Utilities.base64Encode(file.getBlob().getBytes()),
        fileName: fileName,
      };
    }

    if (mimeType === MimeType.MICROSOFT_WORD || /\.docx$/i.test(fileName)) {
      return {
        kind: "text",
        text: CvReaderUtil.extractTextFromDocxBlob(file.getBlob()),
      };
    }

    if (mimeType === MimeType.PLAIN_TEXT || /\.txt$/i.test(fileName)) {
      return {
        kind: "text",
        text: file.getBlob().getDataAsString("UTF-8").trim(),
      };
    }

    throw new Error(
      `Định dạng tệp "${fileName}" (${mimeType}) không được hỗ trợ để đọc.`,
    );
  }

  /**
   * Tìm file trong Drive theo tên (khi cột CV chỉ ghi tên file)
   * @private
   */
  static findDriveFileIdByName_(name) {
    if (!name) return null;
    const escaped = String(name).replace(/'/g, "\\'");
    const it = DriveApp.searchFiles(
      `title contains '${escaped}' and trashed = false`,
    );
    if (it.hasNext()) {
      return it.next().getId();
    }
    return null;
  }
}
