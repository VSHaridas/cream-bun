"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Browser client.
 *
 * Cookie storage is mandatory, not stylistic: when Auth is driven by
 * `createServerClient` with cookies, the session lives in cookies so that
 * Server Components and Route Handlers — which cannot read localStorage —
 * observe the same signed-in user. A localStorage client would leave every
 * server-side row-level-security policy evaluating as anonymous.
 *
 * @supabase/ssr
 */
let cached: SupabaseClient | null = null;

export function isSupabaseConfigured() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  return Boolean(url && key);
}

export function getSupabaseBrowser(): SupabaseClient | null {
  if (!isSupabaseConfigured()) return null;
  if (cached) return cached;
  cached = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!.trim(),
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!.trim(),
  );
  return cached;
}