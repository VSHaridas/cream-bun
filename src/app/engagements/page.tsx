export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  CalendarClock,
  FileSignature,
  Layers,
  Lock,
} from "lucide-react";
import type {
  Brief,
  Contract,
  Creator,
  Engagement,
  Escrow,
  Offer,
  TrustAssessment,
} from "@/lib/domain/types";
import {
  getBriefs,
  getContracts,
  getCreators,
  getEngagements,
  getEscrows,
  getOffers,
  getPortfolio,
  getProvenance,
  getWorkflows,
} from "@/lib/data";
import { createTrustEngine } from "@/lib/domain/trust";
import { compactInr, formatDate, inr } from "@/lib/utils";
import { Badge, Button, Label, Meter } from "@/components/ui/primitives";
import { Reveal, Stagger, StaggerItem } from "@/components/shared/motion";
import { CreatorAvatar } from "@/components/creator/avatar";

export const metadata: Metadata = {
  title: "Engagements — production workspaces",
  description:
    "Signed engagements with their gated stage rail, escrow position, contract stack, generation rounds and provenance records.",
};

type EngagementStatus = Engagement["status"];

interface StageSkin {
  label: string;
  badge: "neutral" | "ink" | "caramel" | "mint" | "rose" | "violet";
  bar: string;
  note: string;
}

const PIPELINE: EngagementStatus[] = [
  "awaiting-signature",
  "in-production",
  "client-review",
  "delivered",
  "closed",
];

const STATUS: Record<EngagementStatus, StageSkin> = {
  "awaiting-signature": {
    label: "Awaiting signature",
    badge: "violet",
    bar: "bg-violet",
    note: "Nothing happens until both parties sign.",
  },
  "in-production": {
    label: "In production",
    badge: "caramel",
    bar: "bg-caramel",
    note: "Rounds are generating against a captured escrow.",
  },
  "client-review": {
    label: "Client review",
    badge: "mint",
    bar: "bg-mint",
    note: "Samples released with dual-branded burn-in.",
  },
  delivered: {
    label: "Delivered",
    badge: "ink",
    bar: "bg-ink",
    note: "Finals handed over; close agreement pending.",
  },
  closed: {
    label: "Closed",
    badge: "neutral",
    bar: "bg-line-strong",
    note: "Settled. Rights transferred, review closed.",
  },
  refunded: {
    label: "Refunded",
    badge: "rose",
    bar: "bg-rose",
    note: "Cancelled and returned through Razorpay.",
  },
};

function stageIndex(status: EngagementStatus) {
  return PIPELINE.indexOf(status);
}

