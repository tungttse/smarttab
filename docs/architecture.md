🖼️ Mockup UI – Idea Vault với Export
1. Idea Vault (Dashboard)
---------------------------------------------------
| LOGO          |  [ Search Ideas... ]   | Profile |
---------------------------------------------------
|   📌 Blog Ideas (from your highlights)           |
---------------------------------------------------
| Idea #1: "How AI saves 2 hours a day at work"
   Source: Highlight from Forbes.com
   Actions: [ Copy ] [ Export → Notion ] [ Export → WP Draft ]
---------------------------------------------------
| Idea #2: "3 Unexpected Lessons from Remote Work"
   Source: Highlight from Medium
   Actions: [ Copy ] [ Export → Notion ] [ Export → Google Docs ]
---------------------------------------------------
| Idea #3: "Why Students Should Embrace AI Tools"
   Source: Highlight from NYTimes
   Actions: [ Copy ] [ Export → Substack ]
---------------------------------------------------
| + Add Highlight (manual paste)                   |
---------------------------------------------------


👉 Điểm nhấn: mỗi idea có 3 hành động rõ ràng

Copy (markdown / plain text).

Export nhanh (Notion, WP, Docs, Substack).

Không có tag/folder → giữ gọn.

2. Export Modal (khi bấm Export)
-----------------------------------------
| Export Idea → WordPress                |
-----------------------------------------
Title: How AI saves 2 hours a day at work
Category: [ Productivity ] v
Tags: [AI] [Work] 
Destination: [ MyBlog.com Draft ]
-----------------------------------------
[ Save as Draft ]     [ Publish Now ]


👉 Giữ nhẹ nhàng: chỉ vài trường chỉnh sửa.
👉 Default action = Save as Draft, để không phá quy trình của blogger chuyên nghiệp.

3. Weekly Digest Email (Momentum vibe)
Subject:  ✨ 3 Blog Ideas from Your Highlights This Week

Hello Tung, 

Here are 3 ideas generated from your highlights:

1. How AI saves 2 hours a day at work 
   → [ Export to WordPress Draft ]

2. 3 Unexpected Lessons from Remote Work
   → [ Export to Notion ]

3. Why Students Should Embrace AI Tools
   → [ Export to Google Docs ]

Keep writing, 
Your Idea Vault 🚀


👉 User không cần mở app → ngay trong email đã có nút export.
👉 Đây chính là “wow moment” giữ retention.

🎯 UX Principles (theo tinh thần Momentum)

Less is more: không có tag/folder/filter.

One-click action: highlight → idea → export.

Ambient reminder: digest email nhắc lại idea đã generate.


---

Idea Vault theo hướng lean, dễ build nhưng scale được.

🏗️ Kiến trúc hệ thống (Text Diagram)
                ┌─────────────────────────┐
                │      User Devices        │
                └─────────────────────────┘
                       /            \
                      /              \
             ┌───────────────┐   ┌───────────────┐
             │ Browser Ext.   │   │ Mobile App     │
             │ (Chrome/Edge)  │   │ (iOS/Android) │
             └───────────────┘   └───────────────┘
                     \                /
                      \              /
                     ┌────────────────┐
                     │    API Gateway │
                     │ (Backend REST) │
                     └────────────────┘
                              │
          ┌───────────────────┼──────────────────────┐
          │                   │                      │
┌────────────────┐   ┌─────────────────────┐   ┌─────────────────┐
│  Auth Service   │   │   Highlight Store   │   │   AI Service     │
│ (Google OAuth)  │   │ (Postgres/MongoDB)  │   │ (OpenAI/Claude) │
└────────────────┘   └─────────────────────┘   └─────────────────┘
                              │
                     ┌─────────────────┐
                     │ Idea Generator  │
                     │ (batch + single)│
                     └─────────────────┘
                              │
                     ┌─────────────────┐
                     │ Export Service  │
                     │ (WordPress,     │
                     │  Notion, Docs)  │
                     └─────────────────┘
                              │
                     ┌─────────────────┐
                     │ Email Service   │
                     │ (Digest sender) │
                     └─────────────────┘

🔎 Giải thích thành phần
Frontend

Browser Extension:

Capture highlight (selected text + URL).

Call API → save to backend.

Mobile App (React Native):

Capture highlight qua Share Sheet.

Vault view để xem + export.

Web App:

Vault dashboard, pricing page, signup/login.

Backend (API Gateway)

Auth Service:

Google OAuth / email login.

Highlight Store:

Database chính (Postgres hoặc MongoDB).

Schema: user_id, highlight_text, url, timestamp, idea_generated.

AI Service:

Call OpenAI/Claude.

Prompt: generate ideas (single or batch highlight).

Idea Generator:

Middleware: gom highlight → gửi qua AI → lưu kết quả.

Export Service:

Kết nối WordPress REST API, Notion API, Google Docs API.

Email Service:

Weekly digest (SendGrid/Postmark).

Nhắc user: “Bạn có 3 blog ideas từ highlight tuần trước”.

🚀 Flow dữ liệu chính

User highlight trên web/mobile → gửi về API → lưu vào Highlight Store.

API gọi AI Service → tạo blog ideas → lưu vào DB.

User mở Vault → thấy list ideas.

User chọn Export → Export Service gửi sang WordPress/Notion/Docs.

Hàng tuần, Email Service gửi digest với list ideas.

🧩 Công nghệ đề xuất

Frontend:

Web app: React + Next.js (deploy Vercel).

Mobile: React Native.

Extension: JS/TS + Manifest V3.

Backend:

Node.js (Express/Fastify/NestJS).

DB: Postgres (structured) hoặc MongoDB (flexible).

Infra:

Hosting: AWS Lightsail / Railway / Render.

AI: OpenAI GPT-4o hoặc Claude API.

Email: SendGrid/Postmark.

✅ Kết luận:

Đây là kiến trúc modular, dễ mở rộng.

Bạn có thể launch MVP chỉ với: Extension + Web App + Backend nhỏ + AI + Email digest.

Mobile app và export integration để Phase 2.

👉 Bạn có muốn mình lên luôn database schema đơn giản (bảng user, highlight, idea, export_log) để thấy rõ data flow không?
