// 2. Mở Sidebar HTML
function showSidebar() {
  const html = HtmlService.createTemplateFromFile("sidebar")
    .evaluate()
    .setTitle("Tạo Candidate Introduction")
    .setWidth(400);
  SpreadsheetApp.getUi().showSidebar(html);
}

// 3. Hàm lấy link CV từ dòng đang chọn (Xử lý RichText, SmartChips, Hyperlink và Tên file)
function getSelectedCvUrl() {
  const sheet = SpreadsheetApp.getActiveSheet();
  const range = sheet.getActiveRange();
  if (!range) return "";
  const row = range.getRow();

  if (row === 1) return "";

  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];

  let cvColumnIndex = headers.findIndex(
    (h) => h.toString().trim().toUpperCase() === "CV",
  );

  let targetCell;
  if (cvColumnIndex !== -1) {
    targetCell = sheet.getRange(row, cvColumnIndex + 1);
  } else {
    targetCell = sheet.getRange(row, range.getColumn());
  }

  // 1. Kiểm tra RichText Runs (Lấy link đính kèm ẩn trong chữ)
  const richText = targetCell.getRichTextValue();
  if (richText) {
    if (richText.getLinkUrl()) {
      return richText.getLinkUrl();
    }
    const runs = richText.getRuns();
    for (let run of runs) {
      if (run.getLinkUrl()) {
        return run.getLinkUrl();
      }
    }
  }

  // 2. Kiểm tra công thức =HYPERLINK()
  const formula = targetCell.getFormula();
  if (formula && formula.toUpperCase().includes("HYPERLINK")) {
    const match = formula.match(/HYPERLINK\(\s*["']([^"']+)["']/i);
    if (match && match[1]) {
      return match[1];
    }
  }

  const rawValue = targetCell.getValue().toString().trim();

  // 3. Nếu giá trị chỉ là Tên File (chưa có http/https) -> Tự động search lấy URL thực từ Drive
  if (
    rawValue &&
    !rawValue.startsWith("http://") &&
    !rawValue.startsWith("https://")
  ) {
    try {
      const files = DriveApp.getFilesByName(rawValue);
      if (files.hasNext()) {
        return files.next().getUrl();
      }
    } catch (e) {
      Logger.log("Không thể search file theo tên: " + e.toString());
    }
  }

  return rawValue;
}

/**
 * Trích xuất File ID từ Link Google Drive / Google Docs / Smart Chips / Tên File
 */
function extractDriveFileId(input) {
  if (!input) return null;
  let cleanInput = input.toString().trim();

  // 1. Link dạng /file/d/FILE_ID/
  const fileDMatch = cleanInput.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (fileDMatch && fileDMatch[1]) return fileDMatch[1];

  // 2. Link dạng /document/d/FILE_ID/ (Hỗ trợ Google Docs/Word online)
  const docDMatch = cleanInput.match(/\/document\/d\/([a-zA-Z0-9_-]+)/);
  if (docDMatch && docDMatch[1]) return docDMatch[1];

  // 3. Link dạng /spreadsheets/d/ hoặc /presentation/d/
  const genericDocMatch = cleanInput.match(
    /\/(?:spreadsheets|presentation)\/d\/([a-zA-Z0-9_-]+)/,
  );
  if (genericDocMatch && genericDocMatch[1]) return genericDocMatch[1];

  // 4. Link dạng open?id=FILE_ID hoặc uc?id=FILE_ID
  const idParamMatch = cleanInput.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (idParamMatch && idParamMatch[1]) return idParamMatch[1];

  // 5. Nếu input chính là ID thuần (dạng 25+ ký tự không chứa / hay ?)
  if (/^[a-zA-Z0-9_-]{25,}$/.test(cleanInput)) {
    return cleanInput;
  }

  // 6. Nếu input là Tên file (Search trực tiếp trên Drive)
  try {
    const files = DriveApp.getFilesByName(cleanInput);
    if (files.hasNext()) {
      return files.next().getId();
    }
  } catch (e) {
    Logger.log("Lỗi tìm file theo tên: " + e.toString());
  }

  return null;
}

