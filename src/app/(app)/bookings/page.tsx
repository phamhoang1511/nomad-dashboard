"use client";

import { useCallback, useMemo, useState } from "react";

import { BookingFormDialog } from "@/components/bookings/BookingFormDialog";
import { Button } from "@/components/ui/Button";
import { Badge, EmptyState, ErrorNote, LoadingRows } from "@/components/ui/Feedback";
import { Field, Select, TextInput } from "@/components/ui/Field";
import { PageHeader } from "@/components/ui/PageHeader";
import { useLiveData } from "@/hooks/useLiveData";
import { dayKeyToDate, fmtDateTimeShort, fmtTime, shiftDayKey, vnDayKey } from "@/lib/date";
import { fmtDuration, fmtVndFull } from "@/lib/format";
import {
  TABLES,
  describeError,
  listApartments,
  listBookings,
  setBookingStatus,
} from "@/lib/queries";
import {
  BOOKING_STATUS_LABEL,
  BOOKING_STATUS_TONE,
  BOOKING_TYPE_LABEL,
  type BookingStatus,
  type BookingWithApartment,
} from "@/lib/types";

/** Hành động tiếp theo hợp lý cho mỗi trạng thái, hiện ngay trên dòng. */
const NEXT_STATUS: Partial<Record<BookingStatus, { label: string; to: BookingStatus }>> = {
  tentative: { label: "Xác nhận", to: "confirmed" },
  confirmed: { label: "Check-in", to: "checked_in" },
  checked_in: { label: "Check-out", to: "checked_out" },
};

