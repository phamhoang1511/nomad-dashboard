"use client";

import { useCallback, useMemo, useState } from "react";

import { ExpenseFormDialog } from "@/components/expenses/ExpenseFormDialog";
import { RecurringFormDialog } from "@/components/expenses/RecurringFormDialog";
import { Button } from "@/components/ui/Button";
import { Badge, EmptyState, ErrorNote, LoadingRows } from "@/components/ui/Feedback";
import { PageHeader } from "@/components/ui/PageHeader";
import { MonthPicker } from "@/components/ui/PeriodPicker";
import { useLiveData } from "@/hooks/useLiveData";
import { fmtDayMonth, fmtMonthLong, monthKeyToFirstDay, vnMonthKey } from "@/lib/date";
import { fmtVndFull } from "@/lib/format";
import {
  TABLES,
  describeError,
  ensureRecurringExpenses,
  listApartments,
  listExpenseCategories,
  listExpenses,
  listRecurringExpenses,
} from "@/lib/queries";
import type { Expense, RecurringExpense } from "@/lib/types";

type Tab = "actual" | "recurring";

export default function ExpensesPage() {
  const [monthKey, setMonthKey] = useState(() => vnMonthKey(new Date()));
  const [tab, setTab] = useState<Tab>("actual");

  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [creatingExpense, setCreatingExpense] = useState(false);
  const [editingRecurring, setEditingRecurring] = useState<RecurringExpense | null>(null);
  const [creatingRecurring, setCreatingRecurring] = useState(false);

  const [generateNote, setGenerateNote] = useState<string | null>(null);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  const fetcher = useCallback(
    async () => ({
      apartments: await listApartments(true),
      categories: await listExpenseCategories(),
      expenses: await listExpenses(monthKey),
      recurring: await listRecurringExpenses(),
    }),
    [monthKey],
  );
  const { data, loading, error, refresh } = useLiveData(fetcher, [
    TABLES.expenses,
    TABLES.recurring,
  ]);

  const apartments = useMemo(() => data?.apartments ?? [], [data]);
  const categories = useMemo(() => data?.categories ?? [], [data]);
  const expenses = useMemo(() => data?.expenses ?? [], [data]);
  const recurring = useMemo(() => data?.recurring ?? [], [data]);

  const apartmentCode = useCallback(
    (id: string | null) => (id ? (apartments.find((a) => a.id === id)?.code ?? "—") : "Chung"),
    [apartments],
  );
  const categoryName = useCallback(
    (id: string) => categories.find((c) => c.id === id)?.name ?? "—",
    [categories],
  );

  const monthTotal = useMemo(
    () => expenses.reduce((sum, e) => sum + e.amount, 0),
    [expenses],
  );

  async function generateRecurring() {
    setGenerating(true);
    setGenerateError(null);
    setGenerateNote(null);
    try {
      const created = await ensureRecurringExpenses(monthKey);
      setGenerateNote(
        created > 0
          ? `Đã tạo ${created} khoản cho ${fmtMonthLong(monthKey).toLowerCase()}.`
          : `${fmtMonthLong(monthKey)} đã có đủ chi phí định kỳ — không tạo thêm.`,
      );
      await refresh();
    } catch (err) {
      setGenerateError(describeError(err));
    } finally {
      setGenerating(false);
    }
  }

  return (
    <>
      <PageHeader
        eyebrow={`${fmtMonthLong(monthKey)} · tổng ${fmtVndFull(monthTotal)}`}
        title="Chi phí"
        action={
          <div className="flex flex-wrap items-center gap-2">
            <MonthPicker value={monthKey} onChange={setMonthKey} />
            <Button
              variant="primary"
              onClick={() =>
                tab === "actual" ? setCreatingExpense(true) : setCreatingRecurring(true)
              }
              disabled={!categories.length}
            >
              {tab === "actual" ? "+ Thêm chi phí" : "+ Thêm định kỳ"}
            </Button>
          </div>
        }
      />

      <div className="mb-5 flex gap-1.5 rounded-full bg-surface-inset p-1 md:w-fit">
        {(
          [
            ["actual", `Phát sinh (${expenses.length})`],
            ["recurring", `Định kỳ (${recurring.length})`],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`flex-1 rounded-full px-5 py-2 text-[13px] font-semibold whitespace-nowrap transition-colors md:flex-none ${
              tab === key
                ? "bg-surface text-ink shadow-[0_2px_8px_-4px_rgba(61,53,41,.5)]"
                : "text-muted hover:text-ink"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="card p-6 md:p-7">
        {error ? <ErrorNote>{error}</ErrorNote> : null}

        {loading ? (
          <LoadingRows rows={5} />
        ) : tab === "actual" ? (
          expenses.length === 0 ? (
            <EmptyState
              title={`Chưa có chi phí nào trong ${fmtMonthLong(monthKey).toLowerCase()}`}
              hint="Thêm khoản phát sinh, hoặc sang tab Định kỳ để tạo các khoản cố định hàng tháng."
              action={
                <Button variant="primary" onClick={() => setCreatingExpense(true)}>
                  + Thêm chi phí
                </Button>
              }
            />
          ) : (
            <div className="scroll-slim overflow-x-auto">
              <table className="w-full min-w-[720px] border-collapse">
                <thead>
                  <tr className="border-b border-line text-left text-[11.5px] font-semibold tracking-[1px] text-muted-soft uppercase">
                    <th className="pb-3">Ngày</th>
                    <th className="pb-3">Danh mục</th>
                    <th className="pb-3">Căn</th>
                    <th className="pb-3">Ghi chú</th>
                    <th className="pb-3 text-right">Số tiền</th>
                    <th className="pb-3" />
                  </tr>
                </thead>
                <tbody>
                  {expenses.map((e) => (
                    <tr key={e.id} className="border-b border-line-soft last:border-0">
                      <td className="py-3.5 text-[13px] whitespace-nowrap text-muted tabular-nums">
                        {fmtDayMonth(new Date(`${e.incurred_on}T00:00:00Z`))}
                      </td>
                      <td className="py-3.5 pr-3 text-[14px] font-semibold">
                        <div className="flex items-center gap-2">
                          {categoryName(e.category_id)}
                          {e.recurring_id ? (
                            <Badge bg="var(--color-gold-wash)" fg="var(--color-gold-ink)">
                              định kỳ
                            </Badge>
                          ) : null}
                        </div>
                      </td>
                      <td className="py-3.5 pr-3 text-[13px] text-muted">
                        {apartmentCode(e.apartment_id)}
                      </td>
                      <td className="py-3.5 pr-3 text-[13px] text-muted-soft">{e.note ?? "—"}</td>
                      <td className="py-3.5 text-right font-display text-[17px] text-clay tabular-nums">
                        {fmtVndFull(e.amount)}
                      </td>
                      <td className="py-3.5 pl-3">
                        <div className="flex justify-end">
                          <Button size="sm" variant="ghost" onClick={() => setEditingExpense(e)}>
                            Sửa
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  <tr>
                    <td colSpan={4} className="pt-4 text-[13px] font-semibold text-muted">
                      Tổng {fmtMonthLong(monthKey).toLowerCase()}
                    </td>
                    <td className="pt-4 text-right font-display text-[20px] font-semibold text-clay tabular-nums">
                      {fmtVndFull(monthTotal)}
                    </td>
                    <td />
                  </tr>
                </tbody>
              </table>
            </div>
          )
        ) : (
          <div className="flex flex-col gap-5">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-surface-inset px-5 py-4">
              <div className="text-[13px] leading-relaxed text-muted">
                Mỗi mẫu ở đây sinh ra một khoản chi phí thật cho từng tháng.
                <br />
                Dashboard tự sinh khi bạn mở tháng đó — nút này để làm ngay.
              </div>
              <Button onClick={generateRecurring} disabled={generating || !recurring.length}>
                {generating ? "Đang tạo…" : `Tạo cho ${fmtMonthLong(monthKey).toLowerCase()}`}
              </Button>
            </div>

            {generateNote ? (
              <div className="rounded-xl border border-sage/25 bg-sage-wash px-4 py-3 text-[13px] text-sage-deep">
                {generateNote}
              </div>
            ) : null}
            {generateError ? <ErrorNote>{generateError}</ErrorNote> : null}

            {recurring.length === 0 ? (
              <EmptyState
                title="Chưa có chi phí định kỳ"
                hint="Tiền thuê lại căn hộ, internet, phí quản lý… khai báo một lần rồi tự cộng vào P&L mỗi tháng."
                action={
                  <Button variant="primary" onClick={() => setCreatingRecurring(true)}>
                    + Thêm định kỳ
                  </Button>
                }
              />
            ) : (
              <div className="scroll-slim overflow-x-auto">
                <table className="w-full min-w-[760px] border-collapse">
                  <thead>
                    <tr className="border-b border-line text-left text-[11.5px] font-semibold tracking-[1px] text-muted-soft uppercase">
                      <th className="pb-3">Danh mục</th>
                      <th className="pb-3">Căn</th>
                      <th className="pb-3">Hiệu lực</th>
                      <th className="pb-3 text-center">Ngày</th>
                      <th className="pb-3 text-right">Mỗi tháng</th>
                      <th className="pb-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {recurring.map((r) => (
                      <tr
                        key={r.id}
                        className={`border-b border-line-soft last:border-0 ${r.active ? "" : "opacity-50"}`}
                      >
                        <td className="py-3.5 pr-3 text-[14px] font-semibold">
                          {categoryName(r.category_id)}
                          {r.note ? (
                            <div className="text-[12px] font-normal text-muted-soft">{r.note}</div>
                          ) : null}
                        </td>
                        <td className="py-3.5 pr-3 text-[13px] text-muted">
                          {apartmentCode(r.apartment_id)}
                        </td>
                        <td className="py-3.5 pr-3 text-[13px] whitespace-nowrap text-muted">
                          {fmtMonthLong(r.start_month.slice(0, 7))}
                          {r.end_month ? ` → ${fmtMonthLong(r.end_month.slice(0, 7))}` : " → nay"}
                        </td>
                        <td className="py-3.5 text-center text-[13px] text-muted tabular-nums">
                          {r.day_of_month}
                        </td>
                        <td className="py-3.5 text-right font-display text-[17px] text-clay tabular-nums">
                          {fmtVndFull(r.amount)}
                        </td>
                        <td className="py-3.5 pl-3">
                          <div className="flex justify-end">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setEditingRecurring(r)}
                            >
                              Sửa
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {creatingExpense || editingExpense ? (
        <ExpenseFormDialog
          expense={editingExpense}
          defaultDay={monthKeyToFirstDay(monthKey)}
          apartments={apartments}
          categories={categories}
          onClose={() => {
            setCreatingExpense(false);
            setEditingExpense(null);
          }}
          onSaved={refresh}
        />
      ) : null}

      {creatingRecurring || editingRecurring ? (
        <RecurringFormDialog
          recurring={editingRecurring}
          defaultMonth={monthKey}
          apartments={apartments}
          categories={categories}
          onClose={() => {
            setCreatingRecurring(false);
            setEditingRecurring(null);
          }}
          onSaved={refresh}
        />
      ) : null}
    </>
  );
}
