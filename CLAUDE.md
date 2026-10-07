# GOOGLE APPS SCRIPT ONBOARDING EMAIL AUTOMATION - SYSTEM ARCHITECTURE & AGENT INSTRUCTIONS

Bạn là một Chuyên gia Lập trình Google Apps Script (GAS) cao cấp đảm nhận vai trò Lead Developer cho dự án này. Hãy đọc kỹ toàn bộ bối cảnh dự án, các tính năng đã thực thi bên dưới để tiến hành review, tối ưu và nâng cấp hệ thống khi nhận yêu cầu.

> 📌 **Lưu ý cho Agent:** Mọi kế hoạch refactor dài hạn nằm ở `docs/refactor-plan.md`. Tài liệu này mô tả **trạng thái hiện tại** của codebase (đã cập nhật 2026-10-07).

---

## 1. TÓM TẮT DỰ ÁN & KIẾN TRÚC HIỆN TẠI

Hệ thống tự động hóa Onboarding cho Kyanon Digital ("Hera Onboarding Tools") chạy trên Google Sheets thông qua Google Apps Script (phát triển local với `clasp`, rootDir `./src`).

Hệ thống gồm **2 module nghiệp vụ**:

1. **Onboarding Email Automation** — 3 luồng email từ Custom Menu: chọn 1 dòng nhân sự trên Sheet → normalize → validate → confirm → gửi trực tiếp / tạo Gmail Draft → ghi log vào tab sheet riêng (kèm cột Error Details).
2. **AI Recruitment** — sidebar "Welcome Onboard Generator": đọc dòng đang chọn, editor Canvas ghép ảnh Welcome Card, AI tóm tắt CV thành Introduction, tạo draft bài chào mừng trên Outline Wiki.

**Luồng điều phối KHÔNG dùng onEdit** — toàn bộ thao tác chạy qua Custom Menu / sidebar (các cột checkbox tự động đã bị gỡ khỏi sheet).

**Người nhận email nội bộ KHÔNG hardcode** — đọc động từ sheet cấu hình "Data" (cột `Role | Send to | CC`), tra theo role qua `getRecipientsByRole()`.

### 1.1. Cây file & trách nhiệm từng module

> ⚠️ **GAS namespace:** chia subdirectory không tạo module riêng — mọi hàm vẫn là global. File chỉ là cách tổ chức code; không import chéo trực tiếp giữa các module nghiệp vụ.

```
src/
├── appsscript.json        # Manifest: V8, timezone Asia/Ho_Chi_Minh, OAuth scopes
│                          #   (đã thu hẹp tối thiểu: spreadsheets.currentonly,
│                          #   gmail.compose, gmail.send, drive.readonly,
│                          #   documents.readonly, userinfo.email,
│                          #   script.container.ui, script.external_request)
├── main.js                # CONTROLLER: onOpen (menu) + WORKFLOW_REGISTRY + executeWorkflowRunner
│                          #   (PHẢI nằm ở gốc src/ — menu bind theo tên hàm)
├── core/                  # Không phụ thuộc nghiệp vụ, dùng chung bởi mọi module
│   ├── config.js          #   CONFIG (DATA_SHEET_NAME, RECIPIENT_ROLES, GUIDE_PDF_MAP,
│   │                      #   OFFICE_ADDRESS, OUTLINE, AI_PROVIDERS, OPENROUTER,
│   │                      #   GEMINI, LOG) + COLS
│   ├── utils.js           #   Pure helpers + Sheet helpers + Recipient helpers (sheet Data)
│   │                      #   + Template/Drive helpers
│   └── ui-feedback.js     #   WorkflowError + notifySuccess/notifyWarning/notifyError/confirmAction
│                          #   (điểm DUY NHẤT gọi getUi() ngoài main.js + recruitment)
├── onboarding/            # Module 1: Onboarding Email Automation
│   ├── normalize-input.js #   getNormalizedInput: sheet row -> JSON payload chuẩn
│   ├── workflows.js       #   3 hàm handle*Workflow: return {ok, message,...} / throw WorkflowError
│   ├── email-templates.js #   5 hàm get*EmailTemplate -> { subject, htmlBody }
│   ├── email-templates/   #   5 file .html (devops, hr, it, ta-notification, welcome-candidate)
│   └── logger.js          #   appendWorkflowLog + 3 hàm log*Workflow -> tab sheet
├── recruitment/           # Module 2: AI Recruitment — Welcome Onboard Generator
│   ├── sidebar.js         #   CONTROLLER: các hàm public bind qua google.script.run/menu
│   │                      #   (showSidebar, getSelectedCandidate, summarizeCvToIntro,
│   │                      #   submitIntroductionPost) — KHÔNG ĐỔI TÊN
│   ├── outline-api.js     #   Outline client: promptSetupOutlineToken (lưu token cá nhân vào
│   │                      #   UserProperties), getOutlineApiToken_, buildWelcomePostMarkdown,
│   │                      #   callOutlineCreateDocument_ (documents.create, publish:false)
│   ├── cv-reader.js       #   Đọc & trích text CV: PDF (inline base64), DOCX (unzip XML),
│   │                      #   GDoc (DocumentApp), TXT; tìm file Drive theo link/tên
│   ├── ai-providers.js    #   Lời gọi AI: provider chain CONFIG.AI_PROVIDERS (openrouter →
│   │                      #   gemini), xoay vòng key + retry backoff khi 429, model fallback
│   ├── image-loader.js    #   getDriveFileBase64(urlOrId) — helper đọc file Drive thành base64
│   │                      #   (hiện CHƯA được luồng nào tham chiếu, để dự phòng)
│   └── welcome-onboard.html # Sidebar UI: card thông tin + Canvas Welcome Card editor +
│                           #   upload CV + AI summarize + submit Outline
└── legacy/
    └── custom-functions.js # @customfunction cho sheet formula (specificDays, convertVn2...)
```

