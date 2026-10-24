/* =========================================================
   DỮ LIỆU WEB APP PHÚC SINH QUANTUM — sửa nội dung tại đây
   - Ảnh sản phẩm: để trống image: '' sẽ hiện hình vẽ mẫu (art).
     Muốn dùng ảnh thật: chép ảnh vào img/san-pham/ rồi ghi
     image: 'img/san-pham/ten-anh.jpg'
   - Chữ có ghi (mẫu) là nội dung giữ chỗ, anh thay bằng nội dung thật.
   ========================================================= */
window.SITE = {
  brand: 'Phúc Sinh QuanTum',
  short: 'PSQ',
  slogan: 'Tinh hoa trầm hương Việt',
  logo: 'img/logo-psq.png',
  phone: '0931 133 199',
  zalo: '0931133199',
  messenger: '',                   // TODO: tên trang Facebook để mở Messenger (m.me/ten-trang); để trống sẽ mở trang Liên hệ
  email: 'phucsinhquantum@gmail.com',
  address: '41 Nguyễn Đình Chiểu, Phường Sài Gòn, TP. Hồ Chí Minh',
  hours: 'Thứ 2 đến Chủ nhật, 8:00 đến 20:00',
  website: 'tenmien.vn',
  social: { facebook: '', youtube: '', tiktok: '', zalo: '' },   // link mạng xã hội thật (để trống = "sắp ra mắt")
  mapEmbed: '',                    // dán link nhúng Google Maps (https://www.google.com/maps/embed?...)
  bank: { name: 'Ngân hàng (mẫu)', account: '0000 0000 0000', owner: 'CONG TY PHUC SINH QUANTUM' },
  shipFee: 0,                      // phí giao hàng (0 = miễn phí)
  // tài khoản quản trị dùng thử (chỉ lưu trên trình duyệt, cần máy chủ thật trước khi chạy chính thức)
  demoAdmin: { email: 'admin@psq.vn', pass: 'psq2026' }
};

window.CATEGORIES = [
  { id: 'vong-tay', name: 'Vòng tay trầm hương', icon: 'ring' },
  { id: 'tram-tho', name: 'Trầm hương thô', icon: 'gem' },
  { id: 'day-chuyen', name: 'Dây chuyền trầm hương', icon: 'beads' },
  { id: 'tuong', name: 'Tượng trầm hương', icon: 'award' },
  { id: 'tra', name: 'Trà trầm hương', icon: 'leaf' },
  { id: 'luu-niem', name: 'Hàng lưu niệm', icon: 'gift' }
];

