import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { SUPABASE_ANON_KEY, SUPABASE_URL, isSupabaseConfigured } from "./config";

/** Route công khai duy nhất. Mọi đường dẫn khác đều cần đăng nhập. */
const LOGIN_PATH = "/login";

/**
 * Làm mới session Supabase trên mỗi request và chặn route chưa đăng nhập.
 *
 * Đây là chốt kiểm duy nhất của app: các page đều là client component nên
 * không tự kiểm tra auth.
 */
export async function updateSession(request: NextRequest) {
  if (!isSupabaseConfigured) {
    // Chưa cấu hình env — để request đi qua, trang sẽ hiện hướng dẫn cài đặt.
    return NextResponse.next({ request });
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  // getUser() xác thực token với Supabase, khác getSession() vốn chỉ đọc cookie.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname, search } = request.nextUrl;
  const isLoginPage = pathname === LOGIN_PATH;

  if (!user && !isLoginPage) {
    const url = request.nextUrl.clone();
    url.pathname = LOGIN_PATH;
    // Nhớ đích đến để đăng nhập xong quay lại đúng chỗ.
    url.search = pathname === "/" ? "" : `?next=${encodeURIComponent(pathname + search)}`;
    return NextResponse.redirect(url);
  }

  if (user && isLoginPage) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}