**Quy tắc phụ thuộc:** `main.js -> onboarding/* -> core/*`; `recruitment/* -> core/*`; 2 module nghiệp vụ KHÔNG import chéo; `core` không biết đến module nghiệp vụ.

### 1.2. Chi tiết từng module

- **`main.js`**:
  - `onOpen()`: tạo 2 menu:
    - "🚀 Hera Onboarding Tools": (1) Tạo Draft Welcome Email, (2) Gửi Email Offer Accepted (DevOps / HR / IT), (3) Gửi Notification cho TA.
    - "🚀 AI Recruitment": (1) Mở AI Introduction Generator (`showSidebar`), (2) Cài đặt Outline API Token cá nhân (`promptSetupOutlineToken`).
  - `WORKFLOW_REGISTRY`: map `triggerType -> { label, validate(data), run(data) }`. Thêm luồng mới = 1 entry registry + 1 menu item.
  - `executeWorkflowRunner(triggerType)`: chọn dòng → `getNormalizedInput` → validate → confirm (`ui.alert` YES_NO) → `workflow.run(data)`. Bọc try/catch; `WorkflowError` hiển thị `userMessage`, lỗi hệ thống hiển thị raw + Logger.log.
  - `validateRequiredField(value, fieldLabel)`: helper trả message khi thiếu field bắt buộc (WELCOME_EMAIL cần `allocCode`, TA_NOTIFICATION cần `taEmail`).

- **`config.js`**:
  - `CONFIG.DATA_SHEET_NAME = "Data"` + `CONFIG.RECIPIENT_ROLES`: tra recipients động trong sheet "Data" theo role — `DevOps` / `HR: "OKR"` / `IT: "IT Support"` / `PEOPLE_TEAM: "People Team"` (⚠️ đã thay thế `CONFIG.RECIPIENTS` email cố định cũ).
  - `CONFIG.GUIDE_PDF_MAP`: Drive File ID PDF hướng dẫn, key = `${employmentType}_${location}` (intern_danang, intern_hcm, probation_danang, probation_hcm).
  - `CONFIG.OFFICE_ADDRESS`: địa chỉ văn phòng (DEFAULT / DANANG / HOA_CAU) dùng trong Welcome Email.
  - `CONFIG.OUTLINE`: BASE_URL + PUBLISH (false = draft cá nhân).
  - `CONFIG.AI_PROVIDERS = ["openrouter", "gemini"]`; `CONFIG.OPENROUTER.MODELS = ["google/gemini-2.5-flash"]`; `CONFIG.GEMINI.MODELS = ["gemini-flash-latest", "gemini-2.5-flash", "gemini-3.8-flash", "gemini-3.7-flash"]`, `RETRY_DELAYS_MS = [2000, 5000]`.
  - `CONFIG.LOG`: tên tab + headers của 3 tab log (INTERNAL / TA_NOTIFICATION / CANDIDATE) — **mỗi log đều có cột "Error Details"**.
  - `COLS`: từ điển cột, key = `normalizeHeaderKey(<header trên sheet>)` — tự khớp dù header có `\n`/thừa khoảng trắng.

