# Cài máy chủ dữ liệu PSQ lên VPS

Code: nhánh `may-chu` của repo phucsinhquantum/phucsinh-web. Máy chủ là Node 22 + SQLite có sẵn trong Node, không cần cài thư viện.

## Bản thử: thu.phucsinhquantum.com

1. DNS ở Nhân Hòa: bản ghi `A | thu | 103.77.214.45`.
2. Tải code:
   ```
   sudo git clone -b may-chu https://github.com/phucsinhquantum/phucsinh-web.git /opt/web/phucsinhquantum-thu
   ```
3. Thư mục dữ liệu, nằm ngoài thư mục web:
   ```
   sudo mkdir -p /opt/psq-data-thu
   sudo cp /opt/web/phucsinhquantum-thu/server/.env.example /opt/psq-data-thu/.env
   sudo chmod 600 /opt/psq-data-thu/.env
   ```
   Sửa `/opt/psq-data-thu/.env`:
   - `BASE_URL=https://thu.phucsinhquantum.com`
   - `OWNER_EMAIL=tuan3133199@gmail.com`
   - `TELEGRAM_BOT_TOKEN`: token bot Trợ Lý Phúc Sinh.
   - `TELEGRAM_CHAT_ID`: mã cuộc trò chuyện Telegram của anh Tuân với bot.
4. Xem tên mạng docker của Caddy: `docker inspect proxy-caddy-1 -f '{{json .NetworkSettings.Networks}}'`.
5. Chạy:
   ```
   cd /opt/web/phucsinhquantum-thu
   NAME=psq-api-thu WEB_DIR=/opt/web/phucsinhquantum-thu DATA_DIR_HOST=/opt/psq-data-thu PROXY_NET=<tên mạng> \
     docker compose -p psq-thu -f server/docker-compose.yml up -d
   docker logs psq-api-thu
   ```
   Nhật ký in một đường dẫn `.../thanh-vien.html?dat-lai=...`. Đó là đường dẫn để anh Tuân tự đặt mật khẩu chủ sở hữu. Gửi riêng cho anh, dùng 1 lần trong 48 giờ.
6. Caddy: sao lưu Caddyfile, thêm khối dưới, `caddy validate`, rồi reload. Thư mục web mount vào container Caddy giống bản chính, ở /srv/web/phucsinhquantum-thu.
   ```
   thu.phucsinhquantum.com {
     encode gzip
     @hidden path /server /server/* /notes /notes/* /.git /.git/* *.md
     handle @hidden {
       respond 404
     }
     handle /api/* {
       reverse_proxy psq-api-thu:8080
     }
     handle {
       root * /srv/web/phucsinhquantum-thu
       file_server
     }
   }
   ```
7. Kiểm tra:
   - `curl -s https://thu.phucsinhquantum.com/api/boot | head -c 200` trả về JSON.
   - Các trang psq.vn vẫn chạy.

## Cập nhật code

```
git -C /opt/web/phucsinhquantum-thu pull
docker restart psq-api-thu
```

## Tên gọi trên mạng docker (sửa 25/10)

Trước 25/10 dịch vụ trong docker-compose.yml tên là `psq-api`, nên container bản thử cũng mang tên gọi `psq-api` trên mạng của Caddy. Caddy bản chính gọi `psq-api:8080` bị chia ngẫu nhiên sang bản thử (đăng ký rơi vào dữ liệu bản thử, lưu quản trị báo chưa đăng nhập). Nay dịch vụ tên là `app`, Caddy luôn gọi theo tên container: `psq-api` (chính), `psq-api-thu` (thử).

Lần đầu chạy `docker compose ... up -d` sau khi pull bản sửa này, container cũ còn thuộc dịch vụ tên cũ nên báo trùng tên. Xóa container cũ trước (dữ liệu nằm ở thư mục dữ liệu, không mất): `docker rm -f psq-api-thu` (hoặc `psq-api`), rồi chạy lệnh ở bước 5. Kiểm tra: `docker network inspect <mạng Caddy>` chỉ một container có tên gọi `psq-api`.

