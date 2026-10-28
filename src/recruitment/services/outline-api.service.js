/**
 * services/outline-api.service.js
 * Chuyên trách giao tiếp HTTP với Outline API và quản lý Token.
 */
class OutlineApiService {
  static get TOKEN_KEY() {
    return "OUTLINE_API_TOKEN";
  }

  /**
   * Lấy token cá nhân riêng của User
   */
  static getPersonalToken() {
    return (
      PropertiesService.getUserProperties().getProperty(this.TOKEN_KEY) || ""
    );
  }

  /**
   * Lưu token cá nhân vào UserProperties
   */
  static setPersonalToken(token) {
    PropertiesService.getUserProperties().setProperty(
      this.TOKEN_KEY,
      (token || "").trim(),
    );
  }

  /**
   * Đọc token hợp lệ để gọi API (Ưu tiên User -> Fallback Script)
   */
  static getValidToken() {
    const userToken = this.getPersonalToken();
    if (userToken) return userToken;

    const scriptToken = PropertiesService.getScriptProperties().getProperty(
      this.TOKEN_KEY,
    );
    if (scriptToken && scriptToken.trim()) return scriptToken.trim();

    throw new Error(
      "Bạn chưa cài đặt Outline API Token cá nhân! Hãy vào menu '🚀 AI Recruitment' -> 'Cài đặt Outline API Token cá nhân' để nhập key.",
    );
  }

  /**
   * Gọi Outline API documents.create để tạo draft / publish
   * @param {Object} params - { title, text, publish, collectionId }
   */
  static createDocument({ title, text, publish = null, collectionId = null }) {
    if (!title || !text) {
      throw new Error("Tiêu đề và nội dung tài liệu không được để trống.");
    }

    const outlineConfig = OUTLINE_CV_SUMMARIZER_CONFIG.OUTLINE;
    const token = this.getValidToken();

    const isPublish =
      publish !== null ? publish : outlineConfig.PUBLISH === true;
    const targetCollectionId =
      collectionId || outlineConfig.COLLECTION_ID || null;

    const payload = {
      title: title,
      text: text,
      publish: isPublish,
    };

    if (isPublish && targetCollectionId) {
      payload.collectionId = targetCollectionId;
    }

    const response = UrlFetchApp.fetch(
      `${outlineConfig.BASE_URL}/api/documents.create`,
      {
        method: "post",
        contentType: "application/json",
        headers: { Authorization: `Bearer ${token}` },
        payload: JSON.stringify(payload),
        muteHttpExceptions: true,
      },
    );

    const statusCode = response.getResponseCode();
    const rawText = response.getContentText() || "{}";
    let body;

    try {
      body = JSON.parse(rawText);
    } catch (e) {
      throw new Error(
        `Phản hồi Outline API không hợp lệ (HTTP ${statusCode}).`,
      );
    }

    if (statusCode !== 200 || body.ok !== true) {
      throw new Error(
        `Outline API lỗi (${statusCode}): ${body.error || rawText}`,
      );
    }

    return body.data;
  }
}
