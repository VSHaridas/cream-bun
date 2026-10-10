"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Ban,
  Eye,
  Fingerprint,
  KeyRound,
  Landmark,
  Layers,
  Lock,
  Milestone,
  Printer,
  Quote,
  ScanLine,
  Search,
  ShieldCheck,
  Signature,
  Sparkles,
  Split,
  UserX,
} from "lucide-react";
import type {
  Brand,
  Brief,
  Contract,
  Creator,
  Escrow,
  Offer,
  PortfolioPiece,
  ProvenanceRecord,
  Workflow,
} from "@/lib/domain/types";
import {
  CHANNELS,
  MODELS,
  SKILL_TAXONOMY,
  SPECIALIZATIONS,
  TOOLS,
} from "@/lib/domain/taxonomy";
import { CONTENT_TYPES } from "@/lib/domain/types";
import { SIGNAL_META, createTrustEngine } from "@/lib/domain/trust";
import { GenerativeArt } from "@/components/media/generative-art";
import { Badge } from "@/components/ui/primitives";
import { Reveal } from "@/components/shared/motion";
import { cn, compactInr, compactNumber, inr, pct, rupees } from "@/lib/utils";

const TOOLS_VERIFIED = TOOLS.filter((t) => t.verified).length;
const MODELS_VERIFIED = MODELS.filter((m) => m.verified).length;

/* Razorpay waterfall — same rates as payoutBreakdown() in lib/integrations/razorpay.
   Recomputed locally so this client bundle never imports a node:crypto module. */
const PLATFORM_FEE_RATE = 0.08;
const TDS_RATE = 0.01;

const SLIDES = [
  { id: "title", label: "CREAM" },
  { id: "problem", label: "Problem" },
  { id: "split", label: "The split" },
  { id: "discovery", label: "Discovery" },
  { id: "brief", label: "Brief builder" },
  { id: "trust", label: "Trust" },
  { id: "lifecycle", label: "Lifecycle" },
  { id: "provenance", label: "Provenance" },
  { id: "traction", label: "Seed data" },
  { id: "close", label: "Close" },
] as const;

const EXPLAIN_REASONS = [
  "tool · Runway Gen-4 in their published pipeline",
  "aspect · 21:9 anamorphic in their portfolio",
  "signal · identity verified via DigiLocker at AAL2",
  "signal · 2 verified workflows · 9 named human checkpoints",
  "budget · ₹3.8–5.2L band against their ₹3.2L minimum",
  "fit · exclusive-category · India · 36 months",
];

/* ── small pieces ──────────────────────────────────────────────────────────── */

function Slide({
  id,
  index,
  children,
  tone = "bg-bg",
}: {
  id: string;
  index: number;
  children: React.ReactNode;
  tone?: string;
}) {
  return (
    <section
      id={`deck-slide-${id}`}
      data-index={index}
      className={cn(
        "relative flex min-h-[100svh] scroll-mt-15 snap-start flex-col justify-center border-b border-line py-20 print:min-h-0 print:break-after-page print:border-0 print:py-0",
        tone,
      )}
    >
      <div className="container-x w-full">{children}</div>
      <span className="pointer-events-none absolute bottom-5 right-5 font-mono text-[10px] tracking-[0.16em] text-ink-faint print:hidden">
        {String(index + 1).padStart(2, "0")} / {String(SLIDES.length).padStart(2, "0")}
      </span>
    </section>
  );
}

