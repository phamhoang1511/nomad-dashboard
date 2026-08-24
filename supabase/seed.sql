-- =============================================================================
-- Dữ liệu mẫu (tuỳ chọn) — 6 căn hộ giống file design.
-- Chạy sau 0001_init.sql nếu bạn muốn có sẵn danh sách căn để thử.
-- Chạy lại nhiều lần cũng không nhân đôi (unique trên code).
-- Sửa lại giá cho đúng thực tế của bạn, hoặc quản lý thẳng trong màn /apartments.
-- =============================================================================

insert into public.hs_apartments (code, name, building, hourly_rate, nightly_rate, sort_order) values
  ('MSB.3301',  'Studio hướng hồ',       'Masteri', 150000,  700000,  10),
  ('MSB.3612A', '1PN ban công',          'Masteri', 180000,  850000,  20),
  ('TK2.1209',  'Studio góc',            'The K2',  140000,  650000,  30),
  ('TC1.2204',  '1PN full nội thất',     'The C1',  170000,  800000,  40),
  ('MSB.3628',  'Studio view thành phố', 'Masteri', 150000,  720000,  50),
  ('TC1.2610',  '2PN gia đình',          'The C1',  250000, 1200000,  60)
on conflict (code) do nothing;

-- Ví dụ chi phí định kỳ: tiền thuê lại từng căn, thu vào mùng 5 hàng tháng.
-- Bỏ comment và chỉnh số tiền nếu muốn dùng.
--
-- insert into public.hs_recurring_expenses (apartment_id, category_id, amount, day_of_month, start_month, note)
-- select a.id,
--        (select id from public.hs_expense_categories where code = 'rent'),
--        12000000,
--        5,
--        date_trunc('month', now() at time zone 'Asia/Ho_Chi_Minh')::date,
--        'Tiền thuê lại căn hộ'
--   from public.hs_apartments a;
