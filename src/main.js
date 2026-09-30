/** ==========================================
 * MAIN.JS - ĐIỀU PHỐI VÀ XỬ LÝ CHÍNH (CONTROLLER)
 * ========================================== */

/**
 * Tự động tạo Custom Menu trên Google Sheets khi mở file
 */
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu("🚀 Hera Onboarding Tools")
    .addItem(
      "1. Tạo Draft Welcome Email (Dòng đang chọn)",
      "menuSendWelcomeEmail",
    )
    .addItem(
      "2. Tạo Draft Offer Accepted (DevOps / HR / Line Manager)",
      "menuSendDevOpsEmail",
    )
    .addSeparator()
    .addItem(
      "3. Gửi Notification cho TA (Dòng đang chọn)",
      "menuSendTaNotification",
    )
    .addToUi();
}

/**
 * 1. Xử lý menu Gửi Welcome Email
 */
function menuSendWelcomeEmail() {
  executeWorkflowRunner("WELCOME_EMAIL");
}

/**
 * 2. Xử lý menu Gửi TA Notification
 */
function menuSendTaNotification() {
  executeWorkflowRunner("TA_NOTIFICATION");
}

/**
 * 3. Xử lý menu Gửi Yêu cầu cho DevOps
 */
function menuSendDevOpsEmail() {
  executeWorkflowRunner("OFFER_ACCEPTED");
}

/**
 * Bộ điều phối chung (Controller Runner) cho các Action từ Menu
 *
 * @param {string} triggerType - "WELCOME_EMAIL" | "TA_NOTIFICATION" | "OFFER_ACCEPTED"
 */
function executeWorkflowRunner(triggerType) {
  const ui = SpreadsheetApp.getUi();
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    const activeRange = sheet.getActiveRange();

    if (!activeRange) {
      ui.alert("⚠️ Vui lòng chọn một dòng chứa dữ liệu nhân sự trên Sheet!");
      return;
    }

    const rowIndex = activeRange.getRow();
    if (rowIndex < 2) {
      ui.alert(
        "⚠️ Vui lòng chọn dòng dữ liệu nhân sự (không chọn dòng tiêu đề)!",
      );
      return;
    }

    // 1. Đọc và chuẩn hóa dữ liệu của dòng đang được chọn (truyền rõ rowIndex)
    const data = getNormalizedInput(triggerType, rowIndex);

    // 2. Validation dữ liệu trước khi thực thi
    if (triggerType === "WELCOME_EMAIL" && !data.allocCode) {
      ui.alert(
        "⚠️ Thiếu Alloc Code!",
        "Vui lòng nhập Alloc Code cho ứng viên trước khi thực hiện gửi Welcome Email.",
        ui.ButtonSet.OK,
      );
      return;
    }

    if (triggerType === "TA_NOTIFICATION" && !data.taEmail) {
      ui.alert(
        "⚠️ Thiếu TA In Charge!",
        "Vui lòng nhập/chọn TA In Charge cho ứng viên trước khi thực hiện gửi Notification.",
        ui.ButtonSet.OK,
      );
      return;
    }

    // 3. Hỏi xác nhận người dùng
    const confirm = ui.alert(
      "Xác nhận thực hiện",
      `Bạn có chắc chắn muốn thực thi luồng [${triggerType}] cho nhân sự: ${data.fullName} (Dòng ${data.rowNumber})?\n\nThao tác này sẽ gửi mail/tạo draft dưới danh nghĩa Gmail: ${Session.getActiveUser().getEmail()}`,
      ui.ButtonSet.YES_NO,
    );

    if (confirm !== ui.Button.YES) return;

    // 4. Phân nhánh gọi hàm xử lý nghiệp vụ tương ứng
    if (triggerType === "OFFER_ACCEPTED") handleOfferAcceptedWorkflow(data);
    if (triggerType === "WELCOME_EMAIL") handleWelcomeEmailWorkflow(data);
    if (triggerType === "TA_NOTIFICATION") handleTaNotificationWorkflow(data);
  } catch (error) {
    Logger.log(
      `Lỗi trong quá trình xử lý Workflow Runner [${triggerType}]: ` +
        error.toString(),
    );
    ui.alert("❌ Đã xảy ra lỗi!", error.toString(), ui.ButtonSet.OK);
  }
}
