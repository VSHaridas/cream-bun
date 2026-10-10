export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  Coins,
  FileText,
  Layers,
  Plus,
  Send,
  Timer,
  Users,
} from "lucide-react";
import type { Brief, Creator, Offer } from "@/lib/domain/types";
import { ASPECT_RATIOS } from "@/lib/domain/types";
import { getActiveBrand, getBriefs, getCreators, getOffers } from "@/lib/data";
import { compactInr, formatDate, inr } from "@/lib/utils";
import { Badge, Button, Label } from "@/components/ui/primitives";
import { Reveal, Stagger, StaggerItem } from "@/components/shared/motion";
import { CreatorAvatarStack } from "@/components/creator/avatar";

export const metadata: Metadata = {
  title: "Briefs — Nirvani Atelier",
  description:
    "The brand's brief workspace: every structured brief with its originating transcript, deliverables, commercial-use terms, budget and shortlist.",
};

type BriefStatus = Brief["status"];

interface StatusSkin {
  label: string;
  badge: "neutral" | "ink" | "caramel" | "mint" | "rose" | "violet";
  rail: string;
  bar: string;
  rule: string;
  glyph: string;
  note: string;
}

const STATUS_SKIN: Record<BriefStatus, StatusSkin> = {
  draft: {
    label: "Draft",
    badge: "neutral",
    rail: "bg-ink-faint/45",
    bar: "bg-ink-faint",
    rule: "border-dashed",
    glyph: "◌",
    note: "Not published. The assistant is still filling fields.",
  },
  open: {
    label: "Open",
    badge: "mint",
    rail: "bg-mint/55",
    bar: "bg-mint",
    rule: "border-solid",
    glyph: "◉",
    note: "Running against the creator pool now.",
  },
  shortlisted: {
    label: "Shortlisted",
    badge: "violet",
    rail: "bg-violet/55",
    bar: "bg-violet",
    rule: "border-solid",
    glyph: "◇",
    note: "Creators selected. Offers not yet issued.",
  },
  "in-negotiation": {
    label: "In negotiation",
    badge: "caramel",
    rail: "bg-caramel/60",
    bar: "bg-caramel",
    rule: "border-solid",
    glyph: "◆",
    note: "Offers out. Scope and milestones under discussion.",
  },
  awarded: {
    label: "Awarded",
    badge: "ink",
    rail: "bg-ink",
    bar: "bg-ink",
    rule: "border-solid",
    glyph: "●",
    note: "Offer accepted. Escrow and contracts are live.",
  },
  closed: {
    label: "Closed",
    badge: "neutral",
    rail: "bg-line-strong",
    bar: "bg-line-strong",
    rule: "border-solid",
    glyph: "○",
    note: "Delivered and settled. Read-only.",
  },
};

const STATUS_ORDER: BriefStatus[] = [
  "draft",
  "open",
  "shortlisted",
  "in-negotiation",
  "awarded",
  "closed",
];

function ratioLabel(id: string) {
  return ASPECT_RATIOS.find((a) => a.id === id)?.label ?? id;
}

