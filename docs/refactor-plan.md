# REFACTOR PLAN — Hera Onboarding Tools (Google Apps Script)

> Ngày tạo: 2026-09-30
> Phạm vi: toàn bộ `src/` + cấu hình repo.
> Mục tiêu: dọn kiến trúc hiện tại để **dễ bảo trì**, **dễ scale** khi thêm module **AI Recruitment**, mà không phá các luồng email đang chạy.

---

## 1. ĐÁNH GIÁ CẤU TRÚC HIỆN TẠI

### 1.1. Hiện trạng

```
repo/
├── CLAUDE.md                  # Spec cho agent (ĐÃ LỆI THỜI — xem 1.3)
├── .clasp.json                # rootDir=./src, push cả subdirectory
├── .claspignore               # Đang thiếu nhiều pattern quan trọng
├── package.json               # Có typescript + @types nhưng KHÔNG dùng
├── src-backup/                # Backup thủ công, không nằm trong .gitignore
├── docs/                      # (thư mục này)
└── src/
    ├── appsscript.json        # Manifest (scopes, V8, timezone)
    ├── main.js                # Menu + Controller (WORKFLOW_REGISTRY)
    ├── config.js              # CONFIG + COLS
    ├── utils.js               # Pure helpers + Sheet helpers + Template/Drive helpers
    ├── normalize-input.js     # Sheet row -> JSON payload
    ├── workflows.js           # 3 luồng email (business logic)
    ├── email-templates.js     # Subject + payload -> render HTML
    ├── email-templates/       # 5 file .html
    ├── logger.js              # Ghi log vào tab sheet
    └── legacy-utils.js        # Custom functions cho sheet formula
```

### 1.2. Điểm đã ỔN (giữ nguyên)

| Điểm | Lý do |
|---|---|
| Tách lớp Controller → Data → Workflow → Template → Logger | Đúng Separation of Concerns, flow dữ liệu 1 chiều |
| `WORKFLOW_REGISTRY` trong `main.js` | Thêm luồng mới = 1 entry + 1 menu item, không sửa if-cascade |
| `COLS` tra cứu header qua `normalizeHeaderKey()` | Không vỡ khi header sheet đổi khoảng trắng/dấu xuống dòng |
| Log fail-safe + `try/catch` bọc service calls | Lỗi log không crash luồng chính |
| `email-templates/` là file .html riêng | Sửa email không đụng code JS |
| Custom functions tách riêng `legacy-utils.js` | Không phá formula đang có trên sheet |

### 1.3. Vấn đề (theo mức độ nghiêm trọng)

#### 🔴 Nghiêm trọng — sẽ gây sự cố khi scale

1. **Menu "AI Recruitment" trỏ tới `showSidebar` — hàm KHÔNG TỒN TẠI.**
   Click menu → lỗi `showSidebar is not defined` ngay trên tay người dùng. Cần stub ngay hoặc ẩn menu item.

2. **`CLAUDE.md` đã sai lệch hoàn toàn so với code.**
   Vẫn mô tả `getTriggerType(e)`/onEdit (đã xóa), `DRIVE_FILE_MAP` (đã đổi tên `GUIDE_PDF_MAP`), "Toast Popup" (thực tế là `ui.alert`), và bỏ sót `config.js`, `logger.js`, `legacy-utils.js`, `COLS`. Bất kỳ agent/dev nào đọc file này sẽ làm sai.

3. **UI feedback (`ui.alert`) trộn cứng trong business logic (`workflows.js`).**
   3 hàm `handle*Workflow` vừa tính toán vừa gọi `SpreadsheetApp.getUi()`. Hệ quả:
   - Không tái dùng được từ Sidebar/HTML Service, web app, hoặc trigger chạy nền (nơi KHÔNG có `getUi()` — sẽ throw).
   - Muốn đổi alert → toast/modal phải sửa cả 3 chỗ.
   Đây là rào cản số 1 cho module AI Recruitment (sidebar-based).

#### 🟠 Cần sửa trước khi thêm module mới

4. **`src/` phẳng — email automation và AI Recruitment (sắp tới) sẽ nằm lẫn nhau.**
   Khi `sidebar.html`, `ai-*.js` đổ vào, không còn ranh giới module; `utils.js` sẽ thành bãi đổ chung.

5. **Toàn bộ hàm là global (đặc thù GAS) + trùng tên gây nhiễu.**
   `removeAccent` (legacy) vs `removeAccents` (utils) — khác 1 chữ "s", hành vi gần giống. Chưa có convention đặt tên, dễ gọi nhầm.

6. **Không có test nào, kể cả cho pure helpers.**
   `clean()`, `removeAccents()`, `toTitleCase()`, logic cắt tên Việt, mapping PDF… đang chỉ có thể test thủ công bằng cách deploy rồi chạy thử trên sheet thật.

7. **`clasp push` không xóa file thừa trên remote** (đã xác minh với clasp 3.4.1).
   File remote mồ côi (`Code.js`, `sidebar.html` cũ…) tích tụ dần; chưa có quy trình dọn.