// Sản phẩm theo catalogue Phúc Sinh QuanTum (15/10/2026). Ảnh trong img/san-pham/. art: hình vẽ dự phòng khi thiếu ảnh.
window.PRODUCTS = [
  {"id": "vong-6-8li-tre-em", "cat": "vong-tay", "name": "Vòng trầm hương lượng tử dòng trẻ em", "price": 3990000, "art": "bracelet", "image": "img/san-pham/sp-00.jpg", "spec": "6-8 li, 17 hạt/vòng", "material": "Trầm hương tự nhiên", "tone": 0, "hot": true, "desc": "6-8 li, 17 hạt/vòng. Có thể mix mặt Phật, hoa sen, thánh giá, tỳ hưu,... hoặc đá phong thủy theo mệnh."},
  {"id": "vong-10li-hoc-sinh", "cat": "vong-tay", "name": "Vòng trầm hương lượng tử dòng học sinh", "price": 6800000, "art": "bracelet", "image": "img/san-pham/sp-01.jpg", "spec": "10 li, 17 hạt/vòng", "material": "Trầm hương tự nhiên", "tone": 1, "desc": "10 li, 17 hạt/vòng. Có thể mix mặt Phật, hoa sen, thánh giá, tỳ hưu,... hoặc đá phong thủy theo mệnh."},
  {"id": "vong-12li-nu-doanh-nhan", "cat": "vong-tay", "name": "Vòng trầm hương lượng tử dòng nữ doanh nhân", "price": 9900000, "art": "bracelet", "image": "img/san-pham/sp-02.jpg", "spec": "12 li, 14-16 hạt/vòng", "material": "Trầm hương tự nhiên", "tone": 2, "hot": true, "desc": "12 li, 14-16 hạt/vòng. Có thể mix mặt Phật, hoa sen, thánh giá, tỳ hưu,... hoặc đá phong thủy theo mệnh."},
  {"id": "vong-14li-nam-doanh-nhan", "cat": "vong-tay", "name": "Vòng trầm hương lượng tử dòng nam doanh nhân", "price": 13900000, "art": "bracelet", "image": "img/san-pham/sp-03.jpg", "spec": "14 li, 14 hạt/vòng", "material": "Trầm hương tự nhiên", "tone": 3, "hot": true, "desc": "14 li, 14 hạt/vòng. Có thể mix mặt Phật, hoa sen, thánh giá, tỳ hưu,... hoặc đá phong thủy theo mệnh."},
  {"id": "vong-16li-cao-cap", "cat": "vong-tay", "name": "Vòng trầm hương lượng tử dòng cao cấp", "price": 16800000, "art": "bracelet", "image": "img/san-pham/sp-04.jpg", "spec": "16 li, 13 hạt/vòng", "material": "Trầm hương tự nhiên", "tone": 4, "desc": "16 li, 13 hạt/vòng. Có thể mix mặt Phật, hoa sen, thánh giá, tỳ hưu,... hoặc đá phong thủy theo mệnh."},
  {"id": "vong-108-hat", "cat": "vong-tay", "name": "Vòng trầm hương lượng tử 108 hạt", "price": 16800000, "art": "mala", "image": "img/san-pham/sp-05.jpg", "spec": "Hạt 6 li, 8 li hoặc 10 li, 108 hạt", "material": "Trầm hương tự nhiên", "tone": 0, "hot": true, "desc": "Hạt 6 li, 8 li hoặc 10 li, 108 hạt. Có thể mix mặt Phật, hoa sen, thánh giá, tỳ hưu,... hoặc đá phong thủy theo mệnh."},
  {"id": "vong-lu-thong", "cat": "vong-tay", "name": "Vòng trầm hương lượng tử lu thống", "price": 16800000, "art": "bracelet", "image": "img/san-pham/sp-06.jpg", "spec": "10-12 li, 14-16 hạt", "material": "Trầm hương tự nhiên", "tone": 1, "desc": "10-12 li, 14-16 hạt. Có thể mix mặt Phật, hoa sen, thánh giá, tỳ hưu,... hoặc đá phong thủy theo mệnh."},
  {"id": "vong-nhat-ky-nhi-bong", "cat": "vong-tay", "name": "Vòng trầm hương lượng tử \"Nhất kỳ nhì bông\"", "price": 16800000, "art": "bracelet", "image": "img/san-pham/sp-07.jpg", "spec": "14 li, 14 hạt", "material": "Trầm hương tự nhiên", "tone": 2, "desc": "14 li, 14 hạt. Có thể mix mặt Phật, hoa sen, thánh giá, tỳ hưu,... hoặc đá phong thủy theo mệnh."},
  {"id": "dau-an-tram-tho-1", "cat": "tram-tho", "name": "Dấu ấn trầm thô trầm hương lượng tử (mẫu 1)", "price": 16800000, "art": "bracelet", "image": "img/san-pham/sp-08.jpg", "spec": "Mẫu mã lạ mắt", "material": "Trầm hương thô tự nhiên", "tone": 3, "hot": true, "desc": "Mẫu mã lạ mắt."},
  {"id": "dau-an-tram-tho-2", "cat": "tram-tho", "name": "Dấu ấn trầm thô trầm hương lượng tử (mẫu 2)", "price": 16800000, "art": "bracelet", "image": "img/san-pham/sp-09.jpg", "spec": "Mẫu mã lạ mắt", "material": "Trầm hương thô tự nhiên", "tone": 4, "desc": "Mẫu mã lạ mắt."},
  {"id": "dau-an-tram-tho-3", "cat": "tram-tho", "name": "Dấu ấn trầm thô trầm hương lượng tử (mẫu 3)", "price": 18800000, "art": "bracelet", "image": "img/san-pham/sp-10.jpg", "spec": "Mẫu mã lạ mắt", "material": "Trầm hương thô tự nhiên", "tone": 0, "desc": "Mẫu mã lạ mắt."},
  {"id": "dau-an-tram-tho-4", "cat": "tram-tho", "name": "Dấu ấn trầm thô trầm hương lượng tử (mẫu 4)", "price": 16800000, "art": "bracelet", "image": "img/san-pham/sp-11.jpg", "spec": "Mẫu mã lạ mắt", "material": "Trầm hương thô tự nhiên", "tone": 1, "desc": "Mẫu mã lạ mắt."},
  {"id": "dau-an-tram-tho-mau-truc", "cat": "tram-tho", "name": "Dấu ấn trầm thô trầm hương lượng tử mẫu trúc", "price": 16800000, "art": "bracelet", "image": "img/san-pham/sp-12.jpg", "spec": "Mẫu đẹp", "material": "Trầm hương thô tự nhiên", "tone": 2, "desc": "Mẫu đẹp."},
  {"id": "day-co-mat-tu-tho", "cat": "day-chuyen", "name": "Dây đeo cổ trầm hương lượng tử mẫu mắt tử thô", "price": 22000000, "art": "necklace", "image": "img/san-pham/sp-13.jpg", "spec": "Mẫu lạ mắt", "material": "Trầm hương tự nhiên", "tone": 3, "hot": true, "desc": "Mẫu lạ mắt."},
  {"id": "day-co-mat-tram-tho-1", "cat": "day-chuyen", "name": "Dây đeo cổ trầm hương lượng tử mặt trầm thô (mẫu 1)", "price": 16800000, "art": "necklace", "image": "img/san-pham/sp-14.jpg", "spec": "Mẫu lạ, nhìn đẹp và phong cách", "material": "Trầm hương tự nhiên", "tone": 4, "desc": "Mẫu lạ, nhìn đẹp và phong cách."},
  {"id": "day-co-mat-tram-tho-2", "cat": "day-chuyen", "name": "Dây đeo cổ trầm hương lượng tử mặt trầm thô (mẫu 2)", "price": 16800000, "art": "necklace", "image": "img/san-pham/sp-15.jpg", "spec": "Mẫu lạ mắt, nhìn đẹp và phong cách", "material": "Trầm hương tự nhiên", "tone": 0, "desc": "Mẫu lạ mắt, nhìn đẹp và phong cách."},
  {"id": "day-co-mat-thanh-gia", "cat": "day-chuyen", "name": "Dây đeo cổ trầm hương lượng tử mặt thánh giá", "price": 16800000, "art": "necklace", "image": "img/san-pham/sp-16.jpg", "spec": "Mẫu mới", "material": "Trầm hương tự nhiên", "tone": 1, "desc": "Mẫu mới."},
  {"id": "day-mat-thanh-gia-deo-tay", "cat": "day-chuyen", "name": "Dây trầm hương lượng tử mặt thánh giá (đeo cổ hoặc đeo tay)", "price": 16800000, "art": "necklace", "image": "img/san-pham/sp-17.jpg", "spec": "Mẫu mới, có thể đeo tay", "material": "Trầm hương tự nhiên", "tone": 2, "desc": "Mẫu mới, có thể đeo tay."},
  {"id": "tuong-quan-am-15cm", "cat": "tuong", "name": "Tượng Phật Quan Âm trầm hương lượng tử 15 cm", "price": 6800000, "art": "statue", "image": "img/san-pham/sp-18.jpg", "spec": "Mẫu tham khảo: cao 15 cm, rộng 9 cm; xác nhận theo phiên bản thực tế", "material": "Trầm hương tạc nguyên khối", "tone": 3, "hot": true, "desc": "Mẫu tham khảo: cao 15 cm, rộng 9 cm; xác nhận theo phiên bản thực tế."},
  {"id": "tuong-quan-am-22cm", "cat": "tuong", "name": "Tượng Phật Quan Âm trầm hương lượng tử 22 cm", "price": 8900000, "art": "statue", "image": "img/san-pham/sp-19.jpg", "spec": "Mẫu tham khảo: cao 22 cm, rộng 6 cm; xác nhận theo phiên bản thực tế", "material": "Trầm hương tạc nguyên khối", "tone": 4, "desc": "Mẫu tham khảo: cao 22 cm, rộng 6 cm; xác nhận theo phiên bản thực tế."},
  {"id": "tuong-treo-xe-5cm", "cat": "tuong", "name": "Tượng Phật trầm hương lượng tử treo xe ô tô 5 cm", "price": 3900000, "art": "car", "image": "img/san-pham/sp-20.jpg", "spec": "Mẫu tham khảo: cao 5 cm, rộng 3 cm; xác nhận theo phiên bản thực tế", "material": "Trầm hương tạc nguyên khối", "tone": 0, "hot": true, "desc": "Mẫu tham khảo: cao 5 cm, rộng 3 cm; xác nhận theo phiên bản thực tế."},
  {"id": "tuong-treo-xe-6cm", "cat": "tuong", "name": "Tượng Phật trầm hương lượng tử treo xe ô tô 6 cm", "price": 3900000, "art": "car", "image": "img/san-pham/sp-21.jpg", "spec": "Mẫu tham khảo: cao 6 cm, rộng 4 cm; xác nhận theo phiên bản thực tế", "material": "Trầm hương tạc nguyên khối", "tone": 1, "desc": "Mẫu tham khảo: cao 6 cm, rộng 4 cm; xác nhận theo phiên bản thực tế."},
  {"id": "tra-tram-huong-1", "cat": "tra", "name": "Trà trầm hương lượng tử (mẫu 1)", "price": 1680000, "art": "box", "image": "img/san-pham/sp-22.jpg", "spec": "Trà cuốn theo công nghệ oolong, hàm lượng GABA cao", "material": "Trà cuốn phối trầm hương", "tone": 2, "hot": true, "desc": "Trà cuốn theo công nghệ oolong, hàm lượng GABA cao."},
  {"id": "tra-tram-huong-2", "cat": "tra", "name": "Trà trầm hương lượng tử (mẫu 2)", "price": 1680000, "art": "box", "image": "img/san-pham/sp-23.jpg", "spec": "Trà cuốn theo công nghệ oolong, hàm lượng GABA cao", "material": "Trà cuốn phối trầm hương", "tone": 3, "desc": "Trà cuốn theo công nghệ oolong, hàm lượng GABA cao."},
  {"id": "lich-de-ban-tram", "cat": "luu-niem", "name": "Lịch để bàn trầm hương lượng tử cao cấp", "price": 6800000, "art": "box", "image": "img/san-pham/sp-24.jpg", "spec": "Thiết kế tinh tế, đầy đủ giờ, ngày, tháng, năm", "material": "Gỗ trầm hương", "tone": 4, "desc": "Thiết kế tinh tế, đầy đủ giờ, ngày, tháng, năm."},
  {"id": "but-tram-huong", "cat": "luu-niem", "name": "Bút trầm hương lượng tử cao cấp", "price": 9900000, "art": "box", "image": "img/san-pham/sp-25.jpg", "spec": "Thiết kế đẹp, phong cách sang trọng", "material": "Thân bút trầm hương", "tone": 0, "hot": true, "desc": "Thiết kế đẹp, phong cách sang trọng."}
];

