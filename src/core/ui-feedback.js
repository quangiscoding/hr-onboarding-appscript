/** ==========================================
 * CORE/UI-FEEDBACK.JS - LỚP HIỂN THỊ THÔNG BẢO DUY NHẤT
 * ==========================================
 * Quy tắc kiến trúc (docs/refactor-plan.md, Phase 1):
 * - Đây là nơi DUY NHẤT (cùng với main.js) được gọi SpreadsheetApp.getUi().
 * - Business logic (workflows.js) chỉ return kết quả / throw WorkflowError;
 *   tầng điều phối (main.js) gọi các hàm ở đây để hiển thị.
 * - Lợi ích: workflow tái sử dụng được từ Sidebar/Web App (nơi KHÔNG có getUi),
 *   và đổi hình thức thông báo (alert -> toast) chỉ cần sửa 1 file.
 */

/**
 * Lỗi nghiệp vụ có chủ đích từ workflow: màn hình hiển thị `userMessage`,
 * log kỹ thuật dùng `logDetail`.
 */
class WorkflowError extends Error {
  /**
   * @param {string} code - Mã lỗi ổn định (vd: MISSING_TA_EMAIL, SEND_FAILED)
   * @param {string} userMessage - Thông điệp an toàn để hiển thị cho người dùng
   * @param {Object} [details] - Dữ liệu thêm cho log (vd: lỗi gốc từ GmailApp)
   */
  constructor(code, userMessage, details = {}) {
    super(userMessage);
    this.name = "WorkflowError";
    this.code = code;
    this.userMessage = userMessage;
    this.details = details;
  }
}

/** Alert thông báo thành công (màn hình có UI) */
function notifySuccess(title, message) {
  SpreadsheetApp.getUi().alert(title || "Thành công 🎉", message, SpreadsheetApp.getUi().ButtonSet.OK);
}

/** Alert thông báo cảnh báo / dừng nhẹ (thiếu dữ liệu...) */
function notifyWarning(title, message) {
  SpreadsheetApp.getUi().alert(title || "⚠️ Lưu ý", message, SpreadsheetApp.getUi().ButtonSet.OK);
}

/** Alert thông báo lỗi */
function notifyError(title, message) {
  SpreadsheetApp.getUi().alert(title || "Lỗi ❌", message, SpreadsheetApp.getUi().ButtonSet.OK);
}

/**
 * Hỏi xác nhận Yes/No trước khi thực hiện thao tác.
 * @returns {boolean} true nếu người dùng chọn YES
 */
function confirmAction(title, message) {
  const ui = SpreadsheetApp.getUi();
  return ui.alert(title, message, ui.ButtonSet.YES_NO) === ui.Button.YES;
}
