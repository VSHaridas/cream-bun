import type { Metadata } from "next";
import Link from "next/link";
import {
  Database,
  KeyRound,
  Network,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";
import { capability, type CapabilityId } from "@/lib/env";
import { activeSource } from "@/lib/data";
import { Button, Label } from "@/components/ui/primitives";
import { Reveal, Section, SectionHead } from "@/components/shared/motion";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Architecture & adapters",
  description:
    "How CREAM is wired: the datastore boundary, the session boundary, the model boundary, and which third-party capabilities are real versus sandboxed.",
};

const ADAPTERS: {
  id: CapabilityId;
  vendor: string;
  surface: string;
  key: string;
  live: string;
  sandbox: string;
}[] = [
  {
    id: "supabase",
    vendor: "Supabase",
    surface: "src/lib/supabase/*, src/lib/data/supabase-provider.ts",
    key: "NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY",
    live: "Sessions issued by Supabase Auth. Marketplace records read from Postgres under row-level security. Writes go through RLS-checked policies.",
    sandbox: "The bundled seed dataset, with identical domain shapes. Every page still renders.",
  },
  {
    id: "gemini",
    vendor: "Google Gemini",
    surface: "src/lib/llm/gemini.ts",
    key: "GEMINI_API_KEY",
    live: "Schema-constrained extraction of the brief, and creator-side translation. The model is read from the API's own catalogue at runtime — none is compiled in.",
    sandbox: "A deterministic rule-based extractor running the same output contract. No model is called and the UI says so.",
  },
  {
    id: "digilocker",
    vendor: "DigiLocker",
    surface: "src/lib/integrations/digilocker.ts",
    key: "NEXT_PUBLIC_DIGILOCKER_CLIENT_ID",
    live: "Not wired. Requires a registered client id, PKCE, registered redirect URIs and issuer partner access.",
    sandbox: "The same six-step consent flow and the same assertion envelope. CREAM still never receives a document — that is a schema constraint, not an adapter detail.",
  },
  {
    id: "razorpay",
    vendor: "Razorpay",
    surface: "src/lib/integrations/razorpay.ts",
    key: "NEXT_PUBLIC_RAZORPAY_KEY_ID, NEXT_PUBLIC_RAZORPAY_KEY_SECRET",
    live: "Not wired. The Orders, Capture and Refund calls are a documented seam.",
    sandbox: "Exact Razorpay object shapes and state transitions, so escrow can be demonstrated without moving money.",
  },
  {
    id: "synthid",
    vendor: "SynthID / C2PA",
    surface: "src/lib/integrations/provenance.ts",
    key: "NEXT_PUBLIC_SYNTHID_API_KEY",
    live: "Not wired. Requires an endpoint rather than a plain key.",
    sandbox: "A local stamper emitting a C2PA-shaped manifest, a keyed watermark envelope and dual-branded visible burn-in — with an honest extractor that refuses to self-confirm.",
  },
];

