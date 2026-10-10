import { cn } from "@/lib/utils";
import { capability } from "@/lib/env";
import { getSupabaseServer } from "@/lib/supabase/server";
import { Header } from "./header";
import { Footer } from "./footer";

export interface ShellUser {
  id: string;
  email: string | null;
  role: string | null;
  displayName: string | null;
}

/**
 * Resolves the signed-in user once, at the shell, and passes it down.
 *
 * A shell that knows nothing about auth still needs auth: the header renders a
 * different thing when someone is signed in. Resolving here rather than in each
 * page means the session is read once per request rather than once per page,
 * and — more importantly — that a protected page never forgets to check.
 */
async function resolveUser(): Promise<ShellUser | null> {
  if (!capability("supabase").live) return null;
  const supabase = await getSupabaseServer();
  if (!supabase) return null;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  // The profile row is created by an on-insert trigger, so a missing row here
  // is a timing artefact rather than an error worth surfacing.
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, display_name")
    .eq("id", user.id)
    .maybeSingle();

  return {
    id: user.id,
    email: user.email ?? null,
    role: (profile?.role as string | undefined) ?? null,
    displayName: (profile?.display_name as string | undefined) ?? null,
  };
}

export async function AppShell({ children }: { children: React.ReactNode }) {
  const user = await resolveUser();

  const integrations = (["supabase", "gemini", "digilocker", "razorpay", "synthid"] as const).map((id) => {
    const c = capability(id);
    const meta = INTEGRATION_META[id];
    return {
      id,
      name: meta.name,
      vendor: meta.vendor,
      mode: c.live ? ("live" as const) : ("mock" as const),
      configured: c.configured,
      wired: c.wired,
      reason: c.behaviour,
      unlocks: meta.unlocks,
      envKey: meta.envKey,
      docsUrl: meta.docsUrl,
    };
  });

  return (
    <div className="relative flex min-h-dvh flex-col">
      <div
        aria-hidden
        className="pointer-events-none fixed inset-x-0 top-0 -z-10 h-[42rem] bg-[radial-gradient(120%_80%_at_50%_-10%,color-mix(in_oklab,var(--caramel)_11%,transparent),transparent_62%)]"
      />
      <Header integrations={integrations} user={user} />
      <main className={cn("flex-1")}>{children}</main>
      <Footer integrations={integrations} />
    </div>
  );
}

const INTEGRATION_META = {
  supabase: {
    name: "Auth & datastore",
    vendor: "Supabase",
    unlocks: "Federated SSO, row-level security, Postgres, realtime.",
    envKey: "NEXT_PUBLIC_SUPABASE_URL",
    docsUrl: "https://supabase.com/docs",
  },
  gemini: {
    name: "Brief builder",
    vendor: "Google Gemini",
    unlocks: "Free-form requirement extraction, creator-side translation.",
    envKey: "GEMINI_API_KEY",
    docsUrl: "https://ai.google.dev/gemini-api/docs",
  },
  digilocker: {
    name: "Identity",
    vendor: "DigiLocker",
    unlocks: "Issuer-asserted identity verification without holding a document.",
    envKey: "NEXT_PUBLIC_DIGILOCKER_CLIENT_ID",
    docsUrl: "https://digilocker.gov.in",
  },
  razorpay: {
    name: "Payments & escrow",
    vendor: "Razorpay",
    unlocks: "Held-and-released escrow, sub-account splits, TDS payouts.",
    envKey: "NEXT_PUBLIC_RAZORPAY_KEY_ID",
    docsUrl: "https://razorpay.com/docs",
  },
  synthid: {
    name: "Provenance & watermark",
    vendor: "SynthID / C2PA",
    unlocks: "Server-side imperceptible watermarking with scored extraction.",
    envKey: "NEXT_PUBLIC_SYNTHID_API_KEY",
    docsUrl: "https://deepmind.google/technologies/synthid/",
  },
} as const;