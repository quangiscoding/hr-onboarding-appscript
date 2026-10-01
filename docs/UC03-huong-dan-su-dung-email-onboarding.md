# Hướng dẫn gửi Email Onboarding (menu 🚀 Hera Onboarding Tools)

Tài liệu này dành cho TA / HR sử dụng hàng ngày. Chỉ cần làm theo từng bước, không cần biết code.

---

## Chuẩn bị trước khi bấm menu

1. Mở Google Sheet *Hera | On-boarding List*.
2. **Click vào 1 ô trong dòng của nhân sự** cần xử lý (nhớ kỹ: phải là dòng có người, đừng click vào dòng tiêu đề).
3. Kiểm tra các cột đã điền đủ chưa:

| Thông tin | Khi nào cần |
|---|---|
| Họ tên, Chức vụ, Squad | Luôn luôn |
| **Alloc Code** | Bắt buộc khi tạo Welcome Email. Có Alloc Code = nhân sự mới đã có email công ty |
| **Email cá nhân** | Cần cho Welcome Email (nơi gửi thư chào mừng) |
| **TA In Charge** | Cần cho email thông báo TA — điền tên đăng nhập Kyanon (vd: `my.tran`) |
| Employment Type, Onboarding Type, Ngày Onboard | Cần cho Welcome Email (chọn đúng file PDF và địa chỉ văn phòng) |
| Device Request | Chỉ cần khi nhân sự mới xin máy công ty (phải có chữ "as company standard") |

> Danh sách người nhận email các phòng ban (DevOps, HR, IT, People Team) do quản trị viên chỉnh trong sheet **Data** — người dùng không cần đụng tới.

---

## Cách 1 — Tạo thư chào mừng cho nhân sự mới

1. Chọn dòng nhân sự mới.
2. Menu **🚀 Hera Onboarding Tools** → **1. Tạo Draft Welcome Email**.
3. Bấm **Yes** để xác nhận.
4. Mở **Gmail → Thư nháp (Drafts)**, bạn sẽ thấy thư chào mừng đã soạn sẵn, kèm file PDF hướng dẫn.
5. Kiểm tra và sửa phần **vị trí bàn làm việc** (thư để chỗ này trống để bạn tự điền), rồi bấm **Gửi**.

> Lưu ý: nếu báo "Thiếu Alloc Code" → chưa có Alloc Code thì **dùng Email cá nhân** để nhận thư: điền Email cá nhân vào cột tương ứng rồi chạy lại.

## Cách 2 — Nhắc việc các phòng ban (sau khi ứng viên nhận offer)

1. Chọn dòng nhân sự mới.
2. Menu **🚀 Hera Onboarding Tools** → **2. Tạo Draft Offer Accepted**.
3. Bấm **Yes** để xác nhận.
4. Vào **Gmail → Thư nháp**, bạn sẽ thấy:
   - Thư cho **DevOps** — yêu cầu tạo email công ty.
   - Thư cho **HR** — yêu cầu tạo folder OKR.
   - Thư cho **IT** — yêu cầu cấp máy (**chỉ xuất hiện nếu** cột Device Request có "as company standard").
5. Kiểm tra từng thư rồi bấm **Gửi**.

## Cách 3 — Thông báo tiến độ cho TA

1. Chọn dòng nhân sự mới.
2. Menu **🚀 Hera Onboarding Tools** → **3. Gửi Notification cho TA**.
3. Bấm **Yes** để xác nhận — thư sẽ **gửi luôn**, không có bước soát lại.
4. TA In Charge nhận email thông báo. Nội dung tự cập nhật theo tiến độ:
   - Đã có **Alloc Code** → thư báo "Working Email đã được tạo" kèm email công ty của nhân sự mới.
   - Chưa có Alloc Code → thư hiển thị **email cá nhân** của nhân sự mới.

---

## Nếu gặp lỗi

| Báo lỗi | Cách xử lý |
|---|---|
| "Vui lòng chọn một dòng..." | Click lại vào 1 ô **trong dòng nhân sự** rồi mở menu lại |
| "Thiếu Alloc Code!" | Điền Alloc Code, hoặc chỉ dùng Email cá nhân (xem Cách 1) |
| "Thiếu TA In Charge!" | Điền tên đăng nhập Kyanon của TA vào cột TA In Charge |
| "Invalid email..." | Ô trong sheet **Data** đang dán sai dạng — báo quản trị viên sửa lại thành tên đăng nhập/email dạng chữ thường |
| Menu không hiện ra | Refresh lại trang Google Sheet, đợi vài giây rồi thử lại |
| Hệ thống hỏi xin quyền | Bấm **Allow / Cho phép** — chỉ cần làm 1 lần |

Mọi lượt chạy đều được ghi lại tự động vào các tab log cuối file, không cần ghi tay.
