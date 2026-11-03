/** ==========================================
 * MAIN.JS - CỔNG VÀO HỆ THỐNG & ĐĂNG KÝ MENU
 * ==========================================
 */

function onOpen() {
  const reg = OnboardingController.REGISTRY;
  const ui = SpreadsheetApp.getUi();

  // Menu Onboarding
  ui.createMenu("🚀 Hera Onboarding Tools").addItem(`1. ${reg.WELCOME_EMAIL.label}`, "menuSendWelcomeEmail").addItem(`2. ${reg.OFFER_ACCEPTED.label}`, "menuSendDevOpsEmail").addItem(`3. ${reg.TA_NOTIFICATION.label}`, "menuSendTaNotification").addItem(`4. ${reg.AVATAR_UPDATE.label}`, "menuSendAvatarUpdateNotification").addSeparator().addItem("🔓 Unlock Selected Row", "dev_unlockCurrentRow").addToUi();

  // Menu AI Recruitment (Controller khác quản lý)
  ui.createMenu("🚀 AI Recruitment").addItem("1. Tạo Welcome Onboard", "showSidebar").addSeparator().addItem("2. Cài đặt Outline API Token cá nhân", "promptSetupOutlineToken").addToUi();
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

function inspectIdentityToken() {
  const idToken = ScriptApp.getIdentityToken();
  Logger.log("=== ID TOKEN RAW ===");
  Logger.log(idToken);

  if (!idToken) {
    Logger.log("=> Token bị null! (Do thiếu scope 'openid' hoặc đang dùng Default GCP Project)");
    return;
  }

  // ID Token bản chất là một chuỗi JWT gồm 3 phần: Header.Payload.Signature
  // Ta decode phần Payload (phần thứ 2) để xem thông tin user
  try {
    const payloadBase64 = idToken.split(".")[1];
    const decodedJson = Utilities.newBlob(Utilities.base64Decode(payloadBase64)).getDataAsString();
    const payload = JSON.parse(decodedJson);

    Logger.log("=== THÔNG TIN BÊN TRONG ID TOKEN (JWT PAYLOAD) ===");
    Logger.log(JSON.stringify(payload, null, 2));
    Logger.log("Email người dùng: " + payload.email);
    Logger.log("Audience (Client ID): " + payload.aud);
  } catch (e) {
    Logger.log("Lỗi giải mã: " + e.message);
  }
}

function setupGatewayProperties() {
  const scriptProperties = PropertiesService.getScriptProperties();
  scriptProperties.setProperties({
    GATEWAY_WEB_APP_URL: "https://script.google.com/a/macros/kyanon.digital/s/AKfycbwqPVlgbzfCnb4ITwu5JWZknHmf5FKcdkTc2JHtJy8cvPnMLl0F5UoGUnl2qcaRZFfI/exec",
    GATEWAY_N8N_WEBHOOK_URL: "https://n8n.poc.kyanon.dev/webhook-test/summarize-cv",
    GATEWAY_SECRET: "hera_gateway_secret_2026_xyz",
  });
  Logger.log("✅ Đã lưu cấu hình Gateway vào Script Properties thành công!");
}
