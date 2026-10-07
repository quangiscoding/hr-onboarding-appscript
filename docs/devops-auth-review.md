Hiểu rồi, hạ tone xuống cho tự nhiên, đúng kiểu **báo cáo kỹ thuật cho sếp/Lead DevOps** xem: gọn, lịch sự, chuyên nghiệp nhưng không bị sến và thủ tục hành chính.

---

# HERA ONBOARDING TOOLS — BÁO CÁO THẨM ĐỊNH KỸ THUẬT & AN NINH

**Người gửi:** Team Onboarding / HR Tech

**Người nhận:** DevOps & IT Security Team

**Ngày:** 07/10/2026

**Mục đích:** Tổng hợp phạm vi phân quyền (OAuth scopes), luồng dữ liệu (Data Egress) và cơ chế kiểm soát của tool để DevOps review và cấp phép chạy chính thức.

---

## 1. TỔNG QUAN TẬP TỆP & CÁCH VẬN HÀNH

- **Repo:** `hr-onboarding-appscript`
- **Nền tảng:** Google Apps Script (GAS) gắn trực tiếp vào Google Sheet HR Onboarding.
- **Script ID:** `1R3ZLONrA5w1DGydYCXK-11Xmd3ckvf2TbuxWGKQjfgg2c3qZ7Y8OgbGJ`
- **Người dùng:** Team HR (những người đã có sẵn quyền Edit trên sheet này).
- **Cơ chế chạy:** **Không xài trigger tự động** (không `onEdit`, không hẹn giờ). HR phải tự bấm menu/sidebar để chạy. Mọi hành động gửi mail hay tạo dữ liệu đều nhảy popup xác nhận (Yes/No) rồi mới thực thi.

---

## 2. TOOL DÙNG ĐỂ LÀM GÌ?

### 2.1. Tự động hóa Email Onboarding (Menu "🚀 Hera Onboarding Tools")

- **Gửi email thông báo nội bộ (Offer Accepted):** Đọc dòng nhân sự được chọn, gửi mail tự động cho DevOps (tạo email), HR (tạo folder OKR) và IT (chuẩn bị máy). Danh sách mail người nhận đọc động từ tab `Data` trên sheet, không hardcode.
- **Update tiến độ cho TA:** Gửi 1 email báo trạng thái onboarding cho TA phụ trách ứng viên.
- **Tạo Draft Welcome Email:** Tạo bản nháp (Draft) Gmail chào mừng ứng viên, đính kèm PDF hướng dẫn theo loại hợp đồng/văn phòng. **Không tự gửi mail**, HR tự mở Gmail xem lại rồi mới bấm gửi.

### 2.2. AI Recruitment Sidebar (Menu "🚀 AI Recruitment")

- **Tóm tắt CV bằng AI:** Đọc CV (PDF, DOCX, Google Docs), gửi sang AI tóm tắt thành 4–5 câu tiếng Anh để chuẩn bị bài giới thiệu nhân sự mới.
- **Tạo ảnh Welcome Card:** HR upload ảnh nhân sự, tool ghép khung ngay trên trình duyệt (HTML5 Canvas). **Ảnh xử lý 100% ở Client (máy HR), không upload lên server hay Drive.**
- **Đẩy bài lên Outline Wiki:** Tạo bản nháp bài viết (Draft) trên Outline Wiki (`outline.kyanon.digital`) thuộc tài khoản cá nhân của người đang bấm nút.

---

## 3. PHÂN TÍCH HỢP LỆ CÁC QỦYỀN OAUTH (SCOPES)

Tool đăng ký 8 scope trong `src/appsscript.json`. Bảng so sánh giữa quyền tối đa Google cấp và phạm vi thực tế code xài:

| Scope                      | Quyền tối đa                    | Phạm vi code dùng thực tế                             | Ghi chú / Lý do                                                       |
| -------------------------- | ------------------------------- | ----------------------------------------------------- | --------------------------------------------------------------------- |
| `spreadsheets.currentonly` | Đọc/Ghi duy nhất sheet đang mở  | Đọc dữ liệu nhân sự, đọc cấu hình tab `Data`, ghi log | Scope hẹp nhất, không đụng được sheet khác.                           |
| `gmail.compose`            | Tạo, sửa, xóa draft trong Gmail | Chỉ gọi `GmailApp.createDraft()`                      | Dùng cho luồng tạo nháp Welcome Email.                                |
| `gmail.send`               | Gửi mail dưới tên user          | Chỉ gửi mail nội bộ `@kyanon.digital`                 | Dùng cho mail thông báo cho DevOps/IT/HR/TA. Coi log được trên sheet. |
| `drive.readonly`           | Đọc toàn bộ Drive của user      | Chỉ đọc file CV theo link và 4 file PDF hướng dẫn     | Cần để lấy nội dung CV & file đính kèm. Không có quyền Ghi/Xóa.       |
| `documents.readonly`       | Đọc toàn bộ Google Docs         | Chỉ đọc nội dung file CV nếu dạng GDoc                | Dùng trích xuất text cho AI tóm tắt.                                  |
| `userinfo.email`           | Xem email user đang chạy        | Đọc mail người chạy                                   | Hiện trên popup xác nhận để HR biết đang gửi từ mail nào.             |
| `script.container.ui`      | Hiển thị UI                     | Vẽ Menu, Popup và Sidebar                             | Scope bắt buộc để làm giao diện trên Sheet.                           |
| `script.external_request`  | Gọi HTTP ra ngoài               | Chỉ gọi 3 domain hardcode trong config                | Dùng gọi API AI và API Outline Wiki.                                  |

