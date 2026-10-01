/** ==========================================
 * RECRUITMENT/OUTLINE-API.JS - OUTLINE WIKI CLIENT
 * ==========================================
 * Mọi lời gọi tới Outline API của module AI Recruitment:
 *  - Tạo draft document (documents.create)
 * (Ảnh ứng viên được chèn trực tiếp trên Outline sau khi draft được tạo.)
 * Phụ thuộc: core/config.js
 */

/**
 * Lấy API token từ Script Property "OUTLINE_API_TOKEN"
 * (Apps Script → Project Settings → Script Properties).
 * Không hardcode token trong code để tránh leak qua git.
 */
function getOutlineApiToken_() {
  const token =
    PropertiesService.getScriptProperties().getProperty("OUTLINE_API_TOKEN");
  if (!token) {
    throw new Error(
      'Thiếu Script Property "OUTLINE_API_TOKEN". Hãy vào Apps Script → Project Settings → Script Properties và thêm token Outline (dạng ol_api_...).',
    );
  }
  return token;
}

/**
 * Xây markdown của post "Welcome Onboard" theo mẫu bài đăng internal.
 * @param {Object} candidate
 * @param {string} introduction - Nội dung do người dùng soạn trong sidebar
 * @returns {{ title: string, text: string }}
 */
function buildWelcomePostMarkdown(candidate, introduction) {
  const name = candidate.fullName || "New Member";
  const jobTitle = candidate.title || "N/A";
  const firstDay = candidate.dateOfOnboard || "N/A";
  const manager = candidate.lineManager || "N/A";
  const squad = candidate.squad ? `${candidate.squad} — ` : "";

  const title = `Welcome Onboard: ${name}`;

  const text = [
    `**First working day:** ${firstDay}`,
    `**Job Title:** ${jobTitle}`,
    `**Line Manager:** ${manager}`,
    `**Introduction:** ${introduction.trim()}`,
    "",
    `_Squad/Unit: ${squad || "N/A"} | Employment Type: ${candidate.employmentType || "N/A"} | Level: ${candidate.level || "N/A"}_`,
  ].join("\n");

  return { title, text };
}

/**
 * Gọi Outline API documents.create để tạo draft.
 * publish=false + không truyền collectionId -> nằm ở Drafts cá nhân của tài khoản token
 * (giống hệt khi bấm "New draft" ở trang /drafts).
 * @param {string} title
 * @param {string} text - Markdown content
 * @returns {Object} data từ Outline (chứa document.id, document.url...)
 */
function callOutlineCreateDocument_(title, text) {
  const payload = {
    title: title,
    text: text,
    publish: CONFIG.OUTLINE.PUBLISH === true,
  };
  if (payload.publish && CONFIG.OUTLINE.COLLECTION_ID) {
    payload.collectionId = CONFIG.OUTLINE.COLLECTION_ID;
  }

  const response = UrlFetchApp.fetch(
    `${CONFIG.OUTLINE.BASE_URL}/api/documents.create`,
    {
      method: "post",
      contentType: "application/json",
      headers: { Authorization: `Bearer ${getOutlineApiToken_()}` },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true,
    },
  );

  const statusCode = response.getResponseCode();
  const body = JSON.parse(response.getContentText() || "{}");

  if (statusCode !== 200 || body.ok !== true) {
    throw new Error(
      `Outline API lỗi (HTTP ${statusCode}): ${body.error || response.getContentText()}`,
    );
  }
  return body.data;
}
