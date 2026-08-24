"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";

import { getSupabaseClient } from "@/lib/supabase/client";

const NAV = [
  { href: "/", label: "Tổng quan" },
  { href: "/bookings", label: "Booking" },
  { href: "/expenses", label: "Chi phí" },
  { href: "/pnl", label: "Lợi nhuận" },
  { href: "/apartments", label: "Căn hộ" },
] as const;

export function AppShell({ email, children }: { email: string; children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);

  async function signOut() {
    setSigningOut(true);
    await getSupabaseClient().auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-30 border-b border-line bg-surface/85 backdrop-blur-md">
        <div className="mx-auto flex h-14 w-full max-w-[1440px] items-center gap-4 px-5 md:px-10">
          <Link href="/" className="flex shrink-0 items-center gap-2.5">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-ink font-display text-[15px] leading-none font-semibold text-gold">
              H
            </span>
            <span className="hidden font-display text-[16px] font-semibold sm:block">Homestay</span>
          </Link>

          <nav className="scroll-slim -mx-1 flex flex-1 items-center gap-1 overflow-x-auto px-1">
            {NAV.map((item) => {
              const active =
                item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`rounded-full px-3.5 py-1.5 text-[13px] font-semibold whitespace-nowrap transition-colors ${
                    active
                      ? "bg-gold-soft text-gold-ink"
                      : "text-muted hover:bg-surface-inset hover:text-ink"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="flex shrink-0 items-center gap-3">
            <span className="hidden max-w-[180px] truncate text-[12.5px] text-muted lg:block">
              {email}
            </span>
            <button
              type="button"
              onClick={signOut}
              disabled={signingOut}
              className="rounded-full border border-line px-3 py-1.5 text-[12.5px] font-semibold text-muted transition-colors hover:border-clay/40 hover:text-clay disabled:opacity-50"
            >
              {signingOut ? "…" : "Thoát"}
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1440px] px-5 py-7 md:px-10 md:py-9">{children}</main>
    </div>
  );
}
