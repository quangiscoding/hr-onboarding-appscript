/** ==========================================
 * RECRUITMENT/SIDEBAR.JS - MODULE AI RECRUITMENT
 * ==========================================
 * Sidebar "Welcome Onboard Post Generator":
 *  1. Đọc thông tin ứng viên đang chọn trên sheet -> hiển thị form
 *  2. Người dùng nhập/édit Introduction -> Submit
 *  3. Gọi Outline API (documents.create, publish=false) tạo draft trên Outline Wiki
 *
 * Phụ thuộc: core/config.js, core/utils.js (getHeaderColumnMap, clean, toTitleCase)
 */

/* ------------------------------------------------------------------ */
/* SIDEBAR ENTRY & DATA                                                */
/* ------------------------------------------------------------------ */

/** Mở sidebar (được gọi từ menu "Mở AI Introduction Generator") */
function showSidebar() {
  const html = HtmlService.createHtmlOutputFromFile(
    "recruitment/welcome-onboard",
  )
    .setTitle("AI Recruitment — Welcome Onboard")
    .setWidth(320);
  SpreadsheetApp.getUi().showSidebar(html);
}

/**
 * Đọc thông tin ứng viên tại dòng đang chọn để fill form trong sidebar.
 * Được gọi từ sidebar qua google.script.run khi mở.
 * @returns {Object} { ok, error?, candidate: {...} }
 */
function getSelectedCandidate() {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    const activeRange = sheet.getActiveRange();
    if (!activeRange || activeRange.getRow() < 2) {
      return {
        ok: false,
        error: "Hãy chọn trước một dòng nhân sự trên Sheet rồi mở lại sidebar.",
      };
    }

    const rowIndex = activeRange.getRow();
    const colMap = getHeaderColumnMap(sheet);
    const readCol = (key) => {
      const col = colMap[key];
      return col
        ? String(sheet.getRange(rowIndex, col).getDisplayValue()).trim()
        : "";
    };

    // Cột CV: cell thường chứa HYPERLINK (text hiển thị là tên file, URL nằm trong link).
    // Ưu tiên: hyperlink của cell -> URL trong formula HYPERLINK() -> giá trị hiển thị.
    let cvUrl = "";
    if (colMap[COLS.CV]) {
      const cvCell = sheet.getRange(rowIndex, colMap[COLS.CV]);
      const richText = cvCell.getRichTextValue();
      cvUrl = (richText && richText.getLinkUrl()) || "";
      if (!cvUrl) {
        const formula = cvCell.getFormula() || "";
        const m = formula.match(/HYPERLINK\(\s*"([^"]+)"/i);
        if (m) cvUrl = m[1];
      }
      if (!cvUrl) cvUrl = String(cvCell.getDisplayValue()).trim();
    }

    const candidate = {
      rowNumber: rowIndex,
      fullName: readCol(COLS.FULL_NAME),
      accentlessFullName: readCol(COLS.ACCENTLESS_FULL_NAME),
      level: readCol(COLS.LEVEL),
      employmentType: readCol(COLS.EMPLOYMENT_TYPE),
      title: readCol(COLS.TITLE),
      squad: readCol(COLS.SQUAD),
      lineManager: readCol(COLS.LINE_MANAGER),
      taInCharge: readCol(COLS.TA_IN_CHARGE),
      dateOfOnboard: readCol(COLS.DATE_ONBOARD),
      workingEmail: readCol(COLS.WORKING_EMAIL),
      personalEmail: readCol(COLS.PERSONAL_EMAIL),
      phoneNumber: readCol("phonenumber"),
      cvUrl: cvUrl,
    };

    if (!candidate.fullName) {
      return {
        ok: false,
        error: `Dòng ${rowIndex} không có Full Name. Hãy chọn đúng dòng nhân sự.`,
      };
    }

    return { ok: true, candidate };
  } catch (error) {
    Logger.log("❌ getSelectedCandidate lỗi: " + error.toString());
    return { ok: false, error: error.toString() };
  }
}

/* ------------------------------------------------------------------ */
/* OUTLINE API                                                         */
/* ------------------------------------------------------------------ */

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

