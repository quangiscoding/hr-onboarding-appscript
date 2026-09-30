// 2. Mở Sidebar HTML
function showSidebar() {
  const html = HtmlService.createTemplateFromFile("sidebar")
    .evaluate()
    .setTitle("Tạo Candidate Introduction")
    .setWidth(400);
  SpreadsheetApp.getUi().showSidebar(html);
}

// 3. Hàm lấy link CV từ dòng đang chọn (Xử lý cả Hyperlink ẩn và bỏ qua tiêu đề)
function getSelectedCvUrl() {
  const sheet = SpreadsheetApp.getActiveSheet();
  const range = sheet.getActiveRange();
  if (!range) return "";

  const row = range.getRow();

  // Nếu đang chọn dòng 1 (dòng tiêu đề), không lấy dữ liệu tiêu đề
  if (row === 1) return "";

  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];

  // Tìm cột có tiêu đề là 'CV'
  let cvColumnIndex = headers.findIndex(
    (h) => h.toString().trim().toUpperCase() === "CV",
  );

  let targetCell;
  if (cvColumnIndex !== -1) {
    targetCell = sheet.getRange(row, cvColumnIndex + 1);
  } else {
    targetCell = sheet.getRange(row, range.getColumn());
  }

  // 1. Kiểm tra nếu ô sử dụng RichText (Link ẩn dạng Insert Link)
  const richText = targetCell.getRichTextValue();
  if (richText && richText.getLinkUrl()) {
    return richText.getLinkUrl();
  }

  // 2. Kiểm tra nếu ô dùng công thức =HYPERLINK("url", "label")
  const formula = targetCell.getFormula();
  if (formula && formula.toUpperCase().startsWith("=HYPERLINK")) {
    const match = formula.match(/=HYPERLINK\(\s*["']([^"']+)["']/i);
    if (match && match[1]) {
      return match[1];
    }
  }

  // 3. Trường hợp ô chứa text URL thuần
  return targetCell.getValue().toString().trim();
}
// 4. Gọi Gemini API để phân tích CV và tạo Introduction
function generateIntroductionWithGemini(apiKey, cvUrl) {
  if (!apiKey) throw new Error("Vui lòng nhập Gemini API Key!");
  if (!cvUrl) throw new Error("Vui lòng nhập Link CV!");

  const geminiEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

  const prompt = `
  Bạn là một HR Specialist chuyên viết bài giới thiệu nhân sự mới.
  Dựa trên link/thông tin CV sau đây: "${cvUrl}"
  Hãy trích xuất thông tin và tạo bài viết Introduction theo chính xác định dạng/template sau:

  First working day: [Ngày làm việc đầu tiên, ví dụ: DD/MM/YYYY]
  Job Title: [Vị trí công việc]
  Line Manager: [Tên quản lý trực tiếp]
  Introduction: [Đoạn văn ngắn khoảng 4-6 câu giới thiệu bằng tiếng Anh, truyền cảm hứng, nêu bật trường đại học, bằng cấp, kinh nghiệm làm việc, kỹ năng tiêu biểu và câu chào đón nồng nhiệt. Sử dụng emoji hợp lý như 🌟, 🚀].

  Ví dụ tiêu chuẩn (mẫu):
  First working day: 21/09/2026
  Job Title: Recruitment Intern
  Line Manager: Mr. Tri Nguyen
  Introduction: We are thrilled to welcome Uyen Truong as our Recruitment Intern in Perseus Team! 🌟 She is a Business English graduate from HCMUTE with experience in recruitment, employer branding, and HR operations. She has supported hiring across multiple functions and led the recruitment and onboarding of 30+ university club members. With her strong communication and coordination skills, we look forward to seeing her bring fresh energy to the team. Welcome aboard!🚀

  Lưu ý: Chỉ trả về nội dung theo đúng template trên, không kèm lời giải thích thêm.
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
    throw new Error("Lỗi từ Gemini API: " + json.error.message);
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

  // Nếu người dùng có upload ảnh, chèn đoạn Markdown / Data URI hiển thị ảnh trong bài
  if (imageBase64) {
    documentText += `\n\n![${imageName || "Candidate Image"}](${imageBase64})`;
  }

  const endpoint = "https://outline.kyanon.digital/api/documents.create";

  const payload = {
    title: title || "New Candidate Introduction",
    text: documentText,
    publish: false, // false để lưu dạng Draft trong /drafts
  };

  const options = {
    method: "post",
    contentType: "application/json",
    headers: {
      Authorization: `Bearer ${outlineToken}`,
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  };

  const response = UrlFetchApp.fetch(endpoint, options);
  const json = JSON.parse(response.getContentText());

  if (json.error || !json.ok) {
    throw new Error(
      "Lỗi khi tạo draft trên Outline: " +
        (json.message || JSON.stringify(json)),
    );
  }

  return json.data; // Trả về thông tin Document đã tạo
}