window.POST_CATS = [
  { id: 'luong-tu', name: 'Trầm hương lượng tử' },
  { id: 'hinh-thanh', name: 'Nguồn gốc và hình thành' },
  { id: 'phan-loai', name: 'Phân loại và giá trị' },
  { id: 'su-dung', name: 'Sử dụng và bảo quản' }
];

// cover: ảnh bìa (dùng ảnh trong img/), body: nội dung HTML
window.POSTS = [
  { id: 'tram-huong-luong-tu-la-gi', cat: 'luong-tu', date: '20/10/2026', read: 6, cover: 'img/intro/phuc-sinh-canh-nen-ngay-m.jpg', featured: true,
    title: 'Trầm hương lượng tử là gì?',
    excerpt: 'Cách Phúc Sinh QuanTum gọi tên dòng trầm tuyển chọn: trầm tự nhiên, quy trình kiểm định riêng và trải nghiệm hương có chiều sâu.',
    body: `<p>“Trầm hương lượng tử” là tên gọi Phúc Sinh QuanTum đặt cho dòng sản phẩm trầm tuyển chọn của thương hiệu. Tên gọi thể hiện cách chúng tôi tiếp cận trầm hương: tôn trọng giá trị tự nhiên, kết hợp quy trình tuyển chọn và kiểm soát chất lượng hiện đại. (đoạn mẫu, anh thay bằng định nghĩa chính thức của thương hiệu)</p>
<h2>Ba trụ cột của dòng trầm lượng tử</h2>
<h3>1. Nguồn trầm tự nhiên</h3>
<p>Trầm được tạo thành trong thân cây dó bầu qua nhiều năm. Chúng tôi chỉ chọn trầm có nguồn gốc rõ ràng, có hồ sơ vùng nguyên liệu.</p>
<h3>2. Tuyển chọn và kiểm định</h3>
<p>Mỗi lô trầm được đánh giá theo màu, vân dầu, độ nặng và mùi hương. Thông tin lô được gắn với từng sản phẩm để khách tra cứu.</p>
<h3>3. Trải nghiệm hương</h3>
<p>Hương trầm thay đổi theo nhiệt độ và thời gian đeo. Chúng tôi hướng dẫn khách cách dùng để cảm nhận trọn tầng hương.</p>
<blockquote>Có những giá trị chỉ mở ra khi ta chậm lại.</blockquote>
<p>Lưu ý: trầm hương là sản phẩm văn hóa và tinh thần, không phải thuốc, không thay thế việc khám chữa bệnh.</p>` },
  { id: 'tram-hinh-thanh-nhu-the-nao', cat: 'hinh-thanh', date: '18/10/2026', read: 5, cover: 'img/intro/canh-1-may-nui-ngay-m.jpg',
    title: 'Trầm hương hình thành như thế nào?',
    excerpt: 'Từ vết thương trên thân cây dó bầu đến khối trầm thơm: một quá trình tự nhiên kéo dài nhiều năm.',
    body: `<p>Trầm hương hình thành khi cây dó bầu (chi Aquilaria) bị tổn thương, ví dụ do gió bão, côn trùng hay vi nấm. Cây tiết ra nhựa để tự bảo vệ, lượng nhựa này tích tụ dần trong thớ gỗ qua nhiều năm và tạo thành trầm.</p>
<h2>Các yếu tố quyết định chất lượng</h2>
<ul><li>Thời gian tích tụ nhựa: càng lâu, hương càng sâu.</li><li>Thổ nhưỡng và khí hậu vùng trồng.</li><li>Cách khai thác và xử lý sau khai thác.</li></ul>
<p>Việt Nam là một trong những vùng có trầm hương nổi tiếng, với các vùng nguyên liệu tại miền Trung và Tây Nguyên. (đoạn mẫu)</p>` },
  { id: 'phan-biet-cac-loai-tram', cat: 'phan-loai', date: '15/10/2026', read: 7, cover: 'img/intro/phuc-sinh-canh-nen-m.jpg',
    title: 'Phân biệt các loại trầm hương phổ biến',
    excerpt: 'Trầm tự nhiên, trầm cấy, trầm sánh chìm, trầm tốc: đặc điểm và cách nhận biết cơ bản.',
    body: `<p>Trên thị trường có nhiều cách gọi trầm hương. Dưới đây là cách phân loại phổ biến để khách dễ hình dung. (nội dung mẫu, anh bổ sung theo tiêu chuẩn của thương hiệu)</p>
<h3>Trầm tự nhiên</h3><p>Hình thành hoàn toàn trong tự nhiên, thời gian dài, số lượng hiếm nên giá trị cao.</p>
<h3>Trầm cấy</h3><p>Cây dó được tác động để tạo trầm, thời gian ngắn hơn, giá dễ tiếp cận hơn.</p>
<h3>Trầm sánh chìm</h3><p>Lượng dầu cao, khối trầm nặng, chìm trong nước. Đây là dòng được đánh giá cao.</p>
<h3>Trầm tốc</h3><p>Phần trầm hình thành do côn trùng đục khoét, hương ngọt đặc trưng.</p>
<h2>Mẹo nhận biết cơ bản</h2><ul><li>Quan sát vân dầu và màu sắc tự nhiên, không đều tuyệt đối.</li><li>Mùi hương dịu, có tầng, không gắt như hương liệu.</li><li>Mua tại nơi có giấy tờ nguồn gốc và chính sách đổi trả.</li></ul>` },
  { id: 'cach-deo-va-bao-quan-vong-tram', cat: 'su-dung', date: '12/10/2026', read: 4, cover: 'img/intro/canh-1-may-nui-m.jpg',
    title: 'Cách đeo và bảo quản vòng trầm luôn thơm',
    excerpt: 'Tránh nước, nước hoa và hóa chất. Cất trong hộp kín khi không đeo để giữ hương lâu.',
    body: `<h2>Khi đeo</h2><ul><li>Tháo vòng khi tắm, bơi, rửa tay hoặc làm việc nặng.</li><li>Tránh xịt nước hoa, kem dưỡng trực tiếp lên hạt.</li><li>Đeo thường xuyên giúp vòng lên nước bóng đẹp hơn.</li></ul>
<h2>Khi cất</h2><ul><li>Cất trong hộp kín hoặc túi vải, nơi khô thoáng.</li><li>Tránh ánh nắng gắt và nơi ẩm thấp.</li><li>Nếu hạt bị ướt, lau nhẹ bằng khăn mềm và để khô tự nhiên.</li></ul>
<p>Dây đeo nên được thay sau một thời gian sử dụng. Phúc Sinh QuanTum hỗ trợ thay dây miễn phí cho thành viên. (chính sách mẫu)</p>` },
  { id: 'xong-tram-dung-cach', cat: 'su-dung', date: '08/10/2026', read: 4, cover: 'img/intro/phuc-sinh-canh-nen-ngay-m.jpg',
    title: 'Xông trầm đúng cách trong nhà',
    excerpt: 'Chọn lư xông, lượng trầm và thời điểm xông để hương dịu, không gian thư thái.',
    body: `<p>Xông trầm là thói quen lâu đời trong nhiều gia đình Việt. Để hương dịu và an toàn, anh chị lưu ý các bước sau. (nội dung mẫu)</p>
<ul><li>Dùng lư xông điện ở nhiệt độ thấp hoặc than chuyên dụng.</li><li>Mỗi lần chỉ cần một lượng nhỏ trầm miếng hoặc một nụ trầm.</li><li>Mở hé cửa để không khí lưu thông.</li><li>Để xa tầm tay trẻ nhỏ, vật dễ cháy.</li></ul>` },
  { id: 'gia-tri-cua-tram', cat: 'phan-loai', date: '02/10/2026', read: 5, cover: 'img/intro/canh-1-may-nui-ngay-m.jpg',
    title: 'Điều gì làm nên giá trị của một chiếc vòng trầm?',
    excerpt: 'Loại trầm, kích thước hạt, độ đều hạt, tay nghề chế tác và giấy tờ nguồn gốc.',
    body: `<p>Hai chiếc vòng trông giống nhau có thể chênh giá nhiều lần. Các yếu tố chính gồm:</p>
<ul><li>Loại trầm và hàm lượng dầu.</li><li>Kích thước hạt: hạt lớn cần khối trầm lớn hơn.</li><li>Độ đều màu, đều vân giữa các hạt.</li><li>Tay nghề mài, khoan, đánh bóng.</li><li>Giấy kiểm định và chính sách bảo hành.</li></ul><p>(nội dung mẫu)</p>` }
];

