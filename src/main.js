/** ==========================================
 * MAIN.JS - ĐIỀU PHỐI VÀ XỬ LÝ CHÍNH (CONTROLLER)
 * ========================================== */

/**
 * Trigger tự động của Google Sheets khi người dùng chỉnh sửa ô
 * @param {Object} e - Event Object
 */
function onEdit(e) {
  try {
    // 1. Kiểm tra sự kiện chỉnh sửa thuộc luồng nào (OFFER_ACCEPTED hay WELCOME_EMAIL)
    const triggerType = getTriggerType(e);
    if (!triggerType) return; // Nếu không thuộc 2 luồng này thì dừng ngay

    // 2. Lấy toàn bộ dữ liệu ứng viên đã được chuẩn hóa
    const data = getNormalizedInput(triggerType);

    // 3. Phân nhánh xử lý nghiệp vụ
    if (triggerType === "OFFER_ACCEPTED") handleOfferAcceptedWorkflow(data);
    if (triggerType === "WELCOME_EMAIL") handleWelcomeEmailWorkflow(data);
  } catch (error) {
    Logger.log("Lỗi trong quá trình xử lý onEdit: " + error.toString());
  }
}
