import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase/server";
import { APP_URL } from "@/lib/env";

/**
 * OAuth / magic-link callback.
 *
 * The provider redirects here with a `code` (PKCE flow). We exchange it for
 * a session server-side and let `createServerClient` write the cookies onto
 * the response, then send the user onward.
 *
 * The `next` path is validated against an allowlist of prefixes before it is
 * used: an unvalidated redirect target is an open-redirect, and this endpoint
 * is reachable by anyone who can trigger an OAuth callback.
 */

const ALLOWED_PREFIXES = ["/", "/briefs", "/engagements", "/onboarding", "/discover", "/deck"];

function safeNext(value: string | null) {
  if (!value) return "/";
  if (!value.startsWith("/")) return "/";
  if (value.startsWith("//")) return "/";
  return ALLOWED_PREFIXES.some((p) => value === p || value.startsWith(`${p}/`)) ? value : "/";
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const nextParam = url.searchParams.get("next");
  const errorDescription = url.searchParams.get("error_description");

  if (errorDescription) {
    const target = new URL("/auth/signin", APP_URL);
    target.searchParams.set("error", errorDescription);
    return NextResponse.redirect(target);
  }

  if (!code) {
    return NextResponse.redirect(new URL("/auth/signin?error=missing_code", APP_URL));
  }

  const supabase = await getSupabaseServer();
  if (!supabase) {
    return NextResponse.redirect(new URL("/auth/signin?error=not_configured", APP_URL));
  }

  const origin = new URL(request.url).origin;
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    const target = new URL("/auth/signin", origin);
    target.searchParams.set("error", error.message);
    return NextResponse.redirect(target);
  }

  return NextResponse.redirect(new URL(safeNext(nextParam), origin));
}