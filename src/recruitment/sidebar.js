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
  const html = HtmlService.createHtmlOutputFromFile("recruitment/welcome-onboard")
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
      return { ok: false, error: "Hãy chọn trước một dòng nhân sự trên Sheet rồi mở lại sidebar." };
    }

    const rowIndex = activeRange.getRow();
    const colMap = getHeaderColumnMap(sheet);
    const readCol = (key) => {
      const col = colMap[key];
      return col ? String(sheet.getRange(rowIndex, col).getDisplayValue()).trim() : "";
    };

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
      cvUrl: readCol(COLS.CV),
    };

    if (!candidate.fullName) {
      return { ok: false, error: `Dòng ${rowIndex} không có Full Name. Hãy chọn đúng dòng nhân sự.` };
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
  const token = PropertiesService.getScriptProperties().getProperty("OUTLINE_API_TOKEN");
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

  const response = UrlFetchApp.fetch(`${CONFIG.OUTLINE.BASE_URL}/api/documents.create`, {
    method: "post",
    contentType: "application/json",
    headers: { Authorization: `Bearer ${getOutlineApiToken_()}` },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  });

  const statusCode = response.getResponseCode();
  const body = JSON.parse(response.getContentText() || "{}");

  if (statusCode !== 200 || body.ok !== true) {
    throw new Error(`Outline API lỗi (HTTP ${statusCode}): ${body.error || response.getContentText()}`);
  }
  return body.data;
}

/* ------------------------------------------------------------------ */
/* PHOTO UPLOAD (lưu vào Drive, trả về URL để embed vào Outline)       */
/* ------------------------------------------------------------------ */

/**
 * Lưu ảnh ứng viên (base64 từ sidebar) vào Drive folder cấu hình trong
 * CONFIG.PHOTO_UPLOAD.FOLDER_ID, đặt tên theo tên ứng viên.
 * @param {Object} photo - { dataBase64: string, fileName: string, mimeType: string }
 * @param {Object} candidate - để đặt tên file theo ứng viên
 * @returns {Object} { ok, fileId?, url?, error? } — url là link xem trực tiếp ảnh
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
    const blob = Utilities.newBlob(bytes, photo.mimeType || "image/jpeg", photo.fileName || "photo.jpg");

    // Đặt tên file chuẩn theo ứng viên: photo_<accentlessFullName>.<ext>
    const ext = (photo.fileName || "photo.jpg").split(".").pop() || "jpg";
    const baseName = candidate && candidate.accentlessFullName ? candidate.accentlessFullName.replace(/\s+/g, "-") : "candidate";
    blob.setName(`welcome-photo-${baseName}.${ext}`);

    const folder = CONFIG.PHOTO_UPLOAD.FOLDER_ID
      ? DriveApp.getFolderById(CONFIG.PHOTO_UPLOAD.FOLDER_ID)
      : DriveApp.getRootFolder();
    const file = folder.createFile(blob);

    // Cho phép bất kỳ ai có link xem được ảnh (Outline render ảnh qua URL công khai)
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

    // URL xem trực tiếp nội dung ảnh (không phải trang preview Drive)
    const directUrl = `https://drive.google.com/uc?export=view&id=${file.getId()}`;

    return { ok: true, fileId: file.getId(), url: directUrl };
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
  const key = PropertiesService.getScriptProperties().getProperty("GEMINI_API_KEY");
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
 * Trả về text (PDF được trích xuất bằng Drive API Advanced Service không cần —
 * dùng Utilities + DriveApp export text cho PDF/GDoc).
 */