#### 🟡 Vệ sinh repo

8. `src-backup/` không nằm trong `.gitignore` — có nguy cơ commit rác.
9. `typescript` + `@types/google-apps-script` trong devDependencies nhưng không hề dùng (không `tsconfig`, không file `.ts`).
10. `.claspignore` thiếu `/src-backup`, `/docs`, `*.md` — hiện không gây hại vì rootDir=./src, nhưng là bẫy khi ai đó đổi rootDir.
11. Không có quy trình dev/prod: 1 scriptId duy nhất, push thẳng vào môi trường người dùng thật đang dùng.

---

## 2. KIẾN TRÚC ĐÍCH

### 2.1. Cây thư mục mục tiêu

```
src/
├── appsscript.json
├── main.js                        # ENTRY POINT: onOpen + menu (nhàm mỏng, chỉ gọi ra module khác)
│
├── core/                          # Không phụ thuộc nghiệp vụ — dùng chung bởi mọi module
│   ├── config.js                  # CONFIG + COLS
│   ├── utils.js                   # Pure helpers (string, email, date)
│   ├── sheet.js                   # Sheet helpers (getHeaderColumnMap, row reading)
│   └── ui-feedback.js             # MỚI: notify(alert/toast) — duy nhất 1 chỗ gọi getUi()
│
├── onboarding/                    # Module 1: Onboarding Email (hiện tại)
│   ├── normalize-input.js
│   ├── workflows.js               # Chỉ return kết quả, KHÔNG gọi getUi()
│   ├── email-templates.js
│   ├── email-templates/*.html
│   └── logger.js
│
├── recruitment/                   # Module 2: AI Recruitment (giữ chỗ, làm sau)
│   ├── sidebar.js                 # showSidebar + các hàm server-side cho sidebar
│   └── sidebar.html
│
└── legacy/
    └── custom-functions.js        # Custom functions cho sheet formula
```

**Ràng buộc GAS cần lưu ý khi chia thư mục:**
- File trong subdirectory được push với remote name gồm path (vd `core/utils`) — chạy bình thường vì V8 flat namespace, nhưng **không được đổi tên các hàm menu** trong `main.js` (menu bind theo tên hàm string).
- Chỉ `main.js` giữ hàm entry (`onOpen`, `menu*`); mọi logic khác import qua global scope như hiện tại.

### 2.2. Quy tắc phụ thuộc (bắt buộc tuân thủ)

```
main.js ──► onboarding/* ──► core/*
recruitment/* ──► core/*
onboarding ✗──✗ recruitment   (2 module KHÔNG import chéo nhau)
core ✗──✗ mọi module nghiệp vụ (core không được biết đến "onboarding")
```

- `core/ui-feedback.js` là **điểm duy nhất** được gọi `SpreadsheetApp.getUi()`.
- `onboarding/workflows.js` **return object** `{ ok, draftCount, details[] | error }`; tầng gọi (main/sidebar) quyết định hiển thị thế nào.
- Đặt tên hàm global theo prefix module: `onb*`, `rec*` cho hàm "public" của module; hàm private dùng hậu tố `_` hoặc camelCase thường và không gọi từ module khác.

---

## 3. CÁC PHASE THỰC HIỆN

> Mỗi phase độc lập, có tiêu chí nghiệm thu riêng, xong phase nào push phase đó. Thứ tự được thiết kế để **không bao giờ phá luồng email đang chạy**.

### Phase 0 — Vệ sinh & sửa sự cố hiện hữu (½ ngày)

| Việc | Chi tiết |
|---|---|
| Tạo stub `showSidebar` | `src/recruitment/sidebar.js` với `ui.alert("Sắp ra mắt")` — hết lỗi click menu |
| Cập nhật `CLAUDE.md` | Xóa toàn bộ mô tả onEdit/`getTriggerType`/`DRIVE_FILE_MAP`/toast; ghi đúng kiến trúc hiện tại + trỏ tới `docs/refactor-plan.md` |
| `.gitignore` | Thêm `src-backup/`, `*.log` |
| `.claspignore` | Thêm `/src-backup`, `/docs`, `*.md` (phòng khi đổi rootDir) |
| Quyết định TypeScript | Hoặc xóa `typescript`+`@types` khỏi package.json, **hoặc** (khuyến nghị) bật thật: `tsconfig.json` + đặt file `.ts` cạnh `.js` từ Phase 3 |
| Xóa `src-backup/` | Sau khi xác nhận không cần — lịch sử đã có trong git |

**Nghiệm thu:** click cả 3+1 menu item không còn exception nào; `CLAUDE.md` mô tả khớp code 100%.

### Phase 1 — Tách UI khỏi business logic (1 ngày)

*Chưa đổi cây thư mục — chỉ sửa bên trong, giảm rủi ro di chuyển file.*

