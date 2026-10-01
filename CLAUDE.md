# GOOGLE APPS SCRIPT ONBOARDING EMAIL AUTOMATION - SYSTEM ARCHITECTURE & AGENT INSTRUCTIONS

Bạn là một Chuyên gia Lập trình Google Apps Script (GAS) cao cấp đảm nhận vai trò Lead Developer cho dự án này. Hãy đọc kỹ toàn bộ bối cảnh dự án, các tính năng đã thực thi bên dưới để tiến hành review, tối ưu và nâng cấp hệ thống khi nhận yêu cầu.

> 📌 **Lưu ý cho Agent:** Mọi kế hoạch refactor dài hạn nằm ở `docs/refactor-plan.md`. Tài liệu này mô tả **trạng thái hiện tại** của codebase (đã cập nhật 2026-09-30).

---

## 1. TÓM TẮT DỰ ÁN & KIẾN TRÚC HIỆN TẠI

Hệ thống tự động hóa Onboarding Email Automation cho Kyanon Digital chạy trên Google Sheets thông qua Google Apps Script (phát triển local với `clasp`).

**Flow chính:** Người dùng chọn 1 dòng dữ liệu nhân sự trên Sheet → chạy Custom Menu → hệ thống đọc/normalize dòng đó → validate → confirm → tạo Gmail Draft (hoặc gửi trực tiếp) → ghi log vào tab sheet.

**Luồng điều phối KHÔNG dùng onEdit** — toàn bộ thao tác chạy qua Custom Menu (các cột checkbox tự động đã bị gỡ khỏi sheet).

### 1.1. Cây file & trách nhiệm từng module

> ⚠️ **GAS namespace:** chia subdirectory không tạo module riêng — mọi hàm vẫn là global. File chỉ là cách tổ chức code; không import chéo trực tiếp giữa các module nghiệp vụ.

```
src/
├── appsscript.json        # Manifest: V8, timezone Asia/Ho_Chi_Minh, OAuth scopes
├── main.js                # CONTROLLER: onOpen (menu) + WORKFLOW_REGISTRY + executeWorkflowRunner
│                          #   (PHẢI nằm ở gốc src/ — menu bind theo tên hàm)
├── core/                  # Không phụ thuộc nghiệp vụ, dùng chung bởi mọi module
│   ├── config.js          #   CONFIG (RECIPIENTS, GUIDE_PDF_MAP, OFFICE_ADDRESS, OUTLINE, GEMINI,
│   │                      #   PHOTO_UPLOAD, LOG) + COLS
│   ├── utils.js           #   Pure helpers + Sheet helpers + Template/Drive helpers
│   └── ui-feedback.js     #   WorkflowError + notifySuccess/notifyWarning/notifyError/confirmAction
│                          #   (điểm DUY NHẤT gọi getUi() ngoài main.js + recruitment)
├── onboarding/            # Module 1: Onboarding Email Automation
│   ├── normalize-input.js #   getNormalizedInput: sheet row -> JSON payload chuẩn
│   ├── workflows.js       #   3 hàm handle*Workflow: return {ok, message,...} / throw WorkflowError
│   ├── email-templates.js #   5 hàm get*EmailTemplate -> { subject, htmlBody }
│   ├── email-templates/   #   5 file .html
│   └── logger.js          #   appendWorkflowLog + 3 hàm log*Workflow -> tab sheet
├── recruitment/           # Module 2: AI Recruitment — Welcome Onboard Generator
│   ├── sidebar.js         #   CONTROLLER: các hàm public bind qua google.script.run/menu
│   │                      #   (showSidebar, getSelectedCandidate, summarizeCvToIntro,
│   │                      #   submitIntroductionPost) — KHÔNG ĐỔI TÊN
│   ├── outline-api.js     #   Outline client: documents.create, attachments.create
│   │                      #   (presigned S3 upload ảnh), buildWelcomePostMarkdown
│   ├── cv-reader.js       #   Đọc & trích text CV: PDF (inline base64), DOCX (unzip XML),
│   │                      #   GDoc (DocumentApp), TXT; tìm file Drive theo link/tên
│   ├── ai-providers.js    #   Lời gọi AI: provider chain CONFIG.AI_PROVIDERS (openrouter →
│   │                      #   gemini), xoay vòng key + retry backoff khi 429, model fallback
│   └── welcome-onboard.html # Sidebar UI (tên file PHẢI là welcome-onboard.html —
│                           #   trùng tên remote với sidebar.js sẽ gây lỗi clasp push)
└── legacy/
    └── custom-functions.js # @customfunction cho sheet formula (specificDays, convertVn2...)
```

