export type ApartmentStatus = "active" | "paused" | "archived";
export type BookingType = "hourly" | "overnight";
export type BookingStatus =
  | "tentative"
  | "confirmed"
  | "checked_in"
  | "checked_out"
  | "cancelled";
export type ExpenseKind = "fixed" | "variable";

export type Apartment = {
  id: string;
  code: string;
  name: string | null;
  building: string | null;
  hourly_rate: number;
  nightly_rate: number;
  cleaning_buffer_minutes: number;
  status: ApartmentStatus;
  sort_order: number;
  note: string | null;
  created_at: string;
};

export type Booking = {
  id: string;
  apartment_id: string;
  guest_name: string;
  guest_phone: string | null;
  booking_type: BookingType;
  start_at: string;
  end_at: string;
  status: BookingStatus;
  total_amount: number;
  paid_amount: number;
  note: string | null;
  created_at: string;
  updated_at: string;
};

export type BookingWithApartment = Booking & {
  apartment: Pick<Apartment, "code" | "name"> | null;
};

export type ExpenseCategory = {
  id: string;
  code: string;
  name: string;
  kind: ExpenseKind;
  sort_order: number;
};

export type Expense = {
  id: string;
  apartment_id: string | null;
  category_id: string;
  amount: number;
  incurred_on: string;
  note: string | null;
  recurring_id: string | null;
  expense_month: string;
  created_at: string;
};

export type RecurringExpense = {
  id: string;
  apartment_id: string | null;
  category_id: string;
  amount: number;
  day_of_month: number;
  start_month: string;
  end_month: string | null;
  active: boolean;
  note: string | null;
  created_at: string;
};

/** Một dòng của view `v_pnl_monthly`. apartment_id = null ⇒ chi phí chung. */
export type PnlRow = {
  apartment_id: string | null;
  month: string;
  revenue: number;
  expense: number;
  profit: number;
  bookings_count: number;
  booked_hours: number;
};

/** Một dòng của view `v_apartment_cumulative`. */
export type CumulativeRow = {
  apartment_id: string | null;
  revenue: number;
  expense: number;
  profit: number;
};

export const APARTMENT_STATUS_LABEL: Record<ApartmentStatus, string> = {
  active: "Đang khai thác",
  paused: "Tạm dừng",
  archived: "Lưu trữ",
};

export const BOOKING_TYPE_LABEL: Record<BookingType, string> = {
  hourly: "Theo giờ",
  overnight: "Qua đêm",
};

export const BOOKING_STATUS_LABEL: Record<BookingStatus, string> = {
  tentative: "Giữ chỗ",
  confirmed: "Đã xác nhận",
  checked_in: "Đang ở",
  checked_out: "Đã trả phòng",
  cancelled: "Đã huỷ",
};

/** Cặp màu nền/chữ cho badge trạng thái, dùng chung ở bảng booking và dashboard. */
export const BOOKING_STATUS_TONE: Record<BookingStatus, { bg: string; fg: string }> = {
  tentative: { bg: "var(--color-surface-inset)", fg: "var(--color-muted)" },
  confirmed: { bg: "var(--color-gold-soft)", fg: "var(--color-gold-ink)" },
  checked_in: { bg: "var(--color-gold-soft)", fg: "var(--color-gold-ink)" },
  checked_out: { bg: "var(--color-sage-wash)", fg: "var(--color-sage-deep)" },
  cancelled: { bg: "var(--color-clay-wash)", fg: "var(--color-clay)" },
};

/** Booking đã huỷ không chiếm phòng và không tính doanh thu. */
export const ACTIVE_BOOKING_STATUSES: BookingStatus[] = [
  "tentative",
  "confirmed",
  "checked_in",
  "checked_out",
];
