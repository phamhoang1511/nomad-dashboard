"use client";

import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { ErrorNote } from "@/components/ui/Feedback";
import { Field, MoneyInput, Select, TextInput, Textarea } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { describeError, saveApartment } from "@/lib/queries";
import { APARTMENT_STATUS_LABEL, type Apartment, type ApartmentStatus } from "@/lib/types";

type FormState = {
  code: string;
  name: string;
  building: string;
  hourly_rate: number;
  nightly_rate: number;
  cleaning_buffer_minutes: number;
  status: ApartmentStatus;
  sort_order: number;
  note: string;
};

const EMPTY: FormState = {
  code: "",
  name: "",
  building: "",
  hourly_rate: 0,
  nightly_rate: 0,
  cleaning_buffer_minutes: 15,
  status: "active",
  sort_order: 0,
  note: "",
};

export function ApartmentFormDialog({
  apartment,
  onClose,
  onSaved,
}: {
  apartment: Apartment | null;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}) {
  // Dialog chỉ được mount khi mở, nên khởi tạo một lần ở đây là đủ.
  const [form, setForm] = useState<FormState>(() =>
    apartment
      ? {
          code: apartment.code,
          name: apartment.name ?? "",
          building: apartment.building ?? "",
          hourly_rate: apartment.hourly_rate,
          nightly_rate: apartment.nightly_rate,
          cleaning_buffer_minutes: apartment.cleaning_buffer_minutes,
          status: apartment.status,
          sort_order: apartment.sort_order,
          note: apartment.note ?? "",
        }
      : EMPTY,
  );
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const patch = (changes: Partial<FormState>) => setForm((f) => ({ ...f, ...changes }));

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await saveApartment({
        id: apartment?.id,
        code: form.code.trim(),
        name: form.name.trim() || null,
        building: form.building.trim() || null,
        hourly_rate: form.hourly_rate,
        nightly_rate: form.nightly_rate,
        cleaning_buffer_minutes: form.cleaning_buffer_minutes,
        status: form.status,
        sort_order: form.sort_order,
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

  return (
    <Modal
      title={apartment ? `Sửa ${apartment.code}` : "Thêm căn hộ"}
      subtitle="Giá ở đây chỉ để gợi ý khi tạo booking — vẫn sửa được từng lượt."
      onClose={onClose}
      width={600}
    >
      <form id="apartment-form" onSubmit={onSubmit} className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Mã căn *" hint="Duy nhất, ví dụ MSB.3301">
            <TextInput
              required
              autoFocus
              value={form.code}
              onChange={(e) => patch({ code: e.target.value })}
              placeholder="MSB.3301"
            />
          </Field>
          <Field label="Toà nhà">
            <TextInput
              value={form.building}
              onChange={(e) => patch({ building: e.target.value })}
              placeholder="Masteri"
            />
          </Field>
        </div>

        <Field label="Tên gọi">
          <TextInput
            value={form.name}
            onChange={(e) => patch({ name: e.target.value })}
            placeholder="Studio hướng hồ"
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Giá theo giờ">
            <MoneyInput
              value={form.hourly_rate}
              onValueChange={(hourly_rate) => patch({ hourly_rate })}
            />
          </Field>
          <Field label="Giá qua đêm">
            <MoneyInput
              value={form.nightly_rate}
              onValueChange={(nightly_rate) => patch({ nightly_rate })}
            />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Dọn vệ sinh" hint="Phút chặn giữa 2 lượt khách">
            <TextInput
              type="number"
              min={0}
              max={240}
              value={form.cleaning_buffer_minutes}
              onChange={(e) =>
                patch({ cleaning_buffer_minutes: Number(e.target.value) || 0 })
              }
            />
          </Field>
          <Field label="Trạng thái">
            <Select
              value={form.status}
              onChange={(e) => patch({ status: e.target.value as ApartmentStatus })}
            >
              {(Object.keys(APARTMENT_STATUS_LABEL) as ApartmentStatus[]).map((s) => (
                <option key={s} value={s}>
                  {APARTMENT_STATUS_LABEL[s]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Thứ tự" hint="Nhỏ hiện trước">
            <TextInput
              type="number"
              value={form.sort_order}
              onChange={(e) => patch({ sort_order: Number(e.target.value) || 0 })}
            />
          </Field>
        </div>

        <Field label="Ghi chú">
          <Textarea value={form.note} onChange={(e) => patch({ note: e.target.value })} />
        </Field>

        {error ? <ErrorNote>{error}</ErrorNote> : null}

        <div className="mt-2 flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose} disabled={busy}>
            Huỷ
          </Button>
          <Button type="submit" variant="primary" disabled={busy}>
            {busy ? "Đang lưu…" : "Lưu"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