export default async function BriefsPage() {
  const [briefs, offers, brand, creators] = await Promise.all([
    getBriefs(),
    getOffers(),
    getActiveBrand(),
    getCreators(),
  ]);
  const creatorById = new Map(creators.map((c) => [c.id, c]));

  const ordered = [...briefs].sort((a, b) => {
    const ra = STATUS_ORDER.indexOf(a.status);
    const rb = STATUS_ORDER.indexOf(b.status);
    return ra - rb || new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });

  const spend = brand?.totalSpendInr ?? 0;
  const quarterRef = new Date(
    Math.max(...briefs.map((b) => new Date(b.createdAt).getTime())),
  ).getTime();
  const thisQuarter = briefs.filter(
    (b) => quarterRef - new Date(b.createdAt).getTime() < 90 * 86_400_000,
  ).length;
  const midpoints = briefs.map((b) => (b.budget.minInr + b.budget.maxInr) / 2);
  const avgBudget = midpoints.reduce((s, n) => s + n, 0) / midpoints.length;
  const committed = briefs.reduce((s, b) => s + b.budget.minInr, 0);
  const assets = briefs.reduce(
    (s, b) => s + b.deliverables.reduce((n, d) => n + d.quantity, 0),
    0,
  );

  const summary = [
    { icon: Coins, k: "Spend routed to creators", v: compactInr(spend), s: `${inr(spend)} since ${brand?.memberSince ?? "—"}` },
    { icon: FileText, k: "Briefs this quarter", v: String(thisQuarter), s: `${briefs.length} structured in total` },
    { icon: Layers, k: "Average budget", v: compactInr(avgBudget), s: "midpoint of every range" },
    { icon: Timer, k: "Minimum committed", v: compactInr(committed), s: `${assets} assets specified` },
  ];

  return (
    <div className="pb-24">
      {/* ── header ── */}
      <section className="border-b border-line bg-bg-deep/30">
        <div className="container-x py-12 md:py-16">
          <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <div className="mb-5 flex flex-wrap items-center gap-3">
                <Label>Brief workspace</Label>
                <span className="h-3 w-px bg-line" aria-hidden />
                <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-faint">
                  signed in as {brand?.name ?? "unknown brand"}
                </span>
              </div>
              <h1 className="display-lg">
                Every brief, and the <span className="serif-italic">conversation</span> behind it.
              </h1>
              <p className="mt-5 max-w-xl text-balance-pretty text-[15px] leading-relaxed text-ink-muted">
                A brief on this page is not a document a human wrote. It is a set of contract fields
                extracted from a transcript that is stored verbatim beside it — and that transcript is
                what the creator reads.
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-2.5">
              <Button asChild variant="primary">
                <Link href="/briefs/new">
                  <Plus className="size-4" />
                  New brief
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/engagements">
                  Workspaces
                  <ArrowRight className="size-3.5" />
                </Link>
              </Button>
            </div>
          </div>

          {/* summary strip */}
          <dl className="mt-12 grid grid-cols-2 gap-x-6 gap-y-7 border-t border-line pt-8 lg:grid-cols-4">
            {summary.map((s) => (
              <div key={s.k}>
                <dt className="flex items-center gap-2">
                  <s.icon className="size-3.5 text-caramel" />
                  <span className="label-xs">{s.k}</span>
                </dt>
                <dd className="mt-2.5 font-display text-[30px] leading-none tracking-[-0.03em] tabular-nums text-ink">
                  {s.v}
                </dd>
                <dd className="mt-1.5 text-[11px] text-ink-faint">{s.s}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* ── pipeline ── */}
      <section className="border-b border-line">
        <div className="container-x py-7">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-4">
            <Label className="shrink-0">Pipeline</Label>
            <ol className="flex min-w-0 flex-1 flex-wrap items-center gap-y-2">
              {STATUS_ORDER.map((s, i) => {
                const count = briefs.filter((b) => b.status === s).length;
                const skin = STATUS_SKIN[s];
                return (
                  <li key={s} className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-2.5 py-1">
                      <span className={`size-1.5 rounded-full ${skin.bar}`} aria-hidden />
                      <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-2">
                        {skin.label}
                      </span>
                      <span className="font-mono text-[10px] tabular-nums text-ink-faint">
                        {count}
                      </span>
                    </span>
                    {i < STATUS_ORDER.length - 1 && (
                      <span className="h-px w-5 bg-line-strong sm:w-7" aria-hidden />
                    )}
                  </li>
                );
              })}
            </ol>
          </div>
        </div>
      </section>

      {/* ── list ── */}
      <section className="container-x pt-14">
        <div className="mb-7 flex flex-wrap items-baseline justify-between gap-3 border-b border-line pb-4">
          <h2 className="font-display text-[22px] leading-none tracking-[-0.02em] text-ink">
            {briefs.length} briefs
          </h2>
          <p className="max-w-md text-[12px] leading-relaxed text-ink-faint">
            Your own briefs are outlined. The other two belong to brands in the same workspace and are
            shown for comparison.
          </p>
        </div>

        <Stagger className="space-y-4" gap={0.05}>
          {ordered.map((brief) => (
            <StaggerItem key={brief.id}>
              <BriefRow
                brief={brief}
                own={brief.brandId === brand?.id}
                creatorById={creatorById}
                offers={offers}
              />
            </StaggerItem>
          ))}
        </Stagger>

        <Reveal delay={0.1}>
          <div className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-3 rounded-xl border border-dashed border-line bg-surface/40 px-6 py-5">
            <Users className="size-4 shrink-0 text-caramel" />
            <p className="flex-1 text-[13px] leading-relaxed text-ink-muted">
              A brief becomes an offer only after you pick creators. CREAM never sends one on your
              behalf without a scope, a budget and a licence written down first.
            </p>
            <Link
              href="/briefs/new"
              className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.12em] text-caramel hover:underline"
            >
              start another <ArrowRight className="size-3" />
            </Link>
          </div>
        </Reveal>
      </section>
    </div>
  );
}

function BriefRow({
  brief,
  own,
  creatorById,
  offers,
}: {
  brief: Brief;
  own: boolean;
  creatorById: Map<string, Creator>;
  offers: Offer[];
}) {
  const skin = STATUS_SKIN[brief.status];
  const creators = brief.shortlistedCreatorIds
    .map((id) => creatorById.get(id))
    .filter((c): c is NonNullable<typeof c> => Boolean(c));
  const briefOffers = offers.filter((o) => brief.offerIds.includes(o.id));
  const assetCount = brief.deliverables.reduce((s, d) => s + d.quantity, 0);
  const durations = [
    ...new Set(brief.deliverables.map((d) => d.durationSeconds).filter(Boolean)),
  ] as number[];
  const deadline = new Date(
    new Date(brief.createdAt).getTime() + brief.timeline.finalDeliveryWithinDays * 86_400_000,
  );

  return (
    <article
      className={`group relative overflow-hidden rounded-lg border bg-surface transition-all duration-300 hover:border-line-strong hover:shadow-e2 ${
        own ? "border-line-strong/70" : skin.rule
      }`}
    >
      <span className={`absolute inset-y-0 left-0 w-[3px] ${skin.rail}`} aria-hidden />
      <Link href={`/briefs/${brief.code}`} className="absolute inset-0 z-0" aria-label={brief.title} />

      <div className="relative grid gap-6 p-6 pl-7 lg:grid-cols-[1.6fr_0.9fr]">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-ink-faint">
              {brief.code}
            </span>
            <Badge tone={skin.badge}>
              <span aria-hidden>{skin.glyph}</span>
              {skin.label}
            </Badge>
            {own && (
              <span className="inline-flex items-center gap-1 rounded-full border border-caramel/40 bg-caramel/10 px-2 py-[3px] font-mono text-[9.5px] uppercase tracking-[0.1em] text-caramel">
                your workspace
              </span>
            )}
            {!own && (
              <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-faint">
                {brief.brandName}
              </span>
            )}
          </div>

          <h3 className="mt-3 font-display text-[26px] leading-[1.08] tracking-[-0.025em] text-ink">
            {brief.title}
          </h3>

          <p className="mt-3 max-w-2xl text-[13.5px] leading-relaxed text-ink-muted">
            {brief.campaignObjective}
          </p>

          <p className="mt-3 max-w-2xl border-l-2 border-line pl-3 font-display text-[14.5px] italic leading-relaxed text-ink-2">
            &ldquo;{brief.rawIdea}&rdquo;
          </p>

          <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2.5 text-[11.5px] text-ink-muted">
            <span className="inline-flex items-center gap-1.5">
              <Layers className="size-3 text-ink-faint" />
              {brief.deliverables.length} deliverable{brief.deliverables.length > 1 ? "s" : ""} ·{" "}
              <span className="font-mono tabular-nums text-ink-2">{assetCount}</span> assets
              {durations.length > 0 && (
                <span className="text-ink-faint"> · {durations.join("/")}s</span>
              )}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Send className="size-3 text-ink-faint" />
              {briefOffers.length} offer{briefOffers.length === 1 ? "" : "s"}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Timer className="size-3 text-ink-faint" />
              due <span className="font-mono tabular-nums text-ink-2">{formatDate(deadline)}</span>
            </span>
          </div>
        </div>

        <div className="flex min-w-0 flex-col justify-between gap-5 border-t border-line pt-5 lg:border-l lg:border-t-0 lg:pl-7 lg:pt-0">
          <div>
            <div className="flex items-baseline justify-between gap-3">
              <Label>Budget</Label>
              <span className="font-mono text-[9.5px] uppercase tracking-[0.1em] text-ink-faint">
                {brief.budget.model}
              </span>
            </div>
            <div className="mt-2 font-display text-[24px] leading-none tracking-[-0.02em] tabular-nums text-caramel">
              {compactInr(brief.budget.minInr)} &ndash; {compactInr(brief.budget.maxInr)}
            </div>
            <div className="mt-2 flex items-center gap-1.5">
              <span
                className={`size-1.5 rounded-full ${brief.budget.releasedToRazorpay ? "bg-mint" : "bg-ink-faint"}`}
                aria-hidden
              />
              <span className="text-[11px] text-ink-faint">
                {brief.budget.releasedToRazorpay
                  ? "authorised in Razorpay escrow"
                  : "not yet released to escrow"}
              </span>
            </div>
          </div>

          <div>
            <Label>Formats</Label>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {brief.aspectRatios.map((a) => (
                <span key={a} className="chip px-2 py-0.5 font-mono text-[10px]" title={ratioLabel(a)}>
                  {a}
                </span>
              ))}
            </div>
          </div>

          <div className="flex items-end justify-between gap-4 border-t border-line pt-4">
            <div className="min-w-0">
              <Label>Shortlist</Label>
              <div className="mt-2 flex items-center gap-2.5">
                {creators.length > 0 ? (
                  <>
                    <CreatorAvatarStack creators={creators} size={26} max={4} />
                    <span className="font-mono text-[10.5px] tabular-nums text-ink-faint">
                      {creators.length}
                    </span>
                  </>
                ) : (
                  <span className="text-[11.5px] text-ink-faint">nobody yet</span>
                )}
              </div>
            </div>
            <div className="text-right">
              <div className="label-xs">Updated</div>
              <div className="mt-1.5 font-mono text-[11px] tabular-nums text-ink-2">
                {formatDate(brief.updatedAt)}
              </div>
              <div className="mt-0.5 text-[10.5px] text-ink-faint">{skin.note}</div>
            </div>
          </div>
        </div>
      </div>

      <span className="pointer-events-none absolute right-4 top-4 opacity-0 transition-all duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:opacity-100">
        <ArrowUpRight className="size-4 text-caramel" />
      </span>
    </article>
  );
}