/* ------------------------------------------------------------------ */
/* PHOTO UPLOAD (upload thẳng vào Outline qua attachments API)          */
/* ------------------------------------------------------------------ */

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
    const boundary = "-------gasOutline" + Utilities.getUuid().replace(/-/g, "");
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

/* ------------------------------------------------------------------ */
/* GEMINI: AI TÓM TẮT CV                                               */
/* ------------------------------------------------------------------ */

/**
 * Lấy Gemini API key từ Script Property "GEMINI_API_KEY".
 * Lấy key miễn phí tại https://aistudio.google.com/apikey
 */
function getGeminiApiKey_() {
  const key =
    PropertiesService.getScriptProperties().getProperty("GEMINI_API_KEY");
  if (!key) {
    throw new Error(
      'Thiếu Script Property "GEMINI_API_KEY". Hãy vào Apps Script → Project Settings → Script Properties và thêm Gemini API key (lấy tại https://aistudio.google.com/apikey).',
    );
  }
  return key;
}

/**
 * Đọc nội dung CV: ưu tiên file Drive từ formData (upload),
 * fallback link CV trong cột CV của dòng đang chọn.
 * @returns {Object}
 *   - PDF:   { kind: "pdf_inline", pdfBase64, fileName } (gửi thẳng PDF base64 cho Gemini)
 *   - Khác:  { kind: "text", text }
 */
function readCvContent_(cvFileMeta, candidate) {
  let blob = null;
  let fileName = "cv";

  // 1. CV upload trực tiếp từ sidebar (base64) — dựng blob trong bộ nhớ, KHÔNG tạo file Drive
  if (cvFileMeta && cvFileMeta.dataBase64) {
    const bytes = Utilities.base64Decode(cvFileMeta.dataBase64);
    blob = Utilities.newBlob(
      bytes,
      cvFileMeta.mimeType || "application/pdf",
      cvFileMeta.fileName || "cv.pdf",
    );
    fileName = cvFileMeta.fileName || "cv.pdf";
  } else if (candidate && candidate.cvUrl) {
    // 2. Link CV trong cột CV của sheet
    let fileId = extractDriveFileId_(candidate.cvUrl);
    if (!fileId) {
      // Cột CV chỉ chứa TÊN FILE (không phải link) -> tìm file trong Drive theo tên
      fileId = findDriveFileIdByName_(candidate.cvUrl);
      if (!fileId) {
        throw new Error(
          `Cột CV không chứa link Drive hợp lệ và không tìm thấy file nào tên "${candidate.cvUrl}" trong Drive của bạn. Hãy dán link Drive của CV vào cột CV hoặc upload file từ máy.`,
        );
      }
    }
    const file = DriveApp.getFileById(fileId);
    blob = file.getBlob();
    fileName = file.getName() || fileName;
  } else {
    throw new Error(
      "Không tìm thấy CV: cột CV trên sheet trống và bạn chưa upload file CV. Hãy upload CV hoặc điền link CV vào cột CV.",
    );
  }

  const mimeType = blob.getContentType() || "";
  const nameForDetect = fileName || "";

  // PDF: gửi thẳng base64 cho Gemini (Gemini đọc PDF native, không cần convert sang GDoc)
  if (mimeType === MimeType.PDF || /\.pdf$/i.test(nameForDetect)) {
    return {
      kind: "pdf_inline",
      pdfBase64: Utilities.base64Encode(blob.getBytes()),
      fileName,
    };
  }

  // Google Docs: mở DocumentApp trực tiếp
  if (mimeType === MimeType.GOOGLE_DOCS) {
    const fileId =
      extractDriveFileId_(candidate && candidate.cvUrl) ||
      findDriveFileIdByName_(nameForDetect);
    let text = "";
    try {
      text = DocumentApp.openById(fileId).getBody().getText();
    } catch (e) {
      text = "";
    }
    if (text) return { kind: "text", text };
  }

  // DOCX (zip): giải nén lấy word/document.xml rồi strip tag XML
  if (mimeType === MimeType.MICROSOFT_WORD || /\.docx$/i.test(nameForDetect)) {
    return { kind: "text", text: extractTextFromDocx_(blob) };
  }

  // DOC cũ (binary): không đọc được — yêu cầu đổi định dạng
  if (/\.doc$/i.test(nameForDetect) || mimeType === "application/msword") {
    throw new Error(
      "File CV là .doc cũ — script không đọc được. Hãy lưu lại thành .docx hoặc PDF rồi upload lại (hoặc upload PDF).",
    );
  }

  // Plain text / các định dạng khác
  const text = blob.getDataAsString("UTF-8");
  if (!text || !/[a-zA-Z]/.test(text.slice(0, 500))) {
    throw new Error(
      "Không trích xuất được text từ file CV. Các định dạng hỗ trợ: PDF, DOCX, Google Docs, TXT.",
    );
  }
  return { kind: "text", text };
}

