"use client";

import { monthKeyToFirstDay, vnDayBounds, vnDayKey, vnMonthKey } from "@/lib/date";
import { getSupabaseClient } from "@/lib/supabase/client";
import {
  ACTIVE_BOOKING_STATUSES,
  type Apartment,
  type Booking,
  type BookingWithApartment,
  type CumulativeRow,
  type Expense,
  type ExpenseCategory,
  type PnlRow,
  type RecurringExpense,
} from "@/lib/types";

/**
 * Toàn bộ truy vấn Supabase gom về một chỗ. Component chỉ gọi các hàm ở đây,
 * không tự dựng `.from(...)` — đổi schema thì chỉ phải sửa file này.
 */

/**
 * Tên bảng mang tiền tố `hs_` vì project Supabase này còn có một bảng
 * `public.bookings` của app khác. Khai báo một chỗ để trang nào cần đăng ký
 * realtime cũng lấy đúng tên, không gõ tay chuỗi rời rạc.
 */
export const TABLES = {
  apartments: "hs_apartments",
  bookings: "hs_bookings",
  categories: "hs_expense_categories",
  expenses: "hs_expenses",
  recurring: "hs_recurring_expenses",
  pnlMonthly: "hs_v_pnl_monthly",
  cumulative: "hs_v_apartment_cumulative",
} as const;

/** Nhúng thông tin căn hộ vào truy vấn booking qua khoá ngoại apartment_id. */
const BOOKING_SELECT = `*, apartment:${TABLES.apartments}(code, name)`;

/** PostgREST trả numeric dạng số, nhưng ép lại cho chắc. */
const num = (value: unknown): number => {
  const n = typeof value === "string" ? Number(value) : (value as number);
  return Number.isFinite(n) ? n : 0;
};

/** Ném lỗi kèm message gốc để `describeError` dịch sang tiếng Việt ở tầng UI. */
function unwrap<T>(result: { data: T | null; error: { message: string } | null }): T {
  if (result.error) throw new Error(result.error.message);
  return (result.data ?? []) as T;
}

/** Đổi lỗi Postgres thô thành câu tiếng Việt hiển thị được. */
export function describeError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error ?? "");

  const overlap = message.indexOf("BOOKING_OVERLAP:");
  if (overlap !== -1) {
    return `Khung giờ này bị trùng — ${message.slice(overlap + "BOOKING_OVERLAP:".length).trim()}`;
  }
  if (message.includes("hs_apartments_code_key")) {
    return "Mã căn hộ này đã tồn tại. Chọn mã khác.";
  }
  if (message.includes("hs_bookings_time_order")) {
    return "Giờ trả phòng phải sau giờ nhận phòng.";
  }
  if (message.includes("Invalid login credentials")) {
    return "Email hoặc mật khẩu không đúng.";
  }
  if (message.includes("Email not confirmed")) {
    return "Tài khoản chưa được xác nhận. Bật Auto Confirm trong Supabase Studio.";
  }
  if (message.includes("Failed to fetch") || message.includes("NetworkError")) {
    return "Không kết nối được Supabase. Kiểm tra mạng và NEXT_PUBLIC_SUPABASE_URL.";
  }
  if (message.includes("does not exist") || message.includes("schema cache")) {
    return "Chưa tìm thấy bảng dữ liệu. Bạn đã chạy supabase/migrations/0001_init.sql chưa?";
  }
  return message || "Đã có lỗi xảy ra.";
}

// ---------------------------------------------------------------------------
// Căn hộ
// ---------------------------------------------------------------------------

export async function listApartments(includeInactive = false): Promise<Apartment[]> {
  let query = getSupabaseClient()
    .from(TABLES.apartments)
    .select("*")
    .order("sort_order", { ascending: true })
    .order("code", { ascending: true });

  if (!includeInactive) query = query.eq("status", "active");

  const rows = unwrap(await query.returns<Apartment[]>());
  return rows.map((a) => ({
    ...a,
    hourly_rate: num(a.hourly_rate),
    nightly_rate: num(a.nightly_rate),
  }));
}

export type ApartmentInput = Omit<Apartment, "id" | "created_at"> & { id?: string };

export async function saveApartment(input: ApartmentInput): Promise<void> {
  const supabase = getSupabaseClient();
  const { id, ...fields } = input;
  const result = id
    ? await supabase.from(TABLES.apartments).update(fields).eq("id", id)
    : await supabase.from(TABLES.apartments).insert(fields);
  if (result.error) throw new Error(result.error.message);
}

export async function deleteApartment(id: string): Promise<void> {
  const { error } = await getSupabaseClient().from(TABLES.apartments).delete().eq("id", id);
  if (error) throw new Error(error.message);
}

// ---------------------------------------------------------------------------
// Booking
// ---------------------------------------------------------------------------

const normalizeBooking = <T extends Booking>(b: T): T => ({
  ...b,
  total_amount: num(b.total_amount),
  paid_amount: num(b.paid_amount),
});

