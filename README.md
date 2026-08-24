# Homestay Dashboard

Bảng điều hành booking & lợi nhuận cho homestay cho thuê **theo giờ và qua đêm**.
Next.js 16 (App Router) · TypeScript · Tailwind v4 · Supabase.

Giao diện dựng theo concept _Warm Minimal / Boutique Beige_ trong Claude Design.

## Chạy lần đầu

```bash
npm install
cp .env.local.example .env.local   # rồi điền URL + anon key
npm run dev
```

Trước đó cần dựng database: xem [`supabase/README.md`](supabase/README.md) — chạy
[`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql) trong SQL Editor, rồi tạo
một tài khoản ở **Authentication → Users** (app không có màn đăng ký).

Chưa cấu hình `.env.local` thì app hiện màn hình hướng dẫn 4 bước thay vì lỗi runtime.

## Các màn hình

| Đường dẫn     | Nội dung                                                                                       |
| ------------- | ---------------------------------------------------------------------------------------------- |
| `/`           | Dashboard: KPI tháng, dải thời gian 24h theo từng căn, bảng hiệu quả từng căn                   |
| `/bookings`   | Danh sách + bộ lọc, form thêm/sửa, thao tác nhanh Check-in / Check-out                          |
| `/expenses`   | Tab **Phát sinh** (chi phí thực tế) và **Định kỳ** (mẫu tự sinh hàng tháng)                     |
| `/pnl`        | P&L theo tháng: bảng từng căn, biểu đồ 12 tháng, phân tích chi phí theo danh mục                |
| `/apartments` | Quản lý danh sách căn hộ, giá theo giờ/đêm, thời gian dọn vệ sinh                               |

## Kiến trúc

**Auth ở server, dữ liệu ở client.** [`src/proxy.ts`](src/proxy.ts) (Next.js 16 đổi tên
`middleware` → `proxy`) làm mới session và chặn mọi route chưa đăng nhập. Các page là client
component đọc dữ liệu qua browser client — một đường auth duy nhất, và mở đường cho realtime.

**Mọi truy vấn nằm trong [`src/lib/queries.ts`](src/lib/queries.ts).** Component không tự dựng
`.from(...)`. Tên bảng khai trong hằng `TABLES` ở đầu file (tiền tố `hs_` — xem
[`supabase/README.md`](supabase/README.md)).

**[`useLiveData`](src/hooks/useLiveData.ts)** nạp dữ liệu, đăng ký Supabase Realtime cho các bảng
liên quan, và nạp lại khi người dùng quay lại tab. Identity của `fetcher` (bọc `useCallback`) chính
là tín hiệu nạp lại — không có mảng deps thứ hai để quên đồng bộ. Chấm **Live** ở dashboard phản
ánh trạng thái kết nối realtime thật.

**Giờ Việt Nam là hằng số.** [`src/lib/date.ts`](src/lib/date.ts) cộng/trừ offset UTC+7 cố định
(Việt Nam không có giờ mùa hè) nên "hôm nay" của homestay luôn đúng, kể cả khi mở dashboard từ
múi giờ khác.

**Logic timeline tách riêng** ở [`src/lib/timeline.ts`](src/lib/timeline.ts): cắt booking qua đêm về
đúng ngày đang xem, nối vệt dọn vệ sinh sau mỗi lượt, đánh dấu lượt đang diễn ra.

## Ghi chú thiết kế

- Bảng màu, typography và bo góc lấy từ file design, khai trong `@theme` ở
  [`src/app/globals.css`](src/app/globals.css).
- **Biểu đồ P&L dùng bộ màu riêng, đậm hơn** — gold/sage/clay gốc quá nhạt nên trượt cả ba phép
  kiểm tra sắc độ, tương phản và mù màu. Bộ đang dùng qua đủ 4 kiểm tra trên nền `#FDFBF7`. Chi
  tiết ghi trong [`PnlChart.tsx`](src/components/pnl/PnlChart.tsx) — đổi màu thì phải chạy lại
  validator.
- Bảng và dải timeline cuộn ngang trong khung riêng trên màn hình hẹp; trang không bao giờ tràn ngang.

## Lệnh

```bash
npm run dev     # dev server (Turbopack)
npm run build   # build production + kiểm tra type
npx eslint .    # lint
```