// số liệu thương hiệu hiển thị ở trang chủ và trang giới thiệu (mẫu)
window.STATS = [
  { label: 'Khách hàng tin dùng', value: '12.000+', icon: 'users' },
  { label: 'Năm kinh nghiệm', value: '15', icon: 'award' },
  { label: 'Đại lý toàn quốc', value: '120+', icon: 'map' },
  { label: 'Đánh giá 5 sao', value: '98%', icon: 'star' }
];

// Video trải nghiệm khách hàng ở đầu trang chủ. Thêm, xóa, sắp xếp trong Quản trị > Video khách hàng.
// Danh sách dưới đây là mặc định khi trình duyệt chưa có danh sách lưu từ trang quản trị.
// Mẫu: { url: 'https://www.youtube.com/watch?v=XXXXXXXXXXX', title: 'Tên video', name: 'Tên khách hàng' }
window.VIDEOS = [];

window.REVIEWS = [
  { name: 'Chị Minh Anh', place: 'Hà Nội', text: 'Vòng thơm nhẹ, đeo cả ngày rất dễ chịu. Đóng gói sang trọng, giao nhanh. (đánh giá mẫu)' },
  { name: 'Anh Quốc Huy', place: 'Đà Nẵng', text: 'Tư vấn kỹ, có giấy tờ nguồn gốc rõ ràng. Sẽ quay lại mua làm quà. (đánh giá mẫu)' },
  { name: 'Cô Thu Hà', place: 'TP. Hồ Chí Minh', text: 'Nụ trầm khói mỏng, hương dịu, cả nhà đều thích. (đánh giá mẫu)' }
];

