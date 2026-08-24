"use client";

import type { CSSProperties, ReactNode } from "react";

export function Badge({
  children,
  bg = "var(--color-surface-inset)",
  fg = "var(--color-muted)",
  style,
}: {
  children: ReactNode;
  bg?: string;
  fg?: string;
  style?: CSSProperties;
}) {
  return (
    <span
      className="inline-block rounded-full px-3 py-[5px] text-[12px] leading-none font-semibold whitespace-nowrap"
      style={{ background: bg, color: fg, ...style }}
    >
      {children}
    </span>
  );
}

export function ErrorNote({ children }: { children: ReactNode }) {
  if (!children) return null;
  return (
    <div className="rounded-xl border border-clay/25 bg-clay-wash px-4 py-3 text-[13px] text-clay">
      {children}
    </div>
  );
}

export function EmptyState({
  title,
  hint,
  action,
}: {
  title: string;
  hint?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-line px-6 py-14 text-center">
      <div className="font-display text-[19px] font-semibold text-muted">{title}</div>
      {hint ? <div className="max-w-sm text-[13px] text-muted-soft">{hint}</div> : null}
      {action}
    </div>
  );
}

/** Khung xám nhấp nháy giữ đúng chỗ trong lúc chờ dữ liệu. */
export function Skeleton({
  className = "",
  style,
}: {
  className?: string;
  style?: CSSProperties;
}) {
  return <div className={`animate-pulse rounded-xl bg-surface-inset ${className}`} style={style} />;
}

export function LoadingRows({ rows = 5, height = 52 }: { rows?: number; height?: number }) {
  return (
    <div className="flex flex-col gap-2">
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} style={{ height }} className="w-full" />
      ))}
    </div>
  );
}
