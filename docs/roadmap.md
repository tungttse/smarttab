# 🛣 Hilidea Roadmap

## 🎯 Tầm nhìn
Hilidea giúp blogger và content creator **biến đoạn text highlight thành ý tưởng viết blog ngay tức thì**.  
Người dùng không còn chỉ “lưu text” mà sẽ nhận ngay **gợi ý headline/idea** để viết.  

---

## ⚡ Giai đoạn 1: MVP (1 Highlight → 1 Idea) – 0→1
**Mục tiêu:** có sản phẩm chạy được trên Chrome, cho phép highlight và tạo ra 1 idea đơn giản.  

- **Chrome Extension**
  - Manifest V3
  - Context menu hoặc shortcut: highlight → “Save to Hilidea”
  - Gọi API Hilidea (Next.js backend) để xử lý highlight → trả về idea
  - Hiển thị idea trong popup hoặc toast ngay trên trang

- **Web (Next.js)**
  - Landing page đơn giản (hilidea.com) → giải thích công dụng
  - API route `/api/idea` nhận text → trả về idea (rule-based/AI)
  - Dashboard tối giản: danh sách highlights & ideas

- **Backend (trong Next.js)**
  - DB: Supabase / PostgreSQL (lưu highlight + idea theo user)
  - Auth: Google login / email magic link (optional)

⏱ Thời gian: 1–2 tháng để ra MVP  

---

## 🚀 Giai đoạn 2: Trải nghiệm tốt hơn & mở rộng (Chrome)
**Mục tiêu:** làm extension trở nên hữu ích hơn, giữ chân user.  

- **UX cải tiến**
  - Popup đẹp: hiển thị idea + nút copy + nút “Save to Dashboard”
  - Onboarding flow ngắn (cài → highlight → có idea ngay)

- **Web Dashboard**
  - Quản lý ideas theo ngày, theo tag
  - Export ideas sang Notion / Trello / Wordpress

- **AI Enhancement**
  - Highlight → gợi ý **nhiều idea** (3–5 idea)
  - Tùy chọn style: blog headline, Twitter thread, LinkedIn post

⏱ Thời gian: 2–3 tháng sau MVP  

---

## 🌍 Giai đoạn 3: Đa nền tảng trình duyệt
**Mục tiêu:** không chỉ Chrome, mà còn Firefox + Edge.  

- **Firefox Extension**
  - Điều chỉnh manifest (Mozilla WebExtension API)
  - Đảm bảo UI & API call hoạt động

- **Microsoft Edge Store**
  - Port từ Chrome → Edge Store (gần như không cần sửa nhiều)

⏱ Thời gian: 1 tháng để port + test  

---

## 📱 Giai đoạn 4: Mobile Expansion
**Mục tiêu:** đưa Hilidea đến mobile, phục vụ blogger di động.  

- **Mobile App (React Native / Expo hoặc Next.js PWA)**
  - Cho phép user paste text hoặc import highlight từ trình duyệt di động
  - Lưu & gợi ý ideas ngay trên điện thoại

- **Mobile Use Case**
  - Share text từ browser → Hilidea app
  - Nhận push notification khi có idea mới

⏱ Thời gian: 3–6 tháng sau khi web + extension đã ổn  

---

## 🌟 Giai đoạn 5: Hệ sinh thái Hilidea
**Mục tiêu:** biến Hilidea thành công cụ trung tâm cho blogger/content creator.  

- **Marketplace Integrations**: Notion, Obsidian, Evernote, Medium  
- **Team/Collab**: chia sẻ idea với nhóm  
- **Premium Features** (SaaS):  
  - AI idea generator nâng cao (tone, audience)  
  - Idea library có tìm kiếm semantic  
  - Export đa định dạng (newsletter, social post)  

---

## 📌 Ưu tiên quan trọng
1. **Speed:** highlight → idea ngay lập tức (1–2 giây)  
2. **Simplicity:** user không phải học nhiều, chỉ cần highlight & nhận idea  
3. **Trust:** dữ liệu highlight riêng tư, có privacy policy rõ ràng  
