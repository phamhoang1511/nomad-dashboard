"use client";

import { shiftDayKey, shiftMonthKey, vnDayKey, vnMonthKey } from "@/lib/date";

function Stepper({
  onPrev,
  onNext,
  onToday,
  todayLabel,
  isToday,
  children,
}: {
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  todayLabel: string;
  isToday: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        onClick={onPrev}
        aria-label="Lùi"
        className="h-9 w-9 rounded-full border border-line text-muted transition-colors hover:border-gold hover:text-gold-ink"
      >
        ‹
      </button>
      {children}
      <button
        type="button"
        onClick={onNext}
        aria-label="Tiến"
        className="h-9 w-9 rounded-full border border-line text-muted transition-colors hover:border-gold hover:text-gold-ink"
      >
        ›
      </button>
      <button
        type="button"
        onClick={onToday}
        disabled={isToday}
        className="ml-1 rounded-full px-3 py-1.5 text-[12.5px] font-semibold text-muted transition-colors hover:bg-surface-inset hover:text-ink disabled:opacity-40 disabled:hover:bg-transparent"
      >
        {todayLabel}
      </button>
    </div>
  );
}

export function DayPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (dayKey: string) => void;
}) {
  const today = vnDayKey(new Date());
  return (
    <Stepper
      onPrev={() => onChange(shiftDayKey(value, -1))}
      onNext={() => onChange(shiftDayKey(value, 1))}
      onToday={() => onChange(today)}
      todayLabel="Hôm nay"
      isToday={value === today}
    >
      <input
        type="date"
        value={value}
        onChange={(e) => e.target.value && onChange(e.target.value)}
        className="field h-9 w-[152px] cursor-pointer py-0 text-[13px]"
      />
    </Stepper>
  );
}

export function MonthPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (monthKey: string) => void;
}) {
  const thisMonth = vnMonthKey(new Date());
  return (
    <Stepper
      onPrev={() => onChange(shiftMonthKey(value, -1))}
      onNext={() => onChange(shiftMonthKey(value, 1))}
      onToday={() => onChange(thisMonth)}
      todayLabel="Tháng này"
      isToday={value === thisMonth}
    >
      <input
        type="month"
        value={value}
        onChange={(e) => e.target.value && onChange(e.target.value)}
        className="field h-9 w-[140px] cursor-pointer py-0 text-[13px]"
      />
    </Stepper>
  );
}