_Cam kết:_ Code **KHÔNG** xin quyền đọc hòm thư (`gmail.readonly`), **KHÔNG** xin quyền ghi/xóa Drive (`drive`), **KHÔNG** truy cập toàn bộ Sheet (`spreadsheets`).

---

## 4. DỮ LIỆU ĐI RA NGOÀI (EGRESS DATA FLOW)

Mọi HTTP request ra ngoài đều dùng `UrlFetchApp` và chỉ chạy khi HR thao tác trên Sidebar. Chỉ có 3 endpoint sau:

1. **OpenRouter API (`openrouter.ai`):**

- _Gửi gì:_ Prompt cơ bản (tên, vị trí, team) + Nội dung chữ của CV ứng viên.
- _Mục đích:_ Nhờ AI tóm tắt CV.
- _Auth:_ API key dùng chung đặt trong Script Properties.

2. **Google Gemini API (`generativelanguage.googleapis.com`):**

- _Gửi gì:_ Giống OpenRouter (chỉ chạy dự phòng khi OpenRouter lỗi).
- _Auth:_ API key trong Script Properties.

3. **Outline Wiki (`outline.kyanon.digital`):**

- _Gửi gì:_ Nội dung nháp bài Welcome Onboard (tên, vị trí, ngày bắt đầu, đoạn intro).
- _Auth:_ API Token cá nhân của HR (lưu tại `UserProperties` của chính người đó).

> **Lưu ý cho DevOps review:**
>
> - Số điện thoại ứng viên **không bao giờ gửi ra bên ngoài** (chỉ hiển thị trên Sidebar cho HR xem).
> - Ảnh nhân sự **không upload đi đâu hết** (ghép trực tiếp trên Canvas máy HR).

---

## 5. QUẢN LÝ SECRETS & KEYS

- **API Key AI (`OPENROUTER_API_KEY`, `GEMINI_API_KEY`):** Lưu tại `Script Properties` của project. Chỉ Editor của project mới thấy.
- **Token Outline (`OUTLINE_API_TOKEN`):** Lưu tại `UserProperties` của từng người dùng. HR nào dùng token HR đó, bài nháp tạo ra đứng tên chính HR đó, không xài chung token.
- **Mã nguồn:** Không hardcode bất kỳ secret, password hay API key nào trong code.

---

## 6. ĐÁNH GIÁ RỦI RO & ĐỀ XUẤT MITIGATION

1. **Rủi ro CV gửi ra OpenRouter (Bên thứ 3):**

- _Đánh giá:_ Đây là điểm cần cân nhắc nhất về PII.
- _Mitigation:_ Nếu công ty không muốn data ra bên thứ 3, có thể sửa config `CONFIG.AI_PROVIDERS = ["gemini"]` để data chỉ đi trong hạ tầng Google, hoặc trỏ về AI Gateway nội bộ công ty.

2. **Quyền `drive.readonly` rộng:**

- _Đánh giá:_ Do hạn chế của GAS không cho chọn scope từng file.
- _Mitigation:_ Review diff code mỗi lần `clasp push`. Code hiện tại chỉ gọi đọc file ở 2 file `utils.js` và `cv-reader.js`.

3. **Allowlist domain:**

- _Mitigation:_ DevOps có thể whitelist 3 domain egress: `openrouter.ai`, `generativelanguage.googleapis.com`, `outline.kyanon.digital`.

---

## 7. CÁCH KIỂM TRA NHANH TRÊN REPO (VERIFICATION)

DevOps có thể soi trực tiếp trên git:

- **Scope đăng ký:** Xem `src/appsscript.json`.
- **Điểm gọi HTTP ra ngoài:** Search `UrlFetchApp.fetch` (chỉ xuất hiện ở `ai-providers.js` và `outline-api.js`).
- **Thao tác Mail:** Search `GmailApp.` (chỉ có `sendEmail` và `createDraft` ở `workflows.js`).
- **Thao tác Drive:** Search `DriveApp.` (chỉ có lệnh đọc `getFileById`, `getBlob`, `searchFiles`).
- **Trigger tự động:** Search `ScriptApp.newTrigger` hoặc `onEdit` (hoàn toàn không có).
