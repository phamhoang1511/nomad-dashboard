import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { AppShell } from "@/components/AppShell";
import { SetupNotice } from "@/components/SetupNotice";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function AppLayout({ children }: { children: ReactNode }) {
  if (!isSupabaseConfigured) return <SetupNotice />;

  // proxy.ts đã chặn khách chưa đăng nhập; kiểm lại ở đây để lấy email hiển thị
  // và để phòng trường hợp matcher của proxy bị sửa hụt.
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  return <AppShell email={user.email ?? ""}>{children}</AppShell>;
}