/**
 * Trích xuất văn bản từ File CV (Xử lý mượt mà cả PDF, Ảnh scan, Google Docs lẫn file .DOCX)
 */
function extractCvTextFromDrive(cvUrl) {
  const fileId = extractDriveFileId(cvUrl);
  if (!fileId) {
    throw new Error(
      "Không thể nhận diện File ID từ đường link hoặc tên file: " + cvUrl,
    );
  }

  let tempDocId = null;
  try {
    const file = DriveApp.getFileById(fileId);
    const mimeType = file.getMimeType();

    // 1. Nếu file đã là Google Docs sẵn -> Đọc trực tiếp
    if (mimeType === MimeType.GOOGLE_DOCS) {
      return DocumentApp.openById(fileId).getBody().getText();
    }

    // 2. Nếu là PDF, Ảnh hoặc File Word (.docx) -> Thực hiện OCR sang Google Doc tạm
    const blob = file.getBlob();
    let tempDocFile;

    // Kiểm tra và sử dụng Drive API
    try {
      if (typeof Drive !== "undefined" && Drive.Files && Drive.Files.insert) {
        // Drive API v2
        tempDocFile = Drive.Files.insert(
          {
            title: "TEMP_CV_OCR_" + new Date().getTime(),
            mimeType: blob.getContentType(),
          },
          blob,
          { ocr: true, ocrLanguage: "en" },
        );
      } else if (
        typeof Drive !== "undefined" &&
        Drive.Files &&
        Drive.Files.create
      ) {
        // Drive API v3
        tempDocFile = Drive.Files.create(
          {
            name: "TEMP_CV_OCR_" + new Date().getTime(),
            mimeType: "application/vnd.google-apps.document",
          },
          blob,
          { ocr: true },
        );
      } else {
        // Fallback dùng Drive REST API trực tiếp nếu biến 'Drive' bị dính lỗi scope
        const url =
          "https://www.googleapis.com/drive/v2/files?ocr=true&ocrLanguage=en";
        const param = {
          method: "post",
          contentType: blob.getContentType(),
          headers: { Authorization: "Bearer " + ScriptApp.getOAuthToken() },
          payload: blob,
          muteHttpExceptions: true,
        };
        const res = UrlFetchApp.fetch(url, param);
        const json = JSON.parse(res.getContentText());
        if (json.error) {
          throw new Error("Lỗi Drive REST API: " + json.error.message);
        }
        tempDocFile = json;
      }
    } catch (e) {
      throw new Error("Lỗi khi thực hiện OCR chuyển đổi CV: " + e.message);
    }

    tempDocId = tempDocFile.id;

    // Đọc text từ Google Doc tạm thời vừa bóc tách xong
    const docApp = DocumentApp.openById(tempDocId);
    const cvText = docApp.getBody().getText();

    if (!cvText || cvText.trim().length === 0) {
      throw new Error("File CV rỗng hoặc dạng ảnh không thể bóc tách chữ.");
    }

    return cvText;
  } catch (error) {
    throw new Error("Lỗi đọc CV từ Drive: " + error.message);
  } finally {
    // Dọn dẹp file tạm
    if (tempDocId) {
      try {
        DriveApp.getFileById(tempDocId).setTrashed(true);
      } catch (e) {}
    }
  }
}

