/** ==========================================
 * ONBOARDING/CONTROLLERS/ONBOARDING.CONTROLLER.JS
 * ==========================================
 */
class OnboardingController {
  static get REGISTRY() {
    return {
      WELCOME_EMAIL: {
        label: "Tạo Draft Welcome Email",
        lockMode: "HARD", // Khóa cứng tuyệt đối sau 1 lần chạy
        validate: (d) => OnboardingController.validateRequired_(d.allocCode, "Alloc Code"),
        run: (d) => OnboardingService.handleWelcomeEmail(d),
      },
      OFFER_ACCEPTED: {
        label: "Gửi Email Offer Accepted",
        lockMode: "HARD", // Khóa cứng tuyệt đối sau 1 lần chạy
        run: (d) => OnboardingService.handleOfferAccepted(d),
      },
      TA_NOTIFICATION: {
        label: "Gửi Notification cho TA",
        lockMode: "WARN", // Không chặn cứng: cho phép gửi lại sau khi xác nhận
        validate: (d) => OnboardingController.validateRequired_(d.taEmail, "TA In Charge"),
        run: (d) => OnboardingService.handleTaNotification(d),
      },
      AVATAR_UPDATE: {
        label: "Gửi mail nhắc DevOps update avatar",
        isBatch: true,
        run: () => OnboardingService.handleAvatarUpdate(),
      },
    };
  }

  /** Điểm tiếp nhận thực thi workflow */
  static execute(triggerType) {
    const workflow = this.REGISTRY[triggerType];
    if (!workflow) return UIFeedback.alert("Lỗi", `Không tìm thấy workflow: ${triggerType}`);

    try {
      const result = workflow.isBatch ? this.runBatch_(workflow) : this.runSingleRow_(triggerType, workflow);

      if (!result) return;

      if (result.hasModal && result.modalConfig) {
        const { templatePath, data, title, width, height } = result.modalConfig;
        UIFeedback.showModal(templatePath, data, title, width, height);
      } else if (!result.suppressPopup && result.message) {
        UIFeedback.notifySuccess("Thành công 🎉", result.message);
      }
    } catch (error) {
      const stackTrace = error.stack || (error.details && error.details.stack) || "Không thể lấy Stack Trace";
      const fullErrorMsg = error.userMessage || error.message || String(error);

      Logger.log(`❌ Lỗi hệ thống [${triggerType}]: ${fullErrorMsg}`);
      Logger.log(`📍 Call Stack:\n${stackTrace}`);
      console.error(`[${triggerType}] Exception Details:`, error);

      SpreadsheetApp.getUi().alert(`❌ Lỗi hệ thống [${triggerType}]`, `Chi tiết lỗi: ${fullErrorMsg}\n\n📍 Vị trí phát sinh lỗi (Stack Trace):\n${stackTrace}`, SpreadsheetApp.getUi().ButtonSet.OK);
    }
  }

  static runBatch_(workflow) {
    const currentUser = Session.getActiveUser().getEmail();
    const ok = UIFeedback.confirm("Xác nhận thực hiện", `Quét và thực thi luồng [${workflow.label}] dưới danh nghĩa Gmail: ${currentUser}?`);
    return ok ? workflow.run() : null;
  }

  static runSingleRow_(triggerType, workflow) {
    const data = OnboardingUtil.getNormalizedInput(triggerType);
    const targetEmail = data.personalEmail || data.workingEmail;
    const lockMode = workflow.lockMode || "HARD";
    const isLocked = isRowLockedForWorkflow(data.rowNumber, triggerType, targetEmail);

    // 1. Xử lý kiểm tra khóa theo lockMode
    if (isLocked) {
      if (lockMode === "HARD") {
        UIFeedback.notifyWarning("🔒 Đã khóa", `Nhân sự "${data.fullName}" (${targetEmail || "N/A"}) đã chạy luồng này trước đó rồi.`);
        return null;
      }

      if (lockMode === "WARN") {
        const reRunConfirm = UIFeedback.confirm(
          "⚠️ Đã từng gửi thông báo",
          `Nhân sự "${data.fullName}" đã từng được gửi thông báo TA trước đó rồi.\n\nBạn có muốn gửi tiếp email cập nhật tiến độ mới cho TA không?`,
        );
        if (!reRunConfirm) return null;
      }
    }

    // 2. Validate dữ liệu đầu vào
    const errorMsg = workflow.validate ? workflow.validate(data) : null;
    if (errorMsg) {
      UIFeedback.notifyWarning("⚠️ Thiếu thông tin", errorMsg);
      return null;
    }

    // 3. Confirm thực thi (nếu chưa qua bước xác nhận gửi lại ở trên)
    if (!isLocked || lockMode !== "WARN") {
      const currentUser = Session.getActiveUser().getEmail();
      const ok = UIFeedback.confirm("Xác nhận", `Chạy luồng [${workflow.label}] cho nhân sự: ${data.fullName} (Dòng ${data.rowNumber})?\nGmail gửi: ${currentUser}`);
      if (!ok) return null;
    }

    // 4. Chạy nghiệp vụ
    const result = workflow.run(data);

    // 5. Ghi vết khóa nếu mode không phải NONE
    if (lockMode !== "NONE") {
      lockRowForWorkflow(data.rowNumber, triggerType, targetEmail);
    }

    return result;
  }

  static validateRequired_(value, label) {
    return value ? null : `Vui lòng nhập/chọn ${label} trước khi thực hiện.`;
  }
}