- **`utils.js`** (pure, không phụ thuộc nghiệp vụ):
  - Chuỗi: `clean()` (NFC + lowercase + trim + gọn khoảng trắng — LUÔN dùng cho chuỗi so sánh), `removeAccents()`, `toTitleCase()`, `normalizeHeaderKey()`, `formatKyanonEmail()` (tự thêm `@kyanon.digital`), `toEmailUsername()`, `formatDateValue()` (dd/MM/yyyy), `isStandardDevice()`.
  - Recipients (sheet Data): `getEmailList_(raw)` (tách ô thành list email theo `,`/`;`/xuống dòng, tự thêm đuôi Kyanon), `getRecipientsMap()` (tìm động dòng header chứa "Role" — quét tối đa 20 dòng đầu), `getRecipientsByRole(roleName) -> { to: [], cc: [] }`.
  - Sheet: `getHeaderColumnMap(sheet)` -> `{ normalizedKey: columnIndex (1-based) }`.
  - Template/Drive: `renderHtmlTemplate(name, data)` (HtmlService, path đầy đủ `onboarding/email-templates/<name>`), `getGuidePdfFileInfo(employmentType, onboardingType, customFileName)` -> `{ pdfBlob, fileId }` | null (đổi tên blob, KHÔNG đổi tên file gốc trên Drive).

- **`normalize-input.js`**:
  - `getNormalizedInput(triggerType = "MANUAL_TEST", targetRow = null)`: đọc dòng 1 (headers) + dòng được chọn, trả về JSON payload chuẩn (xem mục 2).
  - `testNormalizeOutput()`: hàm test thủ công, chọn sheet "New" dòng 3.

- **`workflows.js`** (mỗi hàm nhận `data` payload, return kết quả thuần — KHÔNG gọi getUi):
  - `handleOfferAcceptedWorkflow(data)`: **gửi TRỰC TIẾP** (không tạo draft) cho DevOps → HR (role "OKR") → IT (chỉ khi `isStandardDevice(data.deviceRequest)`); mỗi role có To + CC đọc từ sheet Data. Lỗi mail nào thì dừng, ghi log FAILED kèm error detail rồi throw `WorkflowError("SEND_FAILED", ...)`. Ghi `logInternalWorkflow` (1 dòng log cho mỗi mail đã gửi).
  - `handleTaNotificationWorkflow(data)`: gửi mail TRỰC TIẾP cho TA In Charge; nội dung email đổi theo tiến độ (4 nhánh: cả OKR + Email / chỉ OKR folder / chỉ Working Email / cập nhật chung). Ghi `logTaNotificationWorkflow`.
  - `handleWelcomeEmailWorkflow(data)`: lấy PDF theo GUIDE_PDF_MAP + đổi tên blob, **tạo draft** cho ứng viên (ưu tiên `workingEmail`, fallback `personalEmail`), CC = TA In Charge + People Team (to + cc từ sheet Data). Ghi `logCandidateWorkflow` (lưu Draft ID).

- **`email-templates.js`**:
  - `buildTemplatePayload(data, extra)`: payload chung (thêm `positionTitle`, `squadTitle` đã title-case).
  - 5 hàm trả `{ subject, htmlBody }`: `getDevOpsEmailTemplate`, `getHREmailTemplate`, `getITEmailTemplate`, `getTaNotificationEmailTemplate` (subject + status message theo 4 nhánh tiến độ), `getWelcomeCandidateEmailTemplate(data, guidePreviewUrl)` (office address theo `CONFIG.OFFICE_ADDRESS`; subject ghép `<Chức danh>_<Squad>`).

- **`logger.js`**:
  - `getOrCreateLogSheet` / `appendWorkflowLog(config, values)`: generic writer, tự tạo tab + header (bold, freeze dòng 1) nếu chưa có; fail-safe (lỗi log không crash workflow).
  - `logInternalWorkflow(data, sentEmails, status, errorDetail)` / `logTaNotificationWorkflow(data, sentTo, status, errorDetail)` / `logCandidateWorkflow(data, draftId, status, errorDetail)` — status: `EMAIL_SENT` / `DRAFT_CREATED` / `FAILED`, kèm chuỗi error detail.

- **`legacy/custom-functions.js`** — các hàm `@customfunction` dùng trực tiếp trong công thức sheet, **KHÔNG ĐƯỢC ĐỔI TÊN**: `specificDays(dayName, monthName, year)`, `removeAccent(text)`, `convertVn2FirstLastName(text, removeAccentFlag)`, `convertVn2FirstFullname(text, removeAccentFlag)`, `convertFName2EmailAddress(text)`.