function readCvContent_(cvFileMeta, candidate) {
  let file = null;

  // 1. CV upload trực tiếp từ sidebar (base64)
  if (cvFileMeta && cvFileMeta.dataBase64) {
    const bytes = Utilities.base64Decode(cvFileMeta.dataBase64);
    const blob = Utilities.newBlob(bytes, cvFileMeta.mimeType || "application/pdf", cvFileMeta.fileName || "cv.pdf");
    const tempFile = DriveApp.getRootFolder().createFile(blob);
    tempFile.setTrashed(true); // chỉ dùng để trích xuất, xóa ngay
    file = tempFile;
  } else if (candidate && candidate.cvUrl) {
    // 2. Link CV trong cột CV của sheet
    const fileId = extractDriveFileId_(candidate.cvUrl);
    if (!fileId) {
      throw new Error(`Không đọc được File ID từ link CV: ${candidate.cvUrl}`);
    }
    file = DriveApp.getFileById(fileId);
  } else {
    throw new Error(
      "Không tìm thấy CV: cột CV trên sheet trống và bạn chưa upload file CV. Hãy upload CV hoặc điền link CV vào cột CV.",
    );
  }

  // Trích text: Google Doc export trực tiếp; PDF dùng blob.getDataAsString (phải chuyển qua GDoc để đọc được text)
  const mimeType = file.getMimeType();
  let text = "";
  if (mimeType === MimeType.GOOGLE_DOCS) {
    text = DocumentApp.openById(file.getId()).getBody().getText();
  } else if (mimeType === MimeType.PDF) {
    // Chuyển PDF thành Google Doc tạm để trích text
    const tempDocFile = DriveApp.getFileById(file.getId()).getAs(MimeType.GOOGLE_DOCS);
    const tempDoc = DriveApp.getRootFolder().createFile(tempDocFile);
    tempDoc.setTrashed(true);
    text = DocumentApp.openById(tempDoc.getId()).getBody().getText();
  } else {
    text = file.getBlob().getDataAsString("UTF-8");
  }

  return text;
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
  if (/^[a-zA-Z0-9_-]{20,}$/.test(String(url).trim())) return String(url).trim();
  return null;
}

/**
 * Gọi Gemini API sinh phần Introduction từ nội dung CV.
 * @param {string} cvText - Nội dung CV
 * @param {Object} candidate - Thông tin ứng viên để AI viết cho đúng ngữ cảnh
 * @returns {string} Phần Introduction tiếng Anh, văn phong giống các bài Welcome Onboard mẫu
 */
function callGeminiSummarizeCv_(cvText, candidate) {
  const prompt = [
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
    "",
    "CV content:",
    cvText.slice(0, 15000),
  ].join("\n");

  const response = UrlFetchApp.fetch(
    `${CONFIG.GEMINI.BASE_URL}/models/${CONFIG.GEMINI.MODEL}:generateContent?key=${getGeminiApiKey_()}`,
    {
      method: "post",
      contentType: "application/json",
      payload: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.7, maxOutputTokens: 1024 },
      }),
      muteHttpExceptions: true,
    },
  );

  const statusCode = response.getResponseCode();
  const body = JSON.parse(response.getContentText() || "{}");
  if (statusCode !== 200 || !body.candidates || !body.candidates[0]) {
    const errMsg = body.error && body.error.message ? body.error.message : response.getContentText();
    throw new Error(`Gemini API lỗi (HTTP ${statusCode}): ${errMsg}`);
  }

  const parts = body.candidates[0].content && body.candidates[0].content.parts;
  const text = parts && parts.map((p) => p.text || "").join("").trim();
  if (!text) throw new Error("Gemini trả về nội dung rỗng.");
  return text;
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
      return { ok: false, error: "Thiếu thông tin ứng viên. Hãy chọn lại dòng và mở lại sidebar." };
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
    const introduction = String(formData && formData.introduction || "").trim();
    const candidate = formData && formData.candidate;
    const photo = formData && formData.photo;

    if (!introduction) {
      return { ok: false, error: "Introduction không được để trống." };
    }
    if (!candidate || !candidate.fullName) {
      return { ok: false, error: "Thiếu thông tin ứng viên. Hãy đóng sidebar, chọn lại dòng và mở lại." };
    }

    // 1. Nếu có ảnh: upload lên Drive trước để lấy URL nhúng vào bài
    let photoMarkdownLine = "";
    let photoWarning = "";
    if (photo && photo.dataBase64) {
      const uploadResult = uploadCandidatePhoto(photo, candidate);
      if (uploadResult.ok) {
        photoMarkdownLine = `![${candidate.fullName}](${uploadResult.url})`;
      } else {
        // Ảnh lỗi không chặn việc tạo post — chỉ cảnh báo
        photoWarning = `⚠️ Ảnh không upload được: ${uploadResult.error}`;
        Logger.log(photoWarning);
      }
    }

    // 2. Xây markdown (chèn ảnh lên đầu nếu có)
    const { title, text: baseText } = buildWelcomePostMarkdown(candidate, introduction);
    const text = photoMarkdownLine ? `${photoMarkdownLine}\n\n${baseText}` : baseText;

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
