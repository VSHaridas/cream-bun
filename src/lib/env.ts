/**
 * Environment contract.
 *
 * One place that answers three questions, and refuses to guess:
 *
 *   1. Is a value present?
 *   2. Is that value actually *used* by a real network call?
 *   3. Where is it safe to read from?
 *
 * The distinction in (2) matters more than it looks. An adapter whose live
 * branch is a documented seam rather than an HTTP call must never report
 * itself as live, because the entire product claim is that the interface
 * never asserts a capability the running code does not have.
 */

const raw = (name: string) => process.env[name]?.trim() ?? "";

function secret(name: string) {
  const v = raw(name);
  return v.length > 0 ? v : null;
}

export interface Capability {
  /** A real credential was supplied. */
  configured: boolean;
  /**
   * A real network call is implemented for this subsystem. Only true when
   * adding the key genuinely changes behaviour end to end.
   */
  wired: boolean;
  /** True only when both of the above hold. */
  live: boolean;
  mode: "live" | "sandbox" | "unconfigured";
  /** What the running code does right now, in plain language. */
  behaviour: string;
}

export const supabase = {
  url: raw("NEXT_PUBLIC_SUPABASE_URL"),
  anonKey: raw("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
  /**
   * Server-only. Never prefixed NEXT_PUBLIC_, never imported into a client
   * component. Used for seeding, backfills and webhook verification.
   */
  serviceRoleKey: secret("SUPABASE_SERVICE_ROLE_KEY"),
  get configured() {
    return Boolean(this.url && this.anonKey);
  },
};

/** True only when the value looks like a reachable project URL, not a placeholder. */
function plausibleUrl(url: string) {
  if (!url) return false;
  if (/^(your|example|changeme|xxx|placeholder)/i.test(url)) return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}

export const supabaseCapability = (): Capability => {
  const configured = Boolean(supabase.url && supabase.anonKey) && plausibleUrl(supabase.url);
  return {
    configured,
    wired: true,
    live: configured,
    mode: configured ? "live" : "sandbox",
    behaviour: configured
      ? "Connected. Sessions are issued by Supabase Auth; marketplace records are read from and written to Postgres under row-level security."
      : "No project configured. The session runs on the built-in datastore and every page reads the curated seed dataset. Identical domain shapes either way.",
  };
};

export const gemini = {
  apiKey: secret("GEMINI_API_KEY"),
  /**
   * Deliberately no default. The model is chosen in the UI from the list the
   * API returns, so a new release never requires a code change here.
   */
  get configured() {
    return Boolean(this.apiKey);
  },
};

export const geminiCapability = (): Capability => {
  const configured = Boolean(gemini.apiKey);
  return {
    configured,
    wired: true,
    live: configured,
    mode: configured ? "live" : "sandbox",
    behaviour: configured
      ? "Live. The model is selected in the UI from the API's own model list; structured brief extraction runs under a JSON schema."
      : "No API key, so the conversational engine runs on the deterministic extractor. Same output contract, no model call.",
  };
};

/* ── adapters that remain mocked by design ────────────────────────────────── */

const digilockerCapability = (): Capability => {
  const configured = Boolean(raw("NEXT_PUBLIC_DIGILOCKER_CLIENT_ID"));
  return {
    configured,
    wired: false,
    live: false,
    mode: "sandbox",
    behaviour: configured
      ? "Credentials present but not yet wired to the DigiLocker consent API — the sandbox adapter runs. Wiring it requires a registered client id, PKCE redirect registration and issuer partner access."
      : "Sandbox adapter. Walks the identical six-step issuer consent flow and returns the identical assertion envelope. CREAM still never receives a document.",
  };
};

const razorpayCapability = (): Capability => {
  const configured = Boolean(raw("NEXT_PUBLIC_RAZORPAY_KEY_ID") && raw("NEXT_PUBLIC_RAZORPAY_KEY_SECRET"));
  return {
    configured,
    wired: false,
    live: false,
    mode: "sandbox",
    behaviour: configured
      ? "Credentials present but not yet wired to the Razorpay Orders API — the sandbox adapter runs and reproduces the exact object shapes and state transitions."
      : "Sandbox adapter. Reproduces Razorpay's order, payment, capture, release and refund objects so escrow can be demonstrated without moving money.",
  };
};

const synthidCapability = (): Capability => {
  const configured = Boolean(raw("NEXT_PUBLIC_SYNTHID_API_KEY"));
  return {
    configured,
    wired: false,
    live: false,
    mode: "sandbox",
    behaviour: configured
      ? "Credentials present but not yet wired to a SynthID endpoint — the local stamper runs."
      : "Local stamper. Emits a real C2PA-shaped manifest, embeds a keyed watermark envelope and applies dual-branded visible burn-in.",
  };
};

export type CapabilityId = "supabase" | "gemini" | "digilocker" | "razorpay" | "synthid";

export function capability(id: CapabilityId): Capability {
  switch (id) {
    case "supabase":
      return supabaseCapability();
    case "gemini":
      return geminiCapability();
    case "digilocker":
      return digilockerCapability();
    case "razorpay":
      return razorpayCapability();
    case "synthid":
      return synthidCapability();
  }
}

export const APP_URL = raw("NEXT_PUBLIC_APP_URL") || "http://localhost:3000";

/** Cookie domain for cloud deployments; unset locally so localhost works. */
export const COOKIE_DOMAIN = raw("NEXT_PUBLIC_SUPABASE_COOKIE_DOMAIN") || undefined;