**Quy tắc phụ thuộc:** `main.js -> onboarding/* -> core/*`; `recruitment/* -> core/*`; 2 module nghiệp vụ KHÔNG import chéo; `core` không biết đến module nghiệp vụ.

### 1.2. Chi tiết từng module

- **`main.js`**:
  - `onOpen()`: tạo 2 menu — "🚀 Hera Onboarding Tools" (3 luồng email) và "🚀 AI Recruitment" (stub).
  - `WORKFLOW_REGISTRY`: map `triggerType -> { label, validate(data, ui), run(data) }`. Thêm luồng mới = 1 entry registry + 1 menu item.
  - `executeWorkflowRunner(triggerType)`: chọn dòng → `getNormalizedInput` → validate → confirm (`ui.alert` YES_NO) → `workflow.run(data)`. Tất cả bọc try/catch, lỗi hiển thị alert.
  - `validateRequiredField(value, fieldLabel, ui)`: helper alert khi thiếu field bắt buộc.

- **`config.js`**:
  - `CONFIG.RECIPIENTS`: email cố định DevOps / HR / IT / PEOPLE_TEAM.
  - `CONFIG.GUIDE_PDF_MAP`: Drive File ID PDF hướng dẫn, key = `${employmentType}_${location}` (intern_danang, intern_hcm, probation_danang, probation_hcm).
  - `CONFIG.OFFICE_ADDRESS`: địa chỉ văn phòng (DEFAULT / DANANG / HOA_CAU) dùng trong Welcome Email.
  - `CONFIG.LOG`: tên tab + headers của 3 tab log (INTERNAL / TA_NOTIFICATION / CANDIDATE).
  - `COLS`: từ điển cột, key = `normalizeHeaderKey(<header trên sheet>)` — tự khớp dù header có `\n`/thừa khoảng trắng.

- **`utils.js`** (pure, không phụ thuộc nghiệp vụ):
  - Chuỗi: `clean()` (NFC + lowercase + trim + gọn khoảng trắng — LUÔN dùng cho chuỗi so sánh), `removeAccents()`, `toTitleCase()`, `normalizeHeaderKey()`, `formatKyanonEmail()` (tự thêm `@kyanon.digital`), `toEmailUsername()`, `formatDateValue()` (dd/MM/yyyy), `isStandardDevice()`.
  - Sheet: `getHeaderColumnMap(sheet)` -> `{ normalizedKey: columnIndex (1-based) }`.
  - Template/Drive: `renderHtmlTemplate(name, data)` (HtmlService, file nằm trong `email-templates/`), `getGuidePdfFileInfo(employmentType, onboardingType, customFileName)` -> `{ pdfBlob, fileId }` | null (đổi tên blob, KHÔNG đổi tên file gốc trên Drive).

- **`normalize-input.js`**:
  - `getNormalizedInput(triggerType = "MANUAL_TEST", targetRow = null)`: đọc dòng 1 (headers) + dòng được chọn, trả về JSON payload chuẩn (xem mục 2).
  - `testNormalizeOutput()`: hàm test thủ công, chọn sheet "New" dòng 3.

