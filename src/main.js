/** ==========================================
 * MAIN.JS - ĐIỀU PHỐI & MENU (CONTROLLER)
 * ==========================================
 * Nhiệm vụ: định nghĩa Custom Menu + chạy workflow sau khi validate.
 * KHÔNG chứa business logic — chỉ điều phối (Separation of Concerns).
 * Toàn bộ hiển thị kết quả đi qua core/ui-feedback.js (Phase 1 của docs/refactor-plan.md).
 */

/** Registry trung tâm: triggerType -> { validate, run, label, isBatch }.
 *  Thêm luồng mới: bổ sung 1 entry tại đây + 1 item trong onOpen().
 */
const WORKFLOW_REGISTRY = {
  WELCOME_EMAIL: {
    label: "Tạo Draft Welcome Email",
    validate: (data) => validateRequiredField(data.allocCode, "Alloc Code"),
    run: (data) => handleWelcomeEmailWorkflow(data),
  },
  OFFER_ACCEPTED: {
    label: "Gửi Email Offer Accepted",
    validate: () => null,
    run: (data) => handleOfferAcceptedWorkflow(data),
  },
  TA_NOTIFICATION: {
    label: "Gửi Notification cho TA",
    validate: (data) => validateRequiredField(data.taEmail, "TA In Charge"),
    run: (data) => handleTaNotificationWorkflow(data),
  },
  AVATAR_UPDATE: {
    label: "Gửi mail nhắc IT Ops update avatar",
    isBatch: true, // Luồng đặc thù: tự quét toàn Sheet theo TA đang thao tác
    validate: () => null,
    run: () => handleAvatarUpdateWorkflow(),
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
      "2. Gửi Email Offer Accepted (DevOps / HR / IT)",
      "menuSendDevOpsEmail",
    )
    .addItem(
      "3. Gửi Notification cho TA (Dòng đang chọn)",
      "menuSendTaNotification",
    )
    .addSeparator()
    .addItem(
      "4. Gửi mail nhắc IT Ops update avatar",
      "menuSendAvatarUpdateNotification",
    )
    // .addSeparator()
    // .addItem("🔓 Unlock Selected Row", "dev_unlockCurrentRow")
    .addToUi();

  ui.createMenu("🚀 AI Recruitment")
    .addItem("1. Mở AI Introduction Generator", "showSidebar")
    .addSeparator()
    .addItem("2. Cài đặt Outline API Token cá nhân", "promptSetupOutlineToken")
    .addToUi();
}

/** 1. Menu: Tạo Draft Welcome Email */
function menuSendWelcomeEmail() {
  executeWorkflowRunner("WELCOME_EMAIL");
}

/** 2. Menu: Gửi Email Offer Accepted */
function menuSendDevOpsEmail() {
  executeWorkflowRunner("OFFER_ACCEPTED");
}

/** 3. Menu: Gửi Notification cho TA */
function menuSendTaNotification() {
  executeWorkflowRunner("TA_NOTIFICATION");
}

/** 4. Menu: Gửi mail nhắc IT Ops update avatar */
function menuSendAvatarUpdateNotification() {
  executeWorkflowRunner("AVATAR_UPDATE");
}

