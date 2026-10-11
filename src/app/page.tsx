export const dynamic = "force-dynamic";

import Link from "next/link";
import type { Metadata } from "next";
import {
  ArrowRight,
  Fingerprint,
  Landmark,
  ShieldCheck,
  FileSignature,
  ScanSearch,
  FingerprintIcon,
} from "lucide-react";
import { getCreators, getPortfolio, getWorkflows, activeSource } from "@/lib/data";
import { DatasetEmpty, missingTables } from "@/components/system/dataset-empty";
import { createTrustEngine } from "@/lib/domain/trust";
import { integrationStatus } from "@/lib/integrations/registry";
import { inr } from "@/lib/utils";
import { Button } from "@/components/ui/primitives";
import { Reveal, Section, SectionHead, Stagger, StaggerItem } from "@/components/shared/motion";
import { CreatorCard } from "@/components/creator/creator-card";
import { GenerativeArt } from "@/components/media/generative-art";

export const metadata: Metadata = {
  title: "CREAM — the AI creator marketplace",
};

export default async function LandingPage() {
  const [creators, portfolio, workflows] = await Promise.all([
    getCreators(),
    getPortfolio(),
    getWorkflows(),
  ]);
  const integrations = integrationStatus();
  const trust = createTrustEngine({
    portfolio,
    workflows: new Map(workflows.map((w) => [w.id, w])),
  });
  // The hero cover is a real portfolio piece, picked by the trust engine rather
  // than hardcoded. With a connected-but-unseeded database there is no piece to
  // pick and `.find(...)` returns undefined — a non-null assertion would only
  // move the crash from here to the next line.
const empty = missingTables({ creators, portfolio, workflows });
  if (empty.length) return <DatasetEmpty missing={empty} source={activeSource()} />;

  const featured = creators.slice(0, 6);
  const elite = [...creators].sort((a, b) => trust.assess(b).score - trust.assess(a).score)[0];
  // `elite.portfolioIds` can be empty even when the creators table has rows — a
  // creator with no uploaded work has no ids to point at. Fall back to any
  // piece rather than asserting one exists.
  const cover =
    portfolio.find((p) => p.id === elite.portfolioIds[0]) ?? portfolio.find((p) => p.creatorId === elite.id) ?? portfolio[0];

  return (
    <>
      {/* ───────────────────────────── hero ───────────────────────────── */}
      <section className="relative overflow-hidden border-b border-line">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.55]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 18% 12%, color-mix(in oklab, var(--caramel) 14%, transparent) 0%, transparent 42%), radial-gradient(circle at 82% 28%, color-mix(in oklab, var(--violet) 12%, transparent) 0%, transparent 38%)",
          }}
        />
        <div className="container-x relative pb-20 pt-16 md:pb-28 md:pt-24">
          <div className="grid gap-14 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
            <div>
              <Reveal>
                <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-line bg-surface/70 py-1 pl-1 pr-3.5 backdrop-blur">
                  <span className="rounded-full bg-caramel px-2 py-[3px] font-mono text-[9.5px] uppercase tracking-[0.14em] text-[oklch(0.18_0.02_60)]">
                    Now in beta
                  </span>
                  <span className="text-[12px] text-ink-muted">
                    {creators.length} AI creators · {portfolio.length} signed works
                  </span>
                </div>
              </Reveal>

              <Reveal delay={0.06}>
                <h1 className="display-xl">
                  The <span className="serif-italic text-cream-gradient">cream</span> layer of AI
                  creative talent.
                </h1>
              </Reveal>

              <Reveal delay={0.12}>
                <p className="mt-7 max-w-xl text-balance-pretty text-[17px] leading-relaxed text-ink-2">
                  Existing marketplaces treat AI creators like interchangeable gig workers. CREAM
                  treats them like a technical vendor: published workflows, named tools, verified
                  delivery history — and a brief specific enough to quote against.
                </p>
              </Reveal>

              <Reveal delay={0.18}>
                <div className="mt-9 flex flex-wrap items-center gap-3">
                  <Button asChild size="lg" variant="primary">
                    <Link href="/discover">
                      Discover creators
                      <ArrowRight className="size-4" />
                    </Link>
                  </Button>
                  <Button asChild size="lg" variant="outline">
                    <Link href="/briefs/new">Build a brief with AI</Link>
                  </Button>
                </div>
              </Reveal>

              <Reveal delay={0.24}>
                <dl className="mt-14 grid grid-cols-2 gap-x-8 gap-y-7 border-t border-line pt-8 sm:grid-cols-4">
                  {[
                    { k: "Verified creators", v: `${creators.length}`, s: "DigiLocker asserted" },
                    {
                      k: "Avg trust score",
                      v: `${Math.round(creators.reduce((s, c) => s + trust.assess(c).score, 0) / creators.length)}`,
                      s: "out of 100",
                    },
                    { k: "Median reply", v: "22m", s: "across the pool" },
                    { k: "Held in escrow", v: "100%", s: "until milestone" },
                  ].map((s) => (
                    <div key={s.k}>
                      <dt className="label-xs">{s.k}</dt>
                      <dd className="mt-2 font-display text-[30px] leading-none tracking-[-0.03em] text-ink">
                        {s.v}
                      </dd>
                      <dd className="mt-1.5 text-[11.5px] text-ink-faint">{s.s}</dd>
                    </div>
                  ))}
                </dl>
              </Reveal>
            </div>

            {/* Live brief-transformation strip */}
            <Reveal delay={0.2} className="relative">
              <div className="relative">
                <div
                  aria-hidden
                  className="absolute -inset-6 -z-10 rounded-[28px] bg-[radial-gradient(60%_60%_at_70%_30%,color-mix(in_oklab,var(--caramel)_16%,transparent),transparent_70%)] blur-2xl"
                />
                <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-e4">
                  <div className="relative aspect-[16/10]">
                    <GenerativeArt
                      seed={cover.artSeed}
                      palette={cover.palette}
                      ratio="16/10"
                      chrome
                      className="size-full"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-surface via-surface/25 to-transparent" />
                    <div className="absolute inset-x-0 bottom-0 flex items-end justify-between p-5">
                      <div>
                        <div className="label-xs">{cover.client ?? "Selected work"}</div>
                        <div className="mt-1.5 font-display text-[22px] leading-tight tracking-[-0.02em] text-ink">
                          {cover.title}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="label-xs">Trust</div>
                        <div className="mt-1.5 font-display text-[26px] leading-none text-mint">
                          {trust.assess(elite).score}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3 p-5">
                    <div className="label-xs">Brief intake · unstructured in</div>
                    <p className="text-[13px] leading-relaxed text-ink-muted">
                      “something monsoon-ish, we shoot in the rain usually but its too slow to
                      schedule everyone”
                    </p>
                    <div className="hairline my-1" />
                    <div className="label-xs">Structured out</div>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        ["Format", "21:9 + 9:16"],
                        ["Duration", "55s"],
                        ["Territory", "India · 36 mo"],
                        ["Budget", "₹3.8–5.2L"],
                      ].map(([k, v]) => (
                        <div key={k} className="rounded-lg border border-line bg-surface-2/50 px-3 py-2">
                          <div className="text-[10px] font-mono uppercase tracking-[0.12em] text-ink-faint">
                            {k}
                          </div>
                          <div className="mt-0.5 text-[12.5px] text-ink">{v}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <p className="mt-4 text-center text-[12px] text-ink-faint">
                  Every field above was extracted from a sentence. Nothing was guessed.
                </p>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ───────────────────── the four objections ───────────────────── */}
      <Section>
        <SectionHead
          eyebrow="The objections every marketplace gets"
          title={
            <>
              Trust is a <span className="serif-italic">platform</span> problem, not a feature.
            </>
          }
          lede="A brand asking why it should trust a new tool with their money, their data and their brand is not being difficult — they are being careful. CREAM's answer is to not hold the sensitive things at all."
        />

        <Stagger className="grid gap-4 md:grid-cols-2">
          {[
            {
              icon: Fingerprint,
              k: "“Why should I trust you with my account?”",
              a: "We do not have your password.",
              b: "Sessions are issued by Supabase Auth through Google and Apple SSO. There is no credential for us to lose, phish or leak.",
              tag: "Supabase Auth",
            },
            {
              icon: Landmark,
              k: "“Why would I give you my government ID?”",
              a: "You do not give it to us.",
              b: "Identity is asserted by the issuer over a consented DigiLocker pull. We store an assertion envelope and never a document — the artefact stays in your own locker, downloadable by you at any time.",
              tag: "DigiLocker",
            },
            {
              icon: ShieldCheck,
              k: "“What stops a fraudulent transaction?”",
              a: "Money never sits in our balance.",
              b: "Razorpay holds the client's funds in a regulated institution's custody and routes them to the creator only against accepted milestones. Card details never touch our servers.",
              tag: "Razorpay Route",
            },
            {
              icon: ScanSearch,
              k: "“End-to-end encryption doesn't stop a client misusing my work.”",
              a: "Correct. It can't.",
              b: "So we use three layers — dual-branded visible burn-in, a keyed invisible watermark we can still extract from a screenshot, and a signed C2PA manifest — plus contracts that gate every stage.",
              tag: "SynthID + C2PA",
            },
          ].map((c) => (
            <StaggerItem key={c.k}>
              <div className="group h-full rounded-lg border border-line bg-surface p-6 transition-colors duration-300 hover:border-line-strong hover:bg-surface-2/40">
                <div className="flex items-start justify-between gap-4">
                  <span className="grid size-10 place-items-center rounded-xl border border-line bg-surface-2 text-caramel">
                    <c.icon className="size-4.5" />
                  </span>
                  <span className="chip shrink-0 font-mono text-[10px]">{c.tag}</span>
                </div>
                <h3 className="mt-5 text-[15px] leading-snug text-ink">{c.k}</h3>
                <p className="mt-3 font-display text-[19px] leading-snug tracking-[-0.015em] text-caramel">
                  {c.a}
                </p>
                <p className="mt-2.5 text-[13.5px] leading-relaxed text-ink-muted">{c.b}</p>
              </div>
            </StaggerItem>
          ))}
        </Stagger>
      </Section>

      {/* ───────────────────── the split ───────────────────── */}
      <section className="border-y border-line bg-bg-deep/35">
        <Section>
          <SectionHead
            eyebrow="Why the AI never searches the database"
            title={
              <>
                Use each system for what it is <span className="serif-italic">actually</span> good at.
              </>
            }
            lede="Programs can run database queries but cannot understand a vague requirement. Models can hold context but cannot query an enormous, continuously-changing creator pool without overflowing or hallucinating. CREAM splits the work instead of pretending one thing can do both."
          />

          <div className="grid gap-px overflow-hidden rounded-xl border border-line bg-line md:grid-cols-3">
            {[
              {
                n: "01",
                role: "Model — conversation",
                does: ["Extracts a structured brief from badly-worded intent", "Never queries the creator pool", "Never invents a creator, price or availability"],
                tone: "var(--violet)",
              },
              {
                n: "02",
                role: "Program — query",
                does: ["Executes the export query over the live pool", "Runs the filters a buyer actually set", "Cannot hallucinate, because it cannot generate"],
                tone: "var(--caramel)",
              },
              {
                n: "03",
                role: "Model — explanation",
                does: ["Explains the result in plain language", "Translates the brief for the creator's side", "Preserves the original conversation verbatim"],
                tone: "var(--mint)",
              },
            ].map((s) => (
              <div key={s.n} className="relative bg-surface p-7">
                <div
                  className="absolute inset-x-0 top-0 h-px"
                  style={{ background: `linear-gradient(90deg, transparent, ${s.tone}, transparent)` }}
                />
                <div className="font-mono text-[11px] tracking-[0.14em]" style={{ color: s.tone }}>
                  {s.n}
                </div>
                <h3 className="mt-4 font-display text-[21px] leading-tight tracking-[-0.02em] text-ink">
                  {s.role}
                </h3>
                <ul className="mt-5 space-y-3">
                  {s.does.map((d) => (
                    <li key={d} className="flex gap-2.5 text-[13px] leading-relaxed text-ink-muted">
                      <span
                        className="mt-[7px] block size-1 shrink-0 rounded-full"
                        style={{ background: s.tone }}
                      />
                      {d}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <Reveal className="mt-8">
            <div className="flex flex-wrap items-center gap-x-6 gap-y-3 rounded-xl border border-dashed border-line bg-surface/50 px-6 py-5">
              <FingerprintIcon className="size-4 shrink-0 text-caramel" />
              <p className="flex-1 text-[13px] leading-relaxed text-ink-muted">
                The differentiator sits between step one and step two:{" "}
                <span className="text-ink">
                  the exact brief conversation is persisted and re-hydrated on the creator&apos;s
                  side
                </span>
                , so a creator receives the full intent rather than a lossy summary written by
                somebody else.
              </p>
              <Link
                href="/model"
                className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.12em] text-caramel hover:underline"
              >
                read the data model <ArrowRight className="size-3" />
              </Link>
            </div>
          </Reveal>
        </Section>
      </section>

      {/* ───────────────────── the pool ───────────────────── */}
      <Section>
        <SectionHead
          eyebrow="The pool"
          title="Creators who publish how they work."
          lede="A portfolio is a mood board. A published workflow with named human decision points is a vendor you can brief."
          action={
            <Button asChild variant="outline" size="md">
              <Link href="/discover">
                View all {creators.length}
                <ArrowRight className="size-3.5" />
              </Link>
            </Button>
          }
        />

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {featured.map((c, i) => (
            <Reveal key={c.id} delay={i * 0.05}>
              <CreatorCard creator={c} compact trust={trust.assess(c)} />
            </Reveal>
          ))}
        </div>
      </Section>

      {/* ───────────────────── lifecycle ───────────────────── */}
      <section className="border-y border-line bg-bg-deep/35">
        <Section>
          <div className="grid gap-12 lg:grid-cols-[0.85fr_1.15fr]">
            <div>
              <SectionHead
                eyebrow="Lifecycle"
                title={
                  <>
                    Nothing moves until a <span className="serif-italic">contract</span> is signed.
                  </>
                }
                lede="Each stage is gated. Contracts are virtual, non-bypassable, and reviewed by a human before they take effect."
                className="mb-0"
              />
              <Button asChild variant="accent" size="lg" className="mt-8">
                <Link href="/briefs/new">
                  Start with a brief <ArrowRight className="size-4" />
                </Link>
              </Button>
            </div>

            <ol className="relative space-y-0 border-l border-line pl-8">
              {[
                {
                  t: "Intake",
                  d: "The brand describes the campaign badly, in their own words. The assistant pulls out formats, rights, budget and deadline, and asks for what is missing — one question at a time.",
                  gate: null,
                },
                {
                  t: "Discovery",
                  d: "The structured brief runs as a query. Results are ranked and, crucially, explained — each card shows which filters it matched.",
                  gate: null,
                },
                {
                  t: "Offer",
                  d: "The creator receives the brief re-rendered in second person, with the original conversation preserved so nothing is lost in translation.",
                  gate: "Brief is complete",
                },
                {
                  t: "Signature",
                  d: "Both parties sign an engagement-start contract. No signature, no payment and no production. The contract names the watermark policy, the scope and the rejection grounds.",
                  gate: "NDA + start contract",
                },
                {
                  t: "Escrow",
                  d: "The client's payment is authorised and captured into Razorpay custody, then routed to the creator against accepted milestones.",
                  gate: "Both signatures captured",
                },
                {
                  t: "Production",
                  d: "Rounds are generated and released with dual-branded burn-in, an invisible watermark and a signed C2PA manifest on every sample.",
                  gate: "Sample shown before delivery",
                },
                {
                  t: "Close",
                  d: "Approval triggers an engagement-close agreement — mutually signed, human reviewed, and the licence that actually transfers rights.",
                  gate: "Milestone accepted",
                },
              ].map((s, i) => (
                <Reveal key={s.t} delay={i * 0.04}>
                  <li className="relative pb-9 last:pb-0">
                    <span className="absolute -left-[37px] top-1 grid size-4 place-items-center rounded-full border border-line bg-bg">
                      <span className="size-1.5 rounded-full bg-caramel" />
                    </span>
                    <div className="flex flex-wrap items-center gap-2.5">
                      <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-faint">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <h3 className="text-[15px] font-medium text-ink">{s.t}</h3>
                      {s.gate && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-line bg-surface-2 px-2 py-[3px] font-mono text-[9.5px] uppercase tracking-[0.1em] text-ink-faint">
                          <FileSignature className="size-2.5" />
                          {s.gate}
                        </span>
                      )}
                    </div>
                    <p className="mt-2 max-w-lg text-[13.5px] leading-relaxed text-ink-muted">{s.d}</p>
                  </li>
                </Reveal>
              ))}
            </ol>
          </div>
        </Section>
      </section>

      {/* ───────────────────── integrations ───────────────────── */}
      <Section>
        <SectionHead
          eyebrow="Integrations"
          title="Nothing here requires you to trust us."
          lede="Every sensitive capability is delegated to a third party we do not control. What we keep is the orchestration, the contracts and the provenance."
        />
        <div className="grid gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-2 lg:grid-cols-3">
          {integrations.map((i, n) => (
            <Reveal key={i.id} delay={n * 0.04}>
              <div className="h-full bg-surface p-6">
                <div className="flex items-center justify-between gap-3">
                  <div className="font-display text-[17px] tracking-[-0.01em] text-ink">{i.vendor}</div>
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-[3px] font-mono text-[9.5px] uppercase tracking-[0.1em] ${
                      i.mode === "live"
                        ? "border-mint/40 bg-mint/10 text-mint"
                        : "border-line bg-surface-2 text-ink-faint"
                    }`}
                  >
                    <span
                      className={`size-1.5 rounded-full ${i.mode === "live" ? "bg-mint" : "bg-ink-faint"}`}
                    />
                    {i.mode === "live" ? "live" : "sandbox"}
                  </span>
                </div>
                <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-faint">
                  {i.name}
                </p>
                <p className="mt-4 text-[13px] leading-relaxed text-ink-muted">{i.unlocks}</p>
              </div>
            </Reveal>
          ))}
          <Reveal delay={0.2}>
            <div className="flex h-full flex-col justify-between bg-surface p-6">
              <div>
                <div className="font-display text-[17px] text-ink">Keys, or don&apos;t</div>
                <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-faint">
                  .env.example
                </p>
              </div>
              <p className="mt-4 text-[13px] leading-relaxed text-ink-muted">
                Add any key to <code className="font-mono text-ink-2">.env.local</code> and that
                subsystem switches from its sandbox adapter to the live one. The application code
                does not change.
              </p>
            </div>
          </Reveal>
        </div>
      </Section>

      {/* ───────────────────── close ───────────────────── */}
      <section className="border-t border-line">
        <div className="container-x py-20 text-center md:py-28">
          <Reveal>
            <p className="mx-auto max-w-3xl font-display text-[clamp(1.75rem,4.2vw,3.25rem)] leading-[1.05] tracking-[-0.03em] text-balance-pretty">
              The interesting part was never the generation. It was making the{" "}
              <span className="serif-italic text-cream-gradient">trust</span> legible.
            </p>
            <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
              <Button asChild size="lg" variant="primary">
                <Link href="/discover">Explore the pool</Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="/deck">Watch the demo</Link>
              </Button>
            </div>
            <p className="mt-8 font-mono text-[11px] uppercase tracking-[0.16em] text-ink-faint">
              {inr(12400000)} routed to creators · 0 credentials stored ·{" "}
              {integrations.filter((i) => i.mode === "live").length} integrations live
            </p>
          </Reveal>
        </div>
      </section>
    </>
  );
}