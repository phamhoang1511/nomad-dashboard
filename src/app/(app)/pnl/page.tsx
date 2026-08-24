"use client";

import { useCallback, useMemo, useState } from "react";

import { PnlChart, type PnlPoint } from "@/components/pnl/PnlChart";
import { EmptyState, ErrorNote, LoadingRows } from "@/components/ui/Feedback";
import { PageHeader } from "@/components/ui/PageHeader";
import { MonthPicker } from "@/components/ui/PeriodPicker";
import { useLiveData } from "@/hooks/useLiveData";
import { fmtMonthLong, recentMonthKeys, vnMonthKey } from "@/lib/date";
import { fmtPct, fmtVnd, fmtVndFull } from "@/lib/format";
import {
  TABLES,
  ensureRecurringExpensesOnce,
  listApartments,
  listExpenseCategories,
  listExpenses,
  listPnlForMonth,
  listPnlRange,
} from "@/lib/queries";

const CHART_MONTHS = 12;
const COLUMNS = "grid grid-cols-[1.3fr_1fr_1fr_1fr_.7fr] gap-3";

export default function PnlPage() {
  const [monthKey, setMonthKey] = useState(() => vnMonthKey(new Date()));

  const fetcher = useCallback(async () => {
    await ensureRecurringExpensesOnce(monthKey);
    const months = recentMonthKeys(monthKey, CHART_MONTHS);
    return {
      apartments: await listApartments(true),
      categories: await listExpenseCategories(),
      month: await listPnlForMonth(monthKey),
      expenses: await listExpenses(monthKey),
      range: await listPnlRange(months[0], monthKey),
      months,
    };
  }, [monthKey]);

  const { data, loading, error } = useLiveData(fetcher, [TABLES.bookings, TABLES.expenses]);

  const apartments = useMemo(() => data?.apartments ?? [], [data]);

  /** Một dòng cho mỗi căn, cộng dòng "Chi phí chung" nếu tháng đó có. */
  const rows = useMemo(() => {
    const month = data?.month ?? [];
    const perApartment = apartments.map((apartment) => {
      const pnl = month.find((m) => m.apartment_id === apartment.id);
      return {
        id: apartment.id,
        label: apartment.code,
        sublabel: apartment.name ?? apartment.building ?? "",
        revenue: pnl?.revenue ?? 0,
        expense: pnl?.expense ?? 0,
        profit: pnl?.profit ?? 0,
      };
    });

    const shared = month.find((m) => m.apartment_id === null);
    if (shared && (shared.expense > 0 || shared.revenue > 0)) {
      perApartment.push({
        id: "shared",
        label: "Chi phí chung",
        sublabel: "Không gắn căn nào",
        revenue: shared.revenue,
        expense: shared.expense,
        profit: shared.profit,
      });
    }
    return perApartment;
  }, [data, apartments]);

  const totals = useMemo(
    () =>
      rows.reduce(
        (acc, r) => ({
          revenue: acc.revenue + r.revenue,
          expense: acc.expense + r.expense,
          profit: acc.profit + r.profit,
        }),
        { revenue: 0, expense: 0, profit: 0 },
      ),
    [rows],
  );

  const byCategory = useMemo(() => {
    const categories = data?.categories ?? [];
    const totalsByCategory = new Map<string, number>();
    for (const e of data?.expenses ?? []) {
      totalsByCategory.set(e.category_id, (totalsByCategory.get(e.category_id) ?? 0) + e.amount);
    }
    return [...totalsByCategory.entries()]
      .map(([id, amount]) => ({
        name: categories.find((c) => c.id === id)?.name ?? "Khác",
        amount,
      }))
      .sort((a, b) => b.amount - a.amount);
  }, [data]);

  const chartData = useMemo<PnlPoint[]>(() => {
    const months = data?.months ?? [];
    const range = data?.range ?? [];
    return months.map((month) => {
      const rowsOfMonth = range.filter((r) => r.month.slice(0, 7) === month);
      return {
        monthKey: month,
        revenue: rowsOfMonth.reduce((sum, r) => sum + r.revenue, 0),
        expense: rowsOfMonth.reduce((sum, r) => sum + r.expense, 0),
        profit: rowsOfMonth.reduce((sum, r) => sum + r.profit, 0),
      };
    });
  }, [data]);

  const hasChartData = chartData.some((d) => d.revenue || d.expense);

  return (
    <>
      <PageHeader
        eyebrow={`${fmtMonthLong(monthKey)} · biên lợi nhuận ${fmtPct(totals.profit, totals.revenue)}`}
        title="Lợi nhuận"
        action={<MonthPicker value={monthKey} onChange={setMonthKey} />}
      />

      {error ? (
        <div className="mb-5">
          <ErrorNote>{error}</ErrorNote>
        </div>
      ) : null}

      <div className="mb-[22px] grid gap-5 md:grid-cols-3">
        <SummaryCard label="Doanh thu" value={fmtVndFull(totals.revenue)} />
        <SummaryCard
          label="Chi phí"
          value={fmtVndFull(totals.expense)}
          color="var(--color-clay)"
        />
        <SummaryCard
          label="Lợi nhuận"
          value={fmtVndFull(totals.profit)}
          color={totals.profit < 0 ? "var(--color-clay)" : "var(--color-sage-deep)"}
        />
      </div>

      <section className="card mb-[22px] p-6 md:p-7">
        <h2 className="font-display text-[24px] font-semibold">12 tháng gần nhất</h2>
        <div className="mt-1.5 mb-5 text-[13px] text-muted">
          Tính đến {fmtMonthLong(monthKey).toLowerCase()} · di chuột vào từng tháng để xem số chi
          tiết
        </div>
        {loading && !data ? (
          <LoadingRows rows={1} height={260} />
        ) : hasChartData ? (
          <PnlChart data={chartData} />
        ) : (
          <EmptyState
            title="Chưa đủ dữ liệu để vẽ biểu đồ"
            hint="Ghi vài booking và chi phí, biểu đồ sẽ tự hiện."
          />
        )}
      </section>

      <section className="card mb-[22px] p-6 md:p-7">
        <h2 className="font-display text-[24px] font-semibold">Chi tiết theo căn</h2>
        <div className="mt-1.5 mb-5 text-[13px] text-muted">{fmtMonthLong(monthKey)}</div>

        {loading && !data ? (
          <LoadingRows rows={5} />
        ) : rows.length === 0 ? (
          <EmptyState title="Chưa có căn hộ nào" />
        ) : (
          <div className="scroll-slim overflow-x-auto">
            <div className="min-w-[720px]">
              <div
                className={`${COLUMNS} border-b border-line px-1 pb-3 text-[11.5px] font-semibold tracking-[1px] text-muted-soft uppercase`}
              >
                <div>Căn hộ</div>
                <div className="text-right">Doanh thu</div>
                <div className="text-right">Chi phí</div>
                <div className="text-right">Lợi nhuận</div>
                <div className="text-right">Biên LN</div>
              </div>

              {rows.map((row) => (
                <div
                  key={row.id}
                  className={`${COLUMNS} items-center border-b border-line-soft px-1 py-4`}
                >
                  <div>
                    <div className="text-[15px] font-semibold">{row.label}</div>
                    {row.sublabel ? (
                      <div className="text-[12px] text-muted-soft">{row.sublabel}</div>
                    ) : null}
                  </div>
                  <div className="text-right font-display text-[17px] tabular-nums">
                    {fmtVnd(row.revenue)}
                  </div>
                  <div className="text-right font-display text-[17px] text-clay tabular-nums">
                    {row.expense ? `−${fmtVnd(row.expense)}` : fmtVnd(0)}
                  </div>
                  <div
                    className="text-right font-display text-[17px] font-semibold tabular-nums"
                    style={{
                      color:
                        row.profit < 0 ? "var(--color-clay)" : "var(--color-sage-deep)",
                    }}
                  >
                    {fmtVnd(row.profit)}
                  </div>
                  <div className="text-right text-[13px] text-muted tabular-nums">
                    {fmtPct(row.profit, row.revenue)}
                  </div>
                </div>
              ))}

              <div className={`${COLUMNS} items-center px-1 pt-4`}>
                <div className="text-[13px] font-semibold tracking-wide text-muted uppercase">
                  Tổng
                </div>
                <div className="text-right font-display text-[19px] font-semibold tabular-nums">
                  {fmtVnd(totals.revenue)}
                </div>
                <div className="text-right font-display text-[19px] font-semibold text-clay tabular-nums">
                  {totals.expense ? `−${fmtVnd(totals.expense)}` : fmtVnd(0)}
                </div>
                <div
                  className="text-right font-display text-[19px] font-semibold tabular-nums"
                  style={{
                    color:
                      totals.profit < 0 ? "var(--color-clay)" : "var(--color-sage-deep)",
                  }}
                >
                  {fmtVnd(totals.profit)}
                </div>
                <div className="text-right text-[13px] font-semibold text-muted tabular-nums">
                  {fmtPct(totals.profit, totals.revenue)}
                </div>
              </div>
            </div>
          </div>
        )}
      </section>

      <section className="card p-6 md:p-7">
        <h2 className="font-display text-[24px] font-semibold">Chi phí theo danh mục</h2>
        <div className="mt-1.5 mb-5 text-[13px] text-muted">{fmtMonthLong(monthKey)}</div>

        {loading && !data ? (
          <LoadingRows rows={4} height={40} />
        ) : byCategory.length === 0 ? (
          <EmptyState title={`Chưa ghi chi phí nào trong ${fmtMonthLong(monthKey).toLowerCase()}`} />
        ) : (
          <div className="flex flex-col gap-3">
            {byCategory.map((c) => (
              <div key={c.name} className="flex items-center gap-4">
                <div className="w-[150px] shrink-0 text-[13.5px] font-semibold">{c.name}</div>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-inset">
                  <div
                    className="h-full rounded-full bg-clay"
                    style={{ width: `${(c.amount / (byCategory[0]?.amount || 1)) * 100}%` }}
                  />
                </div>
                <div className="w-[130px] shrink-0 text-right font-display text-[16px] tabular-nums">
                  {fmtVndFull(c.amount)}
                </div>
                <div className="w-[46px] shrink-0 text-right text-[12.5px] text-muted-soft tabular-nums">
                  {fmtPct(c.amount, totals.expense)}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  );
}

function SummaryCard({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <div className="card p-6 md:px-7">
      <div className="eyebrow text-[12px]">{label}</div>
      <div
        className="mt-3 font-display text-[30px] leading-none font-semibold md:text-[34px]"
        style={{ color }}
      >
        {value}
      </div>
    </div>
  );
}
