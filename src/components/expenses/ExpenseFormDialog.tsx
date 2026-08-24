"use client";

import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { ErrorNote } from "@/components/ui/Feedback";
import { Field, MoneyInput, Select, TextInput, Textarea } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { vnDayKey } from "@/lib/date";
import { deleteExpense, describeError, saveExpense } from "@/lib/queries";
import type { Apartment, Expense, ExpenseCategory } from "@/lib/types";

type FormState = {
  apartment_id: string;
  category_id: string;
  amount: number;
  incurred_on: string;
  note: string;
};

export function ExpenseFormDialog({
  expense,
  defaultDay,
  apartments,
  categories,
  onClose,
  onSaved,
}: {
  expense: Expense | null;
  defaultDay: string;
  apartments: Apartment[];
  categories: ExpenseCategory[];
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}) {
  // Dialog chỉ được mount khi mở, nên khởi tạo một lần ở đây là đủ.
  const [form, setForm] = useState<FormState>(() =>
    expense
      ? {
          apartment_id: expense.apartment_id ?? "",
          category_id: expense.category_id,
          amount: expense.amount,
          incurred_on: expense.incurred_on,
          note: expense.note ?? "",
        }
      : empty(defaultDay, categories),
  );
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const patch = (changes: Partial<FormState>) => setForm((f) => ({ ...f, ...changes }));

  // Dòng sinh từ chi phí định kỳ: sửa được, nhưng cần nói rõ ảnh hưởng.
  const fromRecurring = Boolean(expense?.recurring_id);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await saveExpense({
        id: expense?.id,
        apartment_id: form.apartment_id || null,
        category_id: form.category_id,
        amount: form.amount,
        incurred_on: form.incurred_on,
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
    if (!expense) return;
    setBusy(true);
    setError(null);
    try {
      await deleteExpense(expense.id);
      await onSaved();
      onClose();
    } catch (err) {
      setError(describeError(err));
      setBusy(false);
    }
  }

  return (
    <Modal
      title={expense ? "Sửa chi phí" : "Thêm chi phí"}
      subtitle={
        fromRecurring
          ? "Khoản này sinh từ chi phí định kỳ. Sửa ở đây chỉ đổi riêng tháng này."
          : undefined
      }
      onClose={onClose}
      width={560}
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
          <Field label="Số tiền *">
            <MoneyInput value={form.amount} onValueChange={(amount) => patch({ amount })} />
          </Field>
          <Field label="Ngày phát sinh *">
            <TextInput
              type="date"
              required
              value={form.incurred_on}
              onChange={(e) => patch({ incurred_on: e.target.value })}
            />
          </Field>
        </div>

        <Field label="Ghi chú">
          <Textarea value={form.note} onChange={(e) => patch({ note: e.target.value })} />
        </Field>

        {error ? <ErrorNote>{error}</ErrorNote> : null}

        <div className="mt-2 flex items-center justify-between gap-2">
          {expense ? (
            confirmDelete ? (
              <div className="flex items-center gap-2">
                <span className="text-[12.5px] text-muted">Xoá khoản này?</span>
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

function empty(defaultDay: string, categories: ExpenseCategory[]): FormState {
  return {
    apartment_id: "",
    category_id: categories[0]?.id ?? "",
    amount: 0,
    incurred_on: defaultDay || vnDayKey(new Date()),
    note: "",
  };
}
