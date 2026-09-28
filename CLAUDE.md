# GOOGLE APPS SCRIPT ONBOARDING EMAIL AUTOMATION - SYSTEM ARCHITECTURE & AGENT INSTRUCTIONS

Bạn là một Chuyên gia Lập trình Google Apps Script (GAS) cao cấp đảm nhận vai trò Lead Developer cho dự án này. Hãy đọc kỹ toàn bộ bối cảnh dự án, các tính năng đã thực thi bên dưới để tiến hành review, tối ưu và nâng cấp hệ thống khi nhận yêu cầu.

---

## 1. TÓM TẮT DỰ ÁN & NHỮNG CÔNG VIỆC ĐÃ HOÀN THÀNH

Hệ thống tự động hóa Onboarding Email Automation cho Kyanon Digital chạy trên Google Sheets thông qua Google Apps Script (phát triển local với `clasp`).

### Các tính năng & mô-đun đã xây dựng:

1. **Kiến trúc mô-đun hóa (Modular Architecture):**
   - **`src/appsscript.json`**: Cấu hình OAuth Scopes, V8 runtime và múi giờ `Asia/Ho_Chi_Minh`.
   - **`src/utils.js`**:
     - Định nghĩa `CONFIG.RECIPIENTS` chứa email cố định của các phòng ban (DevOps, HR, IT, People Team).
     - Từ điển cột `COLS` được chuẩn hóa tự động qua `normalizeHeaderKey()`.
     - Bản đồ File ID cố định (`DRIVE_FILE_MAP`) tra cứu theo loại hợp đồng và địa điểm (`intern_danang`, `intern_hcm`, `probation_danang`, `probation_hcm`).
     - Bộ hàm helper xử lý chuỗi triệt để: `clean()` (ép lowercase, NFC Unicode, trim 2 đầu và thu gọn khoảng trắng ở giữa thành 1), `removeAccents()`, `toTitleCase()`, `formatKyanonEmail()`, `formatDateValue()`, `isStandardDevice()`, `getGuidePdfFileInfo()`.
   - **`src/normalize-input.js`**:
     - `getNormalizedInput(triggerType)`: Lấy dữ liệu dòng đang active trên Sheet, làm sạch và trả về JSON Payload chuẩn hóa với thông tin ứng viên, link trực tiếp tới dòng sheet, tên file đính kèm chuẩn hóa (`formattedName_Essential Onboarding Steps.pdf`).
     - `getTriggerType(e)`: Nhận sự kiện `onEdit(e)`, xác định chính xác người dùng đang kích hoạt luồng `OFFER_ACCEPTED` (sửa Offer Status sang "offer accepted") hay `WELCOME_EMAIL` (nhập/cut-paste Alloc Code).
   - **`src/email-templates.js`**:
     - Chứa 4 hàm trả về chuỗi HTML Email + Subject chuẩn thiết kế Kyanon Digital (`#EF403E`): `getDevOpsEmailTemplate()`, `getHREmailTemplate()`, `getITEmailTemplate()`, `getWelcomeCandidateEmailTemplate()`.
   - **`src/workflows.js`**:
     - `handleOfferAcceptedWorkflow(data)`: Tạo 3 bản nháp (Gmail Drafts) cho DevOps, HR, và IT (nếu thiết bị là "as company standard"). Kết thúc bằng việc hiển thị Toast Popup thông báo kết quả ở góc dưới màn hình.
     - `handleWelcomeEmailWorkflow(data)`: Lấy đúng file PDF hướng dẫn trên Drive, đổi tên đính kèm, tạo Draft Welcome Email gửi Candidate (CC TA, Manager, People Team) kèm link preview PDF online. Hiển thị Toast Popup thông báo kết quả.
   - **`src/main.js`**:
     - Controller điều phối sự kiện `onEdit(e)` và hàm test `testNormalizeOutput()`.

---

## 2. CHUẨN PAYLOAD JSON ĐẦU VÀO (`getNormalizedInput`)

```json
{
  "triggerType": "OFFER_ACCEPTED",
  "rowNumber": 3,
  "rowLink": "[https://docs.google.com/spreadsheets/d/1WKf-qJ7ENBn2Az-uXps9gYB1yUtERBRj1TS375sh8Qs/edit#gid=1299731012&range=3:3](https://docs.google.com/spreadsheets/d/1WKf-qJ7ENBn2Az-uXps9gYB1yUtERBRj1TS375sh8Qs/edit#gid=1299731012&range=3:3)",
  "status": "offer accepted",
  "employmentType": "probation",
  "onboardingType": "onsite - danang",
  "deviceRequest": "as company standard",
  "fullName": "Trần Thị Tú Anh",
  "accentlessFullName": "tran thi tu anh",
  "formattedName": "Anh Tran",
  "customFileName": "Anh Tran_Essential Onboarding Steps.pdf",
  "position": "Quality Control Engineer",
  "squad": "Apollo",
  "level": "E4.1",
  "startDate": "05/01/2026",
  "personalEmail": "tttuanh99@gmail.com",
  "workingEmail": "quang.nguyenminh@kyanon.digital",
  "allocCode": "quang.nguyenminh",
  "taEmail": "my.tran@kyanon.digital",
  "managerEmail": "hau.nt@kyanon.digital",
  "currentUserEmail": "quang.nguyenminh@kyanon.digital"
}
```

---

## 3. NGUYÊN TẮC CẦN TUÂN THỦ KHI MỞ RỘNG VÀ REFAC CODE (INSTRUCTIONS FOR AGENT)

Khi đọc repo này, Agent có nhiệm vụ tự chủ động audit toàn bộ codebase trong thư mục `src/`, chủ động phát hiện các **Potential Bugs** (ví dụ: duplicate trigger khi edit lặp lại, paste range làm e.value bị undefined, thiếu email cá nhân khi tạo welcome mail, crash script khi Drive ID không khả dụng...) và nâng cấp hệ thống theo các nguyên tắc sau:

1. **Tuân thủ phân tách trách nhiệm (Separation of Concerns):** Không viết gộp logic nghiệp vụ vào `main.js`. Mọi helper đưa vào `utils.js`, template đưa vào `email-templates.js`, workflow đưa vào `workflows.js`.
2. **Xử lý dữ liệu an toàn (Defensive Programming):** Luôn dùng hàm `clean()` cho các chuỗi so sánh, bọc các thao tác gọi dịch vụ ngoài (DriveApp, GmailApp) trong khối `try...catch`.
3. **UI Feedback:** Giữ nguyên giao diện thông báo mượt mà cho người dùng bằng `SpreadsheetApp.getActiveSpreadsheet().toast()`.

```

```
