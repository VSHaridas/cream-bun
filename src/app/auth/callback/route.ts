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

const ALLOWED_PREFIXES = [
  "/",
  "/briefs",
  "/engagements",
  "/onboarding",
  "/discover",
  "/deck",
  "/trust",
];

function safeNext(value: string | null) {
  if (!value) return null;
  if (!value.startsWith("/")) return null;
  if (value.startsWith("//")) return null;
  return ALLOWED_PREFIXES.some((p) => value === p || value.startsWith(`${p}/`)) ? value : null;
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

  const destination = safeNext(nextParam) ?? (await onboardingPath());
  return NextResponse.redirect(new URL(destination, origin));
}

/**
 * Decides where a user lands when they did not ask for a specific page.
 *
 * `handle_new_user()` writes a profile and a stub creator/brand row on first
 * sign-in, so a new account looks complete to anything that only checks for
 * existence. Reading the shape rather than the presence is what makes
 * onboarding reachable at all.
 */
async function onboardingPath() {
  try {
    const { postSignInPath } = await import("@/lib/identity/onboarding-state");
    return await postSignInPath("/");
  } catch (error) {
    // Onboarding routing is a convenience, not an authorisation boundary. If
    // the state query fails the user should still get a working session rather
    // than an error page.
    console.error(
      "[cream] could not resolve post-sign-in destination:",
      error instanceof Error ? error.message : error,
    );
    return "/";
  }
}