1. Tạo `core/ui-feedback.js`: `notifySuccess(title, msg)`, `notifyError(title, msg)`, `confirmAction(title, msg)` — 1 chỗ duy nhất gọi `getUi()`.
2. Sửa 3 hàm `handle*Workflow`: thay mọi `SpreadsheetApp.getUi().alert(...)` bằng `return { ok: true, ... }` hoặc `throw new WorkflowError(code, message)` (class mới trong core).
3. `executeWorkflowRunner` trở thành nơi DUY NHẤN render alert từ kết quả.

**Nghiệm thu:** `grep -n "getUi()" src/` chỉ còn `main.js` + `core/ui-feedback.js`; luồng email chạy y như trước trên sheet thật.

### Phase 2 — Chia thư mục module (½ ngày)

1. Di chuyển file theo cây mục tiêu mục 2.1 (`git mv` để giữ history).
2. `main.js` chỉ còn `onOpen` + `menu*` + `executeWorkflowRunner` (runner có thể tách thành `core/workflow-runner.js`).
3. Chạy `clasp push`, test đủ 3 luồng + log.

**Nghiệm thu:** `clasp push` thành công không thiếu file; test thủ công 3 luồng OK; `clasp status` hiển thị đúng cây mới.

### Phase 3 — Test pure helpers (1 ngày)

1. Cài `vitest` (dev-only, không ảnh hưởng GAS).
2. Test các hàm thuần không phụ thuộc GAS API: `clean`, `removeAccents`, `toTitleCase`, `normalizeHeaderKey`, `formatKyanonEmail`, `toEmailUsername`, và các custom functions trong `legacy/` (`convertVn2FirstLastName` với tên 1 từ/2 từ/3 từ, `specificDays` tháng 2 năm nhuận…).
3. Tách "phần thuần có thể test" ra khỏi phần gọi GAS: ví dụ rút `parseVietnameseName(fullName) -> {formattedName, accentlessFullName}` thuần từ `normalize-input.js`.

**Nghiệm thu:** `npm test` xanh; các case biên tên Việt (có/không dấu, 1 từ, nhiều khoảng trắng) được khóa bằng test.

### Phase 4 — Đồng bộ remote & quy trình deploy (½ ngày)

1. Script `scripts/sync-remote.js`: gọi Apps Script API `projects.updateContent` với đúng file list local → xóa file mồ côi trên remote (bù lỗ hổng `clasp push`). Chạy thủ công, in diff trước khi thực hiện.
2. Tách `.clasp.json.dev` / `.clasp.json.prod` (2 scriptId) + alias npm script `push:dev`, `push:prod`.
3. Quy ước version: tạo `clasp version` trước mỗi lần người dùng bắt đầu dùng luồng mới; rollout ghi vào `docs/changelog.md`.

**Nghiệm thu:** xóa 1 file local → chạy sync script → editor Apps Script không còn file đó; dev/prod push đúng scriptId.

### Phase 5 — Module AI Recruitment (theo roadmap riêng)

1. `recruitment/sidebar.js` + `sidebar.html` thật: sidebar gọi các hàm server qua `google.script.run`, tái dùng `core/ui-feedback.js` cho kết quả.
2. Nếu AI Recruitment cần đọc cùng sheet nhân sự → tái dùng `core/sheet.js` + `onboarding/normalize-input.js` **thông qua 1 facade duy nhất** (không import chéo trực tiếp).
3. OAuth scopes mới (nếu gọi API ngoài — ví dụ LLM) bổ sung vào `appsscript.json`; lưu ý scope `script.external_request` đã có sẵn.

**Nghiệm thu:** sidebar mở được, luồng chạy độc lập với email automation; tắt hẳn module (xóa menu item) không ảnh hưởng luồng email.

---

## 4. RỦI RO & CÁCH CHỐNG

| Rủi ro | Giải pháp |
|---|---|
| Đổi tên/cấu trúc làm vỡ menu (menu bind theo string tên hàm) | Không đổi tên `onOpen`/`menu*`; `main.js` luôn ở `src/` gốc |
| Push subdirectory làm remote file name đổi (`utils` → `core/utils`) tạo file TRÙNG trên remote | Sau Phase 2 chạy sync script (Phase 4) để dọn file cũ trên remote |
| 2 module import chéo dần theo thời gian | Review rule mục 2.2; thêm mục này vào `CLAUDE.md` |
| Refactor song song với người dùng đang dùng thật | Mỗi phase push vào giờ thấp điểm; test trên bản copy của spreadsheet trước |

---

## 5. THỨ TỰ ƯU TIÊN ĐỀ XUẤT

```
Phase 0 (ngay, vì có bug menu + CLAUDE.md sai)
  └─► Phase 1 (mở đường cho sidebar)
        └─► Phase 2 (dọn nhà trước khi xây thêm tầng)
              └─► Phase 3 + 4 (song song được)
                    └─► Phase 5 (AI Recruitment)
```

Tổng effort ước tính: **~4 ngày làm việc** cho Phase 0–4, chưa gồm Phase 5.
