"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  CalendarClock,
  CircleDot,
  FileText,
  History,
  Send,
  Sparkles,
  Stamp,
} from "lucide-react";
import type {
  Brief,
  Contract,
  Creator,
  Engagement,
  Escrow,
  GenerationRound,
  Offer,
  ProvenanceRecord,
  TrustAssessment,
} from "@/lib/domain/types";
import { compactInr, formatDate } from "@/lib/utils";
import { Badge, Button, Label } from "@/components/ui/primitives";
import { CreatorAvatar } from "@/components/creator/avatar";
import { TrustStrip } from "@/components/trust/trust";
import { StageRail, ContractStack, type GateSpec } from "./contract-stack";
import { EscrowPanel, ProvenancePanel, type EscrowPolicy, type PayoutMath } from "./escrow-panel";
import { RoundGallery, type RoundOverride } from "./round-gallery";

const STATUS_META: Record<
  Engagement["status"],
  { label: string; badge: "neutral" | "ink" | "caramel" | "mint" | "rose" | "violet" }
> = {
  "awaiting-signature": { label: "Awaiting signature", badge: "violet" },
  "in-production": { label: "In production", badge: "caramel" },
  "client-review": { label: "Client review", badge: "mint" },
  delivered: { label: "Delivered", badge: "ink" },
  closed: { label: "Closed", badge: "neutral" },
  refunded: { label: "Refunded", badge: "rose" },
};

function bothSigned(c: Contract) {
  return c.signatures.every((s) => s.status === "signed");
}

