export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  Boxes,
  FileSignature,
  Fingerprint,
  KeyRound,
  Landmark,
  Layers,
  Lock,
  ScanSearch,
  ShieldOff,
  Signature,
  UserRound,
} from "lucide-react";

import { DIGILOCKER_FLOW, ISSUER_CATALOGUE } from "@/lib/integrations/digilocker";
import { CHECKOUT_METHODS, ESCROW_POLICY, payoutBreakdown } from "@/lib/integrations/razorpay";
import { PROVENANCE_LAYERS, envelopeBits, visibleBurnIn } from "@/lib/integrations/provenance";
import { integrationStatus } from "@/lib/integrations/registry";
import { getContracts, getCreators, getEscrows, getProvenance } from "@/lib/data";
import { activeSource } from "@/lib/data";
import { DatasetEmpty, missingTables } from "@/components/system/dataset-empty";

import { Badge, Button, Label, Meter, Panel, Stat } from "@/components/ui/primitives";
import { Reveal, Section, SectionHead, Stagger, StaggerItem } from "@/components/shared/motion";
import { cn, formatDateTime, inr, pct } from "@/lib/utils";
import { WatermarkDetector } from "@/components/trust/watermark-detector";

export const metadata: Metadata = {
  title: "Trust architecture",
  description:
    "How CREAM verifies identity with DigiLocker, holds money with Razorpay, and stamps provenance with SynthID and C2PA — and what the platform is structurally unable to do.",
};

/* ── the four objections, rendered as an audit table ─────────────────────── */

const OBJECTIONS = [
  {
    objection: "“Why would I give you my government ID?”",
    holder: "The issuer. Your document never leaves your own DigiLocker account.",
    stores: "An assertion envelope — issuer reference, assurance level, timestamp.",
    cannot: "Receive a scan. There is no upload endpoint, no OCR, no retention field.",
    vendor: "DigiLocker",
    tone: "mint" as const,
  },
  {
    objection: "“Why would I hand you my card details?”",
    holder: "Razorpay, inside its own frame, in a licensed bank's custody.",
    stores: "An order id, a payment id and a milestone ledger. Nothing else.",
    cannot: "See, store or log a card, UPI or bank credential. We never touch that surface.",
    vendor: "Razorpay Route",
    tone: "caramel" as const,
  },
  {
    objection: "“End-to-end encryption does not stop me misusing your work.”",
    holder: "Nobody. That is exactly the point — the copy is provably yours.",
    stores: "A signed C2PA manifest, a keyed watermark envelope, a custody log.",
    cannot: "Stop you recording the screen. It can name you afterwards.",
    vendor: "SynthID + C2PA",
    tone: "violet" as const,
  },
  {
    objection: "“Why should I trust a new platform with my account at all?”",
    holder: "Supabase Auth. We issue no credentials, so we have none to lose.",
    stores: "A session and a row-level-security policy.",
    cannot: "Lose, phish or leak a password. There is no password field to leak.",
    vendor: "Supabase Auth",
    tone: "ink" as const,
  },
];

/* ── escrow journey ───────────────────────────────────────────────────────── */

const ESCROW_STEPS = [
  { k: "Authorise", d: "The brand authorises the full amount inside Razorpay's checkout frame.", owner: "brand" },
  { k: "Sign", d: "Both parties sign the engagement-start contract. Nothing has moved yet.", owner: "both" },
  { k: "Capture", d: "On the second signature the payment is captured into CREAM's sub-account.", owner: "razorpay" },
  { k: "Held", d: "Funds sit in a regulated payment institution's custody. Not ours to spend.", owner: "razorpay" },
  { k: "Milestone release", d: "Each tranche releases only against written acceptance of that milestone.", owner: "brand" },
  { k: "Settled", d: "Net 15 from acceptance, to the creator's sub-account, net of fee and TDS.", owner: "razorpay" },
];