/**
 * Bộ điều phối chung (Controller Runner) cho TẤT CẢ Action từ Menu:
 * phân loại luồng batch / single-row -> validate -> confirm -> chạy workflow -> khóa dòng (nếu single-row) -> hiển thị kết quả.
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
    const currentUser = Session.getActiveUser().getEmail();

    // -------------------------------------------------------------
    // NHÁNH 1: LUỒNG BATCH (Tự quét toàn bộ Sheet như AVATAR_UPDATE)
    // -------------------------------------------------------------
    if (workflow.isBatch) {
      const confirmed = confirmAction(
        "Xác nhận gửi email nhắc IT Ops update avatar?",
        `Hệ thống sẽ quét các nhân sự onboard HÔM NAY có trạng thái 'On-boarded' thuộc quản lý của bạn và gửi email trực tiếp tới IT Ops.\n\nThao tác này sẽ gửi email dưới danh nghĩa Gmail: ${currentUser}`,
      );

      if (!confirmed) return;

      const result = workflow.run();
      notifySuccess("Thành công 🎉", result.message);
      return;
    }

    // -------------------------------------------------------------
    // NHÁNH 2: LUỒNG SINGLE ROW (Tác động theo 1 dòng đang chọn)
    // -------------------------------------------------------------
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    const activeRange = sheet.getActiveRange();

    if (!activeRange) {
      notifyWarning(
        "⚠️ Thiếu lựa chọn",
        "Vui lòng chọn một dòng chứa dữ liệu nhân sự trên Sheet!",
      );
      return;
    }

    const rowIndex = activeRange.getRow();
    if (rowIndex < 2) {
      notifyWarning(
        "⚠️ Sai dòng",
        "Vui lòng chọn dòng dữ liệu nhân sự (không chọn dòng tiêu đề)!",
      );
      return;
    }

    // 1. Đọc và chuẩn hóa dữ liệu của dòng đang chọn
    const data = getNormalizedInput(triggerType, rowIndex);
    const targetEmail = data.personalEmail || data.workingEmail;

    // 🔒 CHECK LOCK: Dòng VÀ Email này đã chạy Workflow NÀY chưa?
    if (isRowLockedForWorkflow(rowIndex, triggerType, targetEmail)) {
      notifyWarning(
        "🔒 Chức Năng Đã Bị Khóa!",
        `Nhân sự "${data.fullName || `Dòng \${rowIndex}`}" (${targetEmail || "N/A"}) ĐÃ CHẠY luồng [${workflow.label}] trước đó rồi.\n\n` +
          `Thao tác bị từ chối để tránh tạo lặp email/draft.\n` +
          `(Các chức năng khác của nhân sự/dòng này vẫn có thể thực hiện bình thường).`,
      );
      return;
    }

    // 2. Validate dữ liệu theo từng luồng
    const validationMessage = workflow.validate(data);
    if (validationMessage) {
      notifyWarning("⚠️ Thiếu dữ liệu", validationMessage);
      return;
    }

    // 3. Hỏi xác nhận người dùng
    const confirmed = confirmAction(
      "Xác nhận thực hiện",
      `Bạn có chắc chắn muốn thực thi luồng [${workflow.label}] cho nhân sự: ${data.fullName} (Dòng ${data.rowNumber})?\n\nThao tác này sẽ gửi mail/tạo draft dưới danh nghĩa Gmail: ${currentUser}`,
    );

    if (!confirmed) return;

    // 4. Thực thi luồng nghiệp vụ tương ứng
    const result = workflow.run(data);

    // 🔒 ĐÁNH DẤU KHÓA ĐỘC LẬP THEO DÒNG + EMAIL VỪA CHẠY XONG
    lockRowForWorkflow(rowIndex, triggerType, targetEmail);

    // 5. Hiển thị kết quả
    notifySuccess("Thành công 🎉", result.message);
  } catch (error) {
    if (error instanceof WorkflowError) {
      // Lỗi nghiệp vụ có chủ đích: hiển thị thông điệp an toàn cho người dùng
      notifyError("Lỗi ❌", error.userMessage);
    } else {
      // Lỗi hệ thống bất ngờ: log chi tiết + hiển thị thông báo chung
      Logger.log(
        `Lỗi trong quá trình xử lý Workflow Runner [${triggerType}]: ` +
          error.toString(),
      );
      notifyError("❌ Đã xảy ra lỗi!", error.toString());
    }
  }
}

/**
 * Helper validate: trả về message cảnh báo nếu field bắt buộc còn thiếu.
 * @param {*} value - Giá trị cần kiểm tra
 * @param {string} fieldLabel - Tên hiển thị của field (vd: "Alloc Code")
 * @returns {string|null} Thông điệp cảnh báo, hoặc null nếu hợp lệ
 */
function validateRequiredField(value, fieldLabel) {
  if (value) return null;
  return `Vui lòng nhập/chọn ${fieldLabel} cho ứng viên trước khi thực hiện.`;
}
