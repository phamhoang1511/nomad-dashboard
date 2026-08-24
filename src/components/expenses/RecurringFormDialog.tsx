"use client";

import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { ErrorNote } from "@/components/ui/Feedback";
import { Field, MoneyInput, Select, TextInput, Textarea } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { vnMonthKey } from "@/lib/date";
import { deleteRecurringExpense, describeError, saveRecurringExpense } from "@/lib/queries";
import type { Apartment, ExpenseCategory, RecurringExpense } from "@/lib/types";

type FormState = {
  apartment_id: string;
  category_id: string;
  amount: number;
  day_of_month: number;
  start_month: string;
  end_month: string;
  active: boolean;
  note: string;
};

export function RecurringFormDialog({
  recurring,
  defaultMonth,
  apartments,
  categories,
  onClose,
  onSaved,
}: {
  recurring: RecurringExpense | null;
  defaultMonth: string;
  apartments: Apartment[];
  categories: ExpenseCategory[];
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}) {
  // Dialog chỉ được mount khi mở, nên khởi tạo một lần ở đây là đủ.
  const [form, setForm] = useState<FormState>(() =>
    recurring
      ? {
          apartment_id: recurring.apartment_id ?? "",
          category_id: recurring.category_id,
          amount: recurring.amount,
          day_of_month: recurring.day_of_month,
          start_month: recurring.start_month.slice(0, 7),
          end_month: recurring.end_month?.slice(0, 7) ?? "",
          active: recurring.active,
          note: recurring.note ?? "",
        }
      : empty(defaultMonth, categories),
  );
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const patch = (changes: Partial<FormState>) => setForm((f) => ({ ...f, ...changes }));

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await saveRecurringExpense({
        id: recurring?.id,
        apartment_id: form.apartment_id || null,
        category_id: form.category_id,
        amount: form.amount,
        day_of_month: form.day_of_month,
        start_month: `${form.start_month}-01`,
        end_month: form.end_month ? `${form.end_month}-01` : null,
        active: form.active,
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
    if (!recurring) return;
    setBusy(true);
    setError(null);
    try {
      await deleteRecurringExpense(recurring.id);
      await onSaved();
      onClose();
    } catch (err) {
      setError(describeError(err));
      setBusy(false);
    }
  }

  return (
    <Modal
      title={recurring ? "Sửa chi phí định kỳ" : "Chi phí định kỳ mới"}
      subtitle="Đây là mẫu. Mỗi tháng nó sinh ra một khoản chi phí thật, sửa riêng từng tháng được."
      onClose={onClose}
      width={600}
    >
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Danh mục *">
            <Select
              required
              value={form.category_id}
              onChange={(e) => patch({ category_id: e.target.value })}
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Căn hộ" hint="Bỏ trống nếu là chi phí chung">
            <Select
              value={form.apartment_id}
              onChange={(e) => patch({ apartment_id: e.target.value })}
            >
              <option value="">Chi phí chung</option>
              {apartments.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.code}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Số tiền mỗi tháng *">
            <MoneyInput value={form.amount} onValueChange={(amount) => patch({ amount })} />
          </Field>
          <Field label="Ngày trong tháng" hint="1–28 để tháng nào cũng có ngày này">
            <TextInput
              type="number"
              min={1}
              max={28}
              value={form.day_of_month}
              onChange={(e) =>
                patch({ day_of_month: Math.min(28, Math.max(1, Number(e.target.value) || 1)) })
              }
            />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Bắt đầu từ tháng *">
            <TextInput
              type="month"
              required
              value={form.start_month}
              onChange={(e) => patch({ start_month: e.target.value })}
            />
          </Field>
          <Field label="Kết thúc tháng" hint="Bỏ trống nếu còn hiệu lực">
            <TextInput
              type="month"
              value={form.end_month}
              onChange={(e) => patch({ end_month: e.target.value })}
            />
          </Field>
        </div>

        <label className="flex cursor-pointer items-center gap-2.5 text-[13.5px]">
          <input
            type="checkbox"
            checked={form.active}
            onChange={(e) => patch({ active: e.target.checked })}
            className="h-4 w-4 accent-[var(--color-gold-deep)]"
          />
          Đang áp dụng
        </label>

        <Field label="Ghi chú">
          <Textarea value={form.note} onChange={(e) => patch({ note: e.target.value })} />
        </Field>

        {error ? <ErrorNote>{error}</ErrorNote> : null}

        <div className="mt-2 flex items-center justify-between gap-2">
          {recurring ? (
            confirmDelete ? (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[12.5px] text-muted">
                  Xoá mẫu này? Chi phí các tháng đã sinh vẫn giữ nguyên.
                </span>
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
                Xoá
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

function empty(defaultMonth: string, categories: ExpenseCategory[]): FormState {
  return {
    apartment_id: "",
    category_id: categories.find((c) => c.kind === "fixed")?.id ?? categories[0]?.id ?? "",
    amount: 0,
    day_of_month: 1,
    start_month: defaultMonth || vnMonthKey(new Date()),
    end_month: "",
    active: true,
    note: "",
  };
}