- **`workflows.js`** (mỗi hàm nhận `data` payload, kết thúc bằng `ui.alert` kết quả):
  - `handleOfferAcceptedWorkflow(data)`: tạo draft DevOps + HR, thêm draft IT nếu `isStandardDevice(data.deviceRequest)`. Ghi `logInternalWorkflow`.
  - `handleTaNotificationWorkflow(data)`: gửi mail TRỰC TIẾP (`GmailApp.sendEmail`) cho TA In Charge; nội dung email thay đổi theo tiến độ (có OKR folder / có allocCode). Ghi `logTaNotificationWorkflow`.
  - `handleWelcomeEmailWorkflow(data)`: lấy PDF theo GUIDE_PDF_MAP + đổi tên blob, tạo draft cho ứng viên (ưu tiên `workingEmail`, fallback `personalEmail`), CC TA + Manager + People Team. Ghi `logCandidateWorkflow`.

- **`email-templates.js`**:
  - `buildTemplatePayload(data, extra)`: payload chung (thêm `positionTitle`, `squadTitle` đã title-case).
  - 5 hàm trả `{ subject, htmlBody }`: `getDevOpsEmailTemplate`, `getHREmailTemplate`, `getITEmailTemplate`, `getTaNotificationEmailTemplate` (subject đổi theo tiến độ OKR/Email), `getWelcomeCandidateEmailTemplate(data, guidePreviewUrl)` (office address theo `CONFIG.OFFICE_ADDRESS`).

- **`logger.js`**:
  - `appendWorkflowLog(config, values)`: generic writer, tự tạo tab + header nếu chưa có; fail-safe (lỗi log không crash workflow).
  - `logInternalWorkflow(data, drafts)` / `logTaNotificationWorkflow(data, sentTo)` / `logCandidateWorkflow(data, draftId)`.

- **`legacy/custom-functions.js`** — các hàm `@customfunction` dùng trực tiếp trong công thức sheet, **KHÔNG ĐƯỢC ĐỔI TÊN**: `specificDays(dayName, monthName, year)`, `removeAccent(text)`, `convertVn2FirstLastName(text, removeAccentFlag)`, `convertVn2FirstFullname(text, removeAccentFlag)`, `convertFName2EmailAddress(text)`.

