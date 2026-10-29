/** ==========================================
 * ONBOARDING/CONTROLLERS/ONBOARDING.CONTROLLER.JS
 * ==========================================
 * Điều phối luồng Onboarding: Nhận input -> Validate -> Confirm -> Gọi Service -> Phản hồi UI
 */
class OnboardingController {
  static get REGISTRY() {
    return {
      WELCOME_EMAIL: {
        label: "Tạo Draft Welcome Email",
        validate: (d) =>
          OnboardingController.validateRequired_(d.allocCode, "Alloc Code"),
        run: (d) => OnboardingService.handleWelcomeEmail(d),
      },
      OFFER_ACCEPTED: {
        label: "Gửi Email Offer Accepted",
        run: (d) => OnboardingService.handleOfferAccepted(d),
      },
      TA_NOTIFICATION: {
        label: "Gửi Notification cho TA",
        validate: (d) =>
          OnboardingController.validateRequired_(d.taEmail, "TA In Charge"),
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
    if (!workflow)
      return UIFeedback.alert("Lỗi", `Không tìm thấy workflow: ${triggerType}`);

    try {
      const result = workflow.isBatch
        ? this.runBatch_(workflow)
        : this.runSingleRow_(triggerType, workflow);
      if (!result) return;

      if (result.hasModal && result.modalConfig) {
        const { templatePath, data, title, width, height } = result.modalConfig;
        UIFeedback.showModal(templatePath, data, title, width, height);
      } else if (!result.suppressPopup && result.message) {
        UIFeedback.notifySuccess("Thành công 🎉", result.message);
      }
    } catch (error) {
      // 1. LẤY TOÀN BỘ STACK TRACE TỪ ERROR HOẶC LỖI GỐC (DETAILS)
      const stackTrace =
        error.stack ||
        (error.details && error.details.stack) ||
        "Không thể lấy Stack Trace";
      const fullErrorMsg = error.userMessage || error.message || String(error);

      // 2. GHI RA EXECUTION LOG (ĐẦY ĐỦ CẢ DÒNG VÀ FILE)
      Logger.log(`❌ Lỗi hệ thống [${triggerType}]: ${fullErrorMsg}`);
      Logger.log(`📍 Call Stack:\n${stackTrace}`);
      console.error(`[${triggerType}] Exception Details:`, error);

      // 3. HIỂN THỊ ALERT TRỰC TIẾP TRÊN SHEET KÈM VỊ TRÍ GÂY LỖI
      SpreadsheetApp.getUi().alert(
        `❌ Lỗi hệ thống [${triggerType}]`,
        `Chi tiết lỗi: ${fullErrorMsg}\n\n📍 Vị trí phát sinh lỗi (Stack Trace):\n${stackTrace}`,
        SpreadsheetApp.getUi().ButtonSet.OK,
      );
    }
  }

  static runBatch_(workflow) {
    const currentUser = Session.getActiveUser().getEmail();
    const ok = UIFeedback.confirm(
      "Xác nhận thực hiện",
      `Quét và thực thi luồng [${workflow.label}] dưới danh nghĩa Gmail: ${currentUser}?`,
    );
    return ok ? workflow.run() : null;
  }

  static runSingleRow_(triggerType, workflow) {
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

  static validateRequired_(value, label) {
    return value ? null : `Vui lòng nhập/chọn ${label} trước khi thực hiện.`;
  }
}
