"use client";

import { fmtVnd, fmtVndFull } from "@/lib/format";

function HeroStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[12px] text-[#b7ad9b]">{label}</div>
      <div className="mt-[3px] font-display text-[20px] font-semibold">{value}</div>
    </div>
  );
}

function KpiCard({
  icon,
  iconBg,
  eyebrow,
  value,
  valueColor,
  caption,
}: {
  icon: string;
  iconBg: string;
  eyebrow: string;
  value: string;
  valueColor?: string;
  caption: string;
}) {
  return (
    <div className="card p-6 md:px-7">
      <div className="flex items-center gap-2.5">
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[18px]"
          style={{ background: iconBg }}
        >
          {icon}
        </div>
        <div className="eyebrow text-[12px]">{eyebrow}</div>
      </div>
      <div
        className="mt-4 font-display text-[32px] leading-none font-semibold md:text-[38px]"
        style={{ color: valueColor }}
      >
        {value}
      </div>
      <div className="mt-2 text-[13px] text-muted">{caption}</div>
    </div>
  );
}

export function KpiRow({
  monthNum,
  unitCount,
  monthRevenue,
  todayRevenue,
  bookingsCount,
  occupancyPct,
  monthExpense,
  cumulativeProfit,
  live,
}: {
  monthNum: number;
  unitCount: number;
  monthRevenue: number;
  todayRevenue: number;
  bookingsCount: number;
  occupancyPct: number;
  monthExpense: number;
  cumulativeProfit: number;
  live: boolean;
}) {
  return (
    <div className="mb-[22px] grid gap-5 lg:grid-cols-[1.4fr_1fr_1fr]">
      {/* Card doanh thu — nền tối tạo điểm neo thị giác cho cả trang */}
      <div
        className="relative overflow-hidden rounded-3xl px-7 py-7 text-[#f5f1e8] shadow-[0_18px_40px_-18px_rgba(61,53,41,.55)] md:px-8"
        style={{ background: "linear-gradient(135deg,#3D3529 0%,#4A4133 100%)" }}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-[11.5px] font-semibold tracking-[1.2px] text-gold uppercase">
              Tổng doanh thu · Tháng {monthNum}
            </div>
            <div className="mt-3 font-display text-[40px] leading-[1.05] font-semibold whitespace-nowrap md:text-[46px]">
              {fmtVnd(monthRevenue)}
            </div>
          </div>
          <span
            className={`mt-2 h-2 w-2 shrink-0 rounded-full bg-gold ${live ? "animate-live" : "opacity-30"}`}
            title={live ? "Đang nhận cập nhật realtime" : "Chưa kết nối realtime"}
          />
        </div>

        <div className="mt-6 flex gap-6 border-t border-[#f5f1e829] pt-5">
          <HeroStat label="Hôm nay" value={fmtVnd(todayRevenue)} />
          <HeroStat label="Lượt tháng này" value={String(bookingsCount)} />
          <HeroStat label="Lấp đầy" value={`${occupancyPct}%`} />
        </div>
      </div>

      <KpiCard
        icon="↓"
        iconBg="var(--color-gold-wash)"
        eyebrow={`Chi phí tháng ${monthNum}`}
        value={fmtVndFull(monthExpense)}
        caption={`Tổng chi phí vận hành ${unitCount} căn`}
      />

      <KpiCard
        icon="↑"
        iconBg="var(--color-sage-wash)"
        eyebrow="Lợi nhuận tích lũy"
        value={fmtVndFull(cumulativeProfit)}
        valueColor={
          cumulativeProfit < 0 ? "var(--color-clay)" : "var(--color-sage-deep)"
        }
        caption="Cộng dồn toàn bộ danh mục"
      />
    </div>
  );
}