- **`recruitment/`** — module AI Recruitment, sidebar "Welcome Onboard Generator" (mở từ menu "🚀 AI Recruitment"). Tách file theo trách nhiệm (GAS global namespace nên không import — chỉ quy ước tổ chức):

  - **`sidebar.js`** (controller mỏng, chỉ hàm public — KHÔNG ĐỔI TÊN vì bind theo string):
    - `showSidebar()`: menu entry, mở `recruitment/welcome-onboard.html` (width 420).
    - `getSelectedCandidate()`: đọc dòng đang chọn qua `getHeaderColumnMap` (fullName, title, squad, lineManager, dateOfOnboard, workingEmail từ Alloc Code, phoneNumber, cvUrl...). Cột CV đọc 3 lớp: rich-text link URL → formula HYPERLINK() → display value.
    - `summarizeCvToIntro(formData)`: đọc CV (upload hoặc cột CV) → AI → trả Introduction.
    - `submitIntroductionPost(formData)`: build markdown + tạo draft Outline (ảnh KHÔNG upload qua Outline API).
  - **`welcome-onboard.html`** — UI sidebar gồm 4 section:
    1. Card thông tin ứng viên (tự fill từ dòng đang chọn).
    2. **Canvas Welcome Card editor** (1000×1000): upload ảnh ứng viên từ máy + upload khung template tùy chỉnh (mặc định là placeholder URL `.ttf` — sẽ fail load và vẽ fallback nền đỏ `#C8102E`; thay bằng link PNG khung thật khi có); slider Zoom / Trái-Phải / Lên-Xuống (`renderCanvas()`); avatar cắt tròn ở tâm (500,445) r=230; tự vẽ đè dải đen bo tròn + tên dạng "TÊN HỌ" in hoa (`formatShortName` — client-side, đảo Tên-Họ + bỏ dấu), position, squad lấy từ sheet; nút `downloadImage()` tải JPG (quality 0.95, tên `Welcome_<FullName>.jpg`) về máy — sau đó người dùng tự kéo ảnh vào draft Outline.
    3. CV cho AI: hiển thị link CV trên sheet + nút upload CV khác từ máy (giới hạn 10MB, gửi base64 qua `google.script.run`).
    4. Introduction textarea + nút Submit tạo draft Outline.
  - **`outline-api.js`**:
    - `promptSetupOutlineToken()`: menu entry — popup `ui.prompt` nhập token Outline cá nhân, lưu vào **UserProperties** (`OUTLINE_API_TOKEN`) của từng tài khoản Google; hiển thị token cũ dạng masked.
    - `getOutlineApiToken_()`: đọc token từ UserProperties (ưu tiên 1); thiếu thì throw Error hướng dẫn vào menu cài đặt.
    - `buildWelcomePostMarkdown(candidate, introduction)`: title `Welcome Onboard: <fullName>` + First working day / Job Title / Line Manager / Introduction / dòng footer Squad | Employment Type | Level.
    - `callOutlineCreateDocument_(title, text)`: `documents.create` với `publish: CONFIG.OUTLINE.PUBLISH === false` → Drafts cá nhân của tài khoản token ( KHÔNG còn `attachments.create` / upload S3).
  - **`cv-reader.js`**: `readCvContent_` — ưu tiên file upload từ máy (blob trong bộ nhớ, KHÔNG tạo file Drive tạm), fallback link/tên file cột CV (`extractDriveFileId_`, `findDriveFileIdByName_`). Trả `{kind: "pdf_inline", pdfBase64, fileName}` cho PDF hoặc `{kind: "text", text}` cho DOCX (unzip word/document.xml + strip XML — phải ép ContentType application/zip), GDoc (DocumentApp), TXT. .doc cũ bị từ chối với hướng dẫn rõ ràng.
  - **`ai-providers.js`**: `callGeminiSummarizeCv_` — duyệt `CONFIG.AI_PROVIDERS` theo thứ tự (mặc định `"openrouter"` → `"gemini"`), provider lỗi thì chuyển kế, lỗi tất cả thì throw Error gộp. `buildGeminiPrompt_`: prompt tiếng Anh few-shot theo style bài mẫu (phân biệt Senior/Intern), chỉ dùng facts từ CV. Mỗi provider: xoay vòng API key (property chính + `_2..10`, hoặc 1 property nhiều key cách phẩy) + retry backoff `RETRY_DELAYS_MS` khi 429 + chuyển model trong MODELS khi lỗi khác. OpenRouter: OpenAI-compatible `/chat/completions`, PDF dạng `file` content part (base64 data URL). Gemini: `generateContent`, PDF dạng `inline_data` (Gemini 3.x KHÔNG nhận temperature/top_p/top_k).
  - **`image-loader.js`**: `getDriveFileBase64(urlOrId)` — trích File ID từ link Drive, đọc blob, trả base64. Hiện chưa được luồng nào gọi (dự phòng).
  - **Script Properties (Apps Script → Project Settings):**
    - `OUTLINE_API_TOKEN`: giờ đây là **UserProperties per-user** — mỗi HR tự nhập qua menu "🚀 AI Recruitment → 2. Cài đặt Outline API Token cá nhân" (không dùng chung Script Property nữa).
    - `OPENROUTER_API_KEY` (https://openrouter.ai/settings/keys, ưu tiên) và/hoặc `GEMINI_API_KEY` (https://aistudio.google.com/apikey, dự phòng) — Script Properties, hỗ trợ nhiều key xoay vòng (`_2..10` hoặc phân cách phẩy). KHÔNG hardcode.
  - **OAuth scopes:** đã thu hẹp còn read-only tối thiểu (xem `appsscript.json`): `drive.readonly` (đọc CV/GUIDE_PDF), `documents.readonly` (DocumentApp đọc GDoc), `gmail.compose` + `gmail.send`, `spreadsheets.currentonly`, `script.container.ui`, `script.external_request` (UrlFetchApp gọi OpenRouter/Gemini/Outline), `userinfo.email`. CV upload từ máy được dựng blob trong bộ nhớ nên không cần scope write Drive.
- **`core/ui-feedback.js`**: class `WorkflowError(code, userMessage, details)` + `notifySuccess/notifyWarning/notifyError/confirmAction`. Workflow chỉ return kết quả / throw WorkflowError; main.js gọi các hàm này để hiển thị (Phase 1 của refactor-plan).

---

## 2. CHUẨN PAYLOAD JSON ĐẦU VÀO (`getNormalizedInput`)

```json
{
  "triggerType": "OFFER_ACCEPTED",
  "rowNumber": 3,
  "rowLink": "https://docs.google.com/spreadsheets/d/...#gid=...&range=3:3",
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
  "okrFolderUrl": "https://drive.google.com/...",
  "taEmail": "my.tran@kyanon.digital",
  "managerEmail": "hau.nt@kyanon.digital",
  "currentUserEmail": "quang.nguyenminh@kyanon.digital"
}
```

**Sheet cấu hình "Data"** (nguồn recipients động cho module onboarding): các cột `Role | Send to | CC`; mỗi ô Send to/CC có thể chứa nhiều Alloc Code/email cách nhau `,` `;` hoặc xuống dòng. Role hiện có: `DevOps`, `OKR` (HR), `IT Support`, `People Team`.

---

## 3. NGUYÊN TẮC CẦN TUÂN THỦ KHI MỞ RỘNG VÀ REFACTOR CODE (INSTRUCTIONS FOR AGENT)

1. **Tuân thủ phân tách trách nhiệm (Separation of Concerns):** Không viết logic nghiệp vụ vào `main.js` — controller chỉ điều phối qua `WORKFLOW_REGISTRY`. Helper chuỗi/sheet vào `utils.js`, cấu hình vào `config.js`, template vào `email-templates.js`, workflow vào `workflows.js`.
2. **Defensive Programming:** Luôn dùng `clean()` cho chuỗi so sánh; bọc thao tác gọi dịch vụ ngoài (DriveApp, GmailApp, UrlFetchApp) trong `try...catch`; log phải fail-safe và ghi kèm error detail vào cột "Error Details".
3. **Không phá contract hiện có:** Không đổi tên `onOpen`, các hàm `menu*`, `showSidebar`, `promptSetupOutlineToken`, các `handle*Workflow`, các `get*EmailTemplate`, các hàm public của `recruitment/sidebar.js`, và các `@customfunction` trong `legacy/custom-functions.js` (menu/formula/google.script.run bind theo string tên hàm).
4. **Không tái引入 onEdit:** các cột checkbox trigger đã bị gỡ khỏi sheet; flow hiện tại 100% qua Custom Menu + sidebar.
5. **UI Feedback:** các luồng onboarding báo kết quả qua `core/ui-feedback.js`; sidebar recruitment tự quản UI qua google.script.run (return `{ok, ...}`/`{ok:false, error}`).
6. **Khi thêm module mới:** đặt file trong thư mục riêng (vd `src/<module>/`), KHÔNG import chéo với `onboarding`/`recruitment`, tái dùng `utils.js`/`config.js`. Chi tiết kiến trúc đích: mục 2 của `docs/refactor-plan.md`.
7. **Bảo mật credential:** không hardcode API key/token trong code — token Outline thuộc UserProperties (per-user), AI key thuộc Script Properties. Chỉ push `src/` (`.claspignore` đã chặn `CLAUDE.md`, `docs/`, `node_modules`...).