// 4. Gọi Gemini 3.5 Flash API để phân tích CV và tạo Introduction
function generateIntroductionWithGemini(apiKey, cvUrl) {
  if (!apiKey) throw new Error("Vui lòng nhập Gemini API Key!");
  if (!cvUrl) throw new Error("Vui lòng nhập Link CV!");

  // BƯỚC 1: Trích xuất văn bản CV từ Google Drive
  const cvText = extractCvTextFromDrive(cvUrl);

  // BƯỚC 2: Endpoint sử dụng Gemini 3.5 Flash
  const geminiEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${apiKey.trim()}`;

  const prompt = `
Bạn là một HR Specialist chuyên viết bài giới thiệu nhân sự mới.
Hãy đọc kỹ NỘI DUNG CV thực tế sau đây của ứng viên:

--- NỘI DUNG CV ---
${cvText}
-------------------

Nhiệm vụ: Dựa HOÀN TOÀN và CHỈ DỰA VÀO thông tin thực tế trong CV trên, hãy tạo bài viết Introduction theo chính xác template sau:

First working day: [Ngày làm việc đầu tiên, nếu không có trong CV thì bỏ trống]
Job Title: [Vị trí công việc]
Line Manager: [Tên quản lý trực tiếp, nếu không có trong CV thì bỏ trống]
Introduction: [Đoạn văn ngắn khoảng 80-100 từ giới thiệu bằng tiếng Anh, truyền cảm hứng. Nêu bật trường đại học/kỹ năng/kinh nghiệm NẾU CÓ TRONG CV. Sử dụng emoji hợp lý như 🌟, 🚀].

RÀNG BUỘC NGHIÊM NGẶT:
1. CHỈ sử dụng thông tin thực tế xuất hiện trong CV. Tuyệt đối KHÔNG tự bịa ra tên trường đại học, bằng cấp, công nghệ nếu CV không đề cập.
2. Nếu thông tin nào không xuất hiện trong CV, hãy bỏ qua chi tiết đó, tuyệt đối KHÔNG tự điền bừa.
3. Chỉ trả về nội dung theo đúng template trên, không kèm lời giải thích hay dẫn dắt nào khác.
`;

  const payload = {
    contents: [{ parts: [{ text: prompt }] }],
  };

  const options = {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  };

  const response = UrlFetchApp.fetch(geminiEndpoint, options);
  const json = JSON.parse(response.getContentText());

  if (json.error) {
    throw new Error("Lỗi Gemini API: " + json.error.message);
  }

  if (!json.candidates || !json.candidates[0] || !json.candidates[0].content) {
    throw new Error("Gemini API không trả về kết quả hợp lệ.");
  }

  return json.candidates[0].content.parts[0].text;
}

// 5. Gọi API của Outline để đăng bài Draft
function createOutlineDraft(
  outlineToken,
  title,
  contentText,
  imageBase64,
  imageName,
) {
  if (!outlineToken) throw new Error("Vui lòng nhập Outline API Token!");

  let documentText = contentText;

  if (imageBase64) {
    documentText += `\n\n![${imageName || "Candidate Image"}](${imageBase64})`;
  }

  const endpoint = "https://outline.kyanon.digital/api/documents.create";

  const payload = {
    title: title || "New Candidate Introduction",
    text: documentText,
    publish: false,
  };

  const options = {
    method: "post",
    contentType: "application/json",
    headers: {
      Authorization: `Bearer ${outlineToken.trim()}`,
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  };

  const response = UrlFetchApp.fetch(endpoint, options);
  const json = JSON.parse(response.getContentText());

  if (json.error || !json.ok) {
    throw new Error(
      "Lỗi tạo draft Outline: " + (json.message || JSON.stringify(json)),
    );
  }

  return json.data;
}

/**
 * Lấy API Keys đã lưu
 */
function getSavedApiKeys() {
  const userProperties = PropertiesService.getUserProperties();
  return {
    geminiKey: userProperties.getProperty("GEMINI_API_KEY") || "",
    outlineToken: userProperties.getProperty("OUTLINE_API_TOKEN") || "",
  };
}

/**
 * Lưu API Keys vào UserProperties
 */
function saveApiKeys(geminiKey, outlineToken) {
  const userProperties = PropertiesService.getUserProperties();
  if (geminiKey) userProperties.setProperty("GEMINI_API_KEY", geminiKey.trim());
  if (outlineToken)
    userProperties.setProperty("OUTLINE_API_TOKEN", outlineToken.trim());
  return true;
}
