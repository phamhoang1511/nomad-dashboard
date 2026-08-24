import { MINUTES_PER_DAY, minutesSince } from "@/lib/date";
import { fmtHM } from "@/lib/format";
import type { Apartment, BookingWithApartment } from "@/lib/types";

/**
 * Dựng dữ liệu cho dải timeline 24 giờ.
 *
 * Tách khỏi component để phần tính toán khó nhất — cắt booking qua đêm về đúng
 * ngày đang xem, và vệt dọn vệ sinh nối sau mỗi lượt — đứng độc lập, đọc được
 * mà không phải lội qua JSX.
 */

export type TimelineSegment = {
  kind: "booking" | "cleaning";
  bookingId: string;
  leftPct: number;
  widthPct: number;
  label: string;
  title: string;
  /** Đang diễn ra ngay lúc này. */
  active: boolean;
  /** Bị cắt ở đầu / cuối ngày ⇒ bỏ bo góc phía đó để thấy là còn kéo dài. */
  clipStart: boolean;
  clipEnd: boolean;
};

export type TimelineRow = {
  apartment: Apartment;
  segments: TimelineSegment[];
  /** Booking đang diễn ra, nếu có. */
  current: BookingWithApartment | null;
  /** Booking kế tiếp trong ngày đang xem. */
  next: BookingWithApartment | null;
  occupied: boolean;
};

const pct = (minutes: number) => (minutes / MINUTES_PER_DAY) * 100;
const clamp = (value: number) => Math.min(MINUTES_PER_DAY, Math.max(0, value));

/** Nhãn giờ ở đầu dải: 00, 02, … 24. */
export const HOUR_LABELS = Array.from({ length: 13 }, (_, i) =>
  String(i * 2).padStart(2, "0"),
);

function makeSegment(
  kind: TimelineSegment["kind"],
  bookingId: string,
  startMin: number,
  endMin: number,
  label: string,
  title: string,
  active: boolean,
): TimelineSegment | null {
  const left = clamp(startMin);
  const right = clamp(endMin);
  const width = right - left;
  // Dưới ~1 phút thì không còn gì để nhìn — bỏ hẳn cho đỡ rác DOM.
  if (width <= 0.5) return null;

  return {
    kind,
    bookingId,
    leftPct: pct(left),
    widthPct: pct(width),
    // Chỉ đủ chỗ cho chữ khi block rộng hơn ~9% dải (≈2 tiếng).
    label: pct(width) > 9 ? label : "",
    title,
    active,
    clipStart: startMin < 0,
    clipEnd: endMin > MINUTES_PER_DAY,
  };
}

export function buildTimeline(
  apartments: Apartment[],
  bookings: BookingWithApartment[],
  dayStart: Date,
  now: Date,
): TimelineRow[] {
  const nowMs = now.getTime();

  return apartments.map((apartment) => {
    const own = bookings
      .filter((b) => b.apartment_id === apartment.id)
      .sort((a, b) => a.start_at.localeCompare(b.start_at));

    const segments: TimelineSegment[] = [];
    let current: BookingWithApartment | null = null;
    let next: BookingWithApartment | null = null;

    for (const booking of own) {
      const start = new Date(booking.start_at);
      const end = new Date(booking.end_at);
      const startMin = minutesSince(start, dayStart);
      const endMin = minutesSince(end, dayStart);

      const active = nowMs >= start.getTime() && nowMs < end.getTime();
      if (active) current = booking;
      if (!next && start.getTime() > nowMs) next = booking;

      // Nhãn dùng giờ thật của booking, kể cả khi block bị cắt — người xem cần
      // biết khách nhận/trả phòng lúc mấy giờ, không phải mấy giờ block bắt đầu.
      const timeRange = `${fmtHM(((startMin % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY)}–${fmtHM(((endMin % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY)}`;

      const bookingSegment = makeSegment(
        "booking",
        booking.id,
        startMin,
        endMin,
        timeRange,
        `${booking.guest_name} · ${timeRange}${active ? " · đang thuê" : ""}`,
        active,
      );
      if (bookingSegment) segments.push(bookingSegment);

      // Đệm dọn vệ sinh nối ngay sau giờ trả phòng.
      const buffer = apartment.cleaning_buffer_minutes;
      if (buffer > 0) {
        const cleaningEndMin = endMin + buffer;
        const cleaning = makeSegment(
          "cleaning",
          booking.id,
          endMin,
          cleaningEndMin,
          "",
          `Dọn vệ sinh ${buffer}′ sau khi ${booking.guest_name} trả phòng`,
          nowMs >= end.getTime() && nowMs < end.getTime() + buffer * 60_000,
        );
        if (cleaning) segments.push(cleaning);
      }
    }

    return { apartment, segments, current, next, occupied: current !== null };
  });
}

/** Vị trí vạch "thời điểm hiện tại", tính theo % của dải. `null` nếu không thuộc ngày đang xem. */
export function nowMarkerPct(now: Date, dayStart: Date): number | null {
  const minutes = minutesSince(now, dayStart);
  if (minutes < 0 || minutes > MINUTES_PER_DAY) return null;
  return pct(minutes);
}
