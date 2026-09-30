/** ==========================================
 * MAIN.JS - ĐIỀU PHỐI & MENU (CONTROLLER)
 * ==========================================
 * Nhiệm vụ: định nghĩa Custom Menu + chạy workflow sau khi validate.
 * KHÔNG chứa business logic — chỉ điều phối (Separation of Concerns).
 */

/** Registry trung tâm: triggerType -> { validate, run, label }.
 *  Thêm luồng mới: bổ sung 1 entry tại đây + 1 item trong onOpen(). */
const WORKFLOW_REGISTRY = {
  WELCOME_EMAIL: {
    label: "Tạo Draft Welcome Email",
    validate: (data, ui) =>
      validateRequiredField(data.allocCode, "Alloc Code", ui),
    run: (data) => handleWelcomeEmailWorkflow(data),
  },
  OFFER_ACCEPTED: {
    label: "Tạo Draft Offer Accepted",
    validate: () => true,
    run: (data) => handleOfferAcceptedWorkflow(data),
  },
  TA_NOTIFICATION: {
    label: "Gửi Notification cho TA",
    validate: (data, ui) =>
      validateRequiredField(data.taEmail, "TA In Charge", ui),
    run: (data) => handleTaNotificationWorkflow(data),
  },
};

/** Tự động tạo Custom Menu trên Google Sheets khi mở file */
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
  ui.createMenu("🚀 AI Recruitment")
    .addItem("Mở AI Introduction Generator", "showSidebar")
    .addToUi();
}

/** 1. Menu: Tạo Draft Welcome Email */
function menuSendWelcomeEmail() {
  executeWorkflowRunner("WELCOME_EMAIL");
}

/** 2. Menu: Tạo Draft Offer Accepted */
function menuSendDevOpsEmail() {
  executeWorkflowRunner("OFFER_ACCEPTED");
}

/** 3. Menu: Gửi Notification cho TA */
function menuSendTaNotification() {
  executeWorkflowRunner("TA_NOTIFICATION");
}

/**
 * Bộ điều phối chung (Controller Runner) cho các Action từ Menu:
 * chọn dòng -> normalize -> validate -> confirm -> chạy workflow.
 * @param {string} triggerType - Key trong WORKFLOW_REGISTRY
 */
function executeWorkflowRunner(triggerType) {
  const ui = SpreadsheetApp.getUi();
  const workflow = WORKFLOW_REGISTRY[triggerType];

  if (!workflow) {
    ui.alert(`❌ Không tìm thấy workflow: ${triggerType}`);
    return;
  }

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

    // 1. Đọc và chuẩn hóa dữ liệu của dòng đang chọn
    const data = getNormalizedInput(triggerType, rowIndex);

    // 2. Validate dữ liệu theo từng luồng
    if (!workflow.validate(data, ui)) return;

    // 3. Hỏi xác nhận người dùng
    const confirm = ui.alert(
      "Xác nhận thực hiện",
      `Bạn có chắc chắn muốn thực thi luồng [${workflow.label}] cho nhân sự: ${data.fullName} (Dòng ${data.rowNumber})?\n\nThao tác này sẽ gửi mail/tạo draft dưới danh nghĩa Gmail: ${Session.getActiveUser().getEmail()}`,
      ui.ButtonSet.YES_NO,
    );

    if (confirm !== ui.Button.YES) return;

    // 4. Thực thi luồng nghiệp vụ tương ứng
    workflow.run(data);
  } catch (error) {
    Logger.log(
      `Lỗi trong quá trình xử lý Workflow Runner [${triggerType}]: ` +
        error.toString(),
    );
    ui.alert("❌ Đã xảy ra lỗi!", error.toString(), ui.ButtonSet.OK);
  }
}

/**
 * Helper validate: báo alert nếu field bắt buộc còn thiếu.
 * @returns {boolean} true nếu hợp lệ
 */
function validateRequiredField(value, fieldLabel, ui) {
  if (value) return true;

  ui.alert(
    `⚠️ Thiếu ${fieldLabel}!`,
    `Vui lòng nhập/chọn ${fieldLabel} cho ứng viên trước khi thực hiện.`,
    ui.ButtonSet.OK,
  );
  return false;
}