/**
 * Trích text từ file DOCX (một file zip chứa XML).
 * Đọc word/document.xml, tách paragraph rồi strip tag XML.
 */
function extractTextFromDocx_(blob) {
  let xml = null;
  try {
    // Utilities.unzip yêu cầu ContentType = application/zip — docx mang MIME Word riêng nên phải ép lại
    blob.setContentType("application/zip");
    const entries = Utilities.unzip(blob);
    for (let i = 0; i < entries.length; i++) {
      if (entries[i].getName() === "word/document.xml") {
        xml = entries[i].getDataAsString("UTF-8");
        break;
      }
    }
  } catch (e) {
    throw new Error("File DOCX hỏng hoặc không đọc được: " + e.message);
  }
  if (!xml) {
    throw new Error(
      'Không tìm thấy nội dung "word/document.xml" trong file DOCX.',
    );
  }

  return xml
    .replace(/<w:p[ >]/g, "\n<w:p ") // mỗi paragraph = 1 dòng
    .replace(/<w:tab[^>]*\/>/g, "\t")
    .replace(/<w:br[^>]*\/>/g, "\n")
    .replace(/<[^>]+>/g, "") // strip toàn bộ tag còn lại
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Tìm file trong Drive theo TÊN (khi cột CV chỉ chứa tên file, không phải link).
 * Trả về File ID của kết quả khớp đầu tiên, hoặc null nếu không thấy.
 */
function findDriveFileIdByName_(name) {
  if (!name) return null;
  const escaped = String(name).replace(/'/g, "\\'");
  const it = DriveApp.searchFiles(
    `title contains '${escaped}' and trashed = false`,
  );
  while (it.hasNext()) {
    return it.next().getId(); // lấy kết quả khớp đầu tiên
  }
  return null;
}

/** Trích Drive File ID từ nhiều dạng link Drive phổ biến */
function extractDriveFileId_(url) {
  if (!url) return null;
  const patterns = [
    /\/file\/d\/([a-zA-Z0-9_-]+)/, // /file/d/<ID>/view
    /[?&]id=([a-zA-Z0-9_-]+)/, // ?id=<ID>
    /\/document\/d\/([a-zA-Z0-9_-]+)/, // docs.google.com/document/d/<ID>
  ];
  for (const p of patterns) {
    const m = String(url).match(p);
    if (m) return m[1];
  }
  // Trả về nguyên chuỗi nếu nó tự là File ID (dạng uuid)
  if (/^[a-zA-Z0-9_-]{20,}$/.test(String(url).trim()))
    return String(url).trim();
  return null;
}

/**
 * Gọi Gemini API sinh phần Introduction từ CV.
 * Với mỗi model trong CONFIG.GEMINI.MODELS: retry theo RETRY_DELAYS_MS khi gặp
 * 429 (rate limit); hết retries hoặc lỗi 404 (model ngừng) thì chuyển model kế.
 * @param {Object} cvContent - Kết quả từ readCvContent_: { kind: "pdf_inline", pdfBase64 } hoặc { kind: "text", text }
 * @param {Object} candidate - Thông tin ứng viên để AI viết cho đúng ngữ cảnh
 * @returns {string} Phần Introduction tiếng Anh, văn phong giống các bài Welcome Onboard mẫu
 */
function callGeminiSummarizeCv_(cvContent, candidate) {
  const promptParts = [{ text: buildGeminiPrompt_(candidate) }];

  if (cvContent.kind === "pdf_inline") {
    promptParts.push({
      inline_data: { mime_type: "application/pdf", data: cvContent.pdfBase64 },
    });
  } else {
    promptParts[0].text += "\n\nCV content:\n" + cvContent.text.slice(0, 15000);
  }

  const models = (CONFIG.GEMINI.MODELS && CONFIG.GEMINI.MODELS.length
    ? CONFIG.GEMINI.MODELS
    : [CONFIG.GEMINI.MODEL || "gemini-3.1-flash"]
  ).filter(Boolean);
  const delays = CONFIG.GEMINI.RETRY_DELAYS_MS || [];
  const errors = [];

  for (const model of models) {
    for (let attempt = 0; attempt <= delays.length; attempt++) {
      if (attempt > 0) {
        Logger.log(
          `⏳ Gemini ${model}: rate limit, thử lại sau ${delays[attempt - 1]}ms (lần ${attempt}/${delays.length})`,
        );
        Utilities.sleep(delays[attempt - 1]);
      }

      const result = callGeminiOnce_(model, promptParts);
      if (result.ok) return result.text;

      const { status, message } = result;
      // 429 = rate limit -> retry cùng model; lỗi khác -> bỏ sang model kế
      if (status !== 429) {
        errors.push(`${model}: ${message}`);
        break;
      }
      errors.push(`${model} (lần ${attempt + 1}): ${message}`);
    }
  }

  throw new Error(
    "Gemini API lỗi sau khi thử " + models.length + " model:\n" + errors.join("\n"),
  );
}

/**
 * Gọi generateContent 1 lần với 1 model. Không retry ở đây.
 * @returns {Object} { ok: true, text } hoặc { ok: false, status, message }
 */
function callGeminiOnce_(model, promptParts) {
  const response = UrlFetchApp.fetch(
    `${CONFIG.GEMINI.BASE_URL}/models/${model}:generateContent?key=${getGeminiApiKey_()}`,
    {
      method: "post",
      contentType: "application/json",
      payload: JSON.stringify({
        contents: [{ parts: promptParts }],
        // Lưu ý: Gemini 3.x từ chối temperature/top_p/top_k trong generateContent
        generationConfig: {},
      }),
      muteHttpExceptions: true,
    },
  );

  const statusCode = response.getResponseCode();
  const body = JSON.parse(response.getContentText() || "{}");
  if (statusCode !== 200 || !body.candidates || !body.candidates[0]) {
    const errMsg =
      body.error && body.error.message
        ? body.error.message
        : response.getContentText();
    return { ok: false, status: statusCode, message: errMsg };
  }

  const parts = body.candidates[0].content && body.candidates[0].content.parts;
  const text =
    parts &&
    parts
      .map((p) => p.text || "")
      .join("")
      .trim();
  if (!text) {
    return { ok: false, status: statusCode, message: "Gemini trả về nội dung rỗng." };
  }
  return { ok: true, text: text };
}

/**
 * Dựng prompt tiếng Anh theo style bài Welcome Onboard mẫu.
 * @param {Object} candidate
 * @returns {string} Prompt text
 */
function buildGeminiPrompt_(candidate) {
  return [
    "You are an HR teammate writing a short, warm 'Introduction' paragraph for a company-wide 'Welcome Onboard' post.",
    "Write it in ENGLISH, 4-6 sentences, in the same style as these real examples:",
    "",
    'Example 1: "We are excited to welcome Ha Ngan as our HR Admin Intern! 🎉 Ngan is currently a final-year International Relations student at USSH. Through her active involvement in student organizations, particularly as an HR Team Leader for the International Exchange Club, she has built a solid foundation in coordination, teamwork, and administrative support. Ngan joins us with a highly proactive attitude, great attention to detail, and a strong eagerness to learn and experience real-world HR operations. We believe this internship will be a great stepping stone for her career, and she will bring a fresh, energetic vibe to our team. Welcome aboard, Ngan! 🚀"',
    "",
    "Requirements:",
    "- Start with 'We are excited/delighted/thrilled to welcome <Ms./Mr.> <FirstName FullName> as our <Job Title>! 🎉'",
    "- Highlight the most relevant experience/education/soft skills from the CV (2-3 highlights max, no bullet points)",
    "- End with 'Welcome aboard, <FirstName>! 🚀'",
    "- Use ONLY facts present in the CV below. Do NOT invent achievements, numbers or certifications.",
    "- Output ONLY the paragraph text, no title, no markdown headers.",
    "",
    `Candidate info: Full name: ${candidate.fullName}. Job title: ${candidate.title || "N/A"}. Squad: ${candidate.squad || "N/A"}. Employment type: ${candidate.employmentType || "N/A"}.`,
  ].join("\n");
}

/**
 * Handler cho nút "AI tóm tắt CV": đọc CV (upload hoặc cột CV) → Gemini → trả về Introduction.
 * @param {Object} formData - { candidate: Object, cvFile?: { dataBase64, fileName, mimeType } | null }
 * @returns {Object} { ok, introduction?, error? }
 */
function summarizeCvToIntro(formData) {
  try {
    const candidate = formData && formData.candidate;
    if (!candidate || !candidate.fullName) {
      return {
        ok: false,
        error: "Thiếu thông tin ứng viên. Hãy chọn lại dòng và mở lại sidebar.",
      };
    }

    const cvText = readCvContent_(formData && formData.cvFile, candidate);
    const introduction = callGeminiSummarizeCv_(cvText, candidate);

    return { ok: true, introduction };
  } catch (error) {
    Logger.log("❌ summarizeCvToIntro lỗi: " + error.toString());
    return { ok: false, error: error.message || error.toString() };
  }
}

/* ------------------------------------------------------------------ */
/* SUBMIT HANDLER (được gọi từ sidebar form)                           */
/* ------------------------------------------------------------------ */

/**
 * Nhận dữ liệu form từ sidebar, tạo draft trên Outline.
 * @param {Object} formData - { introduction, candidate, photo?: { dataBase64, fileName, mimeType } | null }
 * @returns {Object} { ok, url?, error? }
 */
function submitIntroductionPost(formData) {
  try {
    const introduction = String(
      (formData && formData.introduction) || "",
    ).trim();
    const candidate = formData && formData.candidate;
    const photo = formData && formData.photo;

    if (!introduction) {
      return { ok: false, error: "Introduction không được để trống." };
    }
    if (!candidate || !candidate.fullName) {
      return {
        ok: false,
        error:
          "Thiếu thông tin ứng viên. Hãy đóng sidebar, chọn lại dòng và mở lại.",
      };
    }

    // 1. Nếu có ảnh: upload lên Drive trước để lấy URL nhúng vào bài
    let photoMarkdownLine = "";
    let photoWarning = "";
    if (photo && photo.dataBase64) {
      const uploadResult = uploadCandidatePhoto(photo, candidate);
      if (uploadResult.ok) {
        photoMarkdownLine = `![${candidate.fullName}](${uploadResult.url})`;
        if (uploadResult.warning) {
          photoWarning = `⚠️ ${uploadResult.warning}`;
        }
      } else {
        // Ảnh lỗi không chặn việc tạo post — chỉ cảnh báo
        photoWarning = `⚠️ Ảnh không upload được: ${uploadResult.error}`;
        Logger.log(photoWarning);
      }
    }

    // 2. Xây markdown (chèn ảnh lên đầu nếu có)
    const { title, text: baseText } = buildWelcomePostMarkdown(
      candidate,
      introduction,
    );
    const text = photoMarkdownLine
      ? `${photoMarkdownLine}\n\n${baseText}`
      : baseText;

    // 3. Tạo draft Outline
    const doc = callOutlineCreateDocument_(title, text);

    return {
      ok: true,
      message: `Đã tạo draft "${title}" trên Outline!${photoWarning ? " " + photoWarning : ""}`,
      url: doc && doc.url ? doc.url : `${CONFIG.OUTLINE.BASE_URL}/drafts`,
    };
  } catch (error) {
    Logger.log("❌ submitIntroductionPost lỗi: " + error.toString());
    return { ok: false, error: error.message || error.toString() };
  }
}
