/**
 * CORE/ERRORS.JS - Định nghĩa các loại lỗi dùng chung hệ thống
 */

/**
 * Lỗi nghiệp vụ có chủ đích từ tầng Service
 * Dùng để phân biệt với lỗi runtime hệ thống (TypeError, Network...)
 */
class WorkflowError extends Error {
  /**
   * @param {string} code Mã lỗi định danh (vd: MISSING_TA_EMAIL, ALREADY_LOCKED)
   * @param {string} userMessage Thông điệp thân thiện hiển thị cho người dùng
   * @param {Object} [details={}] Dữ liệu ngữ cảnh để ghi log debug
   */
  constructor(code, userMessage, details = {}) {
    super(userMessage);
    this.name = "WorkflowError";
    this.code = code;
    this.userMessage = userMessage;
    this.details = details;

    Logger.log(`⚠️ [WorkflowError - ${code}]: ${userMessage}`);
    if (details.originalError) {
      Logger.log(`📌 Chi tiết lỗi gốc: ${details.originalError}`);
    }
  }
}
