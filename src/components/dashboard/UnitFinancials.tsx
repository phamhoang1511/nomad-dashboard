"use client";

import { EmptyState } from "@/components/ui/Feedback";
import { fmtTime } from "@/lib/date";
import { fmtVnd } from "@/lib/format";
import type { TimelineRow } from "@/lib/timeline";
import type { CumulativeRow, PnlRow } from "@/lib/types";

const COLUMNS = "grid grid-cols-[1.2fr_.9fr_1fr_1fr_1.3fr] gap-3";

export function UnitFinancials({
  rows,
  monthNum,
  monthPnl,
  cumulative,
  onSelectApartment,
}: {
  rows: TimelineRow[];
  monthNum: number;
  monthPnl: PnlRow[];
  cumulative: CumulativeRow[];
  onSelectApartment: (apartmentId: string) => void;
}) {
  const maxProfit = Math.max(1, ...cumulative.map((c) => Math.abs(c.profit)));

  return (
    <section className="card p-6 md:p-7">
      <h2 className="font-display text-[24px] font-semibold">Hiệu quả từng căn</h2>
      <div className="mt-1.5 mb-5 text-[13px] text-muted">
        Chi phí tháng {monthNum} · Lợi nhuận tích lũy toàn thời gian
      </div>

      {rows.length === 0 ? (
        <EmptyState title="Chưa có căn hộ nào" />
      ) : (
        <div className="scroll-slim overflow-x-auto">
          <div className="min-w-[760px]">
            <div
              className={`${COLUMNS} border-b border-line px-1 pb-3 text-[11.5px] font-semibold tracking-[1px] text-muted-soft uppercase`}
            >
              <div>Căn hộ</div>
              <div>Trạng thái</div>
              <div className="text-right">Doanh thu tháng</div>
              <div className="text-right">Chi phí tháng</div>
              <div className="text-right">Lợi nhuận tích lũy</div>
            </div>

            {rows.map((row) => {
              const pnl = monthPnl.find((p) => p.apartment_id === row.apartment.id);
              const profit =
                cumulative.find((c) => c.apartment_id === row.apartment.id)?.profit ?? 0;
              const checkout = row.current ?? row.next;

              return (
                <button
                  key={row.apartment.id}
                  type="button"
                  onClick={() => onSelectApartment(row.apartment.id)}
                  className={`${COLUMNS} w-full items-center border-b border-line-soft px-1 py-4 text-left transition-colors last:border-0 hover:bg-surface-inset/50`}
                >
                  <div className="flex items-center gap-2.5">
                    <span
                      className="h-[9px] w-[9px] shrink-0 rounded-full"
                      style={{ background: row.occupied ? "var(--color-gold)" : "#cbbfa9" }}
                    />
                    <span className="truncate text-[15px] font-semibold">
                      {row.apartment.code}
                    </span>
                  </div>

                  <div className="flex flex-col items-start gap-1.5">
                    <span
                      className="rounded-full px-3 py-[5px] text-[12px] leading-none font-semibold"
                      style={
                        row.occupied
                          ? { background: "var(--color-gold-soft)", color: "var(--color-gold-ink)" }
                          : { background: "#ede9df", color: "var(--color-muted)" }
                      }
                    >
                      {row.occupied ? "Đang thuê" : "Trống"}
                    </span>
                    <span
                      className="inline-flex items-center gap-1.5 rounded-full bg-gold-track px-2.5 py-1 text-[11.5px] font-semibold text-gold-ink"
                      // Booking kế tiếp (chưa tới giờ) làm mờ để phân biệt với lượt đang ở.
                      style={row.current ? undefined : { opacity: 0.7 }}
                    >
                      ⏱ Check-out {checkout ? fmtTime(new Date(checkout.end_at)) : "—"}
                    </span>
                  </div>

                  <div className="text-right font-display text-[18px] font-medium tabular-nums">
                    {fmtVnd(pnl?.revenue ?? 0)}
                  </div>

                  <div className="text-right font-display text-[18px] font-medium text-clay tabular-nums">
                    {pnl?.expense ? `−${fmtVnd(pnl.expense)}` : fmtVnd(0)}
                  </div>

                  <div className="flex items-center justify-end gap-2.5">
                    <div className="h-1.5 w-full max-w-[90px] overflow-hidden rounded-full bg-gold-track">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${Math.min(100, (Math.abs(profit) / maxProfit) * 100)}%`,
                          background:
                            profit < 0 ? "var(--color-clay)" : "var(--color-sage-deep)",
                        }}
                      />
                    </div>
                    <span
                      className="min-w-[96px] text-right font-display text-[18px] font-semibold tabular-nums"
                      style={{
                        color: profit < 0 ? "var(--color-clay)" : "var(--color-sage-deep)",
                      }}
                    >
                      {fmtVnd(profit)}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}
