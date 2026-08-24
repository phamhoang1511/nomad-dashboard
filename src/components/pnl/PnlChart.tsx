"use client";

import { useState } from "react";

import { fmtMonthLong, fmtMonthShort } from "@/lib/date";
import { fmtVnd, fmtVndFull } from "@/lib/format";

export type PnlPoint = {
  monthKey: string;
  revenue: number;
  expense: number;
  profit: number;
};

/**
 * Ba màu này là biến thể đậm hơn của bảng màu design, không phải màu design nguyên
 * bản: gold/sage/clay gốc quá nhạt nên trượt cả ba phép kiểm tra sắc độ, tương phản
 * và mù màu. Bộ dưới đây qua đủ 4 kiểm tra trên nền #FDFBF7 (kể cả protan/deutan/tritan).
 * Sửa màu thì phải chạy lại validator.
 */
const SERIES = [
  { key: "revenue", label: "Doanh thu", color: "#A87C12" },
  { key: "expense", label: "Chi phí", color: "#A34A28" },
  { key: "profit", label: "Lợi nhuận", color: "#1C7A57" },
] as const;

const VIEW_W = 900;
const VIEW_H = 260;
const PAD = { top: 18, right: 14, bottom: 30, left: 66 };
const PLOT_W = VIEW_W - PAD.left - PAD.right;
const PLOT_H = VIEW_H - PAD.top - PAD.bottom;
const BAR_GAP = 2; // khe nền ngăn hai cột cạnh nhau
const MAX_BAR_W = 24;
const CORNER = 4;

/** Bước chia trục tròn trịa: 1 / 2 / 5 × luỹ thừa 10. */
function niceStep(rough: number): number {
  if (rough <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const normalized = rough / magnitude;
  const step = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  return step * magnitude;
}

function buildTicks(min: number, max: number): { values: number[]; lo: number; hi: number } {
  const step = niceStep((max - min) / 4 || 1);
  const lo = Math.floor(min / step) * step;
  const hi = Math.ceil(max / step) * step;
  const values: number[] = [];
  for (let v = lo; v <= hi + step / 2; v += step) values.push(Math.round(v));
  return { values, lo, hi };
}

/** Cột bo 4px ở đầu dữ liệu, vuông ở chân baseline. */
function barPath(x: number, w: number, yTop: number, yBase: number): string {
  const h = Math.abs(yBase - yTop);
  if (h < 0.5) return "";
  const r = Math.min(CORNER, h, w / 2);
  const up = yTop < yBase;
  return up
    ? `M${x},${yBase} L${x},${yTop + r} Q${x},${yTop} ${x + r},${yTop} L${x + w - r},${yTop} Q${x + w},${yTop} ${x + w},${yTop + r} L${x + w},${yBase} Z`
    : `M${x},${yBase} L${x},${yTop - r} Q${x},${yTop} ${x + r},${yTop} L${x + w - r},${yTop} Q${x + w},${yTop} ${x + w},${yTop - r} L${x + w},${yBase} Z`;
}

export function PnlChart({ data }: { data: PnlPoint[] }) {
  const [hovered, setHovered] = useState<number | null>(null);

  const values = data.flatMap((d) => [d.revenue, d.expense, d.profit]);
  const { values: ticks, lo, hi } = buildTicks(Math.min(0, ...values), Math.max(0, ...values));

  const y = (value: number) => PAD.top + PLOT_H - ((value - lo) / (hi - lo || 1)) * PLOT_H;
  const bandW = PLOT_W / Math.max(1, data.length);
  const barW = Math.min(MAX_BAR_W, (bandW * 0.74 - BAR_GAP * 2) / SERIES.length);
  const groupW = barW * SERIES.length + BAR_GAP * 2;
  const zeroY = y(0);

  const point = hovered !== null ? data[hovered] : null;

  return (
    <div className="relative">
      <div className="mb-4 flex flex-wrap items-center gap-x-5 gap-y-2">
        {SERIES.map((s) => (
          <div key={s.key} className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: s.color }} />
            <span className="text-[12.5px] text-muted">{s.label}</span>
          </div>
        ))}
      </div>

      <div className="scroll-slim relative overflow-x-auto">
        <div className="relative min-w-[680px]">
          <svg
            viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
            width="100%"
            role="img"
            aria-label="Doanh thu, chi phí và lợi nhuận 12 tháng gần nhất"
            onMouseLeave={() => setHovered(null)}
          >
            {ticks.map((tick) => (
              <g key={tick}>
                <line
                  x1={PAD.left}
                  x2={VIEW_W - PAD.right}
                  y1={y(tick)}
                  y2={y(tick)}
                  stroke={tick === 0 ? "var(--color-line)" : "var(--color-line-soft)"}
                  strokeWidth={1}
                />
                <text
                  x={PAD.left - 10}
                  y={y(tick) + 4}
                  textAnchor="end"
                  className="fill-[var(--color-muted-soft)] text-[11px] tabular-nums"
                >
                  {tick === 0 ? "0" : fmtVnd(tick)}
                </text>
              </g>
            ))}

            {data.map((d, index) => {
              const bandX = PAD.left + index * bandW;
              const groupX = bandX + (bandW - groupW) / 2;
              const active = hovered === index;

              return (
                <g key={d.monthKey}>
                  {/* Vùng bắt hover rộng cả cột tháng, không chỉ riêng thanh */}
                  <rect
                    x={bandX}
                    y={PAD.top}
                    width={bandW}
                    height={PLOT_H}
                    fill={active ? "var(--color-surface-inset)" : "transparent"}
                    opacity={active ? 0.7 : 1}
                    onMouseEnter={() => setHovered(index)}
                  />

                  {SERIES.map((s, seriesIndex) => {
                    const value = d[s.key];
                    const x = groupX + seriesIndex * (barW + BAR_GAP);
                    return (
                      <path
                        key={s.key}
                        d={barPath(x, barW, y(value), zeroY)}
                        fill={s.color}
                        pointerEvents="none"
                      />
                    );
                  })}

                  <text
                    x={bandX + bandW / 2}
                    y={VIEW_H - 10}
                    textAnchor="middle"
                    className={`text-[11px] ${active ? "fill-[var(--color-ink)]" : "fill-[var(--color-muted-soft)]"}`}
                  >
                    {fmtMonthShort(d.monthKey)}
                  </text>
                </g>
              );
            })}
          </svg>

          {/* Tooltip dựng bằng HTML để chữ không bị SVG co giãn theo */}
          {point ? (
            <div
              className="pointer-events-none absolute top-2 z-10 w-[188px] rounded-xl border border-line bg-surface p-3 shadow-[0_14px_34px_-18px_rgba(61,53,41,.6)]"
              style={{
                left: `${((PAD.left + (hovered! + 0.5) * bandW) / VIEW_W) * 100}%`,
                transform:
                  hovered! > data.length / 2 ? "translateX(-108%)" : "translateX(8%)",
              }}
            >
              <div className="mb-2 text-[12.5px] font-semibold">
                {fmtMonthLong(point.monthKey)}
              </div>
              {SERIES.map((s) => (
                <div key={s.key} className="flex items-center justify-between gap-3 py-0.5">
                  <span className="flex items-center gap-1.5 text-[12px] text-muted">
                    <span className="h-2 w-2 rounded-sm" style={{ background: s.color }} />
                    {s.label}
                  </span>
                  <span className="text-[12px] font-semibold tabular-nums">
                    {fmtVndFull(point[s.key])}
                  </span>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
