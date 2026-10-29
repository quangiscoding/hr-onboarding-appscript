/**
 * CORE/UI-FEEDBACK.JS - Lớp hiển thị UI tập trung
 */

/** Utility hiển thị giao diện tập trung */
class UIFeedback {
  /** Alert thành công */
  static notifySuccess(title, message) {
    SpreadsheetApp.getUi().alert(
      title || "Thành công 🎉",
      message,
      SpreadsheetApp.getUi().ButtonSet.OK,
    );
  }

  /** Alert cảnh báo */
  static notifyWarning(title, message) {
    SpreadsheetApp.getUi().alert(
      title || "⚠️ Lưu ý",
      message,
      SpreadsheetApp.getUi().ButtonSet.OK,
    );
  }

  /** Alert báo lỗi */
  static notifyError(title, message) {
    SpreadsheetApp.getUi().alert(
      title || "Lỗi ❌",
      message,
      SpreadsheetApp.getUi().ButtonSet.OK,
    );
  }

  /** Confirm Yes/No: trả về true nếu chọn YES */
  static confirmAction(title, message) {
    const ui = SpreadsheetApp.getUi();
    return ui.alert(title, message, ui.ButtonSet.YES_NO) === ui.Button.YES;
  }

  /** Mở Modal Dialog dùng chung từ file HTML */
  static showModal(
    templatePath,
    data = {},
    title = "Thông báo",
    width = 740,
    height = 480,
  ) {
    try {
      const tpl = HtmlService.createTemplateFromFile(templatePath);
      Object.assign(tpl, data);
      tpl.it = data;

      const html = tpl.evaluate().setWidth(width).setHeight(height);
      SpreadsheetApp.getUi().showModalDialog(html, title);
    } catch (err) {
      Logger.log(`❌ Lỗi mở modal [${templatePath}]: ${err.message}`);
      UIFeedback.notifyError("Lỗi hiển thị", err.message);
    }
  }
}

/* Aliases giữ tương thích ngược cho code cũ chưa refactor */
const notifySuccess = UIFeedback.notifySuccess;
const notifyWarning = UIFeedback.notifyWarning;
const notifyError = UIFeedback.notifyError;
const confirmAction = UIFeedback.confirmAction;
const showCustomModalDialog = UIFeedback.showModal;
