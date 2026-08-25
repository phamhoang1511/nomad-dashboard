import {createServerClient} from "@supabase/ssr";
import {cookies} from "next/headers";

import {isSupabaseConfigured, SUPABASE_ANON_KEY, SUPABASE_URL} from "./config";

export async function createSupabaseServerClient() {
  if (!isSupabaseConfigured) {
    throw new Error(
      "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.",
    );
  }

  const cookieStore = await cookies();

  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch (error) {
          console.warn(
            "Could not persist refreshed Supabase cookies.",
            error,
          );
        }
      },
    },
  });
}
