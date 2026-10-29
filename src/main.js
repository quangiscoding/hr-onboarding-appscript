/** ==========================================
 * MAIN.JS - CỔNG VÀO HỆ THỐNG & ĐĂNG KÝ MENU
 * ==========================================
 */

const WORKFLOW_REGISTRY = {
  WELCOME_EMAIL: {
    label: "Tạo Draft Welcome Email",
    validate: (d) => validateRequiredField(d.allocCode, "Alloc Code"),
    run: (d) => OnboardingService.handleWelcomeEmail(d),
  },
  OFFER_ACCEPTED: {
    label: "Gửi Email Offer Accepted",
    run: (d) => OnboardingService.handleOfferAccepted(d),
  },
  TA_NOTIFICATION: {
    label: "Gửi Notification cho TA",
    validate: (d) => validateRequiredField(d.taEmail, "TA In Charge"),
    run: (d) => OnboardingService.handleTaNotification(d),
  },
  AVATAR_UPDATE: {
    label: "Gửi mail nhắc DevOps update avatar",
    isBatch: true,
    run: () => OnboardingService.handleAvatarUpdate(),
  },
};

function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu("🚀 Hera Onboarding Tools")
    .addItem(
      `1. ${WORKFLOW_REGISTRY.WELCOME_EMAIL.label}`,
      "menuSendWelcomeEmail",
    )
    .addItem(
      `2. ${WORKFLOW_REGISTRY.OFFER_ACCEPTED.label}`,
      "menuSendDevOpsEmail",
    )
    .addItem(
      `3. ${WORKFLOW_REGISTRY.TA_NOTIFICATION.label}`,
      "menuSendTaNotification",
    )
    .addItem(
      `4. ${WORKFLOW_REGISTRY.AVATAR_UPDATE.label}`,
      "menuSendAvatarUpdateNotification",
    )
    .addSeparator()
    .addItem("🔓 Unlock Selected Row", "dev_unlockCurrentRow")
    .addToUi();

  ui.createMenu("🚀 AI Recruitment")
    .addItem("1. Mở AI Introduction Generator", "showSidebar")
    .addSeparator()
    .addItem("2. Cài đặt Outline API Token cá nhân", "promptSetupOutlineToken")
    .addToUi();
}

function menuSendWelcomeEmail() {
  executeWorkflowRunner("WELCOME_EMAIL");
}
function menuSendDevOpsEmail() {
  executeWorkflowRunner("OFFER_ACCEPTED");
}
function menuSendTaNotification() {
  executeWorkflowRunner("TA_NOTIFICATION");
}
function menuSendAvatarUpdateNotification() {
  executeWorkflowRunner("AVATAR_UPDATE");
}

function executeWorkflowRunner(triggerType) {
  const workflow = WORKFLOW_REGISTRY[triggerType];
  if (!workflow)
    return UIFeedback.alert("Lỗi", `Không tìm thấy workflow: ${triggerType}`);

  try {
    const result = workflow.isBatch
      ? runBatchWorkflow_(workflow)
      : runSingleRowWorkflow_(triggerType, workflow);

    if (!result) return;

    if (result.hasModal && result.modalConfig) {
      const { templatePath, data, title, width, height } = result.modalConfig;
      UIFeedback.showModal(templatePath, data, title, width, height);
    } else if (!result.suppressPopup && result.message) {
      UIFeedback.notifySuccess("Thành công 🎉", result.message);
    }
  } catch (error) {
    if (error instanceof WorkflowError) {
      UIFeedback.notifyError("Lỗi ❌", error.userMessage);
    } else {
      Logger.log(`❌ Lỗi hệ thống [${triggerType}]: ${error.toString()}`);
      UIFeedback.notifyError("❌ Lỗi hệ thống", error.message);
    }
  }
}

function runBatchWorkflow_(workflow) {
  const currentUser = Session.getActiveUser().getEmail();
  const ok = UIFeedback.confirm(
    "Xác nhận thực hiện",
    `Quét và thực thi luồng [${workflow.label}] dưới danh nghĩa Gmail: ${currentUser}?`,
  );
  return ok ? workflow.run() : null;
}

function runSingleRowWorkflow_(triggerType, workflow) {
  const data = OnboardingUtil.getNormalizedInput(triggerType);
  const targetEmail = data.personalEmail || data.workingEmail;

  if (isRowLockedForWorkflow(data.rowNumber, triggerType, targetEmail)) {
    UIFeedback.notifyWarning(
      "🔒 Đã khóa",
      `Nhân sự "${data.fullName}" (${targetEmail || "N/A"}) đã chạy luồng này trước đó rồi.`,
    );
    return null;
  }

  const errorMsg = workflow.validate ? workflow.validate(data) : null;
  if (errorMsg) {
    UIFeedback.notifyWarning("⚠️ Thiếu thông tin", errorMsg);
    return null;
  }

  const currentUser = Session.getActiveUser().getEmail();
  const ok = UIFeedback.confirm(
    "Xác nhận",
    `Chạy luồng [${workflow.label}] cho nhân sự: ${data.fullName} (Dòng ${data.rowNumber})?\nGmail gửi: ${currentUser}`,
  );
  if (!ok) return null;

  const result = workflow.run(data);
  lockRowForWorkflow(data.rowNumber, triggerType, targetEmail);
  return result;
}

function validateRequiredField(value, label) {
  return value ? null : `Vui lòng nhập/chọn ${label} trước khi thực hiện.`;
}
