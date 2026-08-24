"use client";

import { useMemo, useState } from "react";

import { Button } from "@/components/ui/Button";
import { ErrorNote } from "@/components/ui/Feedback";
import { Field, MoneyInput, Select, TextInput, Textarea } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { dateTimeKeyToDate, vnDateTimeKey } from "@/lib/date";
import { fmtDuration, fmtVndFull } from "@/lib/format";
import { deleteBooking, describeError, saveBooking } from "@/lib/queries";
import {
  BOOKING_STATUS_LABEL,
  BOOKING_TYPE_LABEL,
  type Apartment,
  type Booking,
  type BookingStatus,
  type BookingType,
} from "@/lib/types";

/** Giờ nhận/trả mặc định cho khách qua đêm. */
const OVERNIGHT_CHECK_IN_HOUR = 14;
const OVERNIGHT_CHECK_OUT_HOUR = 12;

/** Nút đặt nhanh giờ trả phòng, tính từ giờ nhận. */
const QUICK_DURATIONS: Record<BookingType, { label: string; minutes: number }[]> = {
  hourly: [
    { label: "2h", minutes: 120 },
    { label: "3h", minutes: 180 },
    { label: "6h", minutes: 360 },
    { label: "12h", minutes: 720 },
  ],
  overnight: [
    { label: "1 đêm", minutes: 22 * 60 },
    { label: "2 đêm", minutes: 46 * 60 },
    { label: "3 đêm", minutes: 70 * 60 },
    { label: "1 tuần", minutes: 166 * 60 },
  ],
};

export type BookingPrefill = {
  apartmentId?: string;
  startAt?: Date;
  bookingType?: BookingType;
};

type FormState = {
  apartment_id: string;
  guest_name: string;
  guest_phone: string;
  booking_type: BookingType;
  start: string;
  end: string;
  status: BookingStatus;
  total_amount: number;
  paid_amount: number;
  note: string;
};

/** Giá gợi ý: theo giờ làm tròn lên, qua đêm tính theo số đêm. */
function suggestAmount(
  apartment: Apartment | undefined,
  type: BookingType,
  minutes: number,
): number {
  if (!apartment || !Number.isFinite(minutes) || minutes <= 0) return 0;
  if (type === "overnight") {
    return Math.max(1, Math.ceil(minutes / (24 * 60))) * apartment.nightly_rate;
  }
  return Math.max(1, Math.ceil(minutes / 60)) * apartment.hourly_rate;
}

function buildInitialState(
  booking: Booking | null,
  prefill: BookingPrefill | undefined,
  apartments: Apartment[],
): FormState {
  if (booking) {
    return {
      apartment_id: booking.apartment_id,
      guest_name: booking.guest_name,
      guest_phone: booking.guest_phone ?? "",
      booking_type: booking.booking_type,
      start: vnDateTimeKey(new Date(booking.start_at)),
      end: vnDateTimeKey(new Date(booking.end_at)),
      status: booking.status,
      total_amount: booking.total_amount,
      paid_amount: booking.paid_amount,
      note: booking.note ?? "",
    };
  }

  const type = prefill?.bookingType ?? "hourly";
  const start = prefill?.startAt ?? new Date(Math.ceil(Date.now() / 900_000) * 900_000);
  const defaultMinutes = type === "overnight" ? 22 * 60 : 180;

  return {
    apartment_id: prefill?.apartmentId ?? apartments[0]?.id ?? "",
    guest_name: "",
    guest_phone: "",
    booking_type: type,
    start: vnDateTimeKey(start),
    end: vnDateTimeKey(new Date(start.getTime() + defaultMinutes * 60_000)),
    status: "confirmed",
    total_amount: 0,
    paid_amount: 0,
    note: "",
  };
}

