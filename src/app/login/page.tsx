import { isSupabaseConfigured } from "@/lib/supabase/config";
import { SetupNotice } from "@/components/SetupNotice";

import { LoginForm } from "./LoginForm";

export default async function LoginPage(props: PageProps<"/login">) {
  if (!isSupabaseConfigured) return <SetupNotice />;

  const { next } = await props.searchParams;
  return <LoginForm next={typeof next === "string" ? next : "/"} />;
}
