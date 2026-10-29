/** ==========================================
 * MAIN.JS - CỔNG VÀO HỆ THỐNG & ĐĂNG KÝ MENU
 * ==========================================
 */

function onOpen() {
  const reg = OnboardingController.REGISTRY;
  const ui = SpreadsheetApp.getUi();

  // Menu Onboarding
  ui.createMenu("🚀 Hera Onboarding Tools")
    .addItem(`1. ${reg.WELCOME_EMAIL.label}`, "menuSendWelcomeEmail")
    .addItem(`2. ${reg.OFFER_ACCEPTED.label}`, "menuSendDevOpsEmail")
    .addItem(`3. ${reg.TA_NOTIFICATION.label}`, "menuSendTaNotification")
    .addItem(
      `4. ${reg.AVATAR_UPDATE.label}`,
      "menuSendAvatarUpdateNotification",
    )
    .addSeparator()
    .addItem("🔓 Unlock Selected Row", "dev_unlockCurrentRow")
    .addToUi();

  // Menu AI Recruitment (Controller khác quản lý)
  ui.createMenu("🚀 AI Recruitment")
    .addItem("1. Mở AI Introduction Generator", "showSidebar")
    .addSeparator()
    .addItem("2. Cài đặt Outline API Token cá nhân", "promptSetupOutlineToken")
    .addToUi();
}

/* --- ONBOARDING MENU HOOKS --- */
function menuSendWelcomeEmail() {
  OnboardingController.execute("WELCOME_EMAIL");
}

function menuSendDevOpsEmail() {
  OnboardingController.execute("OFFER_ACCEPTED");
}

function menuSendTaNotification() {
  OnboardingController.execute("TA_NOTIFICATION");
}

function menuSendAvatarUpdateNotification() {
  OnboardingController.execute("AVATAR_UPDATE");
}
