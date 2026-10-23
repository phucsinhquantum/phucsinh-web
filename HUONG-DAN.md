# Hướng dẫn web app Phúc Sinh QuanTum (bản 2)

Web app chạy trực tiếp trên trình duyệt, không cần cài đặt. Khi chạy thử trên máy, mở bằng một máy chủ tĩnh (ví dụ `python3 -m http.server` trong thư mục này) rồi vào `http://localhost:8000`. Mở thẳng file cũng chạy, nhưng hiệu ứng logo trong intro cần máy chủ.

Bản cũ (giao diện sáng giống tramluongtu) được giữ ở thư mục `website-v1` cạnh thư mục này.

## Các trang
| File | Trang |
|---|---|
| index.html | Trang chủ (có intro mở đầu) |
| gioi-thieu.html | Giới thiệu thương hiệu |
| san-pham.html, san-pham-chi-tiet.html | Danh sách và chi tiết sản phẩm |
| kien-thuc.html, bai-viet.html | Kiến thức trầm hương lượng tử và trang đọc bài |
| dat-hang.html | Giỏ hàng, thông tin giao hàng, xác nhận đơn, tra cứu đơn |
| thanh-vien.html | Đăng nhập, đăng ký, điểm PS, hạng, đơn hàng của tôi |
| quan-tri.html | Quản trị: tổng quan, đơn hàng, sản phẩm, thành viên, tin nhắn |
| lien-he.html | Liên hệ, gửi tin nhắn, chính sách |

## Sửa nội dung
Toàn bộ chữ, sản phẩm, bài viết, số liệu nằm trong `js/data.js`:
- `SITE`: tên, số điện thoại, Zalo, email, địa chỉ, giờ làm việc, Google Maps, tài khoản ngân hàng, phí giao hàng, tỷ lệ điểm PS.
- `PRODUCTS`: sản phẩm. Chưa có ảnh thì web tự vẽ hình mẫu theo `art`. Có ảnh thật: chép vào `img/san-pham/` và ghi `image: 'img/san-pham/ten-anh.jpg'`.
- `CATEGORIES`, `POSTS` (bài viết, nội dung HTML), `POST_CATS`, `STATS`, `REVIEWS`, `TEAM`, `TIMELINE`, `RANKS` (hạng thành viên).
- Chữ có ghi "(mẫu)" là nội dung giữ chỗ, anh thay bằng nội dung thật.

## Giao diện
- `css/app.css`: màu (mục `:root`), khung kính phát sáng (`.card.glow-gold`, `.glow-cyan`, `.glow-mix`), nút, bảng, biểu mẫu, bố cục cho máy tính, iPad, điện thoại.
- `js/app.js`: khung chung (thanh bên, thanh trên, thanh dưới điện thoại, chân trang, giỏ hàng), nền khói trầm và đốm sáng, biểu đồ, hình vẽ sản phẩm, tài khoản và đơn hàng.

## Tài khoản dùng thử
- Quản trị: `admin@psq.vn` / `psq2026` (đổi trong `SITE.demoAdmin`).
- Thành viên mẫu: `khach1@email.com` / `123456`.

## Quan trọng trước khi bán thật
Hiện tài khoản, đơn hàng và tin nhắn chỉ lưu trên trình duyệt của từng máy (localStorage) để chạy thử giao diện. Muốn khách đăng ký thật, quản trị thấy đơn từ mọi khách, thanh toán online, gửi email xác nhận thì cần nối máy chủ (backend) và cơ sở dữ liệu. Mật khẩu quản trị dùng thử không an toàn, chỉ để xem thử.

## Màn hình mở đầu (intro)
- File: `js/intro.js`, `css/intro.css`, nhạc `audio/intro-full.mp3`, ảnh trong `img/intro/`: `canh-1-may-nui.jpg` (cảnh 1), `phuc-sinh-canh-nen.jpg` (cảnh 2), `logo-psq.png`. Mỗi ảnh có bản `-m.jpg` nhẹ hơn cho điện thoại. Chỉ gắn ở trang chủ.
- Có 2 bản: ban ngày (ảnh `*-ngay.jpg`, đang dùng) và bình minh. Chọn bằng `theme: 'ngay'` hoặc `theme: 'binh-minh'` trong mục `INTRO`. Xem thử bản kia: `index.html?intro=1&canh=binh-minh`.
- Cảnh 1 (0–5,4s): tia nắng, mây bay bồng bềnh. Cảnh 2 (4,2s trở đi): mặt trời ló dần sau núi, tia sáng chiếu tới logo, logo sáng lên, nút Khám phá nhấp nháy (khoảng giây thứ 8). Khách bấm nút mới vào trang.
- Nhạc nền: nguyên bài anh gửi ngày 23/10 (13 phút 37 giây, nén 96 kbps, khoảng 9,8 MB), phát dần khi tải, hết bài thì phát lại, nhỏ dần khi bấm Khám phá. Trình duyệt chặn tự phát tiếng khi khách chưa chạm vào trang, nên nhạc phát ngay khi được phép hoặc ở lần chạm/bấm đầu tiên. Nút loa góc trên bên trái để bật/tắt. Đổi nhạc: thay `audio/intro.mp3`; tắt nhạc: `music: ''`; âm lượng: `volume`.
- Thời gian từng cảnh: mục `T`. Đường đi máy quay: `CAM`. Vị trí mặt trời, vòng sáng trên ảnh: `IMG`. (Code cảnh lửa khói và cổng sáng vẫn còn nhưng đang tắt.)
- Tự chỉnh theo máy tính, iPad (dọc, ngang), điện thoại: mục `PROFILES` trong `js/intro.js`, cỡ chữ và logo trong `css/intro.css`.
- Đổi logo: thay `img/intro/logo-psq.png` (PNG nền trong suốt). Đổi chữ: mục `INTRO`. Mỗi phiên trình duyệt khách thấy 1 lần; xem lại bằng `index.html?intro=1`; tắt bằng `enabled: false`.