/**
 * Booking giao với khoảng [start, end).
 *
 * Nới biên trái thêm `padMinutes` để bắt cả booking kết thúc ngay trước khoảng
 * này — vệt dọn vệ sinh 15′ của nó vẫn tràn sang, timeline cần vẽ.
 */
export async function listBookingsOverlapping(
  start: Date,
  end: Date,
  padMinutes = 240,
): Promise<BookingWithApartment[]> {
  const paddedStart = new Date(start.getTime() - padMinutes * 60_000);
  const rows = unwrap(
    await getSupabaseClient()
      .from(TABLES.bookings)
      .select(BOOKING_SELECT)
      .lt("start_at", end.toISOString())
      .gt("end_at", paddedStart.toISOString())
      .in("status", ACTIVE_BOOKING_STATUSES)
      .order("start_at", { ascending: true })
      .returns<BookingWithApartment[]>(),
  );
  return rows.map(normalizeBooking);
}

export type BookingFilters = {
  apartmentId?: string;
  status?: string;
  from?: Date;
  to?: Date;
  search?: string;
};

export async function listBookings(filters: BookingFilters): Promise<BookingWithApartment[]> {
  let query = getSupabaseClient()
    .from(TABLES.bookings)
    .select(BOOKING_SELECT)
    .order("start_at", { ascending: false })
    .limit(500);

  if (filters.apartmentId) query = query.eq("apartment_id", filters.apartmentId);
  if (filters.status) query = query.eq("status", filters.status);
  if (filters.from) query = query.gte("start_at", filters.from.toISOString());
  if (filters.to) query = query.lt("start_at", filters.to.toISOString());
  if (filters.search?.trim()) {
    const term = `%${filters.search.trim()}%`;
    query = query.or(`guest_name.ilike.${term},guest_phone.ilike.${term}`);
  }

  return unwrap(await query.returns<BookingWithApartment[]>()).map(normalizeBooking);
}

export type BookingInput = {
  id?: string;
  apartment_id: string;
  guest_name: string;
  guest_phone: string | null;
  booking_type: Booking["booking_type"];
  start_at: string;
  end_at: string;
  status: Booking["status"];
  total_amount: number;
  paid_amount: number;
  note: string | null;
};

export async function saveBooking(input: BookingInput): Promise<void> {
  const supabase = getSupabaseClient();
  const { id, ...fields } = input;
  const result = id
    ? await supabase.from(TABLES.bookings).update(fields).eq("id", id)
    : await supabase.from(TABLES.bookings).insert(fields);
  if (result.error) throw new Error(result.error.message);
}

