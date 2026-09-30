/** ==========================================
 * RECRUITMENT/SIDEBAR.JS - MODULE AI RECRUITMENT (GIỮ CHỖ)
 * ==========================================
 * Module AI Recruitment sẽ được xây dựng sau (xem docs/refactor-plan.md, Phase 5).
 * Hiện tại chỉ có stub để menu "🚀 AI Recruitment" không báo lỗi khi click.
 */

/**
 * Entry point của menu "Mở AI Introduction Generator".
 * TODO (Phase 5): thay alert bằng HtmlService.createHtmlOutputFromFile('recruitment/sidebar').
 */
function showSidebar() {
  const ui = SpreadsheetApp.getUi();
  ui.alert(
    "🚧 Đang phát triển",
    "Tính năng AI Recruitment (AI Introduction Generator) đang được xây dựng và sẽ ra mắt sớm.",
    ui.ButtonSet.OK,
  );
}
