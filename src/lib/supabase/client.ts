"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

import { SUPABASE_ANON_KEY, SUPABASE_URL } from "./config";

let cached: SupabaseClient | undefined;

/**
 * Một instance duy nhất cho cả tab. Tạo client mới mỗi lần render sẽ dựng lại
 * kênh realtime liên tục.
 */
export function getSupabaseClient(): SupabaseClient {
  if (!cached) {
    cached = createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
  return cached;
}
