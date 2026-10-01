# UC03 — Hướng dẫn sử dụng: Email Onboarding (Hera Onboarding Tools)

> Phiên bản: tháng 10/2026 · Dành cho người dùng nghiệp vụ (TA / HR) và người vận hành hệ thống.
> UC03 là phần **tự động hóa email onboarding** của Google Sheet *Hera | On-boarding List*, chạy bằng menu **🚀 Hera Onboarding Tools**.

---

## 1. Tổng quan

Mở Google Sheet, chọn **1 dòng nhân sự** cần xử lý (click vào ô bất kỳ trong dòng, **không chọn dòng tiêu đề**), vào menu **🚀 Hera Onboarding Tools**:

| # | Menu | Chức năng | Kết quả |
|---|------|-----------|---------|
| 1 | Tạo Draft Welcome Email | Soạn thư chào mừng gửi **nhân sự mới** | Tạo **bản nháp** trong Gmail của bạn (kèm PDF hướng dẫn) |
| 2 | Tạo Draft Offer Accepted | Nhắc việc các phòng ban sau khi ứng viên nhận offer | Tạo **3 bản nháp**: DevOps, HR (folder OKR), IT (cấp máy) |
| 3 | Gửi Notification cho TA | Thông báo tiến độ onboarding cho **TA In Charge** | **Gửi thẳng** email (không tạo draft) |

Mỗi lần chạy, hệ thống sẽ:
1. Đọc dữ liệu **dòng đang chọn**;
2. Kiểm tra dữ liệu bắt buộc (thiếu thì báo lỗi và dừng, không gửi);
3. Hỏi xác nhận (Yes/No) trước khi thực hiện;
4. Ghi log vào tab log tương ứng ở cuối file.

---

## 2. Chuẩn bị dữ liệu trước khi chạy

Các cột trên sheet cần điền đầy đủ (tên cột viết hoa/thường không quan trọng):

| Cột | Dùng cho luồng | Bắt buộc? |
|-----|----------------|-----------|
| Full Name | Tất cả | ✅ |
| Title / Squad/ Unit / Level | Tất cả | ✅ |
| Employment Type (Intern / Probation...) | Luồng 1 | ✅ — quyết định file PDF đính kèm |
| Onboarding Type (Onsite / Onsite - Danang / Hoa Cau...) | Luồng 1 | ✅ — quyết định địa chỉ văn phòng + PDF |
| Date of Onboard | Luồng 1 | ✅ |
| **Alloc Code** (update by Atlas) | Luồng 1, 3 | Luồng 1: ✅ bắt buộc. Luồng 3: quyết định hiển thị Working Email |
| Personal Email | Luồng 1 | ✅ — nơi nhận thư Welcome khi chưa có Alloc Code |
| TA In Charge | Luồng 2, 3 | Luồng 3: ✅ bắt buộc (ghi username hoặc email Kyanon) |
| Device Request from newcomer | Luồng 2 | Chỉ khi cần IT cấp máy — phải chứa chữ "as company standard" |
| Link Folder OKRs | Luồng 3 | Có → subject báo "Folder OKRs đã sẵn sàng" |

### 2.1. Sheet `Data` — danh sách người nhận (cấu hình động)

Email các phòng ban **không còn hardcode** trong code — hệ thống đọc bảng trong sheet `Data` (cột `Role`, `Send to`, `CC`):

| Role | Dùng cho |
|------|----------|
| `OKR` | Luồng 2 — draft gửi HR tạo folder OKR |
| `DevOps` | Luồng 2 — draft khởi tạo tài khoản email |
| `IT Support` | Luồng 2 — draft thông báo cấp máy (CC ghi ở cột CC) |
| `People Team` | Luồng 1 — CC của Welcome Email |

Quy tắc điền giá trị:
- Ghi **Alloc Code** (vd: `tuan.le`) → hệ thống tự ghép thành `tuan.le@kyanon.digital`.
- Hoặc ghi **email đầy đủ**.
- 1 ô có thể chứa **nhiều người**, ngăn cách bởi dấu phẩy, chấm phẩy hoặc xuống dòng.
- ⚠️ **KHÔNG dùng contact chip** (chèn người từ @ của Google Sheet): chip chỉ trả về tên hiển thị, script không đọc được email → sẽ gây lỗi `Invalid email`.
- Muốn đổi người nhận: sửa sheet `Data` là xong, không cần sửa code.

---

## 3. Chi tiết 3 luồng

### 3.1. Luồng 1 — Tạo Draft Welcome Email (menu 1)

- **Người nhận:** Personal Email (nếu có) hoặc Working Email sinh từ Alloc Code (`<alloc-code>@kyanon.digital`).
- **CC:** TA In Charge + People Team (theo sheet `Data`).
- **Đính kèm:** PDF "Essential Onboarding Steps" tự chọn theo Employment Type × Onboarding Type (HCM / Danang), tên file tự chuẩn hóa `Anh Tran_Essential Onboarding Steps.pdf`.
- **Subject dạng:** `Welcome to Kyanon Digital: Essential Onboarding Steps for <Chức danh>_<Squad>`.
- Lỗi hay gặp: **"Thiếu Alloc Code"** → điền Alloc Code rồi chạy lại.
- Sau khi chạy, vào **Gmail → Drafts**, rà soát nội dung (đặc biệt phần *Desk Location* còn để placeholder vàng) rồi bấm Send.

