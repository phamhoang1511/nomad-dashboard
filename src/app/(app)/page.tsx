"use client";

import { useCallback, useMemo, useState } from "react";

import { BookingFormDialog, type BookingPrefill } from "@/components/bookings/BookingFormDialog";
import { KpiRow } from "@/components/dashboard/KpiRow";
import { OccupancyTimeline } from "@/components/dashboard/OccupancyTimeline";
import { UnitFinancials } from "@/components/dashboard/UnitFinancials";
import { ErrorNote, Skeleton } from "@/components/ui/Feedback";
import { useLiveData, useNow } from "@/hooks/useLiveData";
import { fmtClock, fmtDateLong, vnDayBounds, vnDayKey, vnMonthKey, vnParts } from "@/lib/date";
import { TABLES, ensureRecurringExpensesOnce, getDashboardData } from "@/lib/queries";
import { buildTimeline } from "@/lib/timeline";
import type { BookingWithApartment } from "@/lib/types";

export default function DashboardPage() {
  const now = useNow();
  const [dayKey, setDayKey] = useState(() => vnDayKey(new Date()));

  const [editing, setEditing] = useState<BookingWithApartment | null>(null);
  const [prefill, setPrefill] = useState<BookingPrefill | null>(null);

  const fetcher = useCallback(async () => {
    // Vật chất hoá chi phí định kỳ của tháng hiện tại trước, để con số
    // "Chi phí tháng" không thiếu tiền thuê nhà ở lần mở đầu tháng.
    await ensureRecurringExpensesOnce(vnMonthKey(new Date()));
    return getDashboardData(dayKey);
  }, [dayKey]);

  const { data, loading, error, connected, refresh } = useLiveData(fetcher, [
    TABLES.bookings,
    TABLES.expenses,
  ]);

  const apartments = useMemo(() => data?.apartments ?? [], [data]);
  const bookings = useMemo(() => data?.dayBookings ?? [], [data]);

  const rows = useMemo(
    () => (now ? buildTimeline(apartments, bookings, vnDayBounds(dayKey).start, now) : []),
    [apartments, bookings, dayKey, now],
  );

  const totals = useMemo(() => {
    const pnl = data?.monthPnl ?? [];
    return {
      revenue: pnl.reduce((sum, r) => sum + r.revenue, 0),
      expense: pnl.reduce((sum, r) => sum + r.expense, 0),
      bookings: pnl.reduce((sum, r) => sum + r.bookings_count, 0),
      cumulative: (data?.cumulative ?? []).reduce((sum, r) => sum + r.profit, 0),
    };
  }, [data]);

  const occupancyPct = apartments.length
    ? Math.round((rows.filter((r) => r.occupied).length / apartments.length) * 100)
    : 0;

  const monthNum = now ? vnParts(now).month : vnParts(new Date()).month;

  function openCreate(apartmentId: string, startAt: Date) {
    setEditing(null);
    setPrefill({ apartmentId, startAt });
  }

  function openEdit(bookingId: string) {
    const booking = bookings.find((b) => b.id === bookingId);
    if (!booking) return;
    setPrefill(null);
    setEditing(booking);
  }

  return (
    <>
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="eyebrow mb-1.5 tracking-[2px]">
            Bảng điều hành · {apartments.length} căn hộ
          </div>
          <h1 className="font-display text-[34px] leading-none font-semibold md:text-[40px]">
            Homestay Performance
          </h1>
        </div>

        <div className="text-right">
          <div className="mb-1 flex items-center justify-end gap-2">
            <span
              className={`h-2 w-2 rounded-full bg-sage ${connected ? "animate-live" : "opacity-30"}`}
            />
            <span className="text-[12px] font-semibold tracking-[1.5px] text-muted uppercase">
              Live
            </span>
          </div>
          <div className="font-display text-[26px] font-medium tabular-nums">
            {now ? fmtClock(now) : "--:--:--"}
          </div>
          <div className="mt-0.5 text-[13px] text-muted">
            {now ? fmtDateLong(now) : " "}
          </div>
        </div>
      </header>

      {error ? (
        <div className="mb-5">
          <ErrorNote>{error}</ErrorNote>
        </div>
      ) : null}

      {loading && !data ? (
        <DashboardSkeleton />
      ) : (
        <>
          <KpiRow
            monthNum={monthNum}
            unitCount={apartments.length}
            monthRevenue={totals.revenue}
            todayRevenue={data?.todayRevenue ?? 0}
            bookingsCount={totals.bookings}
            occupancyPct={occupancyPct}
            monthExpense={totals.expense}
            cumulativeProfit={totals.cumulative}
            live={connected}
          />

          <OccupancyTimeline
            apartments={apartments}
            bookings={bookings}
            dayKey={dayKey}
            onDayChange={setDayKey}
            now={now ?? new Date()}
            onCreateAt={openCreate}
            onEditBooking={openEdit}
          />

          <UnitFinancials
            rows={rows}
            monthNum={monthNum}
            monthPnl={data?.monthPnl ?? []}
            cumulative={data?.cumulative ?? []}
            onSelectApartment={(apartmentId) => openCreate(apartmentId, nextQuarterHour())}
          />
        </>
      )}

      {editing || prefill ? (
        <BookingFormDialog
          booking={editing}
          prefill={prefill ?? undefined}
          apartments={apartments}
          onClose={() => {
            setEditing(null);
            setPrefill(null);
          }}
          onSaved={refresh}
        />
      ) : null}
    </>
  );
}

function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-[22px]">
      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr_1fr]">
        <Skeleton className="h-[196px]" />
        <Skeleton className="h-[196px]" />
        <Skeleton className="h-[196px]" />
      </div>
      <Skeleton className="h-[360px]" />
      <Skeleton className="h-[380px]" />
    </div>
  );
}

/** Mốc 15 phút kế tiếp — mặc định hợp lý khi mở form từ bảng hiệu quả. */
function nextQuarterHour(): Date {
  return new Date(Math.ceil(Date.now() / 900_000) * 900_000);
}
