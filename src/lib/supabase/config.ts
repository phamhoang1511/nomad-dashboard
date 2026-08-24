export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

/**
 * Chưa cấu hình .env.local thì mọi thứ liên quan Supabase phải nhường đường thay
 * vì ném lỗi — proxy cho request đi qua, còn UI hiện hướng dẫn cài đặt.
 */
export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
