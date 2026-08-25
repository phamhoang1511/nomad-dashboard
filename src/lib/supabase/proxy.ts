import {createServerClient} from "@supabase/ssr";
import {NextRequest, NextResponse} from "next/server";
import {isSupabaseConfigured, SUPABASE_ANON_KEY, SUPABASE_URL} from "./config";

function redirectWithCookies(url: URL, source: NextResponse) {
  const redirect = NextResponse.redirect(url);

  source.cookies.getAll().forEach((cookie) => {
    redirect.cookies.set(cookie);
  });

  return redirect;
}

export async function updateSession(request: NextRequest) {
  if (!isSupabaseConfigured) {
    return NextResponse.next({ request });
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookies) {
        cookies.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });
        response = NextResponse.next({ request });

        cookies.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });


  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname, search } = request.nextUrl;
  const isLoginPage = pathname === "/login";
  if (!user && !isLoginPage) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    if (pathname === "/") {
      url.search = "";
    } else {
      url.search = `?next=${encodeURIComponent(pathname + search)}`;
    }
    return redirectWithCookies(url, response);
  }

  if (user && isLoginPage) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return redirectWithCookies(url, response);
  }

  return response;
}
