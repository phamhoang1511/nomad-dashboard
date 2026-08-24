"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "outline" | "ghost" | "danger";
type Size = "sm" | "md";

const VARIANT: Record<Variant, string> = {
  primary: "bg-ink text-surface hover:bg-ink-soft",
  outline: "border border-line bg-surface text-ink hover:border-gold hover:text-gold-ink",
  ghost: "text-muted hover:bg-surface-inset hover:text-ink",
  danger: "border border-clay/30 bg-clay-wash text-clay hover:bg-clay hover:text-surface",
};

const SIZE: Record<Size, string> = {
  sm: "h-8 gap-1.5 px-3 text-[12.5px]",
  md: "h-10 gap-2 px-4 text-[13.5px]",
};

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  children: ReactNode;
};

export function Button({
  variant = "outline",
  size = "md",
  className = "",
  children,
  ...rest
}: Props) {
  return (
    <button
      className={`inline-flex items-center justify-center rounded-full font-semibold whitespace-nowrap transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${VARIANT[variant]} ${SIZE[size]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}
