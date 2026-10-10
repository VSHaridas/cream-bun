import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { COOKIE_DOMAIN, supabase as supabaseEnv } from "@/lib/env";

/**
 * Session refresh middleware.
 *
 * Supabase access tokens are short-lived. This runs on every matched route,
 * refreshes them when they are close to expiry, and writes the rotated
 * cookies back onto the outgoing response. Skipping it means the user is
 * silently signed out at the token boundary, which in practice looks like
 * "the app randomly logs me out".
 *
 * Middleware runs on the Edge runtime, so this file must stay free of Node
 * built-ins and of any import from the server client.
 */

const PUBLIC_ROUTES = [
  "/",
  "/discover",
  "/briefs",
  "/engagements",
  "/trust",
  "/model",
  "/deck",
  "/onboarding",
  "/creators",
];

function matchesPublic(pathname: string) {
  return PUBLIC_ROUTES.some(
    (route) => pathname === route || pathname === `${route}/` || pathname.startsWith(`${route}/`),
  );
}

export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  // Static assets never need a session.
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname.includes(".") ||
    pathname === "/favicon.ico"
  ) {
    return NextResponse.next({ request });
  }

  if (!supabaseEnv.url || !supabaseEnv.anonKey) {
    // Not configured: stay in seed mode and do not pretend otherwise.
    return NextResponse.next({ request });
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!.trim(), process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!.trim(), {
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
          response.cookies.set(name, value, {
            path: "/",
            sameSite: "lax",
            secure: process.env.NODE_ENV === "production",
            ...(COOKIE_DOMAIN ? { domain: COOKIE_DOMAIN } : {}),
            ...options,
          });
        }
      },
    },
  });

  // Touching the user refreshes the token when it is near expiry.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isPublic = matchesPublic(pathname);

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth/signin";
    url.search = `?next=${encodeURIComponent(`${pathname}${search}`)}`;
    return NextResponse.redirect(url);
  }

  if (user && pathname === "/auth/signin") {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Everything except static assets and image optimisation output. Auth
     * callback and signout are deliberately NOT excluded — the callback route
     * needs the refreshed cookies to persist.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};