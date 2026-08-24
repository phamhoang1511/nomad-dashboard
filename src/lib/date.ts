/**
 * Tiện ích thời gian theo giờ Việt Nam.
 *
 * Việt Nam cố định UTC+7 và không có giờ mùa hè, nên chỉ cần cộng/trừ một
 * offset không đổi là ra đúng giờ treo tường — không cần Intl, không lệ thuộc
 * múi giờ của máy người dùng. Nhờ vậy dashboard mở từ nước ngoài vẫn thấy đúng
 * "hôm nay" của homestay.
 */

export const VN_OFFSET_MS = 7 * 60 * 60 * 1000;
export const MINUTES_PER_DAY = 24 * 60;

export const WEEKDAY_VI = [
  "Chủ Nhật",
  "Thứ Hai",
  "Thứ Ba",
  "Thứ Tư",
  "Thứ Năm",
  "Thứ Sáu",
  "Thứ Bảy",
] as const;

export type VnParts = {
  year: number;
  month: number; // 1–12
  day: number;
  hour: number;
  minute: number;
  second: number;
  weekday: number; // 0 = Chủ Nhật
};

/** Bóc các thành phần lịch theo giờ VN của một mốc thời gian. */
export function vnParts(date: Date): VnParts {
  const shifted = new Date(date.getTime() + VN_OFFSET_MS);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
    hour: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes(),
    second: shifted.getUTCSeconds(),
    weekday: shifted.getUTCDay(),
  };
}

/** Dựng mốc thời gian thật từ giờ treo tường Việt Nam. */
export function fromVn(
  year: number,
  month: number,
  day: number,
  hour = 0,
  minute = 0,
): Date {
  return new Date(Date.UTC(year, month - 1, day, hour, minute) - VN_OFFSET_MS);
}

const pad = (n: number) => String(n).padStart(2, "0");

/** 'YYYY-MM-DD' theo giờ VN — khớp value của <input type="date">. */
export function vnDayKey(date: Date): string {
  const p = vnParts(date);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
}

/** 'YYYY-MM' theo giờ VN — khớp value của <input type="month">. */
export function vnMonthKey(date: Date): string {
  const p = vnParts(date);
  return `${p.year}-${pad(p.month)}`;
}

/** 'YYYY-MM-DDTHH:mm' theo giờ VN — khớp value của <input type="datetime-local">. */
export function vnDateTimeKey(date: Date): string {
  const p = vnParts(date);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}`;
}

/** '2026-08-24' → mốc 00:00 giờ VN của ngày đó. */
export function dayKeyToDate(dayKey: string): Date {
  const [y, m, d] = dayKey.split("-").map(Number);
  return fromVn(y, m, d);
}

/** '2026-08-24T14:30' (giờ VN) → mốc thời gian thật. */
export function dateTimeKeyToDate(value: string): Date {
  const [datePart, timePart = "00:00"] = value.split("T");
  const [y, m, d] = datePart.split("-").map(Number);
  const [hh, mm] = timePart.split(":").map(Number);
  return fromVn(y, m, d, hh, mm);
}

/** '2026-08' → 'YYYY-MM-01', dạng lưu của cột date trong Postgres. */
export function monthKeyToFirstDay(monthKey: string): string {
  return `${monthKey}-01`;
}

/** Ranh giới [00:00, 24:00) giờ VN của ngày chứa dayKey. */
export function vnDayBounds(dayKey: string): { start: Date; end: Date } {
  const start = dayKeyToDate(dayKey);
  return { start, end: new Date(start.getTime() + MINUTES_PER_DAY * 60_000) };
}

/** Ranh giới [mùng 1, mùng 1 tháng sau) giờ VN. */
export function vnMonthBounds(monthKey: string): { start: Date; end: Date } {
  const [y, m] = monthKey.split("-").map(Number);
  return { start: fromVn(y, m, 1), end: fromVn(m === 12 ? y + 1 : y, m === 12 ? 1 : m + 1, 1) };
}

/** Dời dayKey đi `delta` ngày. */
export function shiftDayKey(dayKey: string, delta: number): string {
  return vnDayKey(new Date(dayKeyToDate(dayKey).getTime() + delta * MINUTES_PER_DAY * 60_000));
}

/** Dời monthKey đi `delta` tháng. */
export function shiftMonthKey(monthKey: string, delta: number): string {
  const [y, m] = monthKey.split("-").map(Number);
  const total = y * 12 + (m - 1) + delta;
  return `${Math.floor(total / 12)}-${pad((total % 12) + 1)}`;
}

/** `delta` tháng gần nhất tính đến monthKey, cũ → mới. */
export function recentMonthKeys(monthKey: string, count: number): string[] {
  return Array.from({ length: count }, (_, i) => shiftMonthKey(monthKey, i - count + 1));
}

/** Số phút kể từ 00:00 giờ VN của ngày chứa mốc này. */
export function minutesSince(date: Date, dayStart: Date): number {
  return (date.getTime() - dayStart.getTime()) / 60_000;
}

/** 'Thứ Hai, 24/8/2026' */
export function fmtDateLong(date: Date): string {
  const p = vnParts(date);
  return `${WEEKDAY_VI[p.weekday]}, ${p.day}/${p.month}/${p.year}`;
}

/** '24/08' */
export function fmtDayMonth(date: Date): string {
  const p = vnParts(date);
  return `${pad(p.day)}/${pad(p.month)}`;
}

/** '24/08/2026 14:30' */
export function fmtDateTimeShort(date: Date): string {
  const p = vnParts(date);
  return `${pad(p.day)}/${pad(p.month)}/${p.year} ${pad(p.hour)}:${pad(p.minute)}`;
}

/** '14:30:05' — đồng hồ ở header. */
export function fmtClock(date: Date): string {
  const p = vnParts(date);
  return `${pad(p.hour)}:${pad(p.minute)}:${pad(p.second)}`;
}

/** '14:30' */
export function fmtTime(date: Date): string {
  const p = vnParts(date);
  return `${pad(p.hour)}:${pad(p.minute)}`;
}

/** 'Tháng 8/2026' */
export function fmtMonthLong(monthKey: string): string {
  const [y, m] = monthKey.split("-").map(Number);
  return `Tháng ${m}/${y}`;
}

/** 'T8' — nhãn trục biểu đồ. */
export function fmtMonthShort(monthKey: string): string {
  return `T${Number(monthKey.split("-")[1])}`;
}