export default function ApiDocsPage() {
  const source = activeSource();

  return (
    <div className="pb-24">
      <Section className="pb-10">
        <div className="label-xs mb-5">Architecture</div>
        <h1 className="display-lg">
          Three boundaries, and <span className="serif-italic text-cream-gradient">five</span>{" "}
          adapters.
        </h1>
        <p className="mt-5 max-w-2xl text-balance-pretty text-[15px] leading-relaxed text-ink-muted">
          The datastore, the session and the model each sit behind an interface with a live
          implementation and a fallback. Everything above those lines is written once and does not
          know which one it is talking to.
        </p>

        <div className="mt-8 inline-flex flex-wrap items-center gap-2 rounded-full border border-line bg-surface px-3.5 py-2">
          <Database className="size-3.5 text-caramel" />
          <span className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-ink-faint">
            active datastore
          </span>
          <span className="font-mono text-[12px] text-ink">{source}</span>
        </div>
      </Section>

      <Section className="border-t border-line py-14">
        <SectionHead
          eyebrow="Boundaries"
          title="Where the code stops trusting itself"
          lede="Each of these exists because the thing on the other side of it can fail, change or hallucinate. The failure mode is contained rather than propagated."
        />

        <div className="grid gap-4 md:grid-cols-3">
          {[
            {
              icon: Database,
              k: "The datastore",
              file: "src/lib/data/index.ts",
              body: "Twenty-odd files read data and none import an array. They call request-scoped accessors that resolve through a DataProvider to either the bundled seed or Postgres.",
              why: "Accessors use React cache(). A module-level snapshot would be shared across concurrent requests — which under RLS means one user's readable rows leaking into another's response.",
            },
            {
              icon: KeyRound,
              k: "The session",
              file: "src/lib/supabase/server.ts",
              body: "Cookie storage, never localStorage, with an Edge middleware that refreshes tokens on every matched route.",
              why: "Server Components cannot read localStorage. A localStorage client leaves every RLS policy evaluating as anonymous — and the failure is silent.",
            },
            {
              icon: Network,
              k: "The model",
              file: "src/lib/llm/gemini.ts",
              body: "Conversational only. It extracts a brief and explains results; it never queries the creator pool, and its catalogue is read at runtime rather than compiled in.",
              why: "A model cannot hold a continuously-changing roster without overflowing, and when it guesses it hallucinates. Code queries; the model talks.",
            },
          ].map((b) => (
            <Reveal key={b.k}>
              <div className="h-full rounded-lg border border-line bg-surface p-6">
                <span className="grid size-9 place-items-center rounded-lg border border-line bg-surface-2 text-caramel">
                  <b.icon className="size-4" />
                </span>
                <h3 className="mt-4 text-[15px] font-medium text-ink">{b.k}</h3>
                <code className="mt-1.5 block font-mono text-[10.5px] text-ink-faint">
                  {b.file}
                </code>
                <p className="mt-4 text-[13px] leading-relaxed text-ink-muted">{b.body}</p>
                <p className="mt-4 border-t border-line pt-4 text-[12px] leading-relaxed text-ink-faint">
                  <span className="font-medium text-ink-muted">Why:</span> {b.why}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </Section>

      <Section className="border-t border-line py-14">
        <SectionHead
          eyebrow="Adapters"
          title="What is real, and what is deliberately not"
          lede="A configured credential is not the same thing as a live capability. These two are reported separately at runtime, so the interface cannot claim something the code does not do."
        />

        <div className="space-y-3">
          {ADAPTERS.map((a) => {
            const c = capability(a.id);
            return (
              <Reveal key={a.id}>
                <div className="overflow-hidden rounded-lg border border-line bg-surface">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="text-[15px] font-medium text-ink">{a.vendor}</span>
                      <code className="font-mono text-[10.5px] text-ink-faint">{a.surface}</code>
                    </div>
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[9.5px] uppercase tracking-[0.12em] ${
                        c.live
                          ? "border-mint/45 bg-mint/10 text-mint"
                          : "border-line bg-surface-2 text-ink-faint"
                      }`}
                    >
                      <span
                        className={`size-1.5 rounded-full ${c.live ? "bg-mint" : "bg-ink-faint"}`}
                      />
                      {c.live ? "live" : c.wired ? "sandbox" : "sandbox · not wired"}
                    </span>
                  </div>

                  <div className="grid gap-px bg-line md:grid-cols-2">
                    <div className="bg-surface p-5">
                      <div className="flex items-center gap-2">
                        <ShieldCheck className="size-3 text-mint" />
                        <Label>When live</Label>
                      </div>
                      <p className="mt-2.5 text-[12.5px] leading-relaxed text-ink-muted">
                        {a.live}
                      </p>
                    </div>
                    <div className="bg-surface p-5">
                      <div className="flex items-center gap-2">
                        <TriangleAlert className="size-3 text-caramel" />
                        <Label>When sandboxed</Label>
                      </div>
                      <p className="mt-2.5 text-[12.5px] leading-relaxed text-ink-muted">
                        {a.sandbox}
                      </p>
                    </div>
                  </div>

                  <div className="border-t border-line px-5 py-3">
                    <Label>Environment</Label>
                    <code className="mt-1.5 block break-all font-mono text-[10.5px] text-ink-faint">
                      {a.key}
                    </code>
                  </div>
                </div>
              </Reveal>
            );
          })}
        </div>
      </Section>

      <Section className="border-t border-line py-14">
        <div className="flex flex-wrap items-center justify-between gap-6 rounded-xl border border-line bg-surface p-8">
          <div className="max-w-lg">
            <h2 className="display-md">Run modes</h2>
            <p className="mt-4 text-[13.5px] leading-relaxed text-ink-muted">
              Four combinations, all supported, none of them a degraded experience. Full setup
              instructions are in <code className="font-mono text-ink-2">SETUP.md</code>.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button asChild variant="outline">
              <Link href="/trust">Trust architecture</Link>
            </Button>
            <Button asChild variant="primary">
              <Link href="/model">Data model note</Link>
            </Button>
          </div>
        </div>
      </Section>
    </div>
  );
}