window.TEAM = [
  { name: 'Người sáng lập (mẫu)', role: 'Nhà sáng lập', initials: 'PS' },
  { name: 'Chuyên gia trầm (mẫu)', role: 'Tuyển chọn nguyên liệu', initials: 'TH' },
  { name: 'Nghệ nhân (mẫu)', role: 'Chế tác', initials: 'NN' },
  { name: 'Chăm sóc khách hàng (mẫu)', role: 'Tư vấn', initials: 'CS' }
];

window.TIMELINE = [
  { year: '2011', text: 'Bắt đầu từ một xưởng chế tác trầm nhỏ. (mẫu)' },
  { year: '2016', text: 'Xây dựng vùng nguyên liệu dó bầu. (mẫu)' },
  { year: '2021', text: 'Ra mắt thương hiệu Phúc Sinh. (mẫu)' },
  { year: '2026', text: 'Ra mắt dòng trầm hương lượng tử và web app thành viên. (mẫu)' }
];

// Đại lý uy tín hiển thị ở trang chủ và trang dai-ly.html. Thêm, sửa, xóa trong Quản trị > Trang web > Đại lý uy tín.
// Danh sách dưới đây là mặc định khi trình duyệt chưa có danh sách lưu từ trang quản trị (psq_dealers_v1).
window.DEALERS = [
  { id: 'dl-mau-1', code: 'PS1012', name: 'Đại lý Phúc An (mẫu)', area: 'TP. Hồ Chí Minh', address: 'Quận 1, TP. Hồ Chí Minh', phone: '', note: 'Trưng bày đầy đủ vòng trầm và nụ trầm.', photo: '' },
  { id: 'dl-mau-2', code: 'PS1010', name: 'Đại lý Hương Việt (mẫu)', area: 'Hà Nội', address: 'Quận Hoàn Kiếm, Hà Nội', phone: '', note: 'Tư vấn chọn vòng theo mệnh.', photo: '' },
  { id: 'dl-mau-3', code: 'PS1006', name: 'Đại lý Trầm Sơn (mẫu)', area: 'Đà Nẵng', address: 'Quận Hải Châu, Đà Nẵng', phone: '', note: 'Nhận đặt quà tặng doanh nghiệp.', photo: '' },
  { id: 'dl-mau-4', code: 'PS1005', name: 'Đại lý An Nhiên (mẫu)', area: 'Nghệ An', address: 'TP. Vinh, Nghệ An', phone: '', note: 'Giao nhanh khu vực Bắc Trung Bộ.', photo: '' },
  { id: 'dl-mau-5', code: 'PS1004', name: 'Đại lý Phúc Lộc (mẫu)', area: 'Cần Thơ', address: 'Quận Ninh Kiều, Cần Thơ', phone: '', note: 'Có góc trải nghiệm hương trầm.', photo: '' }
];

