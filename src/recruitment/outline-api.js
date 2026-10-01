/** ==========================================
 * RECRUITMENT/OUTLINE-API.JS - OUTLINE WIKI CLIENT
 * ==========================================
 * Mọi lời gọi tới Outline API của module AI Recruitment:
 *  - Tạo draft document (documents.create)
 *  - Upload ảnh attachment (attachments.create + presigned S3)
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

/**
 * Upload ảnh ứng viên thẳng vào Outline qua attachments.create (presigned S3),
 * KHÔNG qua Drive — tránh phụ thuộc quyền share "anyone with link" mà domain
 * Workspace có thể chặn. URL trả về là attachments.redirect (chỉ người có quyền
 * xem Outline mới thấy ảnh, ảnh nằm trong wiki).
 *
 * Flow: attachments.create (JSON, Bearer) -> presigned POST form -> upload bytes
 * lên S3 (form fields trước, file CUỐI, không auth header).
 *
 * @param {Object} photo - { dataBase64: string, fileName: string, mimeType: string }
 * @param {Object} candidate - để đặt tên file theo ứng viên
 * @returns {Object} { ok, id?, url?, error? }
 */
function uploadCandidatePhoto(photo, candidate) {
  try {
    if (!photo || !photo.dataBase64) {
      return { ok: false, error: "Không có dữ liệu ảnh." };
    }

    const bytes = Utilities.base64Decode(photo.dataBase64);
    const maxBytes = (CONFIG.PHOTO_UPLOAD.MAX_SIZE_MB || 5) * 1024 * 1024;
    if (bytes.length > maxBytes) {
      return {
        ok: false,
        error: `Ảnh vượt quá giới hạn ${CONFIG.PHOTO_UPLOAD.MAX_SIZE_MB}MB. Hãy chọn ảnh nhỏ hơn.`,
      };
    }

    const contentType = photo.mimeType || "image/jpeg";
    const ext = (photo.fileName || "photo.jpg").split(".").pop() || "jpg";
    const baseName =
      candidate && candidate.accentlessFullName
        ? candidate.accentlessFullName.replace(/\s+/g, "-")
        : "candidate";
    const fileName = `welcome-photo-${baseName}.${ext}`;

    // 1. attachments.create -> nhận presigned S3 POST (uploadUrl + form fields)
    const createResponse = UrlFetchApp.fetch(
      `${CONFIG.OUTLINE.BASE_URL}/api/attachments.create`,
      {
        method: "post",
        contentType: "application/json",
        headers: { Authorization: `Bearer ${getOutlineApiToken_()}` },
        payload: JSON.stringify({
          name: fileName,
          contentType: contentType,
          size: bytes.length,
          preset: "documentAttachment",
        }),
        muteHttpExceptions: true,
      },
    );
    const createBody = JSON.parse(createResponse.getContentText() || "{}");
    if (createResponse.getResponseCode() !== 200 || createBody.ok !== true) {
      throw new Error(
        `Outline attachments.create lỗi: ${createBody.error || createResponse.getContentText()}`,
      );
    }
    const { uploadUrl, form, attachment } = createBody.data;

    // 2. POST multipart lên S3: toàn bộ form fields trước, file blob CUỐI, KHÔNG auth header
    const boundary =
      "-------gasOutline" + Utilities.getUuid().replace(/-/g, "");
    let prefix = "";
    for (const [key, value] of Object.entries(form || {})) {
      prefix += `--${boundary}\r\nContent-Disposition: form-data; name="${key}"\r\n\r\n${value}\r\n`;
    }
    prefix += `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${fileName}"\r\nContent-Type: ${contentType}\r\n\r\n`;
    const suffix = `\r\n--${boundary}--\r\n`;

    const payloadBytes = Utilities.mergeBytes([
      Utilities.newBlob(prefix).getBytes(),
      bytes,
      Utilities.newBlob(suffix).getBytes(),
    ]);

    const uploadResponse = UrlFetchApp.fetch(uploadUrl, {
      method: "post",
      contentType: `multipart/form-data; boundary=${boundary}`,
      payload: payloadBytes,
      muteHttpExceptions: true,
    });
    if (uploadResponse.getResponseCode() >= 300) {
      throw new Error(
        `Upload ảnh lên storage lỗi (HTTP ${uploadResponse.getResponseCode()}): ${uploadResponse.getContentText().slice(0, 200)}`,
      );
    }

    // 3. attachment.url là đường dẫn tương đối (/api/attachments.redirect?id=...) -> ghép origin
    let url;
    if (attachment && attachment.url) {
      url = /^https?:\/\//.test(attachment.url)
        ? attachment.url
        : `${CONFIG.OUTLINE.BASE_URL}${attachment.url}`;
    } else {
      url = `${CONFIG.OUTLINE.BASE_URL}/api/attachments.redirect?id=${attachment.id}`;
    }

    return { ok: true, id: attachment.id, url: url };
  } catch (error) {
    Logger.log("❌ uploadCandidatePhoto lỗi: " + error.toString());
    return { ok: false, error: error.message || error.toString() };
  }
}
