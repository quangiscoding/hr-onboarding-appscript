# Gửi Email Onboarding với menu 🚀 Hera Onboarding Tools

Tài liệu này dành cho các bạn TA / HR sử dụng hàng ngày. Làm theo từng bước là được, không cần quan tâm kỹ thuật bên dưới.

---

## Trước khi bắt đầu

Trước khi chạy menu, mình gợi ý bạn lướt qua dòng nhân sự cần xử lý xem các thông tin sau đã sẵn sàng chưa — sẽ đỡ phải chạy lại:

- **Họ tên, Chức vụ, Squad** — thông tin cơ bản.
- **Alloc Code** — cần cho thư chào mừng. Khi cột này đã có giá trị nghĩa là nhân sự mới đã có email công ty.
- **Email cá nhân** — nơi nhận thư chào mừng (khi chưa có Alloc Code thì thư sẽ gửi qua đây).
- **TA In Charge** — cần cho email thông báo TA, điền tên đăng nhập Kyanon (ví dụ `my.tran`).
- **Employment Type, Onboarding Type, Ngày Onboard** — hệ thống dựa vào đây để chọn file PDF và địa chỉ văn phòng phù hợp.
- **Device Request** — nếu nhân sự mới có xin máy công ty, cột này nên có cụm "as company standard".

Danh sách người nhận email các phòng ban (DevOps, HR, IT, People Team) nằm trong sheet **Data** — phần này quản trị viên lo giúp bạn rồi, không cần đụng tới.

À, một điều nhỏ: khi thao tác trên sheet, bạn click vào **1 ô trong dòng của nhân sự mới** nhé (tránh dòng tiêu đề), rồi menu mới hiểu bạn đang làm việc với ai.

---

## 1. Tạo thư chào mừng cho nhân sự mới

1. Chọn dòng nhân sự mới trên sheet.
2. Vào menu **🚀 Hera Onboarding Tools** → **1. Tạo Draft Welcome Email**.
3. Hệ thống hỏi xác nhận, bạn chọn **Yes** nhé.
4. Thư chào mừng sẽ nằm trong **Gmail → Thư nháp** của bạn, kèm sẵn file PDF hướng dẫn.
5. Trong thư có một chỗ **vị trí bàn làm việc** được tô vàng để bạn tự điền — điền xong, lướt qua lần cuối rồi bấm Gửi là xong.

Nếu hệ thống nhắc "Thiếu Alloc Code" thì cũng đừng lo: chưa có Alloc Code bạn vẫn gửi được thư qua **email cá nhân** của nhân sự mới — điền email cá nhân vào cột tương ứng rồi chạy lại là được.

## 2. Nhắc việc các phòng ban (khi ứng viên nhận offer)

> ⚠️ Luồng này **gửi thư đi luôn** (không có bản nháp để soát) — bạn yên tâm đã chọn đúng dòng trước khi chạy nhé.

1. Chọn dòng nhân sự mới.
2. Menu **🚀 Hera Onboarding Tools** → **2. Gửi Email Offer Accepted**.
3. Chọn **Yes** để xác nhận.
4. Email sẽ được gửi thẳng tới:
   - **DevOps** — nhờ tạo email công ty cho nhân sự mới.
   - **HR** — nhờ tạo folder OKR.
   - **IT** — nhờ cấp máy (email này chỉ gửi khi nhân sự mới có xin máy, tức cột Device Request có cụm "as company standard").
5. Xong! Hệ thống sẽ báo số email đã gửi. Mọi thư đều được ghi log vào tab *Internal Email Log* để bạn đối chiếu khi cần.

## 3. Thông báo tiến độ cho TA

1. Chọn dòng nhân sự mới.
2. Menu **🚀 Hera Onboarding Tools** → **3. Gửi Notification cho TA**.
3. Chọn **Yes** để xác nhận — thư sẽ gửi đi ngay sau đó, nên bạn yên tâm đã chọn đúng dòng trước khi bấm nhé.
4. TA In Charge sẽ nhận được email thông báo, nội dung tự cập nhật theo tiến độ:
   - Đã có **Alloc Code** → thư báo "Working Email đã được tạo" kèm email công ty của nhân sự mới.
   - Chưa có Alloc Code → thư hiển thị **email cá nhân** của nhân sự mới.

---

## Nếu gặp chút trục trặc

| Hệ thống báo | Bạn có thể thử |
|---|---|
| "Vui lòng chọn một dòng..." | Click lại vào 1 ô trong dòng nhân sự rồi mở menu lại nha |
| "Thiếu Alloc Code!" | Điền Alloc Code, hoặc dùng email cá nhân như mục 1 đã nói |
| "Thiếu TA In Charge!" | Điền tên đăng nhập Kyanon của TA vào cột TA In Charge |
| "Invalid email..." | Ô trong sheet **Data** có vẻ dán sai dạng — nhắn quản trị viên sửa lại thành tên đăng nhập/email dạng chữ thường giúp bạn |
| Menu không hiện ra | Refresh lại trang Google Sheet, đợi vài giây rồi thử lại |
| Hệ thống hỏi xin quyền | Bấm **Allow / Cho phép** — chỉ cần làm 1 lần thôi ạ |

Mỗi lượt chạy hệ thống đều tự ghi lại vào các tab log cuối file nên bạn không cần ghi chép gì thêm đâu. Chúc bạn onboard nhân sự mới thật suôn sẻ! 🎉