// Nội dung trang Giới thiệu. Sửa trong Quản trị > Trang web > Trang giới thiệu (lưu psq_about_v1, ghi đè lên mặc định dưới đây).
window.ABOUT = {
  heroEyebrow: 'Về Phúc Sinh QuanTum',
  heroTitle: 'Gìn giữ hương trầm Việt',
  heroEm: 'bằng sự tử tế.',
  heroLead: 'Chúng tôi tuyển chọn trầm hương tự nhiên, chế tác thủ công và minh bạch nguồn gốc cho từng sản phẩm, để mỗi món quà trầm mang đúng giá trị của nó.',
  heroImg: 'img/intro/canh-1-may-nui-ngay.jpg',
  storyEyebrow: 'Câu chuyện thương hiệu',
  storyTitle: 'Từ một xưởng trầm nhỏ đến thương hiệu trầm hương lượng tử',
  story: [
    'Phúc Sinh QuanTum bắt đầu từ một xưởng chế tác trầm nhỏ, nơi những người thợ dành nhiều năm học cách đọc vân dầu, cảm nhận độ nặng và lắng nghe từng tầng hương của khúc trầm. (mẫu)',
    'Chúng tôi tin rằng trầm hương là một sản phẩm văn hóa: thứ giúp ta chậm lại, thư thái hơn trong nhịp sống bận rộn. Vì thế mỗi sản phẩm đều đi kèm thông tin lô nguyên liệu, quy trình chế tác và chính sách hậu mãi rõ ràng. (mẫu)',
    '“Trầm hương lượng tử” là tên gọi dòng trầm tuyển chọn của thương hiệu, thể hiện cách chúng tôi kết hợp giá trị tự nhiên với quy trình kiểm soát chất lượng hiện đại. (mẫu)'
  ],
  promiseTitle: 'Cam kết của chúng tôi',
  promises: [
    'Trầm tự nhiên, có hồ sơ nguồn gốc cho từng lô',
    'Chế tác thủ công, kiểm tra từng hạt trước khi xâu',
    'Đổi trả trong 7 ngày nếu sản phẩm lỗi (mẫu)',
    'Thay dây miễn phí cho thành viên (mẫu)'
  ],
  values: [
    { t: 'Tôn trọng tự nhiên', d: 'Chỉ chọn trầm có nguồn gốc rõ ràng, khai thác có trách nhiệm với rừng dó và người trồng.' },
    { t: 'Minh bạch', d: 'Mỗi sản phẩm gắn với thông tin lô nguyên liệu, giấy kiểm định và chính sách bảo hành.' },
    { t: 'Tay nghề thủ công', d: 'Nghệ nhân mài, khoan, đánh bóng từng hạt để giữ vân dầu và hương trầm tự nhiên.' },
    { t: 'Đồng hành lâu dài', d: 'Tư vấn tận tâm, chăm sóc sau bán và chương trình cộng tác viên, đại lý.' }
  ],
  teamNote: 'Ảnh và tên thật của đội ngũ sẽ cập nhật sau (mẫu).',
  steps: [
    { t: 'Nguồn nguyên liệu', d: 'Thu mua từ vùng dó bầu có hồ sơ, ghi rõ nơi khai thác và thời gian tạo trầm. (mẫu)' },
    { t: 'Tuyển chọn', d: 'Đánh giá màu, vân dầu, độ nặng và mùi hương của từng khối trầm.' },
    { t: 'Chế tác', d: 'Nghệ nhân mài tay, khoan và đánh bóng, giữ lại vân trầm tự nhiên.' },
    { t: 'Kiểm định', d: 'Kiểm tra độ đều hạt, độ hoàn thiện và lập phiếu thông tin cho từng sản phẩm. (mẫu)' },
    { t: 'Đóng gói', d: 'Hộp quà sang trọng, kèm thẻ hướng dẫn bảo quản và giấy bảo hành.' }
  ],
  ctaTitle: 'Chọn món trầm hợp với mình',
  ctaText: 'Xem bộ sưu tập vòng trầm, chuỗi hạt, vật phẩm phong thủy, hoặc đăng ký thành viên miễn phí để nhận ưu đãi riêng.'
};
window.ABOUT_DEFAULT = JSON.parse(JSON.stringify({ about: window.ABOUT, team: window.TEAM, timeline: window.TIMELINE, stats: window.STATS }));