- **`recruitment/`** — module AI Recruitment, sidebar "Welcome Onboard Generator" (mở từ menu "🚀 AI Recruitment"). Tách 4 file JS theo trách nhiệm (GAS global namespace nên không import — chỉ quy ước tổ chức):

  - **`sidebar.js`** (controller mỏng, chỉ hàm public — KHÔNG ĐỔI TÊN vì bind theo string):
    - `showSidebar()`: menu entry.
    - `getSelectedCandidate()`: đọc dòng đang chọn qua `getHeaderColumnMap` (fullName, title, squad, lineManager, dateOfOnboard, cvUrl...). Cột CV đọc 3 lớp: rich-text link URL → formula HYPERLINK() → display value.
    - `summarizeCvToIntro(formData)`: đọc CV → AI → trả Introduction.
    - `submitIntroductionPost(formData)`: upload ảnh (nếu có) + build markdown + tạo draft Outline.
  - **`outline-api.js`**: `getOutlineApiToken_` (Script Property `OUTLINE_API_TOKEN`), `buildWelcomePostMarkdown` (First working day / Job Title / Line Manager / Introduction), `callOutlineCreateDocument_` (documents.create, publish:false → Drafts cá nhân), `uploadCandidatePhoto` (attachments.create presigned S3 — form fields trước, file CUỐI, không auth header; tự dựng multipart vì UrlFetchApp không có FormData).
  - **`cv-reader.js`**: `readCvContent_` — ưu tiên file upload từ máy (blob trong bộ nhớ), fallback link/tên file cột CV (`extractDriveFileId_`, `findDriveFileIdByName_`). Trả `{kind: "pdf_inline", pdfBase64, fileName}` cho PDF hoặc `{kind: "text", text}` cho DOCX (unzip word/document.xml + strip XML — phải ép ContentType application/zip), GDoc (DocumentApp), TXT. .doc cũ bị từ chối với hướng dẫn rõ ràng.
  - **`ai-providers.js`**: `callGeminiSummarizeCv_` — duyệt `CONFIG.AI_PROVIDERS` theo thứ tự (mặc định `"openrouter"` → `"gemini"`), provider lỗi thì chuyển kế. Mỗi provider: xoay vòng API key (property chính + `_2..10`, hoặc 1 property nhiều key cách phẩy) + retry backoff `RETRY_DELAYS_MS` khi 429 + chuyển model trong MODELS khi lỗi khác. OpenRouter: OpenAI-compatible `/chat/completions`, PDF dạng `file` content part (base64 data URL). Gemini: `generateContent`, PDF dạng `inline_data` (Gemini 3.x KHÔNG nhận temperature/top_p/top_k).
  - **Ảnh ứng viên:** ô upload trong sidebar (≤ `CONFIG.PHOTO_UPLOAD.MAX_SIZE_MB`, base64) → `uploadCandidatePhoto()` (outline-api.js) upload THẲNG vào Outline qua `attachments.create` (presigned S3 POST) → embed URL `attachments.redirect?id=` lên đầu bài markdown. KHÔNG dùng Drive — domain Workspace chặn share anyone-with-link nên ảnh trên Drive không render được trong Outline.
  - **AI tóm tắt CV:** `summarizeCvToIntro()` (sidebar.js) → `readCvContent_` (cv-reader.js) → `callGeminiSummarizeCv_` (ai-providers.js) duyệt provider chain openrouter → gemini. Prompt tiếng Anh theo style bài mẫu, chỉ dùng facts từ CV.
  - **Script Properties (Apps Script → Project Settings):** `OUTLINE_API_TOKEN` (token Outline dạng `ol_api_...`); `OPENROUTER_API_KEY` (https://openrouter.ai/settings/keys, ưu tiên) và/hoặc `GEMINI_API_KEY` (https://aistudio.google.com/apikey, dự phòng) — đều hỗ trợ nhiều key xoay vòng. KHÔNG hardcode.
  - **OAuth scopes:** `drive` (full — cần để createFile upload ảnh + temp CV) và `documents` (DocumentApp đọc text GDoc) đã thêm vào `appsscript.json`; khi push lần đầu user sẽ được yêu cầu re-authorize.
- **`core/ui-feedback.js`**: class `WorkflowError(code, userMessage, details)` + `notifySuccess/notifyWarning/notifyError/confirmAction`. Workflow chỉ return kết quả / throw WorkflowError; main.js gọi các hàm này để hiển thị (Phase 1).

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

---

## 3. NGUYÊN TẮC CẦN TUÂN THỦ KHI MỞ RỘNG VÀ REFACTOR CODE (INSTRUCTIONS FOR AGENT)

1. **Tuân thủ phân tách trách nhiệm (Separation of Concerns):** Không viết logic nghiệp vụ vào `main.js` — controller chỉ điều phối qua `WORKFLOW_REGISTRY`. Helper chuỗi/sheet vào `utils.js`, cấu hình vào `config.js`, template vào `email-templates.js`, workflow vào `workflows.js`.
2. **Defensive Programming:** Luôn dùng `clean()` cho chuỗi so sánh; bọc thao tác gọi dịch vụ ngoài (DriveApp, GmailApp) trong `try...catch`; log phải fail-safe.
3. **Không phá contract hiện có:** Không đổi tên `onOpen`, các hàm `menu*`, các `handle*Workflow`, các `get*EmailTemplate`, và các `@customfunction` trong `legacy-utils.js` (menu/formula bind theo string tên hàm).
4. **Không tái引入 onEdit:** các cột checkbox trigger đã bị gỡ khỏi sheet; flow hiện tại 100% qua Custom Menu.
5. **UI Feedback:** các luồng onboarding báo kết quả qua `core/ui-feedback.js`; sidebar recruitment tự quản UI qua google.script.run (return `{ok, ...}`/`{ok:false, error}`).
6. **Khi thêm module mới** (vd AI Recruitment): đặt file trong thư mục riêng (`src/recruitment/`), KHÔNG import chéo với `onboarding`, tái dùng `utils.js`/`config.js`. Chi tiết kiến trúc đích: mục 2 của `docs/refactor-plan.md`.
