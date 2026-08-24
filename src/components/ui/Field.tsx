"use client";

import { useState } from "react";
import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";

import { fmtNumber, parseNumber } from "@/lib/format";

export function Field({
  label,
  hint,
  children,
  className = "",
}: {
  label: string;
  hint?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={`flex flex-col gap-1.5 ${className}`}>
      <span className="text-[12px] font-semibold tracking-wide text-muted">{label}</span>
      {children}
      {hint ? <span className="text-[11.5px] text-muted-soft">{hint}</span> : null}
    </label>
  );
}

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  const { className = "", ...rest } = props;
  return <input className={`field ${className}`} {...rest} />;
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  const { className = "", children, ...rest } = props;
  return (
    <select className={`field cursor-pointer ${className}`} {...rest}>
      {children}
    </select>
  );
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const { className = "", ...rest } = props;
  return <textarea className={`field resize-y ${className}`} rows={2} {...rest} />;
}

/**
 * Ô nhập tiền VND. Hiển thị có dấu phân cách nghìn nhưng trả ra số nguyên,
 * nên "1.500.000" và "1500000" gõ kiểu nào cũng được.
 */
export function MoneyInput({
  value,
  onValueChange,
  ...rest
}: Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange"> & {
  value: number;
  onValueChange: (value: number) => void;
}) {
  // Bản nháp giữ đúng chuỗi người dùng đang gõ (kể cả ô rỗng). Khi giá trị bị đổi
  // từ bên ngoài — mở form sửa, bấm "dùng giá gợi ý" — bản nháp không còn khớp
  // nữa nên tự bị bỏ qua. Suy ra được như vậy thì không cần effect đồng bộ.
  const [draft, setDraft] = useState<string | null>(null);
  const display =
    draft !== null && parseNumber(draft) === value ? draft : value ? fmtNumber(value) : "";

  return (
    <div className="relative">
      <input
        {...rest}
        className="field pr-9 text-right tabular-nums"
        inputMode="numeric"
        value={display}
        onChange={(event) => {
          const next = parseNumber(event.target.value);
          setDraft(event.target.value === "" ? "" : fmtNumber(next));
          onValueChange(next);
        }}
      />
      <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-[12px] text-muted-soft">
        đ
      </span>
    </div>
  );
}
