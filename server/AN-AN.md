# An An tra cứu thành viên

Cổng chỉ đọc cho bot An An (Zalo, Messenger qua n8n) hỏi máy chủ web về thành viên.

## Bật
Quản trị > Thiết lập > mục "An An tra cứu thành viên" > Tạo khóa. Khóa chỉ hiện một lần, dán vào n8n.
Đổi khóa mới hoặc bấm "Khóa cổng tra cứu" là khóa cũ hết dùng được ngay.

## Gọi
```
GET https://phucsinhquantum.com/api/bot/lookup?q=<tên | SĐT | mã PS>&asker=<SĐT người đang chat, nếu biết>
x-bot-key: <khóa>
```
Cũng nhận `POST` JSON `{ "q": "...", "asker": "..." }`, hoặc `Authorization: Bearer <khóa>`.
Trong n8n: công cụ HTTP Request cho AI agent, tên "Tra cứu thành viên".

Kết quả:
- `results[]` (tối đa 5): `name`, `code`, `tier` (Khách hàng, Cộng tác viên, Đại lý), `since`, `trusted`, `dealer` (chỉ khi là đại lý uy tín đang hiện trên web: khu vực, địa chỉ, SĐT, Zalo như trang Đại lý uy tín).
- `self`: chỉ có khi `asker` trùng SĐT tài khoản: SĐT, email, điểm các ví, 5 đơn gần nhất, số người mình giới thiệu.
- `dealers[]`: đại lý uy tín khớp tên hoặc khu vực mà không có tài khoản trùng.
- `count`: tổng số người khớp. Nhiều hơn 1 thì An An hỏi thêm khu vực hoặc mã PS.
- `rule`: nhắc An An những gì được nói.

Không bao giờ trả SĐT, email, địa chỉ, tiền của người khác. Khóa sai 10 lần trong 15 phút thì IP đó bị chặn 15 phút.
