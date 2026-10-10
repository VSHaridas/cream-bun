import { capability, type CapabilityId } from "@/lib/env";

/**
 * Integration registry.
 *
 * A thin presentation layer over `@/lib/env`. The single source of truth for
 * what is live lives in `env.ts`; this module only shapes it for the UI.
 *
 * The distinction it exists to enforce: `configured` is not `live`. A key
 * being present says nothing about whether a real network call is wired
 * behind it, and reporting the two as the same thing is how a prototype ends
 * up claiming a capability it does not have.
 */

export interface IntegrationStatus {
  id: CapabilityId;
  name: string;
  vendor: string;
  mode: "live" | "mock";
  /** A credential is present. */
  configured: boolean;
  /** A real network call is implemented for this subsystem. */
  wired: boolean;
  /** What the running code does right now. */
  reason: string;
  unlocks: string;
  envKey: string;
  docsUrl: string;
}

const META: Record<CapabilityId, { name: string; vendor: string; unlocks: string; envKey: string; docsUrl: string }> = {
  supabase: {
    name: "Auth & datastore",
    vendor: "Supabase",
    unlocks: "Federated SSO, row-level security, Postgres, realtime subscriptions.",
    envKey: "NEXT_PUBLIC_SUPABASE_URL",
    docsUrl: "https://supabase.com/docs",
  },
  gemini: {
    name: "Brief builder",
    vendor: "Google Gemini",
    unlocks: "Free-form requirement extraction and creator-side translation, on any model the key can call.",
    envKey: "GEMINI_API_KEY",
    docsUrl: "https://ai.google.dev/gemini-api/docs",
  },
  digilocker: {
    name: "Identity",
    vendor: "DigiLocker",
    unlocks: "Issuer-asserted identity verification without ever holding a document.",
    envKey: "NEXT_PUBLIC_DIGILOCKER_CLIENT_ID",
    docsUrl: "https://digilocker.gov.in",
  },
  razorpay: {
    name: "Payments & escrow",
    vendor: "Razorpay",
    unlocks: "Held-and-released escrow, sub-account splits, TDS-compliant payouts.",
    envKey: "NEXT_PUBLIC_RAZORPAY_KEY_ID",
    docsUrl: "https://razorpay.com/docs",
  },
  synthid: {
    name: "Provenance & watermark",
    vendor: "SynthID / C2PA",
    unlocks: "Server-side imperceptible watermarking with confidence-scored extraction.",
    envKey: "NEXT_PUBLIC_SYNTHID_API_KEY",
    docsUrl: "https://deepmind.google/technologies/synthid/",
  },
};

export function integrationStatus(): IntegrationStatus[] {
  return (Object.keys(META) as CapabilityId[]).map((id) => {
    const c = capability(id);
    return {
      id,
      name: META[id].name,
      vendor: META[id].vendor,
      mode: c.live ? ("live" as const) : ("mock" as const),
      configured: c.configured,
      wired: c.wired,
      reason: c.behaviour,
      unlocks: META[id].unlocks,
      envKey: META[id].envKey,
      docsUrl: META[id].docsUrl,
    };
  });
}

export function modeOf(id: CapabilityId) {
  return capability(id).mode;
}

export function isLive(id: CapabilityId) {
  return capability(id).live;
}

export const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";