# Supabase — cài đặt database

## 1. Tạo project

Vào [supabase.com/dashboard](https://supabase.com/dashboard) → **New project**. Chọn region gần
Việt Nam (Singapore) cho độ trễ thấp nhất.

## 2. Chạy migration

**Cách nhanh (không cần cài gì):** mở **SQL Editor** trong Supabase Studio, dán toàn bộ nội dung
[`migrations/0001_init.sql`](migrations/0001_init.sql) rồi **Run**.

**Cách dùng CLI:**

```bash
npx supabase link --project-ref <project-ref>
npx supabase db push
```

Muốn có sẵn 6 căn hộ mẫu để thử thì chạy tiếp [`seed.sql`](seed.sql).

## 3. Tạo tài khoản đăng nhập

App **không có màn đăng ký** — đây là công cụ nội bộ. Tạo user thủ công:

**Authentication → Users → Add user → Create new user**, nhập email + mật khẩu, bật
_Auto Confirm User_.

## 4. Lấy key cho frontend

**Project Settings → API**, copy vào `.env.local` ở thư mục gốc:

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...
```

Chỉ dùng **anon key**. `service_role` key bỏ qua RLS — không bao giờ đưa vào biến `NEXT_PUBLIC_*`
vì mọi biến này đều bị nhúng thẳng vào bundle trình duyệt.

---

## Những điểm cần biết về schema

### Tiền tố `hs_`

Project Supabase này đã có sẵn một bảng `public.bookings` của app khác. Mọi bảng, view, hàm và
trigger của dashboard đều mang tiền tố `hs_` (`hs_apartments`, `hs_bookings`, `hs_expenses`…) để
không đụng vào dữ liệu đó. Phần `grant` cũng liệt kê từng bảng thay vì `all tables in schema public`
vì lý do tương tự.

Tên bảng khai báo một chỗ duy nhất trong code: hằng `TABLES` ở [`src/lib/queries.ts`](../src/lib/queries.ts).
Nếu sau này bạn tách sang project riêng và muốn bỏ tiền tố, sửa hằng đó cùng file migration là đủ.

### Bảo mật

RLS bật trên cả 5 bảng, mỗi bảng một policy `for all to authenticated`. Role `anon` không có policy
nào nên không đọc được gì, kể cả khi anon key bị lộ. Các view P&L đặt `security_invoker = on` —
thiếu dòng này view sẽ chạy bằng quyền owner và **vô hiệu hoá RLS của bảng gốc**.

### Chống trùng lịch

Trigger `hs_bookings_no_overlap` chặn hai booking cùng căn chồng thời gian, có cộng thêm
`cleaning_buffer_minutes` của căn đó (mặc định 15 phút) vào cả hai phía. Booking `cancelled` được bỏ qua.

Lỗi trả về mang mã `23P01` và message bắt đầu bằng `BOOKING_OVERLAP:` — frontend bắt tiền tố này để
hiện thông báo tiếng Việt thay vì lỗi Postgres thô.

### Chi phí định kỳ

`hs_recurring_expenses` là *mẫu*, không phải chi phí. Hàm `hs_ensure_recurring_expenses(p_month)`
vật chất hoá chúng thành các dòng `hs_expenses` thật cho tháng được chỉ định. App gọi hàm này khi
bạn mở dashboard hoặc trang P&L của một tháng, và có nút bấm tay ở tab **Định kỳ**.

Hàm idempotent nhờ unique index `(recurring_id, expense_month)` — gọi bao nhiêu lần cũng chỉ ra
đúng một dòng mỗi định kỳ mỗi tháng. Vì là dòng thật nên bạn vẫn sửa số tiền hoặc xoá riêng cho
một tháng cụ thể được (ví dụ tháng đó chủ nhà giảm giá).

Đổi số tiền trong `hs_recurring_expenses` **không** hồi tố các tháng đã sinh — đúng như mong đợi.

### Ghi nhận doanh thu

Doanh thu tính theo tháng của `start_at` (giờ Việt Nam). Booking qua đêm vắt qua ranh giới tháng
(vào 31/8, ra 2/9) được tính **trọn vào tháng check-in**. Với homestay quy mô nhỏ thì đây là cách
đối chiếu sổ sách dễ nhất. Nếu sau này cần phân bổ theo từng đêm, sửa `hs_v_revenue_monthly` —
frontend không cần đổi gì vì chỉ đọc qua view.

Booking `cancelled` không tính vào doanh thu. Các trạng thái khác đều tính, kể cả `tentative`.

### Chi phí chung

`apartment_id` trong `hs_expenses` và `hs_recurring_expenses` cho phép `null` = chi phí không gắn căn nào
(marketing, lương, phần mềm…). Các khoản này hiện thành dòng **"Chi phí chung"** ở trang P&L và
có trừ vào tổng lợi nhuận, nhưng không phân bổ về từng căn.