export default function BookingsPage() {
  const today = vnDayKey(new Date());
  const [apartmentId, setApartmentId] = useState("");
  const [status, setStatus] = useState("");
  const [from, setFrom] = useState(() => shiftDayKey(today, -30));
  const [to, setTo] = useState(() => shiftDayKey(today, 60));
  const [search, setSearch] = useState("");

  const [editing, setEditing] = useState<BookingWithApartment | null>(null);
  const [creating, setCreating] = useState(false);
  const [rowError, setRowError] = useState<string | null>(null);

  const apartmentsFetcher = useCallback(() => listApartments(true), []);
  const { data: apartments } = useLiveData(apartmentsFetcher, [TABLES.apartments]);

  const bookingsFetcher = useCallback(
    () =>
      listBookings({
        apartmentId: apartmentId || undefined,
        status: status || undefined,
        from: from ? dayKeyToDate(from) : undefined,
        to: to ? dayKeyToDate(shiftDayKey(to, 1)) : undefined,
        search,
      }),
    [apartmentId, status, from, to, search],
  );
  const { data, loading, error, refresh } = useLiveData(bookingsFetcher, [TABLES.bookings]);

  const bookings = useMemo(() => data ?? [], [data]);
  const totals = useMemo(
    () =>
      bookings.reduce(
        (acc, b) => {
          if (b.status !== "cancelled") {
            acc.revenue += b.total_amount;
            acc.paid += b.paid_amount;
          }
          return acc;
        },
        { revenue: 0, paid: 0 },
      ),
    [bookings],
  );

  async function advance(booking: BookingWithApartment, next: BookingStatus) {
    setRowError(null);
    try {
      await setBookingStatus(booking.id, next);
      await refresh();
    } catch (err) {
      setRowError(describeError(err));
    }
  }

  return (
    <>
      <PageHeader
        eyebrow={`${bookings.length} lượt · doanh thu ${fmtVndFull(totals.revenue)} · đã thu ${fmtVndFull(totals.paid)}`}
        title="Booking"
        action={
          <Button
            variant="primary"
            onClick={() => setCreating(true)}
            disabled={!apartments?.length}
          >
            + Booking mới
          </Button>
        }
      />

      <div className="card mb-5 grid gap-4 p-5 md:grid-cols-5 md:p-6">
        <Field label="Căn hộ">
          <Select value={apartmentId} onChange={(e) => setApartmentId(e.target.value)}>
            <option value="">Tất cả</option>
            {(apartments ?? []).map((a) => (
              <option key={a.id} value={a.id}>
                {a.code}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Trạng thái">
          <Select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">Tất cả</option>
            {(Object.keys(BOOKING_STATUS_LABEL) as BookingStatus[]).map((s) => (
              <option key={s} value={s}>
                {BOOKING_STATUS_LABEL[s]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Từ ngày">
          <TextInput type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </Field>
        <Field label="Đến ngày">
          <TextInput type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </Field>
        <Field label="Tìm khách">
          <TextInput
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tên hoặc số điện thoại"
          />
        </Field>
      </div>

      <div className="card p-6 md:p-7">
        {error ? <ErrorNote>{error}</ErrorNote> : null}
        {rowError ? <ErrorNote>{rowError}</ErrorNote> : null}

        {loading ? (
          <LoadingRows rows={6} />
        ) : bookings.length === 0 ? (
          <EmptyState
            title="Không có booking nào khớp bộ lọc"
            hint="Thử nới rộng khoảng ngày, hoặc tạo booking mới."
          />
        ) : (
          <div className="scroll-slim overflow-x-auto">
            <table className="w-full min-w-[980px] border-collapse">
              <thead>
                <tr className="border-b border-line text-left text-[11.5px] font-semibold tracking-[1px] text-muted-soft uppercase">
                  <th className="pb-3">Khách</th>
                  <th className="pb-3">Căn</th>
                  <th className="pb-3">Thời gian</th>
                  <th className="pb-3 text-right">Thành tiền</th>
                  <th className="pb-3 text-right">Còn lại</th>
                  <th className="pb-3">Trạng thái</th>
                  <th className="pb-3" />
                </tr>
              </thead>
              <tbody>
                {bookings.map((b) => {
                  const start = new Date(b.start_at);
                  const end = new Date(b.end_at);
                  const minutes = (end.getTime() - start.getTime()) / 60_000;
                  const remaining = b.total_amount - b.paid_amount;
                  const next = NEXT_STATUS[b.status];

                  return (
                    <tr
                      key={b.id}
                      className="border-b border-line-soft last:border-0 hover:bg-surface-inset/40"
                    >
                      <td className="py-4 pr-3">
                        <div className="text-[14.5px] font-semibold">{b.guest_name}</div>
                        {b.guest_phone ? (
                          <div className="text-[12.5px] text-muted-soft">{b.guest_phone}</div>
                        ) : null}
                      </td>
                      <td className="py-4 pr-3 text-[13.5px] font-semibold">
                        {b.apartment?.code ?? "—"}
                        <div className="text-[12px] font-normal text-muted-soft">
                          {BOOKING_TYPE_LABEL[b.booking_type]}
                        </div>
                      </td>
                      <td className="py-4 pr-3 text-[13px] whitespace-nowrap text-muted">
                        {fmtDateTimeShort(start)} → {fmtTime(end)}
                        <div className="text-[12px] text-muted-soft">
                          {fmtDuration(minutes, b.booking_type)}
                        </div>
                      </td>
                      <td className="py-4 pr-3 text-right font-display text-[17px] tabular-nums">
                        {fmtVndFull(b.total_amount)}
                      </td>
                      <td
                        className={`py-4 pr-3 text-right font-display text-[17px] tabular-nums ${
                          remaining > 0 ? "text-clay" : "text-sage-deep"
                        }`}
                      >
                        {remaining > 0 ? fmtVndFull(remaining) : "Đủ"}
                      </td>
                      <td className="py-4 pr-3">
                        <Badge {...BOOKING_STATUS_TONE[b.status]}>
                          {BOOKING_STATUS_LABEL[b.status]}
                        </Badge>
                      </td>
                      <td className="py-4">
                        <div className="flex justify-end gap-1.5">
                          {next ? (
                            <Button size="sm" onClick={() => advance(b, next.to)}>
                              {next.label}
                            </Button>
                          ) : null}
                          <Button size="sm" variant="ghost" onClick={() => setEditing(b)}>
                            Sửa
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {creating || editing ? (
        <BookingFormDialog
          booking={editing}
          apartments={apartments ?? []}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
          onSaved={refresh}
        />
      ) : null}
    </>
  );
}