### 3.2. Luồng 2 — Tạo Draft Offer Accepted (menu 2)

Tạo 3 bản nháp gửi nội bộ:

| Draft | Người nhận (sheet Data) | Nội dung |
|-------|------------------------|----------|
| DevOps | Role `DevOps` | Yêu cầu khởi tạo tài khoản email công ty |
| HR | Role `OKR` | Yêu cầu tạo folder OKR onboarding |
| IT | Role `IT Support` + CC cột CC | Thông báo cấp máy — **chỉ tạo khi** Device Request chứa "as company standard" |

Các draft đều **nằm trong Gmail của bạn** — ai được phân giao review thì bấm Send. Mỗi draft đã được ghi log Draft ID vào tab *Internal Draft Log*.

### 3.3. Luồng 3 — Gửi Notification cho TA (menu 3)

- **Gửi thẳng** tới TA In Charge (không tạo draft, không thể thu hồi) — hệ thống sẽ hỏi xác nhận trước khi gửi.
- Nội dung mail **tự đổi theo tiến độ** trên dòng:
  - Có **Alloc Code** → dòng thông tin hiển thị **"Working Email"** (sinh từ Alloc Code), subject "Working Email đã được tạo" (hoặc "Cả Folder OKRs và Email công ty đã sẵn sàng" nếu cũng có Link Folder OKRs).
  - Chưa có Alloc Code → hiển thị **"Email cá nhân"** (Personal Email).
- Cột checkbox gửi TA (nếu dùng) sẽ được tô xám nhẹ sau khi gửi thành công.
- Log ghi vào tab *TA Notification Log*.

---

## 4. Tab log tự động

| Tab | Ghi khi | Cột chính |
|-----|---------|-----------|
| `Internal Draft Log` | Luồng 2 | Timestamp, Fullname, Position, Request Type (DevOps/HR/IT), Draft ID, Status |
| `TA Notification Log` | Luồng 3 | Timestamp, Fullname, Alloc Code, Sent To, Status = EMAIL_SENT |
| `Candidate Draft Log` | Luồng 1 | Timestamp, Fullname, Alloc Code, Draft ID, Status = DRAFT_CREATED |

Tab chưa tồn tại sẽ tự được tạo khi chạy lần đầu.

---

## 5. Sự cố thường gặp

| Triệu chứng | Nguyên nhân | Cách xử lý |
|-------------|-------------|------------|
| "Vui lòng chọn một dòng chứa dữ liệu nhân sự" | Đang chọn dòng tiêu đề hoặc không chọn gì | Click vào 1 ô trong dòng nhân sự rồi mở lại menu |
| "⚠️ Thiếu Alloc Code!" | Cột Alloc Code trống khi chạy Luồng 1 | Điền Alloc Code (update by Atlas) rồi chạy lại |
| "⚠️ Thiếu TA In Charge!" | Cột TA In Charge trống khi chạy Luồng 3 | Điền TA In Charge (username hoặc email Kyanon) |
| `Invalid email: <tên có dấu cách>@kyanon.digital` | Sheet `Data` đang dùng **contact chip** thay vì text | Xóa chip, gõ lại Alloc Code/email dạng text thường |
| Draft bị gửi trùng người / thiếu người | Bảng Role trong sheet `Data` thiếu hoặc sai chính tả Role | Kiểm tra cột `Role` khớp đúng: `OKR`, `DevOps`, `IT Support`, `People Team` |
| Menu không hiện | Script chưa được gắn vào file / chưa authorize | Mở Extensions → Apps Script kiểm tra; chạy lại `onOpen` hoặc refresh trang |
| Yêu cầu xin quyền khi mở menu lần đầu | OAuth scope mới được thêm | Bấm Review permissions → chọn tài khoản → Allow |

---

## 6. Ghi chú cho người vận hành (dev)

- Source code nằm trong thư mục `src/`, deploy bằng `clasp push` (phải chạy trong WSL: `export PATH="$HOME/.local/share/pnpm/bin:$PATH"` rồi `clasp push`).
- `clasp push` **không xóa file mồ côi** trên Apps Script — khi đổi tên/xóa file trong repo phải xóa tay trong Apps Script Editor.
- Email phòng ban cấu hình tại sheet `Data` (xem mục 2.1); File ID PDF hướng dẫn tại `CONFIG.GUIDE_PDF_MAP` trong `src/config.js`.
- Token/API key (nếu có) đặt trong **Script Properties**, không commit lên git.
- Không đổi tên các hàm menu (`menuSendWelcomeEmail`, `menuSendTaNotification`, `menuSendDevOpsEmail`) và `handle*Workflow` — menu bind theo chuỗi tên hàm.
