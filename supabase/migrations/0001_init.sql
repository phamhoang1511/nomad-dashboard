-- =============================================================================
-- Homestay Dashboard — schema khởi tạo
--
-- Chạy toàn bộ file này một lần trong Supabase SQL Editor (hoặc `supabase db push`).
-- Chạy lại được nhiều lần: không nhân đôi bảng hay danh mục.
--
-- TIỀN TỐ `hs_`: project Supabase này đã có sẵn một bảng `public.bookings` của
-- app khác. Mọi đối tượng của dashboard đều mang tiền tố hs_ để không đụng vào
-- dữ liệu đó. Phần GRANT cũng liệt kê từng bảng thay vì "all tables in schema"
-- vì lý do tương tự.
--
-- Quy ước thời gian: mọi mốc lưu dạng timestamptz (UTC). Mọi phép tính
-- "hôm nay" / "tháng này" quy đổi sang 'Asia/Ho_Chi_Minh' ngay tại chỗ dùng.
-- =============================================================================

create extension if not exists pgcrypto;

-- -----------------------------------------------------------------------------
-- 1. Căn hộ
-- -----------------------------------------------------------------------------
create table if not exists public.hs_apartments (
  id                      uuid primary key default gen_random_uuid(),
  code                    text not null unique,          -- 'MSB.3301'
  name                    text,                          -- 'Studio ban công'
  building                text,                          -- 'Masteri'
  hourly_rate             numeric(14, 2) not null default 0,
  nightly_rate            numeric(14, 2) not null default 0,
  cleaning_buffer_minutes int  not null default 15 check (cleaning_buffer_minutes between 0 and 240),
  status                  text not null default 'active' check (status in ('active', 'paused', 'archived')),
  sort_order              int  not null default 0,
  note                    text,
  created_at              timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- 2. Booking (hybrid: theo giờ hoặc qua đêm)
-- -----------------------------------------------------------------------------
create table if not exists public.hs_bookings (
  id           uuid primary key default gen_random_uuid(),
  apartment_id uuid not null references public.hs_apartments (id) on delete cascade,
  guest_name   text not null,
  guest_phone  text,
  booking_type text not null default 'hourly'    check (booking_type in ('hourly', 'overnight')),
  start_at     timestamptz not null,
  end_at       timestamptz not null,
  status       text not null default 'confirmed' check (status in ('tentative', 'confirmed', 'checked_in', 'checked_out', 'cancelled')),
  total_amount numeric(14, 2) not null default 0 check (total_amount >= 0),
  paid_amount  numeric(14, 2) not null default 0 check (paid_amount  >= 0),
  note         text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint hs_bookings_time_order check (end_at > start_at)
);

create index if not exists hs_bookings_apartment_start_idx on public.hs_bookings (apartment_id, start_at);
create index if not exists hs_bookings_start_idx           on public.hs_bookings (start_at);

create or replace function public.hs_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists hs_bookings_set_updated_at on public.hs_bookings;
create trigger hs_bookings_set_updated_at
  before update on public.hs_bookings
  for each row execute function public.hs_set_updated_at();

-- Chống trùng lịch. Dùng trigger thay vì EXCLUDE USING gist vì buffer dọn dẹp
-- đọc theo từng căn, và vì `timestamptz + interval` chỉ STABLE nên không dùng
-- được trong generated column / exclusion constraint.
create or replace function public.hs_bookings_check_overlap()
returns trigger
language plpgsql
as $$
declare
  v_buffer   int;
  v_conflict record;
begin
  if new.status = 'cancelled' then
    return new;
  end if;

  select coalesce(a.cleaning_buffer_minutes, 0)
    into v_buffer
    from public.hs_apartments a
   where a.id = new.apartment_id;

  select b.guest_name, b.start_at, b.end_at
    into v_conflict
    from public.hs_bookings b
   where b.apartment_id = new.apartment_id
     and b.id <> new.id
     and b.status <> 'cancelled'
     -- Đệm cộng vào cả hai phía: hai lượt khách phải cách nhau đủ thời gian dọn.
     and tstzrange(new.start_at, new.end_at + make_interval(mins => v_buffer), '[)')
      && tstzrange(b.start_at,   b.end_at   + make_interval(mins => v_buffer), '[)')
   limit 1;

  if found then
    raise exception
      using
        errcode = '23P01', -- exclusion_violation
        message = format(
          'BOOKING_OVERLAP: căn hộ đã có booking của %s (%s → %s), tính cả %s phút dọn dẹp.',
          coalesce(nullif(v_conflict.guest_name, ''), 'khách khác'),
          to_char(v_conflict.start_at at time zone 'Asia/Ho_Chi_Minh', 'DD/MM HH24:MI'),
          to_char(v_conflict.end_at   at time zone 'Asia/Ho_Chi_Minh', 'DD/MM HH24:MI'),
          v_buffer
        );
  end if;

  return new;
end;
$$;

drop trigger if exists hs_bookings_no_overlap on public.hs_bookings;
create trigger hs_bookings_no_overlap
  before insert or update of apartment_id, start_at, end_at, status on public.hs_bookings
  for each row execute function public.hs_bookings_check_overlap();

-- -----------------------------------------------------------------------------
-- 3. Danh mục chi phí
-- -----------------------------------------------------------------------------
create table if not exists public.hs_expense_categories (
  id         uuid primary key default gen_random_uuid(),
  code       text not null unique,
  name       text not null,
  kind       text not null default 'variable' check (kind in ('fixed', 'variable')),
  sort_order int  not null default 0
);

insert into public.hs_expense_categories (code, name, kind, sort_order) values
  ('rent',       'Tiền thuê nhà',    'fixed',    10),
  ('electric',   'Điện',             'variable', 20),
  ('water',      'Nước',             'variable', 30),
  ('internet',   'Internet',         'fixed',    40),
  ('cleaning',   'Dọn vệ sinh',      'variable', 50),
  ('supplies',   'Đồ dùng / Vật tư', 'variable', 60),
  ('repair',     'Sửa chữa',         'variable', 70),
  ('management', 'Phí quản lý',      'fixed',    80),
  ('other',      'Khác',             'variable', 90)
on conflict (code) do nothing;

-- -----------------------------------------------------------------------------
-- 4. Chi phí định kỳ (tiền thuê lại căn hộ, internet, phí quản lý…)
-- -----------------------------------------------------------------------------
create table if not exists public.hs_recurring_expenses (
  id           uuid primary key default gen_random_uuid(),
  apartment_id uuid references public.hs_apartments (id) on delete cascade, -- null = chi phí chung
  category_id  uuid not null references public.hs_expense_categories (id),
  amount       numeric(14, 2) not null check (amount >= 0),
  day_of_month int  not null default 1 check (day_of_month between 1 and 28), -- ≤28 để mọi tháng đều có ngày này
  start_month  date not null,
  end_month    date,                                                         -- null = còn hiệu lực
  active       boolean not null default true,
  note         text,
  created_at   timestamptz not null default now(),
  constraint hs_recurring_month_order check (end_month is null or end_month >= start_month)
);

-- Chuẩn hoá start_month/end_month về ngày mùng 1 để so sánh tháng luôn đúng.
create or replace function public.hs_recurring_normalize_months()
returns trigger
language plpgsql
as $$
begin
  new.start_month := date_trunc('month', new.start_month::timestamp)::date;
  if new.end_month is not null then
    new.end_month := date_trunc('month', new.end_month::timestamp)::date;
  end if;
  return new;
end;
$$;

drop trigger if exists hs_recurring_expenses_normalize on public.hs_recurring_expenses;
create trigger hs_recurring_expenses_normalize
  before insert or update on public.hs_recurring_expenses
  for each row execute function public.hs_recurring_normalize_months();

-- -----------------------------------------------------------------------------
-- 5. Chi phí thực tế
-- -----------------------------------------------------------------------------
create table if not exists public.hs_expenses (
  id            uuid primary key default gen_random_uuid(),
  apartment_id  uuid references public.hs_apartments (id) on delete cascade, -- null = chi phí chung
  category_id   uuid not null references public.hs_expense_categories (id),
  amount        numeric(14, 2) not null check (amount >= 0),
  incurred_on   date not null,
  note          text,
  recurring_id  uuid references public.hs_recurring_expenses (id) on delete set null,
  created_at    timestamptz not null default now(),
  -- Ép ::timestamp để chọn đúng overload IMMUTABLE của date_trunc
  -- (bản nhận timestamptz chỉ STABLE nên generated column sẽ bị từ chối).
  expense_month date generated always as (date_trunc('month', incurred_on::timestamp)::date) stored
);

-- Mỗi chi phí định kỳ chỉ sinh đúng 1 dòng cho mỗi tháng → RPC bên dưới idempotent.
create unique index if not exists hs_expenses_recurring_once_per_month
  on public.hs_expenses (recurring_id, expense_month)
  where recurring_id is not null;

create index if not exists hs_expenses_month_idx           on public.hs_expenses (expense_month);
create index if not exists hs_expenses_apartment_month_idx on public.hs_expenses (apartment_id, expense_month);

-- Vật chất hoá chi phí định kỳ của một tháng thành các dòng `hs_expenses` thật.
-- Sinh dòng thật (thay vì tính bay trong view) để vẫn sửa/xoá override từng tháng được.
-- Gọi lại bao nhiêu lần cũng chỉ ra đúng 1 dòng/định kỳ/tháng.
create or replace function public.hs_ensure_recurring_expenses(p_month date)
returns integer
language plpgsql
security invoker
as $$
declare
  v_month    date := date_trunc('month', p_month::timestamp)::date;
  v_inserted integer;
begin
  insert into public.hs_expenses (apartment_id, category_id, amount, incurred_on, note, recurring_id)
  select r.apartment_id,
         r.category_id,
         r.amount,
         v_month + (r.day_of_month - 1),
         r.note,
         r.id
    from public.hs_recurring_expenses r
   where r.active
     and r.start_month <= v_month
     and (r.end_month is null or r.end_month >= v_month)
  on conflict do nothing;

  get diagnostics v_inserted = row_count;
  return v_inserted;
end;
$$;

-- -----------------------------------------------------------------------------
-- 6. Views tổng hợp P&L
--
-- security_invoker = on là bắt buộc: không có nó view chạy bằng quyền của owner
-- và RLS của bảng gốc bị bỏ qua.
-- -----------------------------------------------------------------------------

-- Doanh thu ghi nhận theo tháng của start_at (giờ VN). Booking qua đêm vắt tháng
-- được tính trọn vào tháng check-in — xem supabase/README.md.
create or replace view public.hs_v_revenue_monthly as
select
  b.apartment_id,
  date_trunc('month', b.start_at at time zone 'Asia/Ho_Chi_Minh')::date as month,
  sum(b.total_amount)::numeric(14, 2) as revenue,
  sum(b.paid_amount)::numeric(14, 2)  as paid,
  count(*)::int                       as bookings_count,
  round(sum(extract(epoch from (b.end_at - b.start_at)) / 3600.0)::numeric, 2) as booked_hours
from public.hs_bookings b
where b.status <> 'cancelled'
group by 1, 2;

create or replace view public.hs_v_expense_monthly as
select
  e.apartment_id,
  e.expense_month               as month,
  sum(e.amount)::numeric(14, 2) as expense
from public.hs_expenses e
group by 1, 2;

-- apartment_id = null nghĩa là chi phí chung, không gắn căn nào.
create or replace view public.hs_v_pnl_monthly as
select
  coalesce(r.apartment_id, e.apartment_id) as apartment_id,
  coalesce(r.month, e.month)               as month,
  coalesce(r.revenue, 0)::numeric(14, 2)   as revenue,
  coalesce(e.expense, 0)::numeric(14, 2)   as expense,
  (coalesce(r.revenue, 0) - coalesce(e.expense, 0))::numeric(14, 2) as profit,
  coalesce(r.bookings_count, 0)            as bookings_count,
  coalesce(r.booked_hours, 0)              as booked_hours
from public.hs_v_revenue_monthly r
full outer join public.hs_v_expense_monthly e
  on r.apartment_id is not distinct from e.apartment_id
 and r.month = e.month;

-- Lợi nhuận tích luỹ toàn thời gian — nguồn cho cột "Lợi nhuận tích lũy".
create or replace view public.hs_v_apartment_cumulative as
select
  apartment_id,
  sum(revenue)::numeric(14, 2) as revenue,
  sum(expense)::numeric(14, 2) as expense,
  sum(profit)::numeric(14, 2)  as profit
from public.hs_v_pnl_monthly
group by 1;

alter view public.hs_v_revenue_monthly      set (security_invoker = on);
alter view public.hs_v_expense_monthly      set (security_invoker = on);
alter view public.hs_v_pnl_monthly          set (security_invoker = on);
alter view public.hs_v_apartment_cumulative set (security_invoker = on);

-- -----------------------------------------------------------------------------
-- 7. RLS — chỉ tài khoản đã đăng nhập mới đọc/ghi được.
--
-- App không có màn đăng ký. Tạo tài khoản thủ công ở
-- Supabase Studio → Authentication → Users.
-- `anon` không có policy nào ⇒ không đọc được gì kể cả khi lộ anon key.
-- -----------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'hs_apartments', 'hs_bookings', 'hs_expense_categories',
    'hs_expenses', 'hs_recurring_expenses'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists hs_authenticated_full_access on public.%I', t);
    execute format(
      'create policy hs_authenticated_full_access on public.%I
         for all to authenticated using (true) with check (true)', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
end;
$$;

grant usage on schema public to anon, authenticated;
grant select on public.hs_v_revenue_monthly,
                public.hs_v_expense_monthly,
                public.hs_v_pnl_monthly,
                public.hs_v_apartment_cumulative
  to authenticated;
grant execute on function public.hs_ensure_recurring_expenses(date) to authenticated;

-- -----------------------------------------------------------------------------
-- 8. Realtime — dashboard tự cập nhật khi có người sửa ở máy khác.
-- -----------------------------------------------------------------------------
do $$
begin
  alter publication supabase_realtime add table public.hs_bookings;
exception
  when duplicate_object then null;
end;
$$;

do $$
begin
  alter publication supabase_realtime add table public.hs_expenses;
exception
  when duplicate_object then null;
end;
$$;
