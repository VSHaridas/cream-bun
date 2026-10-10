import type { SignalTier, TrustAssessment, VerificationSignal } from "@/lib/domain/types";
import { SIGNAL_META, TIER_META } from "@/lib/domain/trust";
import { cn, formatDate } from "@/lib/utils";
import { Badge } from "@/components/ui/primitives";

/* ── tier styling ─────────────────────────────────────────────────────────── */

const TIER_STYLE: Record<SignalTier, { chip: string; dot: string; text: string }> = {
  verified: { chip: "border-mint/40 bg-mint/10 text-mint", dot: "bg-mint", text: "text-mint" },
  attested: { chip: "border-caramel/40 bg-caramel/10 text-caramel", dot: "bg-caramel", text: "text-caramel" },
  unverified: { chip: "border-line bg-surface-2/70 text-ink-faint", dot: "bg-ink-faint", text: "text-ink-faint" },
  expired: { chip: "border-rose/40 bg-rose/10 text-rose", dot: "bg-rose", text: "text-rose" },
};

export function TierBadge({ tier, className }: { tier: SignalTier; className?: string }) {
  const s = TIER_STYLE[tier];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-[3px] text-[10.5px] font-medium leading-none",
        s.chip,
        className,
      )}
    >
      <span className={cn("size-1.5 rounded-full", s.dot)} />
      {TIER_META[tier].label}
    </span>
  );
}

const KIND_GLYPH: Record<VerificationSignal["kind"], string> = {
  identity: "ID",
  tools: "TL",
  workflow: "WF",
  portfolio: "PF",
  delivery: "DL",
  client: "CL",
};

/* ── one signal ───────────────────────────────────────────────────────────── */

export function SignalRow({ signal, compact }: { signal: VerificationSignal; compact?: boolean }) {
  const style = TIER_STYLE[signal.tier];
  return (
    <div className="group flex gap-3.5 rounded-xl border border-transparent px-1 py-3 transition-colors hover:border-line hover:bg-surface-2/40 sm:px-2">
      <div
        className={cn(
          "mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg border font-mono text-[9.5px] tracking-tight",
          style.chip,
        )}
        aria-hidden
      >
        {KIND_GLYPH[signal.kind]}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <span className="text-[13.5px] font-medium leading-tight text-ink">{signal.title}</span>
          {!compact && <TierBadge tier={signal.tier} />}
        </div>
        <p className="mt-1 text-[12.5px] leading-relaxed text-ink-muted">{signal.detail}</p>
        {!compact && (
          <p className="mt-2 flex items-start gap-1.5 text-[11.5px] leading-relaxed text-ink-faint">
            <span className="mt-[3px] block size-1 shrink-0 rounded-full bg-ink-faint/70" />
            <span>
              <span className="font-medium text-ink-muted">{TIER_META[signal.tier].blurb}.</span>{" "}
              {signal.evidence}
              {signal.verifiedAt && (
                <span className="ml-1 opacity-70">· checked {formatDate(signal.verifiedAt)}</span>
              )}
            </span>
          </p>
        )}
        {signal.reference && !compact && (
          <code className="mt-2 inline-block rounded bg-surface-3/80 px-1.5 py-0.5 font-mono text-[10px] text-ink-muted">
            {signal.reference}
          </code>
        )}
      </div>
    </div>
  );
}

/* ── the trust dial ───────────────────────────────────────────────────────── */

export function TrustDial({
  assessment,
  size = 108,
  className,
}: {
  assessment: TrustAssessment;
  size?: number;
  className?: string;
}) {
  const { score } = assessment;
  const r = size / 2 - 7;
  const c = 2 * Math.PI * r;
  const tone =
    score >= 88 ? "var(--mint)" : score >= 68 ? "var(--caramel)" : "var(--ink-faint)";
  const tierLabel =
    assessment.tier === "elite"
      ? "Elite"
      : assessment.tier === "verified"
        ? "Verified"
        : assessment.tier === "attested"
          ? "Attested"
          : "Unverified";

  return (
    <div className={cn("relative", className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-3)" strokeWidth={5} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={tone}
          strokeWidth={5}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c - (c * score) / 100}
          style={{ transition: "stroke-dashoffset 1.1s cubic-bezier(0.16,1,0.3,1)" }}
        />
      </svg>
      <div className="absolute inset-0 grid place-content-center text-center">
        <div className="font-display text-[30px] leading-none tracking-[-0.03em]" style={{ color: tone }}>
          {score}
        </div>
        <div className="mt-1 font-mono text-[9px] uppercase tracking-[0.14em] text-ink-faint">
          {tierLabel}
        </div>
      </div>
    </div>
  );
}

/* ── compact inline strip used on cards ───────────────────────────────────── */

export function TrustStrip({
  assessment,
  className,
}: {
  assessment: TrustAssessment;
  className?: string;
}) {
  const kinds = Object.keys(SIGNAL_META) as VerificationSignal["kind"][];
  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      <span
        className={cn(
          "font-mono text-[10.5px] font-medium tabular-nums",
          assessment.score >= 88 ? "text-mint" : assessment.score >= 68 ? "text-caramel" : "text-ink-faint",
        )}
      >
        {assessment.score}
      </span>
      <div className="flex gap-0.5" title={`${assessment.verifiedCount} verified signals`}>
        {kinds.map((k) => {
          const s = assessment.signals.find((x) => x.kind === k);
          const verified = s?.tier === "verified";
          const attested = s?.tier === "attested";
          return (
            <span
              key={k}
              title={`${SIGNAL_META[k].label} — ${TIER_META[s?.tier ?? "unverified"].label}`}
              className={cn(
                "h-3 w-[3px] rounded-full",
                verified
                  ? "bg-mint"
                  : attested
                    ? "bg-caramel/70"
                    : s?.tier === "expired"
                      ? "bg-rose/60"
                      : "bg-line-strong",
              )}
            />
          );
        })}
      </div>
    </div>
  );
}

/* ── full panel ───────────────────────────────────────────────────────────── */

export function TrustPanel({
  assessment,
  className,
}: {
  assessment: TrustAssessment;
  className?: string;
}) {
  const order: VerificationSignal["kind"][] = ["identity", "tools", "workflow", "portfolio", "delivery", "client"];
  const sorted = [...assessment.signals].sort(
    (a, b) => order.indexOf(a.kind) - order.indexOf(b.kind),
  );

  return (
    <div className={cn("rounded-lg border border-line bg-surface", className)}>
      <div className="flex flex-wrap items-center gap-5 border-b border-line px-5 py-4">
        <TrustDial assessment={assessment} size={84} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-[15px] font-medium text-ink">Trust assessment</h3>
            <Badge tone={assessment.score >= 88 ? "mint" : assessment.score >= 68 ? "caramel" : "neutral"}>
              {assessment.verifiedCount} verified · {assessment.attestedCount} attested
            </Badge>
          </div>
          <p className="mt-1.5 max-w-md text-[12.5px] leading-relaxed text-ink-muted">
            Only independently substantiated claims contribute to this score. Self-reported
            claims are shown but deliberately score zero.
          </p>
        </div>
      </div>
      <div className="divide-y divide-line/70 px-3 py-1">
        {sorted.map((s) => (
          <SignalRow key={s.id} signal={s} />
        ))}
      </div>
    </div>
  );
}