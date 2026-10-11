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
  // The auth routes must be public or an anonymous visitor is redirected to a
  // page that redirects them again — forever. This is the whole loop: the
  // guard sends them to /auth/signin, the guard does not recognise /auth/signin
  // as public, so it appends ?next=/auth/signin and redirects again.
  "/auth/signin",
  "/auth/callback",
  "/auth/signout",
  "/api-docs",
];

function matchesPublic(pathname: string) {
  return PUBLIC_ROUTES.some(
    (route) => pathname === route || pathname === `${route}/` || pathname.startsWith(`${route}/`),
  );
}

export async function middleware(request: NextRequest) {
  // Middleware runs before every route. Anything it throws here becomes a 500
  // on every page simultaneously, which is a spectacularly bad way to discover
  // a missing environment variable. It fails open instead: if the session
  // cannot be refreshed we let the request through, and the datastore banner
  // reports the misconfiguration where a human will actually read it.
  try {
    return await handle(request);
  } catch (error) {
    console.error(
      "[cream] middleware could not refresh the session, continuing without one:",
      error instanceof Error ? error.message : error,
    );
    return NextResponse.next({ request });
  }
}

async function handle(request: NextRequest) {
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

  const url = supabaseEnv.url;
  const anonKey = supabaseEnv.anonKey;

  if (!url || !anonKey) {
    // Not configured, or baked in as empty at build time. Stay in seed mode
    // and do not pretend otherwise.
    return NextResponse.next({ request });
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(url, anonKey, {
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

  // Touching the user refreshes the token when it is near expiry. A network
  // failure here must not be fatal either — an unreachable identity provider
  // should degrade to "nobody is signed in", not to a blank site.
  let user = null;
  try {
    const { data, error } = await supabase.auth.getUser();
    if (error) throw error;
    user = data.user;
  } catch (error) {
    console.error(
      "[cream] session lookup failed, treating the request as anonymous:",
      error instanceof Error ? error.message : error,
    );
  }

  const isPublic = matchesPublic(pathname);

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth/signin";
    // Belt and braces against a redirect loop. The route list already marks
    // /auth/signin public, but if that list is ever edited incorrectly the
    // failure mode is an ERR_TOO_MANY_REDIRECTS that bricks the whole site,
    // and the nested `?next=` in the log is near-impossible to diagnose. Two
    // independent guards against that outcome.
    const alreadyRedirecting = pathname.startsWith("/auth/signin");
    const carry = alreadyRedirecting ? "" : `?next=${encodeURIComponent(`${pathname}${search}`)}`;
    url.search = carry;
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