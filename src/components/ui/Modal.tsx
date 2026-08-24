"use client";

import { useEffect, type ReactNode } from "react";

/**
 * Dialog luôn hiển thị khi được mount — không có prop `open`.
 *
 * Phía gọi render có điều kiện (`{editing && <Dialog …/>}`), nhờ vậy form bên
 * trong khởi tạo state mới mỗi lần mở mà không cần effect đồng bộ lại.
 */
export function Modal({
  title,
  subtitle,
  onClose,
  children,
  footer,
  width = 560,
}: {
  title: string;
  subtitle?: ReactNode;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  width?: number;
}) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    // Khoá cuộn nền để dialog không "trôi" khi người dùng lăn chuột.
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink/35 px-4 py-8 backdrop-blur-[2px]"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="card w-full p-7 shadow-[0_30px_70px_-30px_rgba(61,53,41,.6)]"
        style={{ maxWidth: width }}
      >
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h2 className="font-display text-[22px] font-semibold">{title}</h2>
            {subtitle ? <div className="mt-1 text-[13px] text-muted">{subtitle}</div> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng"
            className="-mt-1 -mr-1 h-8 w-8 shrink-0 rounded-full text-[18px] text-muted transition-colors hover:bg-surface-inset hover:text-ink"
          >
            ×
          </button>
        </div>

        {children}

        {footer ? <div className="mt-7 flex justify-end gap-2">{footer}</div> : null}
      </div>
    </div>
  );
}