// Danh mục và bài viết do trang Quản trị sửa (lưu trên trình duyệt này) sẽ thay cho danh sách mặc định ở trên.
// Giữ nguyên mảng gốc (splice) để các đoạn mã đã giữ tham chiếu vẫn thấy nội dung mới. Bài viết bị ẩn không hiện ra ngoài.
(function () {
  const use = (arr, key, keep) => {
    try { const v = JSON.parse(localStorage.getItem(key)); if (Array.isArray(v) && v.length) arr.splice(0, arr.length, ...v.filter(x => x && x.id && (!keep || keep(x)))); } catch (e) {}
  };
  use(window.CATEGORIES, 'psq_cats_v1');
  use(window.POST_CATS, 'psq_postcats_v1');
  use(window.POSTS, 'psq_posts_v1', p => !p.hidden);
  // đánh giá khách hàng (Quản trị > Trang web > Khách hàng nói gì); đánh giá ẩn không hiện ra ngoài
  try { const v = JSON.parse(localStorage.getItem('psq_reviews_v1')); if (Array.isArray(v)) window.REVIEWS.splice(0, window.REVIEWS.length, ...v.filter(r => r && r.name && !r.hidden)); } catch (e) {}
  // trang giới thiệu: nội dung chữ, đội ngũ, cột mốc, số liệu (số liệu dùng chung với trang chủ)
  try {
    const a = JSON.parse(localStorage.getItem('psq_about_v1'));
    if (a && typeof a === 'object') {
      if (a.about) Object.assign(window.ABOUT, a.about);
      [['team', 'TEAM'], ['timeline', 'TIMELINE'], ['stats', 'STATS']].forEach(([k, g]) => { if (Array.isArray(a[k]) && a[k].length) window[g].splice(0, window[g].length, ...a[k]); });
    }
  } catch (e) {}
})();

// Thông tin cửa hàng, ngân hàng và link mạng xã hội sửa trong Quản trị > Hệ thống > Thiết lập (lưu psq_site_v1, ghi đè SITE ở mọi trang)
(function () {
  try {
    const v = JSON.parse(localStorage.getItem('psq_site_v1')); if (!v || typeof v !== 'object') return;
    ['brand', 'phone', 'zalo', 'email', 'address', 'hours'].forEach(k => { if (typeof v[k] === 'string' && v[k].trim()) SITE[k] = v[k].trim(); });
    ['messenger', 'mapEmbed'].forEach(k => { if (typeof v[k] === 'string') SITE[k] = v[k].trim(); });
    if (v.bank) ['name', 'account', 'owner'].forEach(k => { if (typeof v.bank[k] === 'string' && v.bank[k].trim()) SITE.bank[k] = v.bank[k].trim(); });
    if (v.social) ['facebook', 'youtube', 'tiktok', 'zalo'].forEach(k => { if (typeof v.social[k] === 'string') SITE.social[k] = v.social[k].trim(); });
  } catch (e) {}
})();
// đường dẫn Messenger: nhận tên trang (m.me/ten-trang) hoặc link đầy đủ
SITE.messLink = () => !SITE.messenger ? '' : /^https?:\/\//i.test(SITE.messenger) ? SITE.messenger : 'https://m.me/' + SITE.messenger.replace(/^@/, '');