export async function setBookingStatus(id: string, status: Booking["status"]): Promise<void> {
  const { error } = await getSupabaseClient()
    .from(TABLES.bookings)
    .update({ status })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deleteBooking(id: string): Promise<void> {
  const { error } = await getSupabaseClient().from(TABLES.bookings).delete().eq("id", id);
  if (error) throw new Error(error.message);
}

// ---------------------------------------------------------------------------
// Chi phí
// ---------------------------------------------------------------------------

export async function listExpenseCategories(): Promise<ExpenseCategory[]> {
  return unwrap(
    await getSupabaseClient()
      .from(TABLES.categories)
      .select("*")
      .order("sort_order", { ascending: true })
      .returns<ExpenseCategory[]>(),
  );
}

export async function listExpenses(monthKey: string): Promise<Expense[]> {
  const rows = unwrap(
    await getSupabaseClient()
      .from(TABLES.expenses)
      .select("*")
      .eq("expense_month", monthKeyToFirstDay(monthKey))
      .order("incurred_on", { ascending: false })
      .returns<Expense[]>(),
  );
  return rows.map((e) => ({ ...e, amount: num(e.amount) }));
}

export type ExpenseInput = {
  id?: string;
  apartment_id: string | null;
  category_id: string;
  amount: number;
  incurred_on: string;
  note: string | null;
};

export async function saveExpense(input: ExpenseInput): Promise<void> {
  const supabase = getSupabaseClient();
  const { id, ...fields } = input;
  const result = id
    ? await supabase.from(TABLES.expenses).update(fields).eq("id", id)
    : await supabase.from(TABLES.expenses).insert(fields);
  if (result.error) throw new Error(result.error.message);
}

export async function deleteExpense(id: string): Promise<void> {
  const { error } = await getSupabaseClient().from(TABLES.expenses).delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function listRecurringExpenses(): Promise<RecurringExpense[]> {
  const rows = unwrap(
    await getSupabaseClient()
      .from(TABLES.recurring)
      .select("*")
      .order("active", { ascending: false })
      .order("start_month", { ascending: false })
      .returns<RecurringExpense[]>(),
  );
  return rows.map((r) => ({ ...r, amount: num(r.amount) }));
}

export type RecurringExpenseInput = {
  id?: string;
  apartment_id: string | null;
  category_id: string;
  amount: number;
  day_of_month: number;
  start_month: string;
  end_month: string | null;
  active: boolean;
  note: string | null;
};

export async function saveRecurringExpense(input: RecurringExpenseInput): Promise<void> {
  const supabase = getSupabaseClient();
  const { id, ...fields } = input;
  const result = id
    ? await supabase.from(TABLES.recurring).update(fields).eq("id", id)
    : await supabase.from(TABLES.recurring).insert(fields);
  if (result.error) throw new Error(result.error.message);
}

export async function deleteRecurringExpense(id: string): Promise<void> {
  const { error } = await getSupabaseClient().from(TABLES.recurring).delete().eq("id", id);
  if (error) throw new Error(error.message);
}

/** Vật chất hoá chi phí định kỳ của một tháng. Trả về số dòng vừa tạo. */
export async function ensureRecurringExpenses(monthKey: string): Promise<number> {
  const { data, error } = await getSupabaseClient().rpc("hs_ensure_recurring_expenses", {
    p_month: monthKeyToFirstDay(monthKey),
  });
  if (error) throw new Error(error.message);
  return num(data);
}

// Chi phí định kỳ chỉ cần sinh một lần cho mỗi tháng mỗi phiên — tránh gửi RPC
// lặp lại mỗi lần realtime bắn refetch.
const ensuredMonths = new Set<string>();

export async function ensureRecurringExpensesOnce(monthKey: string): Promise<void> {
  if (ensuredMonths.has(monthKey)) return;
  ensuredMonths.add(monthKey);
  try {
    await ensureRecurringExpenses(monthKey);
  } catch {
    // Không chặn việc hiển thị dashboard nếu bước này hỏng; cho phép thử lại sau.
    ensuredMonths.delete(monthKey);
  }
}

// ---------------------------------------------------------------------------
// P&L
// ---------------------------------------------------------------------------

const normalizePnl = (r: PnlRow): PnlRow => ({
  ...r,
  revenue: num(r.revenue),
  expense: num(r.expense),
  profit: num(r.profit),
  bookings_count: num(r.bookings_count),
  booked_hours: num(r.booked_hours),
});

export async function listPnlForMonth(monthKey: string): Promise<PnlRow[]> {
  const rows = unwrap(
    await getSupabaseClient()
      .from(TABLES.pnlMonthly)
      .select("*")
      .eq("month", monthKeyToFirstDay(monthKey))
      .returns<PnlRow[]>(),
  );
  return rows.map(normalizePnl);
}

/** P&L của khoảng [fromMonth, toMonth] — dùng cho biểu đồ 12 tháng. */
export async function listPnlRange(fromMonthKey: string, toMonthKey: string): Promise<PnlRow[]> {
  const rows = unwrap(
    await getSupabaseClient()
      .from(TABLES.pnlMonthly)
      .select("*")
      .gte("month", monthKeyToFirstDay(fromMonthKey))
      .lte("month", monthKeyToFirstDay(toMonthKey))
      .order("month", { ascending: true })
      .returns<PnlRow[]>(),
  );
  return rows.map(normalizePnl);
}

export async function listCumulative(): Promise<CumulativeRow[]> {
  const rows = unwrap(
    await getSupabaseClient().from(TABLES.cumulative).select("*").returns<CumulativeRow[]>(),
  );
  return rows.map((r) => ({
    ...r,
    revenue: num(r.revenue),
    expense: num(r.expense),
    profit: num(r.profit),
  }));
}

// ---------------------------------------------------------------------------
// Gói dữ liệu cho dashboard
// ---------------------------------------------------------------------------

export type DashboardData = {
  apartments: Apartment[];
  /** Booking giao với ngày đang xem trên timeline. */
  dayBookings: BookingWithApartment[];
  /** Doanh thu của các booking nhận phòng trong hôm nay (giờ VN). */
  todayRevenue: number;
  monthPnl: PnlRow[];
  cumulative: CumulativeRow[];
};

export async function getDashboardData(viewDayKey: string): Promise<DashboardData> {
  const now = new Date();
  const todayKey = vnDayKey(now);
  const monthKey = vnMonthKey(now);

  const viewDay = vnDayBounds(viewDayKey);
  const today = vnDayBounds(todayKey);

  const [apartments, dayBookings, monthPnl, cumulative, todayRows] = await Promise.all([
    listApartments(),
    listBookingsOverlapping(viewDay.start, viewDay.end),
    listPnlForMonth(monthKey),
    listCumulative(),
    // Doanh thu hôm nay luôn tính theo ngày thật, không theo ngày đang xem.
    getSupabaseClient()
      .from(TABLES.bookings)
      .select("total_amount")
      .gte("start_at", today.start.toISOString())
      .lt("start_at", today.end.toISOString())
      .in("status", ACTIVE_BOOKING_STATUSES)
      .returns<{ total_amount: number }[]>(),
  ]);

  const todayRevenue = unwrap(todayRows).reduce((sum, r) => sum + num(r.total_amount), 0);

  return { apartments, dayBookings, todayRevenue, monthPnl, cumulative };
}
