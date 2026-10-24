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
     @hidden path /server/* /notes/* /.git/* *.md
     respond @hidden 404
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

## Khi anh duyệt xong, đưa lên bản chính

Làm như trên với các giá trị của bản chính:
- nhánh `main`, đã gộp `may-chu`;
- thư mục `/opt/web/phucsinhquantum`;
- dữ liệu `/opt/psq-data`;
- `NAME=psq-api`;
- `BASE_URL=https://phucsinhquantum.com`.

Khối Caddy của phucsinhquantum.com thêm `handle /api/*`, giống bản thử.

## Sao lưu

Máy chủ tự sao lưu mỗi ngày vào `<thư mục dữ liệu>/backups` và giữ 30 bản. Nên chép thêm thư mục này ra ngoài VPS định kỳ.
