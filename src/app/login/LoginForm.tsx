"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { ErrorNote } from "@/components/ui/Feedback";
import { Field, TextInput } from "@/components/ui/Field";
import { describeError } from "@/lib/queries";
import { getSupabaseClient } from "@/lib/supabase/client";

export function LoginForm({ next }: { next: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { error: authError } = await getSupabaseClient().auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (authError) throw new Error(authError.message);
      // replace + refresh để proxy đọc lại cookie session vừa đặt.
      router.replace(next.startsWith("/") ? next : "/");
      router.refresh();
    } catch (err) {
      setError(describeError(err));
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center px-5 py-12">
      <div className="w-full max-w-[400px]">
        <div className="mb-9 text-center">
          <div className="eyebrow mb-2 tracking-[2px]">Bảng điều hành</div>
          <h1 className="font-display text-[34px] leading-none font-semibold">
            Homestay Performance
          </h1>
        </div>

        <form onSubmit={onSubmit} className="card flex flex-col gap-4 p-8">
          <Field label="Email">
            <TextInput
              type="email"
              autoComplete="username"
              required
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="ban@homestay.vn"
            />
          </Field>

          <Field label="Mật khẩu">
            <TextInput
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </Field>

          <ErrorNote>{error}</ErrorNote>

          <Button type="submit" variant="primary" disabled={busy} className="mt-1 h-11 w-full">
            {busy ? "Đang đăng nhập…" : "Đăng nhập"}
          </Button>
        </form>

        <p className="mt-5 text-center text-[12px] leading-relaxed text-muted-soft">
          Công cụ nội bộ — không có đăng ký công khai.
          <br />
          Tạo tài khoản trong Supabase Studio → Authentication → Users.
        </p>
      </div>
    </div>
  );
}