export default async function TrustArchitecturePage() {
  const [provenanceRecords, escrows, contracts, creators] = await Promise.all([
    getProvenance(),
    getEscrows(),
    getContracts(),
    getCreators(),
  ]);

const integrations = integrationStatus();
  const live = integrations.filter((i) => i.mode === "live").length;

  // This page quotes a real escrow, a real contract and a real provenance
  // envelope rather than illustrating them with constants. Those rows are
  // guaranteed under the bundled seed and absent from a connected-but-unseeded
  // database, so the page states which tables are empty instead of
  // dereferencing `escrows[0].amountInr` and dying.
  const empty = missingTables({
    provenance_records: provenanceRecords,
    escrows,
    contracts,
    creators,
  });
  if (empty.length) return <DatasetEmpty missing={empty} source={activeSource()} />;

  const record = provenanceRecords[0];
  const escrow = escrows[0];
  const contract = contracts[0];
  const break_ = payoutBreakdown(escrow.amountInr);
  const bits = envelopeBits(record.synthid.payloadId);
  const burn = visibleBurnIn({ creatorName: record.visible.creatorWatermark });
  const identitySample = creators.find((c) => c.identity.status === "verified") ?? creators[0];

  return (
    <>
      {/* ───────────────────────────── hero ───────────────────────────── */}
      <section className="relative overflow-hidden border-b border-line">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.5]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 14% 8%, color-mix(in oklab, var(--caramel) 14%, transparent) 0%, transparent 44%), radial-gradient(circle at 84% 32%, color-mix(in oklab, var(--violet) 11%, transparent) 0%, transparent 40%)",
          }}
        />
        <div className="container-x relative pb-16 pt-16 md:pb-24 md:pt-24">
          <Reveal>
            <div className="mb-7 inline-flex items-center gap-2.5 rounded-full border border-line bg-surface/70 py-1 pl-1 pr-3.5 backdrop-blur">
              <span className="rounded-full bg-caramel px-2 py-[3px] font-mono text-[9.5px] uppercase tracking-[0.14em] text-[oklch(0.18_0.02_60)]">
                Trust architecture
              </span>
              <span className="text-[12px] text-ink-muted">
                <span className="font-mono tabular-nums">
                  {live}/{integrations.length}
                </span>{" "}
                integrations live · {integrations.length - live} on sandbox adapters
              </span>
            </div>
          </Reveal>

          <Reveal delay={0.06}>
            <h1 className="display-lg max-w-4xl">
              Every sensitive thing you would ask us to hold, we{" "}
              <span className="serif-italic text-cream-gradient">chose not to hold</span>.
            </h1>
          </Reveal>

          <Reveal delay={0.12}>
            <p className="mt-7 max-w-2xl text-balance-pretty text-[17px] leading-relaxed text-ink-2">
              This page is the long answer to the four questions every brand asks about a new
              marketplace. It is written from the adapters themselves — the same constants the running
              application reads — so nothing here is a claim the code does not make.
            </p>
          </Reveal>

          <Reveal delay={0.18}>
            <div className="mt-10 flex flex-wrap gap-2">
              {integrations.map((i) => (
                <span key={i.id} className="chip font-mono text-[10.5px]">
                  <span
                    className={cn(
                      "size-1.5 rounded-full",
                      i.mode === "live" ? "bg-mint" : "bg-ink-faint",
                    )}
                  />
                  {i.vendor}
                  <span className="text-ink-faint">{i.mode === "live" ? "live" : "sandbox"}</span>
                </span>
              ))}
            </div>
          </Reveal>

          <Reveal delay={0.24}>
            <nav className="mt-12 flex flex-wrap gap-2 border-t border-line pt-6">
              {[
                { href: "#digilocker", label: "Identity" },
                { href: "#razorpay", label: "Held money" },
                { href: "#provenance", label: "Provenance" },
                { href: "#identity", label: "The stored object" },
              ].map((a) => (
                <a
                  key={a.href}
                  href={a.href}
                  className="group inline-flex items-center gap-1.5 rounded-full border border-line bg-surface/50 px-3.5 py-1.5 text-[12.5px] text-ink-muted transition-colors hover:border-line-strong hover:text-ink"
                >
                  {a.label}
                  <ArrowRight className="size-3 transition-transform duration-200 group-hover:translate-x-0.5" />
                </a>
              ))}
            </nav>
          </Reveal>
        </div>
      </section>

      {/* ─────────────────── the objections, as an audit ────────────────── */}
      <Section>
        <SectionHead
          eyebrow="The four objections"
          title={
            <>
              Asked as a table, because that is how a{" "}
              <span className="serif-italic">procurement</span> team asks.
            </>
          }
          lede="Four things a new marketplace is asked to prove it will not do. Each row names the party that actually holds the asset, the residue CREAM keeps, and the capability CREAM is structurally missing."
        />

        <Reveal>
          <div className="overflow-x-auto rounded-xl border border-line">
            <table className="w-full min-w-[62rem] border-collapse text-left">
              <thead>
                <tr className="border-b border-line bg-surface-2/50">
                  {["The objection", "Who actually holds it", "What CREAM stores", "What CREAM cannot do"].map(
                    (h) => (
                      <th key={h} className="label-xs px-5 py-4 font-normal">
                        {h}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {OBJECTIONS.map((o) => (
                  <tr key={o.vendor} className="group bg-surface transition-colors hover:bg-surface-2/40">
                    <td className="w-[22%] px-5 py-5 align-top">
                      <span
                        className={cn(
                          "mb-3 inline-flex items-center gap-1.5 rounded-full border px-2 py-[3px] font-mono text-[9.5px] uppercase tracking-[0.1em]",
                          o.tone === "mint" && "border-mint/40 bg-mint/10 text-mint",
                          o.tone === "caramel" && "border-caramel/40 bg-caramel/10 text-caramel",
                          o.tone === "violet" && "border-violet/40 bg-violet/10 text-violet",
                          o.tone === "ink" && "border-line bg-surface-2 text-ink-faint",
                        )}
                      >
                        {o.vendor}
                      </span>
                      <p className="font-display text-[16px] leading-snug tracking-[-0.015em] text-ink">
                        {o.objection}
                      </p>
                    </td>
                    <td className="px-5 py-5 align-top text-[13px] leading-relaxed text-ink-2">
                      {o.holder}
                    </td>
                    <td className="px-5 py-5 align-top text-[13px] leading-relaxed text-ink-2">
                      {o.stores}
                    </td>
                    <td className="px-5 py-5 align-top text-[13px] leading-relaxed text-ink-2">
                      <span className="flex gap-2">
                        <ShieldOff className="mt-0.5 size-3.5 shrink-0 text-rose/80" />
                        {o.cannot}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Reveal>

        <Reveal delay={0.08}>
          <p className="mt-5 max-w-3xl text-[13px] leading-relaxed text-ink-faint">
            The right-hand column is the important one. It is not a policy statement or a promise in a
            terms page — each of those capabilities is absent because the code that would perform it
            does not exist in this repository.
          </p>
        </Reveal>
      </Section>

      {/* ───────────────────────── #digilocker ────────────────────────── */}
      <section className="border-y border-line bg-bg-deep/35">
        <Section id="digilocker" className="scroll-mt-24">
          <SectionHead
            eyebrow="01 · Identity"
            title={
              <>
                CREAM never receives a{" "}
                <span className="serif-italic">government document</span>.
              </>
            }
            lede="Identity is asserted by the issuer over a consented DigiLocker pull. Six steps, four actors, and not one of them passes a file to us."
            action={
              <Button asChild variant="outline" size="md">
                <Link href="/onboarding/identity">
                  Walk the flow
                  <ArrowRight className="size-3.5" />
                </Link>
              </Button>
            }
          />

          <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:gap-14">
            {/* timeline */}
            <ol className="relative space-y-0 border-l border-line pl-8">
              {DIGILOCKER_FLOW.map((s, i) => (
                <Reveal key={s.id} delay={i * 0.04}>
                  <li className="relative pb-8 last:pb-0">
                    <span className="absolute -left-[37px] top-1 grid size-4 place-items-center rounded-full border border-line bg-bg">
                      <span className="size-1.5 rounded-full bg-caramel" />
                    </span>
                    <div className="flex flex-wrap items-center gap-2.5">
                      <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-faint">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <h3 className="text-[15px] font-medium text-ink">{s.title}</h3>
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 rounded-full border px-2 py-[3px] font-mono text-[9.5px] uppercase tracking-[0.1em]",
                          s.actor === "cream"
                            ? "border-caramel/45 bg-caramel/10 text-caramel"
                            : s.actor === "issuer"
                              ? "border-mint/45 bg-mint/10 text-mint"
                              : "border-line bg-surface-2 text-ink-faint",
                        )}
                      >
                        {s.actor}
                      </span>
                    </div>
                    <p className="mt-2 max-w-lg text-[13.5px] leading-relaxed text-ink-muted">
                      {s.description}
                    </p>
                    <p className="mt-2.5 flex items-start gap-2 text-[12px] leading-relaxed text-ink-faint">
                      <ScanSearch className="mt-0.5 size-3 shrink-0" />
                      <span className="font-mono text-[11px]">UI · {s.ui}</span>
                    </p>
                  </li>
                </Reveal>
              ))}
            </ol>

            {/* withheld + catalogue */}
            <div className="space-y-5">
              <Reveal delay={0.06}>
                <Panel className="overflow-hidden">
                  <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
                    <div className="flex items-center gap-2.5">
                      <ShieldOff className="size-3.5 text-rose" />
                      <Label className="text-ink-2">What CREAM did not receive</Label>
                    </div>
                    <span className="chip font-mono text-[10px]">assertion.withheld</span>
                  </div>
                  <ul className="divide-y divide-line">
                    {[
                      "document image",
                      "scanned pages",
                      "signature image",
                      "biometric reference",
                    ].map((w) => (
                      <li key={w} className="flex items-center gap-3 px-5 py-3.5">
                        <span className="font-mono text-[10.5px] text-ink-faint">✕</span>
                        <span className="text-[13.5px] text-rose line-through decoration-rose/70 decoration-[1.5px]">
                          {w}
                        </span>
                        <span className="ml-auto font-mono text-[10.5px] uppercase tracking-[0.12em] text-ink-faint">
                          withheld
                        </span>
                      </li>
                    ))}
                  </ul>
                  <p className="border-t border-line bg-surface-2/40 px-5 py-4 text-[12.5px] leading-relaxed text-ink-muted">
                    This list is emitted by the adapter on every assertion. It is the one thing in the
                    flow that is asserted rather than demonstrated — and it is demonstrated by the
                    absence of the fields entirely.
                  </p>
                </Panel>
              </Reveal>

              <Reveal delay={0.12}>
                <Panel className="overflow-hidden">
                  <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
                    <div className="flex items-center gap-2.5">
                      <Landmark className="size-3.5 text-caramel" />
                      <Label className="text-ink-2">Issuer catalogue</Label>
                    </div>
                    <span className="chip font-mono text-[10px]">{ISSUER_CATALOGUE.length} issuers</span>
                  </div>
                  <ul className="divide-y divide-line">
                    {ISSUER_CATALOGUE.map((d) => (
                      <li key={d.issuerId} className="px-5 py-4">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[13.5px] font-medium text-ink">{d.documentType}</span>
                          <Badge tone={d.assuranceLevel === "AAL2" ? "mint" : "neutral"}>
                            {d.assuranceLevel}
                          </Badge>
                          <span className="ml-auto font-mono text-[10px] text-ink-faint">{d.issuerId}</span>
                        </div>
                        <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink-muted">{d.description}</p>
                        <div className="mt-2.5 flex flex-wrap items-center gap-2">
                          <span className="font-mono text-[10.5px] text-ink-faint">{d.issuer}</span>
                        </div>
                        <div className="mt-2.5 inline-flex items-center gap-1.5 rounded-full border border-rose/35 bg-rose/[0.07] px-2.5 py-1 font-mono text-[10px] text-rose">
                          artefactAvailableToCream: {String(d.artefactAvailableToCream)}
                        </div>
                      </li>
                    ))}
                  </ul>
                </Panel>
              </Reveal>
            </div>
          </div>

          <Stagger className="mt-12 grid gap-4 md:grid-cols-3">
            {[
              {
                icon: BadgeCheck,
                k: "AAL2 outranks AAL1",
                b: "Assurance level, not document type, decides the weight. A passport and an Aadhaar both clear AAL2; a driving licence and a PAN both sit at AAL1. CREAM baselines anything that touches money at AAL2.",
              },
              {
                icon: KeyRound,
                k: "artefactRetained is a type, not a flag",
                b: "IdentityVerification.artefactRetained is typed as the literal false. There is no true branch to write, no configuration that flips it, and no migration that could introduce one.",
              },
              {
                icon: UserRound,
                k: "Possession is proven at the issuer",
                b: "The OTP is sent by the body that issued the document. That is what upgrades an assertion from “this document exists” to “this document exists and the person in front of the screen holds it”.",
              },
            ].map((c) => (
              <StaggerItem key={c.k}>
                <div className="h-full rounded-lg border border-line bg-surface p-6">
                  <span className="grid size-10 place-items-center rounded-xl border border-line bg-surface-2 text-caramel">
                    <c.icon className="size-4.5" />
                  </span>
                  <h3 className="mt-5 text-[15px] leading-snug text-ink">{c.k}</h3>
                  <p className="mt-2.5 text-[13px] leading-relaxed text-ink-muted">{c.b}</p>
                </div>
              </StaggerItem>
            ))}
          </Stagger>
        </Section>
      </section>

      {/* ───────────────────────── #razorpay ──────────────────────────── */}
      <Section id="razorpay" className="scroll-mt-24">
        <SectionHead
          eyebrow="02 · Money"
          title={
            <>
              CREAM does not hold your money. It{" "}
              <span className="serif-italic">holds its place in line</span>.
            </>
          }
          lede="“Escrow” is banned by our own licence because it is the wrong word. What happens is capture into a regulated payment institution's custody and release against accepted milestones."
          action={
            <Button asChild variant="outline" size="md">
              <Link href="/trust#provenance">
                See provenance
                <ArrowRight className="size-3.5" />
              </Link>
            </Button>
          }
        />

        <div className="grid gap-10 lg:grid-cols-[0.95fr_1.05fr] lg:gap-14">
          {/* policy panel */}
          <Reveal>
            <Panel className="overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
                <div className="flex items-center gap-2.5">
                  <Landmark className="size-3.5 text-caramel" />
                  <Label className="text-ink-2">Escrow policy</Label>
                </div>
                <span className="chip font-mono text-[10px]">ESCROW_POLICY</span>
              </div>
              <dl className="divide-y divide-line">
                {[
                  { k: "Capture on", v: ESCROW_POLICY.captureOn },
                  { k: "Release trigger", v: ESCROW_POLICY.releaseTrigger },
                  { k: "Settlement", v: ESCROW_POLICY.settlement },
                  { k: "Dispute", v: ESCROW_POLICY.dispute },
                  { k: "Refund authority", v: ESCROW_POLICY.refundAuthority, wide: true },
                  { k: "Custody", v: ESCROW_POLICY.custody },
                ].map((row) => (
                  <div
                    key={row.k}
                    className={cn("grid gap-1.5 px-5 py-4", !row.wide && "sm:grid-cols-[132px_minmax(0,1fr)] sm:gap-5")}
                  >
                    <dt className="label-xs pt-0.5">{row.k}</dt>
                    <dd
                      className={cn(
                        "text-[13px] leading-relaxed",
                        row.wide ? "text-ink-2" : "text-ink-muted",
                      )}
                    >
                      {row.v}
                    </dd>
                  </div>
                ))}
              </dl>
              <div className="flex flex-wrap gap-1.5 border-t border-line bg-surface-2/40 px-5 py-4">
                {CHECKOUT_METHODS.map((m) => (
                  <span key={m.id} className="chip font-mono text-[10px]" title={m.hint}>
                    {m.label}
                  </span>
                ))}
                <span className="ml-auto font-mono text-[10px] text-ink-faint">
                  collected inside Razorpay&apos;s own frame
                </span>
              </div>
            </Panel>
          </Reveal>

          {/* journey */}
          <div>
            <Reveal delay={0.06}>
              <div className="flex flex-wrap items-center gap-2">
                {ESCROW_STEPS.map((s, i) => (
                  <div key={s.k} className="flex items-center gap-2">
                    <span className="chip font-mono text-[10px]">
                      <span className="text-ink-faint">{String(i + 1).padStart(2, "0")}</span>
                      {s.k}
                    </span>
                    {i < ESCROW_STEPS.length - 1 && <ArrowRight className="size-3 text-ink-faint" />}
                  </div>
                ))}
              </div>
            </Reveal>

            <ol className="mt-6 space-y-px overflow-hidden rounded-xl border border-line">
              {ESCROW_STEPS.map((s, i) => (
                <Reveal key={s.k} delay={0.02 + i * 0.04}>
                  <li className="flex gap-4 bg-surface p-4 transition-colors hover:bg-surface-2/40">
                    <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-md border border-line bg-surface-2 font-mono text-[10px] tabular-nums text-ink-faint">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[13.5px] font-medium text-ink">{s.k}</span>
                        <span className="font-mono text-[9.5px] uppercase tracking-[0.12em] text-ink-faint">
                          held by {s.owner}
                        </span>
                      </div>
                      <p className="mt-1 text-[12.5px] leading-relaxed text-ink-muted">{s.d}</p>
                    </div>
                  </li>
                </Reveal>
              ))}
            </ol>

            <Reveal delay={0.2}>
              <Panel className="mt-5 p-5">
                <div className="flex flex-wrap items-baseline justify-between gap-3">
                  <Label>Live record · {escrow.code}</Label>
                  <span className="font-mono text-[10.5px] text-ink-faint">
                    {escrow.gatewayOrderId} · {escrow.status}
                  </span>
                </div>
                <p className="mt-3 text-[13px] leading-relaxed text-ink-muted">{escrow.protectedBy}</p>
                <dl className="mt-4 grid gap-3 sm:grid-cols-3">
                  <Stat label="Gross captured" value={inr(escrow.amountInr)} sub={`captured ${formatDateTime(escrow.capturedAt ?? "")}`} />
                  <Stat label="Released so far" value={inr(escrow.releasedInr)} sub={`${pct((escrow.releasedInr / escrow.amountInr) * 100, 1)} of gross`} tone="mint" />
                  <Stat label="Payout route" value={<span className="text-[15px]">{escrow.payoutRoute.split(" · ")[0]}</span>} sub={escrow.payoutRoute.split(" · ")[1]} />
                </dl>
                <p className="mt-4 font-mono text-[10.5px] text-ink-faint">
                  contract {contract.code} · signed by both parties · human reviewed
                </p>
              </Panel>
            </Reveal>
          </div>
        </div>

        {/* arithmetic */}
        <Reveal delay={0.1}>
          <div className="mt-12 overflow-hidden rounded-xl border border-line">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-surface-2/50 px-5 py-4">
              <div className="flex items-center gap-2.5">
                <Boxes className="size-3.5 text-caramel" />
                <Label className="text-ink-2">Where one rupee of ₹4,65,000 goes</Label>
              </div>
              <span className="chip font-mono text-[10px]">payoutBreakdown(465000)</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[46rem] border-collapse">
                <thead>
                  <tr className="border-b border-line">
                    {["Line", "Rate", "Amount", "Paid to"].map((h) => (
                      <th key={h} className="label-xs px-5 py-3 text-left font-normal">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-line font-mono text-[12.5px] tabular-nums">
                  {[
                    {
                      l: "Gross captured",
                      r: "—",
                      a: inr(break_.gross),
                      t: "Razorpay custody",
                      tone: "text-ink",
                    },
                    {
                      l: "Platform fee",
                      r: pct(break_.platformFeeRate * 100),
                      a: `− ${inr(break_.platformFee)}`,
                      t: "CREAM",
                      tone: "text-caramel",
                    },
                    {
                      l: "Creator gross",
                      r: "—",
                      a: inr(break_.creatorGross),
                      t: "before withholding",
                      tone: "text-ink-2",
                    },
                    {
                      l: "TDS withheld",
                      r: pct(break_.tdsRate * 100),
                      a: `− ${inr(break_.tds)}`,
                      t: "Government, remitted by Razorpay",
                      tone: "text-rose",
                    },
                    {
                      l: "Creator net",
                      r: "—",
                      a: inr(break_.creatorNet),
                      t: "settled net 15",
                      tone: "text-mint",
                    },
                  ].map((row) => (
                    <tr key={row.l} className="bg-surface transition-colors hover:bg-surface-2/40">
                      <td className={cn("px-5 py-3.5 font-sans text-[13px]", row.tone)}>{row.l}</td>
                      <td className="px-5 py-3.5 text-ink-faint">{row.r}</td>
                      <td className={cn("px-5 py-3.5", row.tone)}>{row.a}</td>
                      <td className="px-5 py-3.5 font-sans text-[12px] text-ink-muted">{row.t}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="border-t border-line bg-surface-2/40 px-5 py-4">
              <p className="max-w-3xl font-mono text-[11.5px] leading-relaxed text-ink-muted">
                {inr(break_.gross)} − {inr(break_.platformFee)} ({pct(break_.platformFeeRate * 100)}) ={" "}
                {inr(break_.creatorGross)} − {inr(break_.tds)} ({pct(break_.tdsRate * 100)}) ={" "}
                <span className="text-mint">{inr(break_.creatorNet)}</span> to the creator. CREAM keeps{" "}
                {inr(break_.platformFee)} and never handles the client&apos;s balance at any point.
              </p>
            </div>
          </div>
        </Reveal>
      </Section>

      {/* ─────────────────────── #provenance ──────────────────────────── */}
      <section className="border-y border-line bg-bg-deep/35">
        <Section id="provenance" className="scroll-mt-24">
          <SectionHead
            eyebrow="03 · Provenance"
            title={
              <>
                Encryption stops a leak. It does not stop a{" "}
                <span className="serif-italic">screenshot</span>.
              </>
            }
            lede="A brand is a legitimate recipient of sample work and can record the screen. What they cannot do is use it elsewhere without leaving a trace we can pull back out of the copy."
          />

          <Stagger className="grid gap-px overflow-hidden rounded-xl border border-line bg-line md:grid-cols-3">
            {PROVENANCE_LAYERS.map((l, i) => (
              <StaggerItem key={l.layer}>
                <div className="h-full bg-surface p-7">
                  <div className="flex items-baseline justify-between gap-3">
                    <div className="font-mono text-[11px] tracking-[0.14em] text-caramel">
                      {String(i + 1).padStart(2, "0")}
                    </div>
                    <Layers className="size-3.5 text-ink-faint" />
                  </div>
                  <h3 className="mt-4 font-display text-[21px] leading-tight tracking-[-0.02em] text-ink">
                    {l.layer}
                  </h3>
                  <p className="mt-2.5 font-mono text-[10.5px] uppercase tracking-[0.12em] text-ink-faint">
                    defeats · {l.defeats}
                  </p>
                  <p className="mt-4 text-[13px] leading-relaxed text-ink-muted">{l.detail}</p>
                  <p className="mt-5 border-t border-line pt-3.5 text-[12px] leading-relaxed text-caramel">
                    {l.strength}
                  </p>
                </div>
              </StaggerItem>
            ))}
          </Stagger>

          {/* record + detector */}
          <div className="mt-10 grid gap-6 lg:grid-cols-[1.05fr_0.95fr] lg:gap-8">
            <Reveal>
              <Panel className="overflow-hidden">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
                  <div className="flex items-center gap-2.5">
                    <Signature className="size-3.5 text-caramel" />
                    <Label className="text-ink-2">Signed manifest · {record.assetName}</Label>
                  </div>
                  <span className="chip font-mono text-[10px]">C2PA v{record.c2pa.version}</span>
                </div>

                <div className="px-5 py-5">
                  <Label>c2pa.assertions</Label>
                  <ul className="mt-3.5 space-y-2">
                    {record.c2pa.assertions.map((a) => (
                      <li key={a} className="flex gap-2.5 font-mono text-[11.5px] leading-relaxed text-ink-2">
                        <span className="mt-[7px] block size-1 shrink-0 rounded-full bg-caramel" />
                        {a}
                      </li>
                    ))}
                  </ul>
                  <div className="mt-5 grid gap-2.5 sm:grid-cols-2">
                    <div className="rounded-md border border-line bg-surface-2/40 px-3.5 py-3">
                      <div className="label-xs">manifestHash</div>
                      <div className="mt-1 font-mono text-[10.5px] break-all text-ink-muted">
                        {record.c2pa.manifestHash}
                      </div>
                    </div>
                    <div className="rounded-md border border-line bg-surface-2/40 px-3.5 py-3">
                      <div className="label-xs">certificateIssuer</div>
                      <div className="mt-1 font-mono text-[10.5px] text-ink-muted">
                        {record.c2pa.certificateIssuer}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="border-t border-line px-5 py-5">
                  <div className="flex flex-wrap items-baseline justify-between gap-3">
                    <Label>SynthID envelope</Label>
                    <span className="font-mono text-[10.5px] text-ink-faint">
                      {record.synthid.provider} · strength {record.synthid.strength}
                    </span>
                  </div>
                  <div className="mt-3 font-mono text-[13px] text-ink">{record.synthid.payloadId}</div>
                  <div className="mt-4 grid grid-cols-[repeat(24,minmax(0,1fr))] gap-[2px]">
                    {bits.map((b, i) => (
                      <span
                        key={i}
                        title={`byte ${i + 1} · ${b} · ${parseInt(b, 2)}`}
                        className={cn(
                          "aspect-square rounded-[2px]",
                          b.startsWith("1") ? "bg-caramel/70" : "bg-surface-3",
                        )}
                      />
                    ))}
                  </div>
                  <p className="mt-3 font-mono text-[10.5px] leading-relaxed text-ink-faint">
                    24 bytes derived from a server-held secret. A recipient can flatten the image, but
                    they cannot flatten this without knowing the key — which is the difference between
                    a deterrent and a proof.
                  </p>
                </div>

                <div className="border-t border-line px-5 py-5">
                  <Label>Visible burn-in</Label>
                  <div className="mt-3.5 flex flex-wrap items-center gap-3">
                    <span className="rounded-md border border-line bg-surface-2/60 px-4 py-2 font-display text-[15px] tracking-[0.02em] text-ink">
                      {burn.composite}
                    </span>
                    <span className="font-mono text-[10.5px] text-ink-faint">
                      {burn.position} · opacity {burn.opacity}
                    </span>
                  </div>
                  <p className="mt-3 text-[12.5px] leading-relaxed text-ink-muted">{burn.note}</p>
                </div>
              </Panel>
            </Reveal>

            <div className="space-y-6">
              <Reveal delay={0.06}>
                <WatermarkDetector defaultPayloadId={record.synthid.payloadId} />
              </Reveal>

              <Reveal delay={0.12}>
                <Panel className="overflow-hidden">
                  <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
                    <div className="flex items-center gap-2.5">
                      <FileSignature className="size-3.5 text-caramel" />
                      <Label className="text-ink-2">Chain of custody</Label>
                    </div>
                    <span className="chip font-mono text-[10px]">{record.chainOfCustody.length} events</span>
                  </div>
                  <ol className="divide-y divide-line">
                    {record.chainOfCustody.map((e, i) => (
                      <li key={`${e.event}-${e.at}`} className="flex gap-4 px-5 py-3.5">
                        <span className="mt-0.5 font-mono text-[10px] tabular-nums text-ink-faint">
                          {String(i + 1).padStart(2, "0")}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="text-[13px] text-ink">{e.event}</div>
                          <div className="mt-0.5 font-mono text-[10.5px] text-ink-faint">
                            {e.actor} · {formatDateTime(e.at)}
                          </div>
                        </div>
                      </li>
                    ))}
                  </ol>
                  {record.synthid.lastDetection && (
                    <div className="border-t border-line bg-surface-2/40 px-5 py-4">
                      <div className="flex items-center justify-between gap-3">
                        <Label>Last extraction</Label>
                        <span className="font-mono text-[10.5px] tabular-nums text-mint">
                          {record.synthid.lastDetection.confidence.toFixed(2)}
                        </span>
                      </div>
                      <Meter
                        value={Math.round(record.synthid.lastDetection.confidence * 100)}
                        tone="mint"
                        className="mt-3"
                      />
                      <p className="mt-3 font-mono text-[10.5px] text-ink-faint">
                        matched · {formatDateTime(record.synthid.lastDetection.at)}
                      </p>
                    </div>
                  )}
                </Panel>
              </Reveal>
            </div>
          </div>
        </Section>
      </section>

      {/* ───────────────────────── #identity ──────────────────────────── */}
      <Section id="identity" className="scroll-mt-24">
        <SectionHead
          eyebrow="04 · The stored object"
          title={
            <>
              An <span className="serif-italic">assertion</span>, not a document.
            </>
          }
          lede="This is the entire shape CREAM persists for a verified person. Read it as a schema and the argument makes itself: there is no property here that could hold a scan."
        />

        <div className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:gap-12">
          <Reveal>
            <Panel className="overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
                <div className="flex items-center gap-2.5">
                  <Fingerprint className="size-3.5 text-caramel" />
                  <Label className="text-ink-2">IdentityVerification</Label>
                </div>
                <span className="chip font-mono text-[10px]">src/lib/domain/types.ts</span>
              </div>

              <table className="w-full border-collapse">
                <tbody className="divide-y divide-line">
                  {[
                    { f: "status", t: '"unverified" | "pending" | "verified" | "flagged" | "expired"', v: identitySample.identity.status },
                    { f: "method", t: '"digilocker" | "issuer-otp" | null', v: String(identitySample.identity.method) },
                    { f: "issuerRef", t: "string | null — hashed issuer identifier", v: identitySample.identity.issuerRef ?? "null" },
                    { f: "issuer", t: "string | null", v: identitySample.identity.issuer ?? "null" },
                    { f: "documentType", t: "string | null", v: identitySample.identity.documentType ?? "null" },
                    { f: "verifiedAt", t: "Iso | null", v: identitySample.identity.verifiedAt ? formatDateTime(identitySample.identity.verifiedAt) : "null" },
                    { f: "expiresAt", t: "Iso | null", v: identitySample.identity.expiresAt ?? "null" },
                    { f: "artefactRetained", t: "false", v: String(identitySample.identity.artefactRetained), hot: true },
                    { f: "assuranceLevel", t: '"AAL1" | "AAL2" | "AAL3" | null', v: identitySample.identity.assuranceLevel ?? "null" },
                  ].map((r) => (
                    <tr key={r.f} className="bg-surface transition-colors hover:bg-surface-2/40">
                      <td className="px-5 py-3 align-top">
                        <div className={cn("font-mono text-[12px]", r.hot ? "text-rose" : "text-ink")}>{r.f}</div>
                        <div className="mt-1 font-mono text-[10.5px] leading-relaxed text-ink-faint">{r.t}</div>
                      </td>
                      <td className="w-[38%] px-5 py-3 align-top text-right">
                        <div
                          className={cn(
                            "font-mono text-[11.5px] break-all",
                            r.hot ? "text-rose" : "text-ink-2",
                          )}
                        >
                          {r.v}
                        </div>
                        <div className="mt-1 font-mono text-[9.5px] uppercase tracking-[0.12em] text-ink-faint">
                          {identitySample.handle}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="border-t border-line bg-surface-2/40 px-5 py-4">
                <p className="text-[12.5px] leading-relaxed text-ink-muted">
                  <span className="text-rose">artefactRetained</span> is declared as the literal type{" "}
                  <code className="font-mono text-ink">false</code>. Assigning{" "}
                  <code className="font-mono text-ink">true</code> is a compile error, not a policy
                  breach — which is the only kind of guarantee that survives a deadline.
                </p>
              </div>
            </Panel>
          </Reveal>

          <div className="space-y-6">
            <Reveal delay={0.06}>
              <div className="space-y-5">
                {[
                  {
                    icon: Lock,
                    k: "Enough to investigate, not enough to be a liability",
                    b: "A masked identifier plus an issuer pointer lets a fraud investigator take a complaint back to the body that can actually answer it. It cannot be used to impersonate you, because it cannot be presented anywhere as a document.",
                  },
                  {
                    icon: ScanSearch,
                    k: "Revocation is a state, not a deletion",
                    b: "Withdrawing consent in DigiLocker marks the record expired within 24 hours. We keep the audit trail because a contract signed under a now-revoked assertion still has to be explainable years later.",
                  },
                  {
                    icon: Landmark,
                    k: "The artefact never became ours to lose",
                    b: "There is no breach scenario where a user's Aadhaar leaks from a CREAM table, because there is no column to leak from. Download your document from your own locker whenever you like; it is still there.",
                  },
                ].map((c, i) => (
                  <Reveal key={c.k} delay={0.06 + i * 0.05}>
                    <div className="flex gap-4">
                      <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-xl border border-line bg-surface text-caramel">
                        <c.icon className="size-4" />
                      </span>
                      <div>
                        <h3 className="text-[14.5px] leading-snug text-ink">{c.k}</h3>
                        <p className="mt-2 text-[13px] leading-relaxed text-ink-muted">{c.b}</p>
                      </div>
                    </div>
                  </Reveal>
                ))}
              </div>
            </Reveal>

            <Reveal delay={0.16}>
              <Panel className="p-6">
                <Label>Try the real thing</Label>
                <p className="mt-3 text-[13px] leading-relaxed text-ink-muted">
                  The walkthrough below is the same six-step flow the adapter exposes, including the
                  parts most prototypes fake — per-document selection, purpose-bound consent, and a
                  refusal that is a supported outcome rather than an error state.
                </p>
                <Button asChild variant="outline" size="md" className="mt-5">
                  <Link href="/onboarding/identity">
                    Open the identity walkthrough
                    <ArrowRight className="size-3.5" />
                  </Link>
                </Button>
              </Panel>
            </Reveal>
          </div>
        </div>
      </Section>

      {/* ─────────────────────────── close ────────────────────────────── */}
      <section className="border-t border-line">
        <div className="container-x py-20 md:py-28">
          <Reveal>
            <div className="mx-auto max-w-3xl">
              <Label>What is still a person</Label>
              <p className="mt-6 text-balance-pretty font-display text-[clamp(1.6rem,3.6vw,2.75rem)] leading-[1.08] tracking-[-0.028em]">
                Automation decides whether a signature is valid. It does not decide whether a refund
                is <span className="serif-italic text-cream-gradient">fair</span>.
              </p>
              <div className="mt-8 grid gap-5 text-[13.5px] leading-relaxed text-ink-muted sm:grid-cols-3">
                <p>
                  A CREAM review specialist still reads every dispute. They reconstruct the custody
                  log, pull the samples the creator was obliged to show, and decide whether a
                  rejection was defensible.
                </p>
                <p>
                  Cancellations are handled by a person too. The system freezes the disputed tranche
                  automatically; it does not decide who was right, and it does not release a rupee on
                  its own.
                </p>
                <p>
                  Where a rejection is upheld, the remedy is set jointly by that specialist and both
                  parties. We wrote it that way deliberately — an automated marketplace that silently
                  refunds a vendor&apos;s month is not a marketplace, it is a lottery.
                </p>
              </div>

              <div className="hairline my-10" />

              <dl className="grid grid-cols-2 gap-x-8 gap-y-7 sm:grid-cols-4">
                {[
                  { k: "Documents retained", v: "0" },
                  { k: "Credentials stored", v: "0" },
                  { k: "Refunds auto-decided", v: "0" },
                  { k: "Integrations live", v: `${live}/${integrations.length}` },
                ].map((s) => (
                  <div key={s.k}>
                    <dt className="label-xs">{s.k}</dt>
                    <dd className="mt-2 font-display text-[30px] leading-none tracking-[-0.03em] text-ink">
                      {s.v}
                    </dd>
                  </div>
                ))}
              </dl>

              <div className="mt-10 flex flex-wrap items-center gap-3">
                <Button asChild size="lg" variant="primary">
                  <Link href="/onboarding/identity">
                    Verify your account
                    <ArrowRight className="size-4" />
                  </Link>
                </Button>
                <Button asChild size="lg" variant="outline">
                  <Link href="/model">Read the data model</Link>
                </Button>
              </div>
            </div>
          </Reveal>
        </div>
      </section>
    </>
  );
}