function SlideHead({
  eyebrow,
  title,
  lede,
}: {
  eyebrow: string;
  title: React.ReactNode;
  lede?: string;
}) {
  return (
    <div className="mb-10 max-w-3xl md:mb-14">
      <div className="label-xs">{eyebrow}</div>
      <h2 className="display-md mt-4">{title}</h2>
      {lede && <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-ink-muted">{lede}</p>}
    </div>
  );
}

function SlideTitle({
  eyebrow,
  title,
  lede,
}: {
  eyebrow: string;
  title: React.ReactNode;
  lede: string;
}) {
  return (
    <div className="max-w-3xl">
      <div className="label-xs">{eyebrow}</div>
      <h1 className="display-xl mt-6">{title}</h1>
      <p className="mt-7 max-w-xl text-balance-pretty text-[16.5px] leading-relaxed text-ink-2">
        {lede}
      </p>
    </div>
  );
}

function Figure({
  value,
  label,
  sub,
}: {
  value: React.ReactNode;
  label: string;
  sub?: string;
}) {
  return (
    <div className="h-full rounded-xl border border-dashed border-line bg-surface/50 p-5 print:break-inside-avoid">
      <div className="font-display text-[28px] leading-none tracking-[-0.03em] text-ink">
        {value}
      </div>
      <div className="label-xs mt-3">{label}</div>
      {sub && <div className="mt-1.5 text-[11px] leading-tight text-ink-faint">{sub}</div>}
    </div>
  );
}

function KeyValue({ k, v, tone }: { k: string; v: React.ReactNode; tone?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-line py-2.5 last:border-0">
      <span className="font-mono text-[11px] text-ink-faint">{k}</span>
      <span className={cn("text-right font-mono text-[11.5px]", tone ?? "text-ink-2")}>{v}</span>
    </div>
  );
}

/* ── page ──────────────────────────────────────────────────────────────────── */

export function DeckClient({
  creators,
  portfolio,
  workflows,
  briefs,
  brands,
  offers,
  escrows,
  provenance,
  contracts,
}: {
  creators: Creator[];
  portfolio: PortfolioPiece[];
  workflows: Workflow[];
  briefs: Brief[];
  brands: Brand[];
  offers: Offer[];
  escrows: Escrow[];
  provenance: ProvenanceRecord[];
  contracts: Contract[];
}) {
  const workflowById = React.useMemo(
    () => new Map(workflows.map((w) => [w.id, w])),
    [workflows],
  );
  const trust = React.useMemo(
    () => createTrustEngine({ portfolio, workflows: workflowById }),
    [portfolio, workflowById],
  );

  const BRIEF = briefs[0];
  const OFFER = offers[0];
  const ESCROW = escrows[0];
  const PROV = provenance[0];
  const CONTRACT = contracts.find((c) => c.kind === "engagement-start")!;
  const TRUST_AVG = Math.round(
    creators.reduce((s, c) => s + trust.assess(c).score, 0) / creators.length,
  );
  const TRUST_TOP = Math.max(...creators.map((c) => trust.assess(c).score));

  const GROSS = OFFER.amountInr;
  const FEE = Math.round(GROSS * PLATFORM_FEE_RATE);
  const CREATOR_GROSS = Math.round(GROSS - FEE);
  const TDS = Math.round(CREATOR_GROSS * TDS_RATE);
  const CREATOR_NET = CREATOR_GROSS - TDS;

  const WATERFALL = [
    { k: "Gross authorised", v: GROSS, sub: `Offer ${OFFER.code} · captured on both signatures`, tone: "ink" },
    { k: `Platform fee · ${PLATFORM_FEE_RATE * 100}%`, v: -FEE, sub: "Razorpay charge + CREAM platform fee", tone: "rose" },
    { k: "Creator gross", v: CREATOR_GROSS, sub: "Routed to the creator sub-account", tone: "mint" },
    { k: `TDS · section 194J · ${TDS_RATE * 100}%`, v: -TDS, sub: "Withheld at source, credited on filing", tone: "rose" },
    { k: "Creator net", v: CREATOR_NET, sub: "Net-15 from milestone acceptance", tone: "caramel" },
  ] as const;

  const [active, setActive] = React.useState(0);
  const [presenting, setPresenting] = React.useState(false);
  const activeRef = React.useRef(0);

  React.useEffect(() => {
    const nodes = Array.from(
      document.querySelectorAll<HTMLElement>("[data-index][id^='deck-slide-']"),
    );
    if (!nodes.length) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const idx = Number((entry.target as HTMLElement).dataset.index);
          if (Number.isFinite(idx)) {
            activeRef.current = idx;
            setActive(idx);
          }
        }
      },
      { rootMargin: "-45% 0px -45% 0px", threshold: 0 },
    );
    nodes.forEach((n) => observer.observe(n));
    return () => observer.disconnect();
  }, []);

  const goTo = React.useCallback((index: number) => {
    const clamped = Math.max(0, Math.min(SLIDES.length - 1, index));
    const node = document.getElementById(`deck-slide-${SLIDES[clamped].id}`);
    node?.scrollIntoView({ behavior: "smooth", block: "start" });
    activeRef.current = clamped;
    setActive(clamped);
  }, []);

  const step = React.useCallback(
    (dir: 1 | -1) => {
      setPresenting(true);
      goTo(activeRef.current + dir);
    },
    [goTo],
  );

  const exitPresent = React.useCallback(() => {
    setPresenting(false);
  }, []);

  const printDeck = React.useCallback(() => {
    setPresenting(false);
    window.print();
  }, []);

  React.useEffect(() => {
    const root = document.documentElement;
    if (!presenting) return;
    root.style.overflow = "hidden";
    return () => {
      root.style.overflow = "";
    };
  }, [presenting]);

  React.useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      switch (event.key) {
        case "ArrowRight":
        case "ArrowDown":
        case "j":
          event.preventDefault();
          step(1);
          break;
        case "ArrowLeft":
        case "ArrowUp":
        case "k":
          event.preventDefault();
          step(-1);
          break;
        case "Home":
          event.preventDefault();
          setPresenting(true);
          goTo(0);
          break;
        case "End":
          event.preventDefault();
          setPresenting(true);
          goTo(SLIDES.length - 1);
          break;
        case "Escape":
          exitPresent();
          break;
        case "p":
        case "P":
          event.preventDefault();
          printDeck();
          break;
        default:
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [exitPresent, goTo, printDeck, step]);

  const progress = Math.round(((active + 1) / SLIDES.length) * 100);

  return (
    <div className="print:!bg-transparent">
      {/* ───────────────────────── chrome: rail + controls ───────────────── */}
      <div className="fixed right-5 top-1/2 z-40 hidden -translate-y-1/2 flex-col items-end gap-3 lg:flex print:hidden">
        <div className="flex flex-col items-end gap-2.5">
          {SLIDES.map((s, i) => (
            <button
              key={s.id}
              type="button"
              onClick={() => goTo(i)}
              aria-label={`Go to slide ${i + 1}: ${s.label}`}
              aria-current={active === i}
              className="group flex items-center justify-end gap-2.5"
            >
              <span
                className={cn(
                  "font-mono text-[10px] uppercase tracking-[0.12em] transition-all duration-300",
                  active === i
                    ? "text-ink-2 opacity-100"
                    : "text-ink-faint opacity-0 group-hover:opacity-100",
                )}
              >
                {s.label}
              </span>
              <span
                className={cn(
                  "block h-px transition-all duration-300",
                  active === i ? "w-8 bg-caramel" : "w-4 bg-line-strong group-hover:w-6",
                )}
              />
            </button>
          ))}
        </div>
        <div className="font-mono text-[10px] tabular-nums tracking-[0.14em] text-ink-faint">
          {String(progress).padStart(3, "0")}%
        </div>
      </div>

      <div className="fixed bottom-5 left-1/2 z-40 flex -translate-x-1/2 items-center gap-1.5 rounded-full border border-line bg-surface/85 px-2 py-1.5 backdrop-blur-xl print:hidden">
        <button
          type="button"
          onClick={() => step(-1)}
          disabled={active === 0}
          className="grid size-7 place-items-center rounded-full text-ink-muted transition-colors hover:bg-surface-3 hover:text-ink disabled:opacity-30"
          aria-label="Previous slide"
        >
          <ArrowLeft className="size-3.5" />
        </button>
        <span className="px-1.5 font-mono text-[10px] tabular-nums tracking-[0.1em] text-ink-faint">
          {String(active + 1).padStart(2, "0")} / {String(SLIDES.length).padStart(2, "0")}
        </span>
        <button
          type="button"
          onClick={() => step(1)}
          disabled={active === SLIDES.length - 1}
          className="grid size-7 place-items-center rounded-full text-ink-muted transition-colors hover:bg-surface-3 hover:text-ink disabled:opacity-30"
          aria-label="Next slide"
        >
          <ArrowRight className="size-3.5" />
        </button>
        <span aria-hidden className="mx-1 h-4 w-px bg-line" />
        <button
          type="button"
          onClick={printDeck}
          className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.1em] text-ink-muted transition-colors hover:bg-surface-3 hover:text-ink"
        >
          <Printer className="size-3" />
          Print
        </button>
      </div>

      {presenting && (
        <div className="fixed left-5 top-20 z-40 inline-flex items-center gap-2 rounded-full border border-caramel/40 bg-caramel/10 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-caramel print:hidden">
          <span className="size-1.5 animate-pulse rounded-full bg-caramel" />
          Presenting · esc to exit
        </div>
      )}

      <p className="sr-only print:hidden">
        Use the left and right arrow keys, or j and k, to move between slides. Press Escape to
        return to normal scrolling and P to open the print dialog.
      </p>

      {/* ───────────────────────────── 01 · title ────────────────────────── */}
      <Slide id="title" index={0}>
        <div className="grid items-center gap-12 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            <div className="mb-8 inline-flex items-center gap-2.5 rounded-full border border-line bg-surface/70 py-1 pl-1 pr-4 backdrop-blur">
              <span className="rounded-full bg-caramel px-2 py-[3px] font-mono text-[9.5px] uppercase tracking-[0.14em] text-[oklch(0.18_0.02_60)]">
                Prototype · seed data
              </span>
              <span className="text-[12px] text-ink-muted">
                {creators.length} creators · {portfolio.length} works · {TOOLS.length} tools
              </span>
            </div>
            <SlideTitle
              eyebrow="CREAM · AI creator marketplace"
              title={
                <>
                  The <span className="serif-italic text-cream-gradient">cream</span> layer of AI
                  creative talent.
                </>
              }
              lede="Existing marketplaces treat AI creators like interchangeable gig workers. CREAM treats them like a technical vendor — published workflows, named tools, verified delivery history, and a brief specific enough to quote against."
            />
            <div className="mt-10 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  setPresenting(true);
                  goTo(1);
                }}
                className="inline-flex items-center gap-2 rounded-full bg-caramel px-6 py-3 text-[14px] font-medium text-[oklch(0.18_0.02_60)] transition-all hover:brightness-108"
              >
                Start the deck
                <ArrowRight className="size-4" />
              </button>
              <Link
                href="/model"
                className="inline-flex items-center gap-2 rounded-full border border-line-strong px-6 py-3 text-[14px] text-ink transition-colors hover:bg-surface-2"
              >
                Read the data model
                <ArrowUpRight className="size-3.5" />
              </Link>
            </div>
          </div>

          <div className="relative">
            <div
              aria-hidden
              className="absolute -inset-8 -z-10 rounded-[32px] bg-[radial-gradient(60%_60%_at_60%_30%,color-mix(in_oklab,var(--caramel)_16%,transparent),transparent_70%)] blur-2xl"
            />
            <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-e4">
              <div className="relative aspect-[16/10]">
                <GenerativeArt
                  seed={portfolio[0].artSeed}
                  palette={portfolio[0].palette}
                  ratio="16/10"
                  chrome
                  className="size-full"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-surface via-surface/25 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 flex items-end justify-between p-5">
                  <div>
                    <div className="label-xs">{portfolio[0].client}</div>
                    <div className="mt-1.5 font-display text-[21px] leading-tight tracking-[-0.02em] text-ink">
                      {portfolio[0].title}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="label-xs">Trust</div>
                    <div className="mt-1.5 font-display text-[26px] leading-none text-mint">
                      {TRUST_TOP}
                    </div>
                  </div>
                </div>
              </div>
              <div className="space-y-2.5 p-5">
                {[
                  ["Toolchain", "Veo 3 · Gen-4 · FLUX 1.1 Pro · Nuke 16"],
                  ["Human checkpoints", "5 named decisions in the published pipeline"],
                  ["Provenance", "C2PA 1.3 manifest + extractable watermark"],
                ].map(([k, v]) => (
                  <div key={k} className="flex items-baseline gap-3">
                    <span className="w-[38%] shrink-0 font-mono text-[10px] uppercase tracking-[0.12em] text-ink-faint">
                      {k}
                    </span>
                    <span className="text-[12.5px] leading-snug text-ink-2">{v}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </Slide>

      {/* ──────────────────────────── 02 · problem ──────────────────────── */}
      <Slide id="problem" index={1} tone="bg-bg-deep/35">
        <SlideHead
          eyebrow="02 · Problem"
          title={
            <>
              AI marketplaces fail on four things, and none of them are{" "}
              <span className="serif-italic">generation</span>.
            </>
          }
          lede="The generation was never the hard part. It is now a commodity with a ninety-second demo. Everything a brand actually has to decide happens after the first frame exists."
        />
        <div className="grid gap-4 md:grid-cols-2">
          {[
            {
              icon: UserX,
              q: "A brand cannot verify capability.",
              a: "Portfolios are images and reviews are adjectives. Nothing distinguishes someone who has shipped a 55-second anamorphic film from someone who rendered a mood frame last Tuesday.",
              stat: `${creators.length} profiles, ${TRUST_AVG} avg trust score, ${TOOLS_VERIFIED}/${TOOLS.length} tools vendor-credentialed`,
            },
            {
              icon: Layers,
              q: "A brand cannot understand the toolchain.",
              a: "Nobody publishes the pipeline. The creator says ‘AI video’ and the buyer has no idea whether that means one prompt or thirty hours of previz, comp and grade.",
              stat: `${workflows.length} published workflows · ${SKILL_TAXONOMY.length} craft skills · ${MODELS_VERIFIED}/${MODELS.length} models verified`,
            },
            {
              icon: Lock,
              q: "A brand cannot manage the licensing.",
              a: "Rights get handled in an email thread, which means exclusivity, territory, duration and model-training consent are all unenforced and unattributed.",
              stat: `${CHANNELS.length} channels · 4 exclusivity tiers · 13-field CommercialUse struct`,
            },
            {
              icon: Split,
              q: "A brand cannot collaborate across generations.",
              a: "Chat transcripts die with the chat. The creator receives a summary written by somebody else, argues with the summary, and three rounds are lost before anyone draws anything.",
              stat: `${briefs.length} briefs · ${briefs[0].deliverables.length} deliverables per brief · transcript persisted verbatim`,
            },
          ].map((c, i) => (
            <Reveal key={c.q} delay={i * 0.05}>
              <div className="h-full rounded-xl border border-line bg-surface p-7">
                <span className="grid size-9 place-items-center rounded-lg border border-line bg-surface-2 text-caramel">
                  <c.icon className="size-4" />
                </span>
                <h3 className="mt-5 font-display text-[21px] leading-snug tracking-[-0.02em] text-ink">
                  {c.q}
                </h3>
                <p className="mt-3 text-[13.5px] leading-relaxed text-ink-muted">{c.a}</p>
                <div className="mt-5 border-t border-line pt-4 font-mono text-[10.5px] leading-relaxed text-ink-faint">
                  {c.stat}
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </Slide>

      {/* ───────────────────────────── 03 · split ────────────────────────── */}
      <Slide id="split" index={2}>
        <SlideHead
          eyebrow="03 · The split"
          title={
            <>
              AI converses, programs <span className="serif-italic">query</span>, AI explains.
            </>
          }
          lede="Models hold context and cannot query an enormous, continuously-changing pool without overflowing or inventing. Programs can query and cannot understand a vague requirement. We stop pretending one system can do both."
        />
        <div className="grid gap-px overflow-hidden rounded-xl border border-line bg-line md:grid-cols-3">
          {[
            {
              n: "01",
              role: "Model — conversation",
              does: [
                "Extracts a structured brief from badly-worded intent",
                "Never queries the creator pool",
                "Never invents a creator, a price or an availability",
              ],
              tone: "var(--violet)",
            },
            {
              n: "02",
              role: "Program — query",
              does: [
                "Runs the filters a buyer actually set",
                "Ranks and explains every hit",
                "Cannot hallucinate, because it cannot generate",
              ],
              tone: "var(--caramel)",
            },
            {
              n: "03",
              role: "Model — explanation",
              does: [
                "Restates the brief in second person for the creator",
                "Answers ‘why did this match?’ in plain language",
                "Preserves the original conversation verbatim",
              ],
              tone: "var(--mint)",
            },
          ].map((s) => (
            <div key={s.n} className="relative bg-surface p-7 print:break-inside-avoid">
              <div
                className="absolute inset-x-0 top-0 h-px"
                style={{ background: `linear-gradient(90deg, transparent, ${s.tone}, transparent)` }}
              />
              <div className="font-mono text-[11px] tracking-[0.14em]" style={{ color: s.tone }}>
                {s.n}
              </div>
              <div className="mt-4 font-display text-[21px] leading-tight tracking-[-0.02em] text-ink">
                {s.role}
              </div>
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
        <Reveal>
          <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-3 rounded-xl border border-dashed border-line bg-surface/50 px-6 py-5 print:bg-transparent">
            <Fingerprint className="size-4 shrink-0 text-caramel" />
            <p className="flex-1 text-[13.5px] leading-relaxed text-ink-muted">
              The differentiator sits between 01 and 02:{" "}
              <span className="text-ink">
                the exact brief conversation is persisted and re-hydrated on the creator&apos;s side
              </span>
              , so a creator receives the full intent rather than a lossy summary written by
              somebody else.
            </p>
          </div>
        </Reveal>
      </Slide>

      {/* ─────────────────────────── 04 · discovery ──────────────────────── */}
      <Slide id="discovery" index={3} tone="bg-bg-deep/35">
        <SlideHead
          eyebrow="04 · Product — Discovery"
          title={
            <>
              Faceted, ranked, and <span className="serif-italic">explained</span>.
            </>
          }
          lede="Nine facet axes over the live pool. Every card tells you which filters it matched, because a ranked list you cannot interrogate is just an opinion."
        />

        <div className="grid gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:gap-14">
          <div>
            <div className="space-y-2.5">
              {[
                { k: "Skills", v: SKILL_TAXONOMY.length, s: "art direction → colour → narrative" },
                { k: "Tools", v: TOOLS.length, s: `${TOOLS_VERIFIED} vendor-credentialed` },
                { k: "Models", v: MODELS.length, s: `${MODELS_VERIFIED} verified` },
                { k: "Specialisations", v: SPECIALIZATIONS.length, s: "fashion → jewellery" },
                { k: "Content types", v: CONTENT_TYPES.length, s: "12 across 4 categories" },
                { k: "Trust signals", v: Object.keys(SIGNAL_META).length, s: "6 kinds, 4 tiers" },
                { k: "Creators in pool", v: creators.length, s: `${TRUST_AVG} avg trust score` },
                { k: "Works published", v: portfolio.length, s: "each with signed provenance" },
              ].map((f) => (
                <div key={f.k} className="flex items-baseline gap-4 border-b border-line pb-2.5">
                  <span className="w-[42%] shrink-0 text-[13px] text-ink-2">{f.k}</span>
                  <span className="font-display text-[20px] leading-none text-caramel">{f.v}</span>
                  <span className="flex-1 text-right text-[11px] text-ink-faint">{f.s}</span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <div className="rounded-xl border border-line bg-surface p-6">
              <div className="flex items-center gap-2.5">
                <Search className="size-3.5 text-ink-faint" />
                <span className="font-mono text-[11.5px] text-ink-2">
                  cinematic fashion film under 3L, 10 days, available now
                </span>
              </div>
              <div className="hairline my-4" />
              <div className="flex flex-wrap gap-1.5">
                {[
                  { t: "specializations: Fashion & apparel", tone: "caramel" },
                  { t: "contentTypes: cinematic-video", tone: "caramel" },
                  { t: "maxDayRate: 300000", tone: "caramel" },
                  { t: "maxTurnaround: 10", tone: "caramel" },
                  { t: "availability: open", tone: "mint" },
                ].map((f) => (
                  <span key={f.t} className={cn("chip font-mono !text-[10px]", f.tone === "mint" && "chip-active")}>
                    {f.t}
                  </span>
                ))}
              </div>
              <p className="mt-4 text-[12px] leading-relaxed text-ink-faint">
                <span className="text-ink-2">interpretQuery()</span> parsed this on the client, on
                keystroke, with no network call. It is a deterministic parser — budget expressions
                including lakh and crore, then a clamp to sane bounds — which is the only reason it
                can run on every character.
              </p>
            </div>

            <div className="mt-5 rounded-xl border border-line bg-surface p-6">
              <div className="flex items-baseline justify-between gap-4">
                <div>
                  <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-faint">
                    Result 1 of 4
                  </div>
                  <div className="mt-2 font-display text-[22px] tracking-[-0.02em] text-ink">
                    {creators[0].displayName} · {creators[0].studioName}
                  </div>
                </div>
                <div className="text-right">
                  <div className="label-xs">Trust</div>
                  <div className="mt-1 font-display text-[24px] leading-none text-mint">
                    {trust.assess(creators[0]).score}
                  </div>
                </div>
              </div>
              <div className="mt-4 space-y-1.5 border-t border-line pt-4">
                {EXPLAIN_REASONS.map((r) => (
                  <div key={r} className="flex items-baseline gap-2.5">
                    <span className="size-1 shrink-0 translate-y-[-2px] rounded-full bg-caramel" />
                    <span className="font-mono text-[11px] leading-relaxed text-ink-muted">{r}</span>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex flex-wrap gap-1.5 border-t border-line pt-4">
                {creators[0].aspectRatios.map((a) => (
                  <span key={a} className="chip font-mono !text-[10px]">
                    {a}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </Slide>

      {/* ────────────────────────── 05 · brief builder ───────────────────── */}
      <Slide id="brief" index={4}>
        <SlideHead
          eyebrow="05 · Product — Brief builder"
          title={
            <>
              A sentence in. <span className="serif-italic">Twenty-seven</span> typed fields out.
            </>
          }
          lede={`${BRIEF.code} · ${BRIEF.brandName} · ${BRIEF.status}. Everything below was extracted from a conversation, then edited by a human before it became a query.`}
        />

        <div className="grid gap-4 lg:grid-cols-[1fr_auto_1fr] lg:items-stretch lg:gap-6">
          <div className="rounded-xl border border-line bg-surface p-6">
            <div className="label-xs flex items-center gap-2">
              <Quote className="size-3" />
              Unstructured in
            </div>
            <p className="mt-4 font-display text-[19px] italic leading-snug tracking-[-0.01em] text-ink">
              “{BRIEF.rawIdea}”
            </p>
            <div className="mt-5 space-y-2 border-t border-line pt-4">
              {[
                ["Turn", "7 turns in 12 minutes"],
                ["Brand turns", "3"],
                ["Assistant turns", "4"],
                ["Fields extracted live", "referenceNotes, rawIdea, commercialUse, budget, timeline"],
              ].map(([k, v]) => (
                <KeyValue key={k} k={k} v={v} />
              ))}
            </div>
          </div>

          <div className="flex items-center justify-center lg:w-16">
            <span aria-hidden className="hidden h-px w-full bg-line lg:block" />
            <span className="grid size-9 place-items-center rounded-full border border-caramel/40 bg-caramel/10 text-caramel">
              <ArrowRight className="size-4" />
            </span>
            <span aria-hidden className="hidden h-px w-full bg-line lg:block" />
          </div>

          <div className="rounded-xl border border-line bg-surface p-6">
            <div className="label-xs flex items-center gap-2">
              <ScanLine className="size-3" />
              Structured out · editable field by field
            </div>
            <div className="mt-4 space-y-2">
              {[
                ["campaignObjective", BRIEF.campaignObjective.slice(0, 52) + "…"],
                ["audience", BRIEF.audience.slice(0, 40) + "…"],
                ["tone", BRIEF.tone.join(" · ")],
                ["styleTags", BRIEF.styleTags.join(" · ")],
                ["excludedStyles", `${BRIEF.excludedStyles.length} written down`],
                ["deliverables", BRIEF.deliverables.map((d) => `${d.quantity}× ${d.contentType}`).join(", ")],
                ["budget", `${compactInr(BRIEF.budget.minInr)}–${compactInr(BRIEF.budget.maxInr)} · ${BRIEF.budget.model}`],
                ["territory", `${BRIEF.commercialUse.territory} · ${BRIEF.commercialUse.durationMonths}mo`],
                ["channels", `${BRIEF.commercialUse.channels.length} channels`],
                ["mustHaveSignals", BRIEF.mustHaveSignals.length + " of 6 required"],
              ].map(([k, v]) => (
                <KeyValue key={k} k={k} v={v} />
              ))}
            </div>
          </div>
        </div>

        <Reveal delay={0.06}>
          <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-3 rounded-xl border border-dashed border-line bg-surface/50 px-6 py-5 print:bg-transparent">
            <Sparkles className="size-4 shrink-0 text-caramel" />
            <p className="flex-1 text-[13.5px] leading-relaxed text-ink-muted">
              <span className="text-ink">Nothing was guessed.</span> Every value on the right can
              be traced to a specific turn in the transcript, and the brand edits the draft before it
              becomes a query. {brands.length} seeded brands,{" "}
              {compactInr(brands.reduce((s, b) => s + b.totalSpendInr, 0))} of recorded spend.
            </p>
          </div>
        </Reveal>
      </Slide>

      {/* ───────────────────────────── 06 · trust ────────────────────────── */}
      <Slide id="trust" index={5} tone="bg-bg-deep/35">
        <SlideHead
          eyebrow="06 · Product — Trust"
          title={
            <>
              Four objections, four one-line <span className="serif-italic">answers</span>.
            </>
          }
          lede="Every sensitive capability is delegated to a third party we do not control. What we keep is the orchestration, the contracts and the provenance."
        />

        <div className="grid gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-2">
          {[
            {
              icon: KeyRound,
              q: "Why should I trust you with my account?",
              a: "We do not have your password.",
              tag: "Supabase Auth",
            },
            {
              icon: Landmark,
              q: "Why would I give you my government ID?",
              a: "You do not give it to us.",
              tag: "DigiLocker",
            },
            {
              icon: ShieldCheck,
              q: "What stops a fraudulent transaction?",
              a: "Money never sits in our balance.",
              tag: "Razorpay Route",
            },
            {
              icon: Ban,
              q: "Doesn't encryption stop misuse downstream?",
              a: "Correct. It can't — hence three marks.",
              tag: "SynthID + C2PA",
            },
          ].map((c) => (
            <div key={c.q} className="bg-surface p-6 print:break-inside-avoid">
              <div className="flex items-start justify-between gap-4">
                <span className="grid size-9 place-items-center rounded-lg border border-line bg-surface-2 text-caramel">
                  <c.icon className="size-4" />
                </span>
                <Badge tone="neutral" className="font-mono !text-[9.5px]">
                  {c.tag}
                </Badge>
              </div>
              <div className="mt-4 text-[13px] leading-snug text-ink-muted">{c.q}</div>
              <div className="mt-2 font-display text-[19px] leading-snug tracking-[-0.015em] text-caramel">
                {c.a}
              </div>
            </div>
          ))}
        </div>

        <Reveal delay={0.06}>
          <div className="mt-6 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="rounded-xl border border-line bg-surface p-6">
              <div className="flex items-baseline justify-between gap-4">
                <div className="font-display text-[19px] tracking-[-0.02em] text-ink">
                  The score mechanic
                </div>
                <Badge tone="mint">only verified counts</Badge>
              </div>
              <div className="mt-5 space-y-2.5">
                {trust.signalsFor(creators[0]).map((s) => (
                  <div key={s.id} className="flex items-center gap-3">
                    <span className="w-[110px] shrink-0 font-mono text-[10.5px] uppercase tracking-[0.1em] text-ink-faint">
                      {SIGNAL_META[s.kind].label}
                    </span>
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-3">
                      <div
                        className={cn(
                          "h-full rounded-full",
                          s.tier === "verified" ? "bg-mint" : "bg-line-strong",
                        )}
                        style={{ width: `${(s.weight / 26) * 100}%` }}
                      />
                    </div>
                    <span
                      className={cn(
                        "w-9 shrink-0 text-right font-mono text-[10.5px] tabular-nums",
                        s.tier === "verified" ? "text-mint" : "text-ink-faint line-through",
                      )}
                    >
                      {s.weight}
                    </span>
                  </div>
                ))}
              </div>
              <p className="mt-5 border-t border-line pt-4 text-[12.5px] leading-relaxed text-ink-muted">
                {creators[0].displayName} scores{" "}
                <span className="text-ink">{trust.assess(creators[0]).score}</span> of a possible
                100. Attested claims are displayed honestly and score{" "}
                <span className="text-rose">zero</span>, because a self-reported claim is not
                evidence. Every signal is derived from the same records that power search, so a
                creator cannot claim a credential the platform cannot point at.
              </p>
            </div>
            <div className="rounded-xl border border-line bg-surface p-6">
              <div className="font-display text-[19px] tracking-[-0.02em] text-ink">
                The four numbers a brand actually asks
              </div>
              <div className="mt-5 space-y-4">
                {[
                  ["On-time delivery", pct(creators[0].stats.onTimeRate), "from escrow releases"],
                  ["Approved first pass", pct(creators[0].stats.approvalRate), "from client sign-offs"],
                  ["Repeat clients", pct(creators[0].stats.repeatClientRate), "from closed engagements"],
                  ["Median reply", `${creators[0].stats.responseMinutes}m`, "across the pool"],
                ].map(([k, v, s]) => (
                  <div key={k}>
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="text-[12.5px] text-ink-2">{k}</span>
                      <span className="font-display text-[20px] leading-none text-mint">{v}</span>
                    </div>
                    <div className="mt-1.5 font-mono text-[10px] text-ink-faint">{s}</div>
                  </div>
                ))}
              </div>
              <p className="mt-5 border-t border-line pt-4 text-[12px] leading-relaxed text-ink-faint">
                None of these can be typed into a profile. They are computed from money that
                actually moved.
              </p>
            </div>
          </div>
        </Reveal>
      </Slide>

      {/* ─────────────────────────── 07 · lifecycle ──────────────────────── */}
      <Slide id="lifecycle" index={6}>
        <SlideHead
          eyebrow="07 · Product — Engagement lifecycle"
          title={
            <>
              Nothing moves until a <span className="serif-italic">contract</span> is signed.
            </>
          }
          lede={`${CONTRACT.code} · ${CONTRACT.kind} · signed by both parties, ${CONTRACT.humanReviewed ? "human reviewed" : "awaiting review"}. Escrow is capture-on-signature, release-on-milestone.`}
        />

        <div className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:gap-12">
          <div>
            <div className="flex flex-wrap gap-1.5">
              {[
                { t: "draft", on: false },
                { t: "sent", on: false },
                { t: "opened", on: false },
                { t: "negotiating", on: false },
                { t: "accepted", on: true },
                { t: "in-production", on: true },
                { t: "client-review", on: false },
                { t: "delivered", on: false },
                { t: "closed", on: false },
              ].map((s) => (
                <span
                  key={s.t}
                  className={cn(
                    "rounded-full border px-2.5 py-1 font-mono text-[9.5px] uppercase tracking-[0.1em]",
                    s.on ? "border-caramel/45 bg-caramel/10 text-caramel" : "border-line text-ink-faint",
                  )}
                >
                  {s.t}
                </span>
              ))}
            </div>

            <div className="mt-6 rounded-xl border border-line bg-surface p-6">
              <div className="flex items-baseline justify-between gap-4">
                <div className="font-display text-[19px] tracking-[-0.02em] text-ink">
                  Milestone ladder
                </div>
                <div className="font-mono text-[11px] text-ink-faint">{OFFER.code}</div>
              </div>
              <div className="mt-5 space-y-3">
                {OFFER.milestones.map((m) => {
                  const amount = Math.round((OFFER.amountInr * m.pct) / 100);
                  const done = amount <= ESCROW.releasedInr;
                  return (
                    <div key={m.label}>
                      <div className="flex items-baseline justify-between gap-4">
                        <span className="text-[13px] text-ink-2">{m.label}</span>
                        <span
                          className={cn(
                            "font-mono text-[11.5px]",
                            done ? "text-mint" : "text-ink-faint",
                          )}
                        >
                          {pct(m.pct)} · {rupees(amount)}
                        </span>
                      </div>
                      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-3">
                        <div
                          className={cn(
                            "h-full rounded-full",
                            done ? "bg-mint" : "bg-caramel/50",
                          )}
                          style={{ width: `${m.pct}%` }}
                        />
                      </div>
                      <div className="mt-1 font-mono text-[10px] text-ink-faint">
                        due day {m.dueDay}
                        {done ? " · accepted" : ""}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="mt-5 flex items-baseline justify-between gap-4 border-t border-line pt-4">
                <span className="font-mono text-[11px] text-ink-faint">
                  {ESCROW.status} · {ESCROW.gateway}
                </span>
                <span className="font-mono text-[11.5px] text-ink-2">
                  {rupees(ESCROW.releasedInr)} of {rupees(ESCROW.amountInr)} released
                </span>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-line bg-surface p-6 md:p-7">
            <div className="flex items-center gap-2.5">
              <Milestone className="size-4 text-caramel" />
              <div className="font-display text-[19px] tracking-[-0.02em] text-ink">
                Escrow waterfall
              </div>
            </div>
            <p className="mt-2 font-mono text-[11px] text-ink-faint">
              payoutBreakdown({inr(GROSS)}) · 8% platform · 1% TDS under 194J
            </p>
            <div className="mt-6 space-y-3">
              {WATERFALL.map((row, i) => (
                <div key={row.k} className="relative">
                  {i < WATERFALL.length - 1 && (
                    <span
                      aria-hidden
                      className="absolute left-[6px] top-6 h-[calc(100%+0.75rem)] w-px bg-line"
                    />
                  )}
                  <div className="relative flex items-center gap-3.5">
                    <span
                      className={cn(
                        "z-10 size-3 shrink-0 rounded-full border-2 border-surface",
                        row.tone === "mint"
                          ? "bg-mint"
                          : row.tone === "rose"
                            ? "bg-rose"
                            : row.tone === "caramel"
                              ? "bg-caramel"
                              : "bg-ink",
                      )}
                    />
                    <div className="flex-1">
                      <div className="text-[13px] text-ink-2">{row.k}</div>
                      <div className="mt-0.5 text-[11px] text-ink-faint">{row.sub}</div>
                    </div>
                    <div
                      className={cn(
                        "font-mono text-[13px] tabular-nums",
                        row.v < 0 ? "text-rose" : row.tone === "mint" ? "text-mint" : "text-ink",
                      )}
                    >
                      {row.v < 0 ? "−" : ""}
                      {inr(Math.abs(row.v))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-6 border-t border-line pt-4 text-[12.5px] leading-relaxed text-ink-muted">
              Razorpay holds the funds the whole time. Neither party&apos;s card, UPI or bank
              credential reaches our servers, and a dispute freezes the disputed tranche only —
              {rupees(ESCROW.amountInr - ESCROW.releasedInr)} stays held while the{" "}
              {rupees(ESCROW.releasedInr)} already accepted continues to settle net-15.
            </p>
            <div className="mt-4 flex flex-wrap gap-1.5">
              {["UPI", "Card", "Net banking", "Wallet"].map((m) => (
                <span key={m} className="chip font-mono !text-[10px]">
                  {m}
                </span>
              ))}
            </div>
          </div>
        </div>
      </Slide>

      {/* ───────────────────────── 08 · provenance ──────────────────────── */}
      <Slide id="provenance" index={7} tone="bg-bg-deep/35">
        <SlideHead
          eyebrow="08 · Product — Provenance"
          title={
            <>
              Three watermark layers, because encryption{" "}
              <span className="serif-italic">cannot stop theft</span>.
            </>
          }
          lede={`Written per asset, at release, and signed. Asset ${PROV.assetName} · ${PROV.chainOfCustody.length} custody events.`}
        />
        <div className="grid gap-4 md:grid-cols-3">
          {[
            {
              icon: Signature,
              k: "C2PA manifest",
              t: `Signed, machine-readable, v${PROV.c2pa.version}`,
              b: "The claim any third party can verify without asking us. It carries CREAM's own humanCheckpoints and toolChain assertions — provenance that only records the model is not provenance.",
              lines: [
                `claimGenerator ${PROV.c2pa.claimGenerator}`,
                `issuer ${PROV.c2pa.certificateIssuer}`,
                `${PROV.c2pa.assertions.length} assertions`,
              ],
            },
            {
              icon: Eye,
              k: "Invisible watermark",
              t: "Survives a screenshot",
              b: "Imperceptible but extractable, so a leaked asset can be proven rather than merely suspected. This is the layer that does the actual work, because it survives the crop and the re-encode.",
              lines: [
                `payload ${PROV.synthid.payloadId}`,
                `strength ${PROV.synthid.strength} · extractable`,
                `last detection ${PROV.synthid.lastDetection?.confidence} confidence`,
              ],
            },
            {
              icon: Fingerprint,
              k: "Visible burn-in",
              t: "Dual-branded, pre-approval only",
              b: "CREAM and the creator, both named on the frame. Blunt, but it is the only layer a human reacts to, and it comes off the final master at approval and never before.",
              lines: [
                `platform ${PROV.visible.platformWatermark}`,
                `creator ${PROV.visible.creatorWatermark}`,
                `${PROV.visible.position} · opacity ${PROV.visible.opacity}`,
              ],
            },
          ].map((p, i) => (
            <Reveal key={p.k} delay={i * 0.05}>
              <div className="flex h-full flex-col rounded-xl border border-line bg-surface p-6 print:break-inside-avoid">
                <span className="grid size-9 place-items-center rounded-lg border border-line bg-surface-2 text-caramel">
                  <p.icon className="size-4" />
                </span>
                <div className="mt-5 font-mono text-[10.5px] uppercase tracking-[0.13em] text-ink-faint">
                  {p.k}
                </div>
                <div className="mt-1.5 font-display text-[20px] leading-tight tracking-[-0.02em] text-ink">
                  {p.t}
                </div>
                <p className="mt-3 flex-1 text-[13px] leading-relaxed text-ink-muted">{p.b}</p>
                <div className="mt-4 space-y-1 rounded-lg border border-line bg-surface-2/40 p-3">
                  {p.lines.map((l) => (
                    <div key={l} className="truncate font-mono text-[10px] text-ink-faint">
                      {l}
                    </div>
                  ))}
                </div>
              </div>
            </Reveal>
          ))}
        </div>
        <Reveal delay={0.16}>
          <div className="mt-6 rounded-xl border border-line bg-surface p-6 print:break-inside-avoid">
            <div className="label-xs mb-4">Chain of custody · {PROV.assetName}</div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {PROV.chainOfCustody.map((c, i) => (
                <div key={`${c.event}-${i}`} className="relative rounded-lg border border-line bg-surface-2/40 p-3.5">
                  <div className="font-mono text-[10px] text-caramel">
                    {c.at.slice(11, 19)} UTC
                  </div>
                  <div className="mt-1.5 text-[12.5px] text-ink-2">{c.event}</div>
                  <div className="mt-1 font-mono text-[10px] text-ink-faint">{c.actor}</div>
                </div>
              ))}
            </div>
          </div>
        </Reveal>
      </Slide>

      {/* ───────────────────────── 09 · seed data ───────────────────────── */}
      <Slide id="traction" index={8}>
        <SlideHead
          eyebrow="09 · Seed data"
          title={
            <>
              What a <span className="serif-italic">prototype</span> looks like at rest.
            </>
          }
          lede="Every number on this slide is invented-but-plausible and exists to size the prototype. Nothing here is a traction claim, and it is labelled as such wherever it appears."
        />

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { v: compactInr(12400000), k: "Routed through escrow", s: "prototype seed target" },
            { v: `${creators.length}`, k: "Creators onboarded", s: "6 regions, 4 languages + dubbing" },
            { v: `${portfolio.length}`, k: "Published works", s: "each with a signed manifest" },
            { v: `${compactNumber(48200000)}`, k: "Reach on portfolio", s: "sum of view counts, not uniques" },
            { v: "22m", k: "Median first reply", s: "across the pool" },
            { v: `${workflows.length}`, k: "Verified workflows", s: "auditable pipelines" },
            { v: "100%", k: "Held until milestone", s: "never on our balance sheet" },
            { v: "0", k: "Credentials stored", s: "no card, no ID, no password" },
          ].map((f, i) => (
            <Reveal key={f.k} delay={i * 0.04}>
              <Figure value={f.v} label={f.k} sub={f.s} />
            </Reveal>
          ))}
        </div>

        <Reveal delay={0.18}>
          <div className="mt-6 grid gap-4 md:grid-cols-2 print:break-inside-avoid">
            <div className="rounded-xl border border-line bg-surface p-6">
              <div className="flex items-center gap-2.5">
                <Eye className="size-4 text-caramel" />
                <div className="font-display text-[18px] tracking-[-0.02em] text-ink">
                  What it costs to run
                </div>
              </div>
              <div className="mt-4 space-y-2">
                {[
                  ["Model inference per brief", "₹0 — extraction runs on the client and on keys the brand supplies"],
                  ["Escrow float", "₹0 — Razorpay holds the funds; we never carry a balance"],
                  ["Identity verification", "₹0 — DigiLocker pulls are issuer-side"],
                  ["Per-asset provenance", "seconds of compute; no storage cost at prototype volume"],
                ].map(([k, v]) => (
                  <KeyValue key={k} k={k} v={v} />
                ))}
              </div>
            </div>
            <div className="rounded-xl border border-line bg-surface p-6">
              <div className="flex items-center gap-2.5">
                <Ban className="size-4 text-caramel" />
                <div className="font-display text-[18px] tracking-[-0.02em] text-ink">
                  What is genuinely hard
                </div>
              </div>
              <ul className="mt-4 space-y-2.5">
                {[
                  "Substantiating a workflow claim at scale without turning review into a bottleneck",
                  "Priced rights, not free-text promises — the hardest negotiation on the platform",
                  "Keeping derived trust signals honest as the pool grows past the seed set",
                ].map((t) => (
                  <li key={t} className="flex gap-2.5 text-[13px] leading-relaxed text-ink-muted">
                    <span className="mt-[7px] block size-1 shrink-0 rounded-full bg-caramel" />
                    {t}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Reveal>
      </Slide>

      {/* ───────────────────────────── 10 · close ───────────────────────── */}
      <Slide id="close" index={9}>
        <div className="mx-auto max-w-4xl text-center">
          <Reveal>
            <div className="label-xs">10 · Close</div>
            <h2 className="mt-7 font-display text-[clamp(2rem,5.4vw,4.25rem)] leading-[1.02] tracking-[-0.035em] text-balance-pretty">
              The interesting part was never the generation. It was making the{" "}
              <span className="serif-italic text-cream-gradient">trust</span> legible.
            </h2>
            <p className="mt-7 max-w-xl text-balance-pretty text-[15.5px] leading-relaxed text-ink-muted">
              {TRUST_AVG} average trust score across {creators.length} creators, {TOOLS.length} tools,{" "}
              {workflows.length} published workflows, {briefs.length} briefs and {rupees(GROSS)}{" "}
              held in a regulator&apos;s custody rather than ours. Print this deck, or read the field
              notes behind every claim in it.
            </p>
          </Reveal>
          <Reveal delay={0.1}>
            <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
              <Link
                href="/model"
                className="inline-flex items-center gap-2 rounded-full bg-caramel px-6 py-3 text-[14px] font-medium text-[oklch(0.18_0.02_60)] transition-all hover:brightness-108"
              >
                Read the data model
                <ArrowRight className="size-4" />
              </Link>
              <button
                type="button"
                onClick={printDeck}
                className="inline-flex items-center gap-2 rounded-full border border-line-strong px-6 py-3 text-[14px] text-ink transition-colors hover:bg-surface-2"
              >
                <Printer className="size-3.5" />
                Print this deck
              </button>
              <Link
                href="/"
                className="inline-flex items-center gap-2 rounded-full px-6 py-3 text-[14px] text-ink-muted transition-colors hover:text-ink"
              >
                Back to CREAM
                <ArrowUpRight className="size-3.5" />
              </Link>
            </div>
            <p className="mt-10 font-mono text-[10.5px] uppercase tracking-[0.16em] text-ink-faint">
              ← → · j · k to navigate · esc to exit · p to print
            </p>
          </Reveal>
        </div>
      </Slide>
    </div>
  );
}