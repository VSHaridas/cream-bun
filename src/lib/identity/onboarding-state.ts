import "server-only";
import { getSupabaseServer } from "@/lib/supabase/server";

/**
 * Whether a signed-in account still needs onboarding.
 *
 * `handle_new_user()` creates a usable-looking profile on first sign-in: a
 * `profiles` row, and a stub `creators` or `brands` row, so that nothing that
 * assumes a profile exists breaks on the very first render. The stub is
 * deliberately empty — no headline, no bio, no verification.
 *
 * That is what made onboarding appear to be missing. Sign-in succeeded, the
 * callback sent the user to `/`, and nothing anywhere asked whether the account
 * had been through setup. `/onboarding/identity` existed and was correct, but
 * only the footer and the trust page linked to it.
 *
 * So we read the same shape the trigger writes and compare it against what a
 * configured account looks like. A brand that has filed a brief, or a creator
 * with portfolio work or a verification, is past this point.
 */
export interface OnboardingState {
  signedIn: boolean;
  needsOnboarding: boolean;
  /** What the account is missing, for the welcome screen to name. */
  missing: string[];
  role: "brand" | "creator" | "admin" | null;
  displayName: string | null;
  handle: string | null;
}

export async function getOnboardingState(): Promise<OnboardingState> {
  const anon: OnboardingState = {
    signedIn: false,
    needsOnboarding: false,
    missing: [],
    role: null,
    displayName: null,
    handle: null,
  };

  const supabase = await getSupabaseServer();
  if (!supabase) return anon;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return anon;

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, display_name, handle")
    .eq("id", user.id)
    .maybeSingle();

  const role = (profile?.role as OnboardingState["role"]) ?? null;
  const missing: string[] = [];

  // A bare profile is one the trigger wrote and nobody has touched since.
  if (!profile) missing.push("profile");

  if (role === "creator") {
    const { data: creator } = await supabase
      .from("creators")
      .select("id, headline, bio, philosophy, day_rate_inr")
      .eq("profile_id", user.id)
      .maybeSingle();

    if (!creator) {
      missing.push("creator profile");
    } else {
      if (!creator.headline) missing.push("headline");
      if (!creator.bio) missing.push("bio");
      if (!creator.philosophy) missing.push("creative philosophy");
      if (creator.day_rate_inr == null) missing.push("day rate");
    }

    const { count: pieces } = await supabase
      .from("portfolio_pieces")
      .select("id", { count: "exact", head: true })
      .eq("creator_id", creator?.id ?? "");

    if (!pieces) missing.push("at least one portfolio piece");

    const { data: verification } = await supabase
      .from("identity_verifications")
      .select("status")
      .eq("creator_id", creator?.id ?? "")
      .maybeSingle();

    if (verification?.status !== "verified") missing.push("identity verification");
  } else if (role === "brand") {
    const { data: brand } = await supabase
      .from("brands")
      .select("id, legal_name")
      .eq("profile_id", user.id)
      .maybeSingle();

    if (!brand) {
      missing.push("brand profile");
    } else if (!brand.legal_name) {
      missing.push("legal entity name");
    }
  }

  return {
    signedIn: true,
    needsOnboarding: missing.length > 0,
    missing,
    role,
    displayName: profile?.display_name ?? null,
    handle: profile?.handle ?? null,
  };
}

/**
 * Where to send someone straight after the OAuth callback.
 *
 * An explicit `next` always wins — if the user asked for a specific page, that
 * is where they meant to go. Otherwise the account state decides: an account
 * still missing its setup goes to onboarding, a configured one goes home.
 */
export async function postSignInPath(requested: string | null): Promise<string> {
  if (requested) return requested;
  const state = await getOnboardingState();
  if (!state.signedIn) return "/auth/signin";
  return state.needsOnboarding ? "/onboarding" : "/";
}