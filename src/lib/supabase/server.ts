import { createClient } from "@supabase/supabase-js";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";
import { COOKIE_DOMAIN, supabase } from "@/lib/env";

/**
 * Server client.
 *
 * Two constructors, and the difference is deliberate:
 *
 *  • `getSupabaseServer()`  — runs as the signed-in user. Subject to RLS. Use
 *    this for anything a user should only be able to read about themselves or
 *    about records they are party to.
 *
 *  • `getSupabaseAdmin()`   — runs as the service role and bypasses RLS. Use
 *    this for system work only: seeding, backfills, webhook verification,
 *    cron. Never wire it to a request that carries user-controlled input
 *    without an explicit authorisation check in front of it.
 *
 * Both read and write cookies so the session survives server-side mutation.
 */

export function isSupabaseServerConfigured() {
  return Boolean(supabase.url && supabase.anonKey);
}

/**
 * A project URL carrying a path — `/rest/v1` being the common one — produces
 * `/rest/v1/rest/v1/...` and a 404 that names neither the cause nor the fix.
 * We refuse it rather than constructing a client that cannot work.
 */
export function supabaseUrlProblem(): string | null {
  if (!supabase.url || !supabase.anonKey) return null;
  try {
    const parsed = new URL(supabase.url);
    if (parsed.pathname && parsed.pathname !== "/") {
      return `NEXT_PUBLIC_SUPABASE_URL must be the bare project origin (https://<ref>.supabase.co) with no path. It currently has "${parsed.pathname}", which the client appends itself — every query would 404.`;
    }
  } catch {
    return "NEXT_PUBLIC_SUPABASE_URL is not a valid URL.";
  }
  return null;
}

export function cookieOptions(): CookieOptions {
  return {
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    ...(COOKIE_DOMAIN ? { domain: COOKIE_DOMAIN } : {}),
  };
}

/**
 * A session-less client for reads that must work outside a request.
 *
 * `generateStaticParams()` and static prerendering both run at build time with
 * no request, so `cookies()` throws. The honest answer is not "catch the error
 * and carry on" — it is that at build time there is genuinely no user, so the
 * correct client is the anonymous one, and the catalogue tables are readable
 * under their public RLS policies.
 *
 * Anything genuinely user-scoped must not be read through this path. Those
 * routes are marked `force-dynamic` so they only ever render inside a request.
 */
export function getSupabaseAnon(): SupabaseClient | null {
  if (!isSupabaseServerConfigured()) return null;
  return createClient(supabase.url, supabase.anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { "x-cream-scope": "anonymous" } },
  });
}

export async function getSupabaseServer(): Promise<SupabaseClient | null> {
  if (!isSupabaseServerConfigured()) return null;

  let store: Awaited<ReturnType<typeof cookies>>;
  try {
    store = await cookies();
  } catch {
    // Build time: generateStaticParams, or a route being statically rendered.
    return getSupabaseAnon();
  }

  return createServerClient(supabase.url, supabase.anonKey, {
    cookies: {
      getAll() {
        return store.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            store.set(name, value, options);
          }
        } catch {
          // Called from a Server Component, which cannot mutate cookies.
          // The middleware refreshes the session instead, which is why the
          // token lifetimes here are deliberately generous.
        }
      },
    },
  });
}

export function getSupabaseAdmin(): SupabaseClient | null {
  if (!supabase.url || !supabase.serviceRoleKey) return null;
  return createClient(supabase.url, supabase.serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}