// Điều khoản sử dụng hiện ở form đăng ký. Sửa trong Quản trị > Trang web > Điều khoản (lưu psq_terms_v1).
// Các chữ trong ngoặc nhọn tự thay bằng số liệu trong Thiết lập: {gia_goi} {diem_goi} {moc_dai_ly} {hh_ctv} {hh_daily}
// {thuong_gt} {thu_nhap_daily} {so_ngay} {thue} {rut_toi_thieu} {ten} {hotline} {email} {phi_goi} {gia_goi_dl} {diem_goi_dl}
window.TERMS_DEFAULT = [
  { t: 'Phạm vi áp dụng', b: 'Điều khoản này áp dụng cho mọi tài khoản đăng ký trên website và ứng dụng {ten}. Khi tích vào ô đồng ý, anh chị xác nhận đã đọc, hiểu và chấp nhận toàn bộ nội dung dưới đây.' },
  { t: 'Tài khoản', b: 'Anh chị cung cấp họ tên, số điện thoại, email đúng sự thật và tự bảo mật mật khẩu. Mỗi người chỉ dùng một tài khoản. Tên truy cập và mã thành viên dùng để giới thiệu, chuyển điểm và đối soát, không đổi được sau khi tạo.\nCông ty có quyền tạm khóa tài khoản có dấu hiệu gian lận, giả mạo thông tin hoặc dùng sai mục đích.' },
  { t: 'Cấp bậc thành viên', b: 'Khách hàng: đăng ký miễn phí, mua hàng như khách thông thường.\nCộng tác viên: kích hoạt gói {gia_goi}, nhận {diem_goi} vào ví điểm mua hàng. Phần còn lại là phí dịch vụ nền tảng (gian hàng online, khóa học, công cụ) và không hoàn lại sau khi đã kích hoạt.\nĐại lý: tổng tiền mua hàng đã thanh toán cộng dồn đạt {moc_dai_ly}, hoặc mua gói đại lý {gia_goi_dl} (nhận {diem_goi_dl} vào ví mua hàng). Gói kích hoạt cộng tác viên và gói đại lý không tính vào doanh số cộng dồn, không tính hoa hồng cho người giới thiệu.' },
  { t: 'Hoa hồng và thu nhập', b: 'Hoa hồng tính trên đơn mua hàng của người do anh chị giới thiệu trực tiếp: cộng tác viên {hh_ctv}, đại lý {hh_daily}. Hoa hồng chỉ ghi nhận khi đơn hàng ở trạng thái Hoàn thành.\nThưởng giới thiệu {thuong_gt} khi người được giới thiệu kích hoạt cộng tác viên. Đại lý nhận thêm {thu_nhap_daily} thu nhập từ đơn mua hàng của đại lý do mình giới thiệu, khi đủ điều kiện hoạt động trong {so_ngay} ngày gần nhất.\nThu nhập phụ thuộc vào kết quả bán hàng thực tế của mỗi người. Công ty không cam kết mức thu nhập cố định nào.' },
  { t: 'Ví, điểm và rút tiền', b: '1 điểm PS tương đương 1 đồng và chỉ dùng trong hệ thống {ten}. Điểm mua hàng chỉ dùng để thanh toán đơn hàng.\nKhi rút hoa hồng hoặc chuyển điểm thưởng, hệ thống khấu trừ thuế thu nhập cá nhân {thue} theo quy định. Số tiền rút tối thiểu mỗi lần là {rut_toi_thieu}. Lệnh rút được kế toán duyệt và chuyển khoản về tài khoản ngân hàng đúng tên chủ tài khoản.' },
  { t: 'Đơn hàng, đổi sản phẩm', b: 'Đơn đã thanh toán không hủy được vì hoa hồng và điểm đã được ghi nhận. Anh chị có thể đổi sang sản phẩm cùng giá, hoặc sản phẩm giá cao hơn và chuyển bù phần chênh lệch.\nSản phẩm lỗi do sản xuất hoặc giao sai mẫu được đổi trong 7 ngày theo chính sách đổi trả. Sản phẩm trầm hương không phải là thuốc và không có tác dụng thay thế thuốc chữa bệnh.' },
  { t: 'Hành vi không được phép', b: 'Đưa thông tin sai về sản phẩm, công dụng hoặc thu nhập; tự ý hứa hẹn lợi nhuận với người khác; mua bán, chuyển nhượng tài khoản; tạo nhiều tài khoản để hưởng hoa hồng; dùng tên, logo công ty khi chưa được phép. Vi phạm có thể bị thu hồi hoa hồng chưa rút và khóa tài khoản.' },
  { t: 'Chính sách bảo mật', b: 'Công ty thu thập họ tên, số điện thoại, email, địa chỉ giao hàng và lịch sử giao dịch để xử lý đơn hàng, tính hoa hồng, chăm sóc khách hàng và thực hiện nghĩa vụ thuế. Thông tin không được bán hay chia sẻ cho bên thứ ba, trừ đơn vị vận chuyển, ngân hàng và cơ quan nhà nước khi pháp luật yêu cầu.\nAnh chị có quyền xem, sửa thông tin cá nhân trong trang Hồ sơ và yêu cầu xóa tài khoản qua hotline hoặc email của công ty.' },
  { t: 'Thay đổi điều khoản', b: 'Công ty có thể cập nhật điều khoản và tỉ lệ hoa hồng. Thay đổi được thông báo trên website và áp dụng cho giao dịch phát sinh sau thời điểm thông báo. Mọi thắc mắc xin liên hệ {hotline} hoặc {email}.' }
];
window.TERMS = (function () {
  try { const v = JSON.parse(localStorage.getItem('psq_terms_v1')); if (Array.isArray(v) && v.length) return v.filter(x => x && (x.t || x.b)); } catch (e) {}
  return window.TERMS_DEFAULT.map(x => ({ ...x }));
})();


// Quyền lợi từng cấp bậc (form đăng ký, trang Thành viên, trang kích hoạt). Sửa trong Quản trị > Trang web > Quyền lợi CTV, đại lý (lưu psq_perks_v1).
// Dùng được các chữ {…} như điều khoản, thêm {phi_goi} {gia_goi_dl} {diem_goi_dl}.
window.PERKS_DEFAULT = {
  khach: ['Mua hàng điền mã giảm giá để nhận chiết khấu'],
  ctv: ['Nhận {diem_goi} vào ví mua hàng', 'Nhận ngay khóa học xây kênh và bán hàng online trị giá 5.000.000đ', 'Tặng công cụ làm video hàng loạt và livestream đa nền tảng trị giá 15.000.000đ', 'Thưởng {thuong_gt} khi người mình giới thiệu kích hoạt CTV', 'Bán hàng nhận hoa hồng {hh_ctv}'],
  ctvFee: ['Khóa học xây kênh và bán hàng online trị giá 5.000.000đ', 'Tặng công cụ làm video hàng loạt và livestream đa nền tảng trị giá 15.000.000đ'],
  daily: ['Nhận ngay gian hàng online trị giá 10.000.000đ', 'Khóa học cao cấp cầm tay chỉ việc trị giá 15.000.000đ', 'Bộ công cụ tạo video hàng loạt và livestream đa nền tảng trị giá 30.000.000đ', 'Bán hàng nhận hoa hồng {hh_daily}', 'Hưởng {thu_nhap_daily} thu nhập của đại lý tuyến dưới'],
  dailyPkg: ['Lên Đại lý ngay khi công ty xác nhận thanh toán', 'Nhận đủ {diem_goi_dl} vào ví mua hàng, lấy hàng dần theo nhu cầu', 'Hưởng toàn bộ quyền lợi Đại lý']
};
window.PERKS = (function () {
  const D = window.PERKS_DEFAULT, out = {};
  let v = null; try { v = JSON.parse(localStorage.getItem('psq_perks_v1')); } catch (e) {}
  Object.keys(D).forEach(k => { out[k] = v && Array.isArray(v[k]) ? v[k].filter(x => typeof x === 'string' && x.trim()) : D[k].slice(); });
  return out;
})();
