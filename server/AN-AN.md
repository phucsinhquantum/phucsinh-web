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
- `results[]` (tối đa 5): `name`, `code`, `refLink` (link đăng ký có sẵn mã giới thiệu của người đó), `tier` (Khách hàng, Cộng tác viên, Đại lý), `since`, `trusted`, `dealer` (chỉ khi là đại lý uy tín đang hiện trên web: khu vực, địa chỉ, SĐT, Zalo như trang Đại lý uy tín).
- `self`: chỉ có khi `asker` trùng SĐT tài khoản: SĐT, email, điểm các ví, 5 đơn gần nhất, số người mình giới thiệu.
- `dealers[]`: đại lý uy tín khớp tên hoặc khu vực mà không có tài khoản trùng.
- `count`: tổng số người khớp. Nhiều hơn 1 thì An An hỏi thêm khu vực hoặc mã PS.
- `rule`: nhắc An An những gì được nói.

Không bao giờ trả SĐT, email, địa chỉ, tiền của người khác. Khóa sai 10 lần trong 15 phút thì IP đó bị chặn 15 phút.

## Kịch bản người giới thiệu (anh Tuân chốt 28/10)
Khách hỏi về thu nhập, hoa hồng CTV hoặc đại lý: An An giới thiệu chung, không tự nêu con số, rồi hỏi khách biết công ty qua đâu, có ai giới thiệu không.
Khách nói tên: tra `q=<tên>`, hỏi lại "Có phải anh/chị <tên>, <cấp>, mã <code> không ạ?" (nhiều người trùng thì hỏi thêm khu vực).
Khách xác nhận: hỏi có cần gửi link giới thiệu của người đó để đăng ký không. Khách đồng ý thì gửi `refLink`, và mời khách hỏi người giới thiệu để được tư vấn chi tiết.
Khách không có ai giới thiệu: gửi trang Đại lý uy tín hoặc đại lý khớp khu vực trong `dealers[]`.

## Tra sản phẩm đang bán
```
GET https://phucsinhquantum.com/api/bot/products?q=<tên sản phẩm, bỏ trống = tất cả>
x-bot-key: <cùng khóa>
```
Trả `products[]`: `name`, `price`, `old`, `partner`, `partnerName`, `inStock`, `stock`, `spec`, `warranty` (bảo hành riêng, trống = chính sách chung), `link`.
Sản phẩm không có trong danh sách là đã gỡ khỏi web: An An báo hết hàng hoặc ngừng bán, gợi ý mẫu tương tự. Không trả giá tính thưởng PS (nội bộ). Hàng đối tác do công ty giao.

## Fanpage thành viên: An An gửi số bài đăng (POST /api/bot/fanpages)

Cùng khóa x-bot-key. Mỗi ngày (ví dụ 22h) n8n đọc từng fanpage An An quản lý qua Facebook Graph API
(`GET /{page-id}/posts?since=<7 ngày trước>&fields=created_time&limit=100` bằng page token), đếm bài rồi gửi:

```json
{ "pages": [
  { "pageId": "1234567890", "name": "Trầm hương Lê Nhị", "url": "https://www.facebook.com/tramhuonglenhi",
    "code": "PS1319", "today": 1, "d7": 6, "lastPost": "2026-10-30T08:12:00+0700" }
] }
```

- `code`: mã PS của thành viên chủ trang (bỏ trống thì quản trị gắn tay trong Quản trị fanpage).
- `today`: số bài hôm nay; `d7`: số bài 7 ngày gần nhất (tính cả bài thành viên tự đăng tay).
- Gửi đủ danh sách mỗi lần: trang không có trong lần gửi sẽ bị coi là An An không còn quản lý (gửi `"full": false` nếu chỉ gửi một phần).
- Số liệu quá 2 ngày không gửi lại thì trang coi như chưa có số bài.
- Trả về `{ ok, added, updated, bad, showing }`. Web tự báo Telegram trang nào vừa hiện lại hoặc tạm ẩn.
- Điều kiện hiện (mặc định: An An quản lý + ít nhất 5 bài trong 7 ngày) anh chỉnh ở Quản trị > Quản trị fanpage. Trang không phải Facebook (TikTok, Zalo) thì bật "Luôn hiện" để bỏ qua điều kiện.
