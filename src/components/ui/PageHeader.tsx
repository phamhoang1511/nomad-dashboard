import type { ReactNode } from "react";

export function PageHeader({
  eyebrow,
  title,
  action,
}: {
  eyebrow: string;
  title: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
      <div>
        <div className="eyebrow mb-1.5 tracking-[2px]">{eyebrow}</div>
        <h1 className="font-display text-[32px] leading-none font-semibold md:text-[38px]">
          {title}
        </h1>
      </div>
      {action}
    </div>
  );
}