export default async function EngagementsPage() {
  const [engagements, escrows, offers, contracts, provenance, briefs, creators, portfolio, workflows] =
    await Promise.all([
      getEngagements(),
      getEscrows(),
      getOffers(),
      getContracts(),
      getProvenance(),
      getBriefs(),
      getCreators(),
      getPortfolio(),
      getWorkflows(),
    ]);

  const trust = createTrustEngine({
    portfolio,
    workflows: new Map(workflows.map((w) => [w.id, w])),
  });
  const briefById = new Map(briefs.map((b) => [b.id, b]));
  const creatorById = new Map(creators.map((c) => [c.id, c]));

  const ordered = [...engagements].sort((a, b) => {
    const d = stageIndex(b.status) - stageIndex(a.status);
    return d !== 0 ? d : new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime();
  });

  const held = escrows.reduce((s, e) => s + (e.amountInr - e.releasedInr), 0);
  const released = escrows.reduce((s, e) => s + e.releasedInr, 0);
  const committed = offers.reduce((s, o) => s + o.amountInr, 0);
  const active = engagements.filter(
    (e) => e.status === "in-production" || e.status === "awaiting-signature",
  ).length;
  const signedContracts = contracts.filter((c) => c.status === "signed").length;
  const sampleCount = engagements.reduce((s, e) => s + e.rounds.reduce((n, r) => n + r.samples.length, 0), 0);

  const summary = [
    { k: "In flight", v: String(active), s: "awaiting signature or producing" },
    { k: "Held in escrow", v: compactInr(held), s: `${inr(released)} released so far` },
    { k: "Signed contracts", v: `${signedContracts}`, s: `of ${contracts.length} raised` },
    { k: "Provenance records", v: String(provenance.length), s: `${sampleCount} samples stamped` },
  ];

  return (
    <div className="pb-24">
      {/* ── header ── */}
      <section className="border-b border-line bg-bg-deep/30">
        <div className="container-x py-12 md:py-16">
          <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <div className="mb-5 flex flex-wrap items-center gap-3">
                <Label>Engagements</Label>
                <span className="h-3 w-px bg-line" aria-hidden />
                <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-faint">
                  brand side
                </span>
              </div>
              <h1 className="display-lg">
                A workspace per contract, gated <span className="serif-italic">all the way</span> down.
              </h1>
              <p className="mt-5 max-w-xl text-balance-pretty text-[15px] leading-relaxed text-ink-muted">
                An engagement is not a project board. It is a contract with a stage rail attached,
                where nothing moves until the gate beneath it is satisfied and paid for.
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-2.5">
              <Button asChild variant="primary">
                <Link href="/briefs/new">
                  New brief
                  <ArrowRight className="size-3.5" />
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/briefs">Brief workspace</Link>
              </Button>
            </div>
          </div>

          <dl className="mt-12 grid grid-cols-2 gap-x-6 gap-y-7 border-t border-line pt-8 lg:grid-cols-4">
            {summary.map((s) => (
              <div key={s.k}>
                <dt className="label-xs">{s.k}</dt>
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
        <div className="container-x py-9">
          <div className="mb-5 flex items-center justify-between gap-4">
            <Label>Where each engagement sits</Label>
            <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-faint">
              {compactInr(committed)} committed across all offers
            </span>
          </div>
          <ol className="grid gap-3 md:grid-cols-5">
            {PIPELINE.map((s, i) => {
              const inStage = engagements.filter((e) => e.status === s);
              const skin = STATUS[s];
              return (
                <li
                  key={s}
                  className={`relative overflow-hidden rounded-lg border bg-surface px-4 py-4 ${
                    inStage.length > 0 ? "border-line-strong/60" : "border-line"
                  }`}
                >
                  <span className={`absolute inset-x-0 top-0 h-[3px] ${skin.bar} opacity-40`} aria-hidden />
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-faint">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span className="font-display text-[22px] leading-none tabular-nums text-ink">
                      {inStage.length}
                    </span>
                  </div>
                  <div className="mt-2.5 text-[13px] leading-tight text-ink">{skin.label}</div>
                  <p className="mt-1.5 text-[11px] leading-relaxed text-ink-faint">{skin.note}</p>
                  {i < PIPELINE.length - 1 && (
                    <span
                      className="absolute -right-3 top-1/2 hidden h-px w-3 bg-line-strong md:block"
                      aria-hidden
                    />
                  )}
                </li>
              );
            })}
          </ol>
        </div>
      </section>

      {/* ── list ── */}
      <section className="container-x pt-14">
        <div className="mb-7 flex flex-wrap items-baseline justify-between gap-3 border-b border-line pb-4">
          <h2 className="font-display text-[22px] leading-none tracking-[-0.02em] text-ink">
            {engagements.length} engagements
          </h2>
          <p className="max-w-md text-[12px] leading-relaxed text-ink-faint">
            Each row opens into the production workspace: stage rail, escrow arithmetic, contract
            clauses, generation rounds and provenance.
          </p>
        </div>

        <Stagger className="space-y-4" gap={0.05}>
          {ordered.map((e) => (
            <StaggerItem key={e.id}>
              <EngagementRow
              engagement={e}
              briefById={briefById}
              creatorById={creatorById}
              escrows={escrows}
              offers={offers}
              contracts={contracts}
              trust={creatorById.get(e.creatorId) ? trust.assess(creatorById.get(e.creatorId)!) : null}
            />
            </StaggerItem>
          ))}
        </Stagger>

        <Reveal delay={0.08}>
          <p className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-3 rounded-xl border border-dashed border-line bg-surface/40 px-6 py-5 text-[13px] leading-relaxed text-ink-muted">
            <Lock className="size-4 shrink-0 text-caramel" />
            <span className="flex-1">
              A creator cannot be paid for work that was never authorised, and a brand cannot be
              invoiced for work that was never gated. Both halves of that sentence are enforced by the
              contract stack, not by a policy page.
            </span>
          </p>
        </Reveal>
      </section>
    </div>
  );
}

function EngagementRow({
  engagement,
  briefById,
  creatorById,
  escrows,
  offers,
  contracts,
  trust,
}: {
  engagement: Engagement;
  briefById: Map<string, Brief>;
  creatorById: Map<string, Creator>;
  escrows: Escrow[];
  offers: Offer[];
  contracts: Contract[];
  trust: TrustAssessment | null;
}) {
  const skin = STATUS[engagement.status];
  const brief = briefById.get(engagement.briefId);
  const creator = creatorById.get(engagement.creatorId);
  const escrow = escrows.find((x) => x.id === engagement.escrowId);
  const offer = offers.find((o) => o.id === engagement.offerId);
  const contractCount = contracts.filter((c) => engagement.contractIds.includes(c.id)).length;
  const approved = engagement.rounds.filter((r) => r.status === "approved").length;
  const rounds = engagement.rounds.length;
  const samples = engagement.rounds.reduce((s, r) => s + r.samples.length, 0);
  const overdue = new Date(engagement.dueAt).getTime() - Date.now() < 0;

  return (
    <article className="group relative overflow-hidden rounded-lg border border-line bg-surface transition-all duration-300 hover:border-line-strong hover:shadow-e2">
      <span className={`absolute inset-y-0 left-0 w-[3px] ${skin.bar}`} aria-hidden />
      <Link href={`/engagements/${engagement.code}`} className="absolute inset-0 z-0" aria-label={engagement.code} />

      <div className="relative grid gap-6 p-6 pl-7 lg:grid-cols-[1.5fr_1fr_0.85fr]">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-ink-faint">
              {engagement.code}
            </span>
            <Badge tone={skin.badge}>{skin.label}</Badge>
            <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-faint">
              {brief?.brandName ?? engagement.brandId}
            </span>
          </div>

          <div className="mt-3.5 flex items-center gap-3">
            {creator && <CreatorAvatar creator={creator} size={38} />}
            <div className="min-w-0">
              <div className="truncate font-display text-[21px] leading-tight tracking-[-0.02em] text-ink">
                {brief?.title ?? "Brief unavailable"}
              </div>
              <div className="mt-1 truncate text-[12.5px] text-ink-muted">
                {creator ? (
                  <span>
                    {creator.displayName}
                    {creator.studioName ? ` · ${creator.studioName}` : ""}
                  </span>
                ) : (
                  "Creator unavailable"
                )}
              </div>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-[11.5px] text-ink-muted">
            <span className="inline-flex items-center gap-1.5">
              <Layers className="size-3 text-ink-faint" />
              <span className="font-mono tabular-nums text-ink-2">
                {approved}/{rounds}
              </span>{" "}
              rounds approved
            </span>
            <span className="inline-flex items-center gap-1.5">
              <FileSignature className="size-3 text-ink-faint" />
              {contractCount} contract{contractCount === 1 ? "" : "s"}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <CalendarClock className="size-3 text-ink-faint" />
              due <span className="font-mono tabular-nums text-ink-2">{formatDate(engagement.dueAt)}</span>
            </span>
          </div>
        </div>

        <div className="min-w-0 border-t border-line pt-5 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
          <Label>Escrow</Label>
          {escrow ? (
            <>
              <div className="mt-2.5 font-display text-[24px] leading-none tabular-nums text-caramel">
                {compactInr(escrow.amountInr)}
              </div>
              <div className="mt-3">
                <Meter
                  value={escrow.releasedInr}
                  max={escrow.amountInr}
                  tone={escrow.releasedInr === escrow.amountInr ? "mint" : "caramel"}
                />
              </div>
              <div className="mt-2 flex items-center justify-between font-mono text-[10.5px] tabular-nums">
                <span className="text-ink-faint">{compactInr(escrow.releasedInr)} released</span>
                <span className="text-ink-faint">{compactInr(escrow.amountInr - escrow.releasedInr)} held</span>
              </div>
              <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.1em] text-ink-faint">
                {escrow.status} · {escrow.code}
              </p>
            </>
          ) : (
            <div className="mt-2.5 flex items-start gap-2">
              <Lock className="mt-0.5 size-3.5 shrink-0 text-ink-faint" />
              <p className="text-[12px] leading-relaxed text-ink-faint">
                No escrow captured. {offer ? `Offer of ${compactInr(offer.amountInr)} is on record.` : "No offer on record."}
              </p>
            </div>
          )}
        </div>

        <div className="flex min-w-0 flex-col justify-between gap-4 border-t border-line pt-5 lg:border-t-0 lg:pt-0">
          <div>
            <Label>Rounds</Label>
            <div className="mt-2.5 space-y-1.5">
              {engagement.rounds.map((r) => (
                <div key={r.id} className="flex items-center gap-2.5">
                  <span
                    className={`size-1.5 shrink-0 rounded-full ${
                      r.status === "approved"
                        ? "bg-mint"
                        : r.status === "changes-requested"
                          ? "bg-rose"
                          : r.status === "in-review"
                            ? "bg-caramel"
                            : "bg-ink-faint"
                    }`}
                    aria-hidden
                  />
                  <span className="truncate text-[12px] text-ink-2">{r.label}</span>
                  <span className="ml-auto shrink-0 font-mono text-[10px] tabular-nums text-ink-faint">
                    {r.samples.length}
                  </span>
                </div>
              ))}
              {rounds === 0 && (
                <span className="text-[12px] text-ink-faint">no rounds recorded</span>
              )}
            </div>
            <p className="mt-2.5 text-[11px] text-ink-faint">
              {samples} sample{samples === 1 ? "" : "s"} burned in and manifest-stamped
            </p>
          </div>

          <div className="flex items-end justify-between gap-4 border-t border-line pt-3.5">
            <div className="min-w-0">
              <Label>Due</Label>
              <div
                className={`mt-1.5 font-mono text-[11.5px] tabular-nums ${overdue ? "text-rose" : "text-ink-2"}`}
              >
                {formatDate(engagement.dueAt)}
              </div>
              {trust && (
                <div className="mt-1 font-mono text-[10px] tabular-nums text-ink-faint">
                  trust {trust.score}/100
                </div>
              )}
            </div>
            <span className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.12em] text-caramel">
              open
              <ArrowUpRight className="size-3" />
            </span>
          </div>
        </div>
      </div>
    </article>
  );
}