## Sửa tệp .env

`docker restart` không đọc lại `.env`. Sửa `.env` xong phải tạo lại container bằng lệnh ở bước 5 (`docker compose ... up -d`, cùng các biến NAME, WEB_DIR, DATA_DIR_HOST, PROXY_NET). Dữ liệu nằm ở thư mục dữ liệu nên không mất.

## Khi anh duyệt xong, đưa lên bản chính

Làm như trên với các giá trị của bản chính:
- nhánh `main`, đã gộp `may-chu`;
- thư mục `/opt/web/phucsinhquantum`;
- dữ liệu `/opt/psq-data`;
- `NAME=psq-api`;
- `BASE_URL=https://phucsinhquantum.com`.

Khối Caddy của phucsinhquantum.com thêm `handle /api/*` và `handle @hidden`, giống bản thử. Chú ý: `respond` phải nằm trong `handle @hidden`, đặt ngoài thì các khối `handle` khác chạy trước và không chặn được.

## Sao lưu

Máy chủ tự sao lưu mỗi ngày vào `<thư mục dữ liệu>/backups` và giữ 30 bản. Nên chép thêm thư mục này ra ngoài VPS định kỳ.

## Vận hành an toàn bản thử và bản chính (27/10)

Nguyên tắc: **code chỉ sửa trên GitHub**, không sửa thẳng trên VPS. Bản thử chạy nhánh `may-chu`, bản chính chạy nhánh `main`.
Anh Tuân kiểm tra bản thử xong, nhắn "đưa lên bản chính" thì mới đẩy `may-chu` sang `main` rồi cập nhật bản chính.

Các lệnh ở `server/ops`, cài một lần bằng `bash /opt/web/phucsinhquantum/server/ops/cai-dat.sh` (chép vào `/opt/psq-ops`, đặt lịch cron):

| Lệnh | Việc làm |
|---|---|
| `bash /opt/psq-ops/cap-nhat.sh thu` hoặc `chinh` | Lấy code từ GitHub, sao lưu dữ liệu, tự kiểm tra (`server/tools/kiem-tra.js`) trên bản sao dữ liệu, sai là dừng. Đúng thì đổi code, khởi động lại, kiểm tra trang và tên gọi trên mạng; hỏng thì tự quay về code cũ. Báo kết quả qua Telegram. Có sửa trực tiếp trên VPS thì dừng (đã giữ ở `backups/code-vps-*.patch`), chạy lại với `FORCE=1` khi chắc GitHub đã có các sửa đó. |
| `canh-gac.sh` (cron mỗi 5 phút) | Trang chính, bản thử còn trả dữ liệu; tên gọi `psq-api`, `psq-api-thu` mỗi cái đúng 1 container; ổ đĩa dưới 90%. Sự cố thì báo Telegram, kéo dài thì nhắc mỗi giờ, hết thì báo đã ổn. |
| `sao-luu-ngoai.sh` (cron 02:30) | Sao lưu dữ liệu bản chính, nén, gửi vào Telegram riêng của chủ (`ALERT_CHAT_ID`, mặc định mã đầu của `TELEGRAM_CHAT_ID`). |
| `du-lieu-thu.sh` (cron 03:30 thứ Hai, hoặc chạy tay) | Làm mới dữ liệu bản thử từ bản chính, đã che tên, số điện thoại, email khách. Mật khẩu thành viên thử `thu123456`. |

Bản thử tự nhận ra khi `BASE_URL` bắt đầu bằng `https://thu.` (hoặc đặt `SITE_MODE=thu`): tin Telegram có nhãn [THỬ], không gửi thư cho khách
(đặt `TEST_MAIL_TO` trong `.env` bản thử nếu muốn nhận mọi thư thử về một hộp), trang hiện dải đỏ BẢN THỬ.

Ghi đè đường dẫn, tên mạng (mặc định mạng Caddy tên `web`) trong `/opt/psq-ops/ops.conf`, ví dụ `PROXY_NET=web`.