export function BookingFormDialog({
  booking,
  prefill,
  apartments,
  onClose,
  onSaved,
}: {
  booking: Booking | null;
  prefill?: BookingPrefill;
  apartments: Apartment[];
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}) {
  // Dialog chỉ được mount khi mở, nên khởi tạo một lần ở đây là đủ.
  const [form, setForm] = useState<FormState>(() =>
    buildInitialState(booking, prefill, apartments),
  );
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Khi người dùng đã tự gõ thành tiền thì thôi ghi đè bằng giá gợi ý.
  // Booking đang sửa coi như đã có giá do người dùng chốt.
  const [amountTouched, setAmountTouched] = useState(() => Boolean(booking));

  const patch = (changes: Partial<FormState>) => setForm((f) => ({ ...f, ...changes }));

  const apartment = apartments.find((a) => a.id === form.apartment_id);
  const startDate = useMemo(() => dateTimeKeyToDate(form.start), [form.start]);
  const endDate = useMemo(() => dateTimeKeyToDate(form.end), [form.end]);
  const minutes = (endDate.getTime() - startDate.getTime()) / 60_000;
  const suggested = suggestAmount(apartment, form.booking_type, minutes);

  // Giá hiển thị suy ra trực tiếp: chưa gõ đè thì luôn bám giá gợi ý theo căn,
  // hình thức và thời lượng đang chọn.
  const totalAmount = amountTouched ? form.total_amount : suggested;

  function setDuration(durationMinutes: number) {
    patch({ end: vnDateTimeKey(new Date(startDate.getTime() + durationMinutes * 60_000)) });
  }

  function switchType(next: BookingType) {
    if (next === form.booking_type) return;
    if (next === "overnight") {
      // Giữ nguyên ngày đang chọn, nắn về khung nhận 14:00 → trả 12:00 hôm sau.
      const dayKey = form.start.slice(0, 10);
      const start = dateTimeKeyToDate(
        `${dayKey}T${String(OVERNIGHT_CHECK_IN_HOUR).padStart(2, "0")}:00`,
      );
      const end = new Date(
        start.getTime() + (24 + OVERNIGHT_CHECK_OUT_HOUR - OVERNIGHT_CHECK_IN_HOUR) * 3_600_000,
      );
      patch({ booking_type: next, start: vnDateTimeKey(start), end: vnDateTimeKey(end) });
      return;
    }
    patch({
      booking_type: next,
      end: vnDateTimeKey(new Date(startDate.getTime() + 180 * 60_000)),
    });
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (minutes <= 0) {
      setError("Giờ trả phòng phải sau giờ nhận phòng.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await saveBooking({
        id: booking?.id,
        apartment_id: form.apartment_id,
        guest_name: form.guest_name.trim(),
        guest_phone: form.guest_phone.trim() || null,
        booking_type: form.booking_type,
        start_at: startDate.toISOString(),
        end_at: endDate.toISOString(),
        status: form.status,
        total_amount: totalAmount,
        paid_amount: form.paid_amount,
        note: form.note.trim() || null,
      });
      await onSaved();
      onClose();
    } catch (err) {
      setError(describeError(err));
    } finally {
      setBusy(false);
    }
  }

  async function onDelete() {
    if (!booking) return;
    setBusy(true);
    setError(null);
    try {
      await deleteBooking(booking.id);
      await onSaved();
      onClose();
    } catch (err) {
      setError(describeError(err));
      setBusy(false);
    }
  }

  const remaining = totalAmount - form.paid_amount;

  return (
    <Modal
      title={booking ? "Sửa booking" : "Booking mới"}
      subtitle={
        apartment
          ? `${apartment.code}${apartment.name ? ` · ${apartment.name}` : ""} · đệm dọn ${apartment.cleaning_buffer_minutes}′`
          : "Chọn căn hộ để thấy giá gợi ý"
      }
      onClose={onClose}
      width={640}
    >
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Căn hộ *">
            <Select
              required
              value={form.apartment_id}
              onChange={(e) => patch({ apartment_id: e.target.value })}
            >
              <option value="" disabled>
                Chọn căn…
              </option>
              {apartments.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.code}
                  {a.name ? ` — ${a.name}` : ""}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Hình thức">
            <div className="flex gap-1.5 rounded-xl bg-surface-inset p-1">
              {(Object.keys(BOOKING_TYPE_LABEL) as BookingType[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => switchType(t)}
                  className={`flex-1 rounded-lg py-1.5 text-[13px] font-semibold transition-colors ${
                    form.booking_type === t
                      ? "bg-surface text-ink shadow-[0_2px_6px_-3px_rgba(61,53,41,.5)]"
                      : "text-muted hover:text-ink"
                  }`}
                >
                  {BOOKING_TYPE_LABEL[t]}
                </button>
              ))}
            </div>
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Khách *">
            <TextInput
              required
              value={form.guest_name}
              onChange={(e) => patch({ guest_name: e.target.value })}
              placeholder="Nguyễn Văn A"
            />
          </Field>
          <Field label="Số điện thoại">
            <TextInput
              value={form.guest_phone}
              onChange={(e) => patch({ guest_phone: e.target.value })}
              placeholder="09xx xxx xxx"
            />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nhận phòng *">
            <TextInput
              type="datetime-local"
              required
              value={form.start}
              onChange={(e) => patch({ start: e.target.value })}
            />
          </Field>
          <Field label="Trả phòng *">
            <TextInput
              type="datetime-local"
              required
              value={form.end}
              onChange={(e) => patch({ end: e.target.value })}
            />
          </Field>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[12px] text-muted-soft">Đặt nhanh:</span>
          {QUICK_DURATIONS[form.booking_type].map((d) => (
            <button
              key={d.label}
              type="button"
              onClick={() => setDuration(d.minutes)}
              className="rounded-full border border-line px-3 py-1 text-[12px] font-semibold text-muted transition-colors hover:border-gold hover:text-gold-ink"
            >
              {d.label}
            </button>
          ))}
          <span className="ml-auto text-[12.5px] font-semibold text-muted">
            {minutes > 0 ? fmtDuration(minutes, form.booking_type) : "—"}
          </span>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Field
            label="Thành tiền"
            hint={
              suggested > 0 && suggested !== totalAmount ? (
                <button
                  type="button"
                  className="font-semibold text-gold-deep hover:underline"
                  onClick={() => {
                    setAmountTouched(false);
                    patch({ total_amount: suggested });
                  }}
                >
                  Dùng giá gợi ý {fmtVndFull(suggested)}
                </button>
              ) : undefined
            }
          >
            <MoneyInput
              value={totalAmount}
              onValueChange={(total_amount) => {
                setAmountTouched(true);
                patch({ total_amount });
              }}
            />
          </Field>
          <Field
            label="Đã thanh toán"
            hint={remaining > 0 ? `Còn lại ${fmtVndFull(remaining)}` : "Đã thu đủ"}
          >
            <MoneyInput
              value={form.paid_amount}
              onValueChange={(paid_amount) => patch({ paid_amount })}
            />
          </Field>
          <Field label="Trạng thái">
            <Select
              value={form.status}
              onChange={(e) => patch({ status: e.target.value as BookingStatus })}
            >
              {(Object.keys(BOOKING_STATUS_LABEL) as BookingStatus[]).map((s) => (
                <option key={s} value={s}>
                  {BOOKING_STATUS_LABEL[s]}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <Field label="Ghi chú">
          <Textarea value={form.note} onChange={(e) => patch({ note: e.target.value })} />
        </Field>

        {error ? <ErrorNote>{error}</ErrorNote> : null}

        <div className="mt-2 flex items-center justify-between gap-2">
          {booking ? (
            confirmDelete ? (
              <div className="flex items-center gap-2">
                <span className="text-[12.5px] text-muted">Xoá hẳn booking này?</span>
                <Button type="button" size="sm" variant="danger" onClick={onDelete} disabled={busy}>
                  Xoá
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => setConfirmDelete(false)}
                >
                  Không
                </Button>
              </div>
            ) : (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => setConfirmDelete(true)}
                disabled={busy}
              >
                Xoá booking
              </Button>
            )
          ) : (
            <span />
          )}

          <div className="flex gap-2">
            <Button type="button" variant="ghost" onClick={onClose} disabled={busy}>
              Huỷ
            </Button>
            <Button type="submit" variant="primary" disabled={busy}>
              {busy ? "Đang lưu…" : "Lưu"}
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
