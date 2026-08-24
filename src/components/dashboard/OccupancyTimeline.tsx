"use client";

import { useMemo, type MouseEvent } from "react";

import { DayPicker } from "@/components/ui/PeriodPicker";
import { EmptyState } from "@/components/ui/Feedback";
import { MINUTES_PER_DAY, fmtDateLong, vnDayBounds, vnDayKey } from "@/lib/date";
import { HOUR_LABELS, buildTimeline, nowMarkerPct } from "@/lib/timeline";
import type { Apartment, BookingWithApartment } from "@/lib/types";

const LEGEND = [
  { label: "Đang thuê", swatch: <span className="h-3 w-[22px] rounded bg-gold" /> },
  { label: "Trống", swatch: <span className="h-3 w-[22px] rounded bg-surface-inset" /> },
  {
    label: "Dọn vệ sinh",
    swatch: <span className="hatch-cleaning h-3 w-[22px] rounded" />,
  },
  {
    label: "Thời điểm hiện tại",
    swatch: <span className="h-3.5 w-0.5 bg-clay" />,
  },
];

export function OccupancyTimeline({
  apartments,
  bookings,
  dayKey,
  onDayChange,
  now,
  onCreateAt,
  onEditBooking,
}: {
  apartments: Apartment[];
  bookings: BookingWithApartment[];
  dayKey: string;
  onDayChange: (dayKey: string) => void;
  now: Date;
  onCreateAt: (apartmentId: string, startAt: Date) => void;
  onEditBooking: (bookingId: string) => void;
}) {
  const dayStart = useMemo(() => vnDayBounds(dayKey).start, [dayKey]);
  const rows = useMemo(
    () => buildTimeline(apartments, bookings, dayStart, now),
    [apartments, bookings, dayStart, now],
  );
  const markerPct = nowMarkerPct(now, dayStart);
  const isToday = dayKey === vnDayKey(now);

  /** Click vào chỗ trống trên dải ⇒ mở form booking, làm tròn về mốc 15 phút. */
  function handleTrackClick(event: MouseEvent<HTMLDivElement>, apartmentId: string) {
    const rect = event.currentTarget.getBoundingClientRect();
    const ratio = (event.clientX - rect.left) / rect.width;
    const minutes = Math.round((ratio * MINUTES_PER_DAY) / 15) * 15;
    onCreateAt(
      apartmentId,
      new Date(dayStart.getTime() + Math.min(MINUTES_PER_DAY - 15, Math.max(0, minutes)) * 60_000),
    );
  }

  return (
    <section className="card mb-[22px] p-6 md:p-7">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="font-display text-[24px] font-semibold">Tình trạng theo khung giờ</h2>
          <div className="mt-1 text-[13px] text-muted">
            {fmtDateLong(dayStart)}
            {isToday ? " · hôm nay" : ""} · bấm vào dải trống để tạo booking
          </div>
        </div>
        <DayPicker value={dayKey} onChange={onDayChange} />
      </div>

      <div className="mb-5 flex flex-wrap items-center gap-x-[18px] gap-y-2">
        {LEGEND.map((item) => (
          <div key={item.label} className="flex items-center gap-[7px]">
            {item.swatch}
            <span className="text-[12.5px] text-muted">{item.label}</span>
          </div>
        ))}
      </div>

      {apartments.length === 0 ? (
        <EmptyState
          title="Chưa có căn hộ nào"
          hint="Thêm căn hộ ở mục Căn hộ để dải thời gian có gì để hiển thị."
        />
      ) : (
        <div className="scroll-slim overflow-x-auto">
          <div className="min-w-[760px]">
            {/* Thước giờ */}
            <div className="mb-2 grid grid-cols-[110px_1fr] gap-3.5">
              <div />
              <div className="flex justify-between">
                {HOUR_LABELS.map((label) => (
                  <div key={label} className="text-[10.5px] text-muted-soft">
                    {label}
                  </div>
                ))}
              </div>
            </div>

            {rows.map((row) => (
              <div
                key={row.apartment.id}
                className="mb-[9px] grid grid-cols-[110px_1fr] items-center gap-3.5"
              >
                <div className="flex items-center gap-2.5">
                  <span
                    className="h-[9px] w-[9px] shrink-0 rounded-full"
                    style={{
                      background: row.occupied ? "var(--color-gold)" : "#cbbfa9",
                    }}
                  />
                  <span className="truncate text-[13.5px] font-semibold tracking-[.3px]">
                    {row.apartment.code}
                  </span>
                </div>

                <div
                  className="timeline-grid relative h-[34px] cursor-copy overflow-hidden rounded-lg bg-surface-inset"
                  onClick={(event) => handleTrackClick(event, row.apartment.id)}
                  title="Bấm để tạo booking vào khung giờ này"
                >
                  {row.segments.map((segment, index) => (
                    <button
                      key={`${segment.bookingId}-${segment.kind}-${index}`}
                      type="button"
                      title={segment.title}
                      onClick={(event) => {
                        event.stopPropagation();
                        onEditBooking(segment.bookingId);
                      }}
                      className={
                        segment.kind === "cleaning"
                          ? "hatch-cleaning absolute top-[3px] bottom-[3px] z-3 rounded-[5px]"
                          : "absolute top-[3px] bottom-[3px] z-2 flex items-center justify-center overflow-hidden px-1 text-[10.5px] font-semibold whitespace-nowrap text-surface"
                      }
                      style={{
                        left: `${segment.leftPct}%`,
                        width: `${segment.widthPct}%`,
                        ...(segment.kind === "booking"
                          ? {
                              background: segment.active
                                ? "var(--color-gold-active)"
                                : "var(--color-gold)",
                              borderRadius: 6,
                              borderTopLeftRadius: segment.clipStart ? 0 : 6,
                              borderBottomLeftRadius: segment.clipStart ? 0 : 6,
                              borderTopRightRadius: segment.clipEnd ? 0 : 6,
                              borderBottomRightRadius: segment.clipEnd ? 0 : 6,
                              outline: segment.active ? "1.5px solid var(--color-gold-edge)" : undefined,
                              boxShadow: segment.active
                                ? "0 2px 8px -2px rgba(61,53,41,.45)"
                                : undefined,
                            }
                          : {
                              outline: segment.active
                                ? "1.5px solid var(--color-teal-edge)"
                                : undefined,
                            }),
                      }}
                    >
                      {segment.label}
                    </button>
                  ))}

                  {markerPct !== null ? (
                    <div
                      className="pointer-events-none absolute top-[-2px] bottom-[-2px] z-5 w-0.5 bg-clay"
                      style={{ left: `${markerPct}%` }}
                    />
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
