/**
 * src/onboarding/services/avatar-update.service.js
 * Service chuyên biệt xử lý Luồng 4: Cập nhật Avatar Onboard (All-or-Nothing Gatekeeper)
 */
class AvatarUpdateService {
  /**
   * Điểm thực thi chính của luồng Avatar Update
   */
  static execute() {
    const TRIGGER = ONBOARDING_CONFIG.TRIGGERS.AVATAR_UPDATE;
    const currentUser = Session.getActiveUser().getEmail().toLowerCase().trim();
    const currentAllocCode = currentUser.split("@")[0].trim();

    // 1. Quét đối soát dữ liệu trên RAM qua AvatarUpdateUtil
    const avatarMap = AvatarUpdateUtil.loadMapAndSync(ONBOARDING_CONFIG.SPREADSHEET_UC06_ID);
    const { candidates, sheetUrl, todayDisplay } = AvatarUpdateUtil.getTodayOnboardCandidates(currentAllocCode, TRIGGER);

    if (!candidates || !candidates.length) {
      throw new WorkflowError("NO_CANDIDATES_FOUND", `Không tìm thấy nhân sự onboard hôm nay (${todayDisplay}) thuộc quản lý của bạn (${currentAllocCode}).\nHãy kiểm tra lại cột Offer Status và Date of Onboard.`);
    }

    const alreadyProcessed = candidates.filter((c) => c.isLocked);
    const pendingCandidates = candidates.filter((c) => !c.isLocked);

    // Trường hợp tất cả nhân sự hôm nay đã được xử lý và khóa từ trước
    if (pendingCandidates.length === 0 && alreadyProcessed.length > 0) {
      return this._buildResponse({
        ready: [],
        missing: [],
        alreadyProcessed,
        noticeType: "PROCESSED",
        message: `ℹ️ Toàn bộ ${alreadyProcessed.length} nhân sự hôm nay đã hoàn tất từ trước.`,
      });
    }

    // 2. Phân loại theo điều kiện ảnh 1:1
    const { ready, missing } = AvatarUpdateUtil.partitionCandidates(pendingCandidates, avatarMap);

    // 3. CỔNG CHẶN GATEKEEPER: CÒN BẠN CHƯA ĐẠT -> DỪNG GỬI, BẬT CẢNH BÁO CHO TA
    if (missing.length > 0) {
      return this._buildResponse({
        ready,
        missing,
        alreadyProcessed,
        noticeType: "MISSING",
        message: `⚠️ Chưa gửi mail cho DevOps vì còn ${missing.length} bạn chưa đủ điều kiện ảnh 1:1.`,
      });
    }

    // 4. KHI 100% ĐẠT CHUẨN: GỬI MAIL CHO DEVOPS VÀ KHÓA DÒNG
    this._sendDevOpsEmail(ready, sheetUrl, todayDisplay, currentUser);
    this._lockAndLogCandidates(ready, TRIGGER);

    return this._buildResponse({
      ready,
      missing: [],
      alreadyProcessed,
      noticeType: "SUCCESS",
      message: `✅ Đã gửi email cho DevOps và khóa toàn bộ ${ready.length} nhân sự onboard hôm nay.`,
    });
  }

  /**
   * Helper gửi email cho DevOps
   * @private
   */
  static _sendDevOpsEmail(readyList, sheetUrl, todayDisplay, currentUser) {
    const devops = getRecipientsByRole(ONBOARDING_CONFIG.RECIPIENT_ROLES.DEVOPS);
    const to = (devops?.to || []).filter(Boolean).join(",");
    const cc = [(devops?.cc || []).join(","), currentUser].filter(Boolean).join(",");

    if (!to || to.trim() === "") {
      throw new WorkflowError("MISSING_DEVOPS_RECIPIENT", "Chưa cấu hình email người nhận cho DevOps tại tab Data (Cột Send to).");
    }

    const tpl = getAvatarUpdateDigestTemplate(readyList, sheetUrl, todayDisplay);
    try {
      // Dùng hàm sendDirectEmail_ dùng chung hoặc qua OnboardingService
      if (typeof sendDirectEmail_ === "function") {
        sendDirectEmail_(to, tpl, cc);
      } else {
        OnboardingService.sendDirectEmail_(to, tpl, cc);
      }
    } catch (errMail) {
      throw new WorkflowError("DEVOPS_MAIL_FAILED", `Gửi mail cho DevOps thất bại: ${errMail.message}`, { originalError: errMail.message });
    }
  }

  /**
   * Helper khóa dòng và ghi log nội bộ
   * @private
   */
  static _lockAndLogCandidates(readyList, trigger) {
    const devops = getRecipientsByRole(ONBOARDING_CONFIG.RECIPIENT_ROLES.DEVOPS);
    const to = (devops?.to || []).filter(Boolean).join(",");

    readyList.forEach((c) => {
      const lockEmail = String(c.personalEmail || c.workingEmail || "").trim();
      if (c.rowNumber && c.rowNumber >= 2 && lockEmail) {
        lockRowForWorkflow(c.rowNumber, trigger, lockEmail);
      }
      logInternalWorkflow(c, [{ type: "DevOps Avatar Update", to }], "EMAIL_SENT", "");
    });
  }

  /**
   * Helper chuẩn bị dữ liệu và kích thước Modal trả về Controller
   * @private
   */
  static _buildResponse({ ready, missing, alreadyProcessed, noticeType, message }) {
    let displayList = [];
    if (noticeType === "MISSING") {
      // Đưa danh sách thiếu lên trên để TA ưu tiên xử lý
      displayList = [...missing.map((c) => ({ ...c, isReady: false })), ...ready.map((c) => ({ ...c, isReady: true }))];
    } else if (noticeType === "SUCCESS") {
      displayList = ready.map((c) => ({ ...c, isReady: true }));
    } else {
      displayList = alreadyProcessed.map((c) => ({ ...c, isReady: true }));
    }

    const totalCount = ready.length + missing.length + alreadyProcessed.length;
    const readyCount = ready.length;
    const missingCount = missing.length;
    const alreadyProcessedCount = alreadyProcessed.length;

    const calculatedHeight = Math.min(270 + displayList.length * 38, 560);
    const safeHeight = isNaN(calculatedHeight) || calculatedHeight <= 0 ? 500 : calculatedHeight;

    let title = `🎉 Đã gửi Avatar cho toàn bộ ${readyCount} nhân sự hôm nay`;
    if (noticeType === "MISSING") {
      title = `⚠️ Cần xử lý Avatar: ${readyCount}/${readyCount + missingCount} bạn đủ điều kiện`;
    } else if (noticeType === "PROCESSED") {
      title = `ℹ️ Đã hoàn tất xử lý Avatar (${alreadyProcessedCount} nhân sự)`;
    }

    return {
      ok: true,
      hasModal: true,
      modalConfig: {
        templatePath: ONBOARDING_CONFIG.TEMPLATES.DIALOG.TA_REMINDER,
        title,
        width: 760,
        height: safeHeight,
        data: {
          totalCount,
          readyCount,
          missingCount,
          alreadyProcessedCount,
          candidates: displayList,
          noticeType,
          uc06Url: `https://docs.google.com/spreadsheets/d/${ONBOARDING_CONFIG.SPREADSHEET_UC06_ID}/edit`,
        },
      },
      status: noticeType === "MISSING" ? "HAS_MISSING" : "SUCCESS",
      message,
    };
  }
}