export function EngagementWorkspace({
  engagement,
  brief,
  creator,
  offer,
  contracts,
  escrow,
  provenance,
  policy,
  payout,
  daysRemaining,
  trust,
}: {
  engagement: Engagement;
  brief: Brief | undefined;
  creator: Creator | undefined;
  trust: TrustAssessment | null;
  offer: Offer | undefined;
  contracts: Contract[];
  escrow: Escrow | undefined;
  provenance: ProvenanceRecord[];
  policy: EscrowPolicy;
  payout: PayoutMath | null;
  daysRemaining: number;
}) {
  const [overrides, setOverrides] = React.useState<Record<string, RoundOverride>>({});
  const status = STATUS_META[engagement.status];
  const nda = contracts.find((c) => c.kind === "nda");
  const start = contracts.find((c) => c.kind === "engagement-start");
  const close = contracts.find((c) => c.kind === "engagement-close");
  const escrowCaptured = Boolean(escrow && escrow.amountInr > 0 && escrow.capturedAt);
  const firstRound = engagement.rounds.find((r) => r.status !== "queued") ?? engagement.rounds[0];
  const allRoundsApproved =
    engagement.rounds.length > 0 &&
    engagement.rounds.every((r) => (overrides[r.id]?.status ?? r.status) === "approved");

  const startDetail = start
    ? `${start.code} · ${start.status}${start.effectiveAt ? ` since ${formatDate(start.effectiveAt)}` : ""}`
    : "No engagement-start agreement on file.";
  const escrowDetail = escrow
    ? `${escrow.code} · ${compactInr(escrow.amountInr)} captured ${escrow.capturedAt ? formatDate(escrow.capturedAt) : "—"}`
    : "No escrow record linked to this engagement.";
  const firstRoundStatus = firstRound
    ? (overrides[firstRound.id]?.status ?? firstRound.status).replace(/-/g, " ")
    : "";
  const samplesDetail = firstRound
    ? `${firstRound.label} · ${firstRound.samples.length} samples, ${firstRoundStatus}`
    : "Production cannot begin before the escrow gate.";

  const gates: GateSpec[] = [
    {
      key: "nda",
      label: "NDA",
      gate: "Mutual confidentiality before any reference material moves",
      state: nda && bothSigned(nda) ? "done" : nda ? "open" : "locked",
      detail: nda
        ? `${nda.code} · ${bothSigned(nda) ? "both signatures captured" : "awaiting signature"}`
        : "Not raised. Nothing has been shared with the creator.",
    },
    {
      key: "start",
      label: "Start contract",
      gate: "Scope, watermarking, rejection grounds and rights",
      state: start && bothSigned(start) ? "done" : start ? "open" : "locked",
      detail: startDetail,
    },
    {
      key: "escrow",
      label: "Escrow funded",
      gate: "Authorisation captured into Razorpay custody",
      state: escrowCaptured ? "done" : "locked",
      detail: escrowDetail,
    },
    {
      key: "samples",
      label: "Round 1 samples",
      gate: "First released frames, dual-branded burn-in attached",
      state: firstRound ? (allRoundsApproved ? "done" : "open") : "locked",
      detail: samplesDetail,
    },
    {
      key: "approval",
      label: "Approval",
      gate: "Written acceptance of an approved sample",
      state: allRoundsApproved ? "done" : engagement.rounds.length > 0 ? "open" : "locked",
      detail: allRoundsApproved
        ? "All rounds approved. Release of the next milestone is due."
        : "Aesthetic preference alone is not a rejection ground — departure from an approved sample is.",
    },
    {
      key: "close",
      label: "Close agreement",
      gate: "The licence that actually transfers rights",
      state: close && bothSigned(close) ? "done" : allRoundsApproved ? "open" : "locked",
      detail: close
        ? `${close.code} · ${close.status}`
        : allRoundsApproved
          ? "Unlocks once approval is written."
          : "Raised by CREAM after approval, signed by both parties.",
    },
  ];

  const rounds: GenerationRound[] = engagement.rounds;

  return (
    <div className="pb-24">
      {/* ── 1 · header ── */}
      <header className="border-b border-line bg-bg-deep/30">
        <div className="container-x py-12 md:py-14">
          <Link
            href="/engagements"
            className="inline-flex items-center gap-1.5 font-mono text-[10.5px] uppercase tracking-[0.14em] text-ink-faint transition-colors hover:text-caramel"
          >
            <ArrowLeft className="size-3" />
            all engagements
          </Link>

          <div className="mt-7 flex flex-wrap items-center gap-2.5">
            <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-ink-faint">
              {engagement.code}
            </span>
            <Badge tone={status.badge}>{status.label}</Badge>
            <span className="h-3 w-px bg-line" aria-hidden />
            <span className="font-mono text-[10.5px] uppercase tracking-[0.13em] text-ink-muted">
              {engagement.brandId}
            </span>
          </div>

          <h1 className="display-lg mt-5 max-w-4xl">
            {brief?.title ?? "Brief unavailable"}
          </h1>

          <div className="mt-8 flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
            <div className="flex items-center gap-4">
              {creator && (
                <>
                  <CreatorAvatar creator={creator} size={54} />
                  <div className="min-w-0">
                    <Link
                      href={`/creators/${creator.handle}`}
                      className="text-[16px] font-medium text-ink transition-colors hover:text-caramel"
                    >
                      {creator.displayName}
                    </Link>
                    <p className="mt-0.5 text-[12.5px] text-ink-muted">
                      {creator.studioName ?? `@${creator.handle}`} · {creator.location}
                    </p>
                  </div>
                </>
              )}
            </div>

            <dl className="grid grid-cols-2 gap-x-8 gap-y-5 sm:grid-cols-4">
              <Meta k="Due" v={formatDate(engagement.dueAt)} />
              <Meta
                k="Days remaining"
                v={daysRemaining > 0 ? String(daysRemaining) : String(Math.abs(daysRemaining))}
                tone={daysRemaining < 0 ? "rose" : daysRemaining <= 3 ? "caramel" : "ink"}
                sub={
                  daysRemaining < 0
                    ? `${Math.abs(daysRemaining)}d past due`
                    : daysRemaining === 0
                      ? "due today"
                      : "on schedule"
                }
              />
              <Meta k="Started" v={formatDate(engagement.startedAt)} />
              <Meta
                k="Contract value"
                v={offer ? compactInr(offer.amountInr) : "—"}
                mono
                tone="caramel"
              />
            </dl>
          </div>

          <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3 border-t border-line pt-6">
            <Button asChild variant="ghost" size="sm">
              <Link href={brief ? `/briefs/${brief.code}` : "/briefs"}>
                <FileText className="size-3.5" />
                the brief
                <ArrowRight className="size-3" />
              </Link>
            </Button>
            {creator && (
              <Button asChild variant="ghost" size="sm">
                <Link href={`/creators/${creator.handle}`}>
                  <CircleDot className="size-3.5" />
                  creator profile
                </Link>
              </Button>
            )}
            {creator && trust && (
              <span className="inline-flex items-center gap-2.5 rounded-full border border-line bg-surface px-3 py-1.5">
                <span className="label-xs">trust</span>
                <TrustStrip assessment={trust} />
              </span>
            )}
          </div>
        </div>
      </header>

      <div className="container-x space-y-14 pt-12">
        {/* ── 2 · stage rail ── */}
        <Block n="01" title="Nothing advances without its gate" lede="Each stage has a condition attached to it. The lock glyph is not decoration — it is the reason the next stage has no data yet.">
          <StageRail gates={gates} />
        </Block>

        {/* ── 3 · escrow ── */}
        <Block n="02" title="Money moves against gates, not promises" lede="Gross, released and held are three numbers with a live gateway behind them. The arithmetic below is the same function the payout route uses.">
          <div className="grid gap-4 lg:grid-cols-[1.35fr_1fr]">
            <EscrowPanel escrow={escrow} policy={policy} math={payout} />
            <aside className="space-y-4">
              <div className="rounded-xl border border-line bg-surface p-5">
                <div className="flex items-center gap-2">
                  <CalendarClock className="size-3.5 text-caramel" />
                  <Label>Milestone clock</Label>
                </div>
                {offer ? (
                  <>
                    <ul className="mt-4 space-y-3">
                      {offer.milestones.map((m, i) => {
                        const past = m.dueDay <= Math.max(0, daysRemaining) || m.dueDay <= 5;
                        return (
                          <li key={m.label} className="flex items-baseline gap-3">
                            <span className="font-mono text-[10px] tabular-nums text-ink-faint">
                              {String(i + 1).padStart(2, "0")}
                            </span>
                            <span className="flex-1 truncate text-[12.5px] text-ink-2">{m.label}</span>
                            <span className="font-mono text-[11px] tabular-nums text-caramel">{m.pct}%</span>
                            <span
                              className={`font-mono text-[10.5px] tabular-nums ${past ? "text-mint" : "text-ink-faint"}`}
                            >
                              d{m.dueDay}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                    <p className="mt-4 border-t border-line pt-3.5 text-[11.5px] leading-relaxed text-ink-faint">
                      Each tranche releases on written acceptance of the milestone it names, and settles
                      net fifteen. Nothing is released because a deadline passed.
                    </p>
                  </>
                ) : (
                  <p className="mt-3 text-[12.5px] leading-relaxed text-ink-faint">
                    No offer is linked to this engagement, so there is no milestone schedule to hold
                    escrow against.
                  </p>
                )}
              </div>

              <div className="rounded-xl border border-line bg-surface p-5">
                <div className="flex items-center gap-2">
                  <History className="size-3.5 text-caramel" />
                  <Label>Round progress</Label>
                </div>
                <div className="mt-4 space-y-2.5">
                  {rounds.map((r) => {
                    const s = overrides[r.id]?.status ?? r.status;
                    return (
                      <div key={r.id} className="flex items-center justify-between gap-3">
                        <span className="flex min-w-0 items-center gap-2.5">
                          <span
                            className={`size-1.5 shrink-0 rounded-full ${
                              s === "approved"
                                ? "bg-mint"
                                : s === "changes-requested"
                                  ? "bg-rose"
                                  : s === "in-review"
                                    ? "bg-caramel"
                                    : "bg-ink-faint"
                            }`}
                            aria-hidden
                          />
                          <span className="truncate text-[12.5px] text-ink-2">{r.label}</span>
                        </span>
                        <span className="shrink-0 font-mono text-[10.5px] tabular-nums text-ink-faint">
                          {r.samples.length} samples
                        </span>
                      </div>
                    );
                  })}
                  {rounds.length === 0 && (
                    <span className="text-[12.5px] text-ink-faint">no rounds recorded</span>
                  )}
                </div>
              </div>
            </aside>
          </div>
        </Block>

        {/* ── 4 · contracts ── */}
        <Block n="03" title="The contract stack" lede="Contracts are virtual, non-bypassable and human-reviewed. Every clause marked for explicit acknowledgement had to be read and confirmed by a person.">
          <ContractStack contracts={contracts} />
        </Block>

        {/* ── 5 · rounds ── */}
        <Block n="05" title="Generation rounds" lede="Every sample below is watermarked, because a sample is a review copy and not yet a licensed asset. The lineage is retained whether or not the frame was approved.">
          <div className="mb-4 flex flex-wrap items-center gap-2.5 rounded-lg border border-dashed border-line bg-surface/40 px-4 py-3">
            <Sparkles className="size-3.5 shrink-0 text-caramel" />
            <p className="text-[11.5px] leading-relaxed text-ink-faint">
              Round actions below are a prototype. Approving a round changes local state in this
              browser only — it does not release escrow, amend a contract or notify the creator.
            </p>
          </div>
          <RoundGallery
            rounds={rounds}
            creatorName={creator?.displayName ?? "Creator"}
            overrides={overrides}
            onApprove={(id) =>
              setOverrides((o) => ({
                ...o,
                [id]: {
                  status: "approved",
                  approvedAt: new Date().toISOString(),
                  feedback:
                    o[id]?.feedback ??
                    "Approved in the workspace prototype. On a live deployment this releases the next escrow tranche.",
                },
              }))
            }
            onRequestChanges={(id, note) =>
              setOverrides((o) => ({
                ...o,
                [id]: { status: "changes-requested", approvedAt: null, feedback: note },
              }))
            }
          />
        </Block>

        {/* ── 6 · provenance ── */}
        <Block n="04" title="Provenance" lede="Three layers, each defeating a different failure mode: a screenshot, a re-encode, and a metadata strip.">
          <ProvenancePanel records={provenance} />
        </Block>

        {/* ── 7 · the brief as the creator received it ── */}
        <Block n="06" title="The brief, as the creator received it" lede="Not the structured fields above — the restatement, generated from the brand's original transcript and shown to the creator alongside it.">
          <TranslatedBrief offer={offer} brief={brief} />
        </Block>
      </div>
    </div>
  );
}

function Block({
  n,
  title,
  lede,
  children,
}: {
  n: string;
  title: string;
  lede: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-6 flex gap-5">
        <span className="mt-2.5 font-mono text-[11px] tabular-nums text-caramel">{n}</span>
        <div className="max-w-2xl">
          <h2 className="display-md">{title}</h2>
          <p className="mt-3 text-[14px] leading-relaxed text-ink-muted">{lede}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

function Meta({
  k,
  v,
  sub,
  mono,
  tone,
}: {
  k: string;
  v: string;
  sub?: string;
  mono?: boolean;
  tone?: "ink" | "caramel" | "rose";
}) {
  return (
    <div>
      <dt className="label-xs">{k}</dt>
      <dd
        className={
          mono
            ? `mt-2 font-display text-[24px] leading-none tabular-nums ${tone === "caramel" ? "text-caramel" : "text-ink"}`
            : `mt-2 font-display text-[24px] leading-none tabular-nums ${
                tone === "rose" ? "text-rose" : tone === "caramel" ? "text-caramel" : "text-ink"
              }`
        }
      >
        {v}
      </dd>
      {sub && <dd className="mt-1.5 text-[11px] text-ink-faint">{sub}</dd>}
    </div>
  );
}

function TranslatedBrief({
  offer,
  brief,
}: {
  offer: Offer | undefined;
  brief: Brief | undefined;
}) {
  if (!offer) {
    return (
      <div className="rounded-xl border border-dashed border-line bg-surface/40 px-6 py-8 text-center">
        <Send className="size-4 text-ink-faint" />
        <p className="mt-3 text-[13px] leading-relaxed text-ink-muted">
          No offer is attached to this engagement, so there is no creator-facing restatement to show.
        </p>
      </div>
    );
  }

  const paragraphs = offer.translatedBrief.split("\n\n");

  return (
    <article className="overflow-hidden rounded-xl border border-line bg-surface">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line px-5 py-4">
        <div className="flex items-center gap-2.5">
          <Send className="size-3.5 text-caramel" />
          <span className="text-[14px] font-medium text-ink">Translated brief</span>
        </div>
        <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-faint">
          {offer.code} · {formatDate(offer.createdAt)}
        </span>
      </div>

      <div className="px-6 py-8 md:px-10 md:py-12">
        <div className="mx-auto max-w-2xl">
          <div className="mb-7 flex items-center gap-3">
            <span className="h-px flex-1 bg-line" aria-hidden />
            <Sparkles className="size-3.5 shrink-0 text-caramel" />
            <span className="h-px flex-1 bg-line" aria-hidden />
          </div>
          <div className="space-y-5">
            {paragraphs.map((p, i) => (
              <p
                key={i}
                className={
                  i === 0
                    ? "font-display text-[19px] leading-[1.55] tracking-[-0.015em] text-ink"
                    : "font-display text-[17px] leading-[1.6] tracking-[-0.01em] text-ink-2"
                }
              >
                {p}
              </p>
            ))}
          </div>
          <div className="mt-7 flex items-center gap-3">
            <span className="h-px flex-1 bg-line" aria-hidden />
            <span className="font-mono text-[9.5px] uppercase tracking-[0.2em] text-ink-faint">
              end of restatement
            </span>
            <span className="h-px flex-1 bg-line" aria-hidden />
          </div>
        </div>
      </div>

      <div className="grid gap-px border-t border-line bg-line md:grid-cols-3">
        <div className="bg-bg-deep/30 px-5 py-4">
          <Label>Generated from</Label>
          <p className="mt-2 text-[12.5px] leading-relaxed text-ink-muted">
            Session{" "}
            <span className="font-mono text-ink-2">{brief?.sessionId ?? "—"}</span> — the brand&apos;s
            own transcript, read in full rather than summarised by the person who wrote the brief.
          </p>
        </div>
        <div className="bg-bg-deep/30 px-5 py-4">
          <Label>Rights as quoted</Label>
          <p className="mt-2 text-[12.5px] leading-relaxed text-ink-muted">
            {offer.exclusivity.replace(/-/g, " ")} · {brief?.commercialUse.durationMonths ?? "—"} month
            term · {brief?.commercialUse.territory ?? "—"}
          </p>
        </div>
        <div className="bg-bg-deep/30 px-5 py-4">
          <Label>Why it reads differently</Label>
          <p className="mt-2 text-[12.5px] leading-relaxed text-ink-muted">
            It is addressed to one creator in the second person, ordered by how much each constraint
            matters, and it does not hide the exclusions.
          </p>
        </div>
      </div>

      <div className="flex gap-3 border-t border-line px-5 py-4">
        <Stamp className="mt-0.5 size-3.5 shrink-0 text-caramel" />
        <p className="max-w-3xl text-[12px] leading-relaxed text-ink-muted">
          The creator saw this text and the original transcript side by side. Neither is a lossy
          summary written by CREAM &mdash; the transcript is verbatim, and this is an explanation of
          it that names every constraint the brand stated.
        </p>
      </div>
    </article>
  );
}
