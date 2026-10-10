import {
  Ban,
  Coins,
  GitBranch,
  Landmark,
  Link2,
  ScanSearch,
  ShieldCheck,
  Stamp,
} from "lucide-react";
import type { Escrow, ProvenanceRecord } from "@/lib/domain/types";
import { formatDateTime, inr, pct, rupees } from "@/lib/utils";
import { Badge, Label, Meter } from "@/components/ui/primitives";

/* ── 3 · escrow ───────────────────────────────────────────────────────────── */

export interface PayoutMath {
  gross: number;
  platformFee: number;
  platformFeeRate: number;
  creatorGross: number;
  tds: number;
  creatorNet: number;
  tdsRate: number;
}

export interface EscrowPolicy {
  captureOn: string;
  releaseTrigger: string;
  settlement: string;
  dispute: string;
  refundAuthority: string;
  custody: string;
}

export function EscrowPanel({
  escrow,
  policy,
  math,
}: {
  escrow: Escrow | undefined;
  policy: EscrowPolicy;
  math: PayoutMath | null;
}) {
  if (!escrow) {
    return (
      <div className="rounded-xl border border-dashed border-line bg-surface/40 px-6 py-8">
        <div className="flex items-start gap-3">
          <Ban className="mt-0.5 size-4 shrink-0 text-rose" />
          <div>
            <p className="text-[13.5px] text-ink">No escrow captured for this engagement.</p>
            <p className="mt-2 max-w-xl text-[12.5px] leading-relaxed text-ink-muted">
              {policy.captureOn}. Until that happens there is nothing to release against, so production
              cannot legitimately have started.
            </p>
          </div>
        </div>
        <dl className="mt-6 grid gap-x-6 gap-y-4 border-t border-line pt-5 sm:grid-cols-2">
          <PolicyRow k="Capture" v={policy.captureOn} />
          <PolicyRow k="Release" v={policy.releaseTrigger} />
          <PolicyRow k="Settlement" v={policy.settlement} />
          <PolicyRow k="Custody" v={policy.custody} />
        </dl>
      </div>
    );
  }

  const held = escrow.amountInr - escrow.releasedInr;
  const releasedPct = (escrow.releasedInr / escrow.amountInr) * 100;

  return (
    <div className="overflow-hidden rounded-xl border border-line bg-surface">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-line px-5 py-4">
        <div className="flex items-center gap-2.5">
          <Landmark className="size-3.5 text-caramel" />
          <span className="text-[14px] font-medium text-ink">Escrow</span>
          <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-faint">
            {escrow.code}
          </span>
        </div>
        <Badge tone={held > 0 ? "caramel" : "mint"}>{escrow.status.replace(/-/g, " ")}</Badge>
      </div>

      <div className="px-5 py-6">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <Label>Gross captured</Label>
            <div className="mt-2 font-display text-[40px] leading-none tracking-[-0.035em] tabular-nums text-ink">
              {rupees(escrow.amountInr)}
            </div>
            <div className="mt-2 font-mono text-[11px] tabular-nums text-ink-faint">
              {inr(escrow.amountInr)} · {escrow.currency} · {escrow.gateway}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-x-8 gap-y-3">
            <Figure k="Released" v={rupees(escrow.releasedInr)} tone="mint" />
            <Figure k="Held" v={rupees(held)} tone="caramel" />
          </div>
        </div>

        <div className="mt-6">
          <Meter
            value={escrow.releasedInr}
            max={escrow.amountInr}
            tone={held > 0 ? "caramel" : "mint"}
            showLabel
          />
          <div className="mt-2 flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.1em] text-ink-faint">
            <span>captured {escrow.capturedAt ? formatDateTime(escrow.capturedAt) : "—"}</span>
            <span>{pct(releasedPct)} released</span>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-2.5">
          <Badge tone="neutral" className="font-mono text-[10px]">
            order {escrow.gatewayOrderId}
          </Badge>
          {escrow.gatewayPaymentId && (
            <Badge tone="neutral" className="font-mono text-[10px]">
              payment {escrow.gatewayPaymentId}
            </Badge>
          )}
          <Badge tone="neutral" className="font-mono text-[10px]">
            {escrow.payoutRoute}
          </Badge>
        </div>

        <p className="mt-5 border-t border-line pt-4 text-[12.5px] leading-relaxed text-ink-muted">
          {escrow.protectedBy}
        </p>
      </div>

      {math && (
        <div className="border-t border-line bg-bg-deep/30 px-5 py-6">
          <div className="flex items-center gap-2">
            <Coins className="size-3.5 text-caramel" />
            <Label>Payout arithmetic on the released tranche</Label>
          </div>
          <dl className="mt-4 space-y-2 font-mono text-[12px] tabular-nums">
            <MathRow k="gross released" v={inr(math.gross)} strong />
            <MathRow
              k={`platform fee @ ${pct(math.platformFeeRate * 100)}`}
              v={`− ${inr(math.platformFee)}`}
              tone="rose"
            />
            <MathRow k="creator gross" v={inr(math.creatorGross)} />
            <MathRow k={`TDS @ ${pct(math.tdsRate * 100)}`} v={`− ${inr(math.tds)}`} tone="rose" />
            <div className="mt-2 border-t border-line pt-2.5">
              <MathRow k="creator net" v={inr(math.creatorNet)} strong tone="mint" />
            </div>
          </dl>
          <p className="mt-4 font-mono text-[10.5px] leading-relaxed text-ink-faint">
            {inr(math.gross)} − {inr(math.platformFee)} − {inr(math.tds)} = {inr(math.creatorNet)} ·
            {" "}{policy.settlement}
          </p>
        </div>
      )}

      <div className="border-t border-line px-5 py-5">
        <Label>Why it works this way</Label>
        <dl className="mt-4 grid gap-x-6 gap-y-4 sm:grid-cols-2">
          <PolicyRow k="Capture on" v={policy.captureOn} />
          <PolicyRow k="Release trigger" v={policy.releaseTrigger} />
          <PolicyRow k="Settlement" v={policy.settlement} />
          <PolicyRow k="Custody" v={policy.custody} />
        </dl>
        <div className="mt-5 flex gap-3 rounded-lg border border-dashed border-line bg-surface/60 px-4 py-3.5">
          <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-mint" />
          <p className="text-[11.5px] leading-relaxed text-ink-faint">
            <span className="text-ink-muted">Dispute rule.</span> {policy.dispute}
          </p>
        </div>
        <div className="mt-3 flex gap-3 rounded-lg border border-dashed border-line bg-surface/60 px-4 py-3.5">
          <Landmark className="mt-0.5 size-3.5 shrink-0 text-caramel" />
          <p className="text-[11.5px] leading-relaxed text-ink-faint">
            <span className="text-ink-muted">Refund authority.</span> {policy.refundAuthority}
          </p>
        </div>
      </div>
    </div>
  );
}

function Figure({ k, v, tone }: { k: string; v: string; tone: "mint" | "caramel" }) {
  return (
    <div>
      <Label>{k}</Label>
      <div
        className={`mt-2 font-display text-[24px] leading-none tabular-nums ${tone === "mint" ? "text-mint" : "text-caramel"}`}
      >
        {v}
      </div>
    </div>
  );
}

function MathRow({
  k,
  v,
  strong,
  tone,
}: {
  k: string;
  v: string;
  strong?: boolean;
  tone?: "rose" | "mint";
}) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className={strong ? "text-ink" : "text-ink-faint"}>{k}</dt>
      <dd
        className={
          tone === "mint"
            ? "text-mint"
            : tone === "rose"
              ? "text-rose"
              : strong
                ? "text-ink"
                : "text-ink-2"
        }
      >
        {v}
      </dd>
    </div>
  );
}

function PolicyRow({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <dt className="label-xs">{k}</dt>
      <dd className="mt-1.5 text-[12px] leading-relaxed text-ink-muted">{v}</dd>
    </div>
  );
}

/* ── 6 · provenance ───────────────────────────────────────────────────────── */

export function ProvenancePanel({ records }: { records: ProvenanceRecord[] }) {
  if (records.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-line bg-surface/40 px-6 py-8 text-center">
        <Stamp className="size-4 text-ink-faint" />
        <p className="mt-3 text-[13px] leading-relaxed text-ink-muted">
          No provenance record has been stamped for this engagement yet. Every released sample gets one
          before it leaves the review sandbox.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {records.map((r) => (
        <article key={r.id} className="overflow-hidden rounded-xl border border-line bg-surface">
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-line px-5 py-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2.5">
                <Stamp className="size-3.5 text-caramel" />
                <span className="font-mono text-[11.5px] text-ink">{r.assetName}</span>
                <Badge tone="neutral">round {r.roundId}</Badge>
              </div>
              <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[10px] tabular-nums text-ink-faint">
                <span>c2pa {r.c2pa.version}</span>
                <span>{r.c2pa.claimGenerator}</span>
                <span>signed {formatDateTime(r.c2pa.signedAt)}</span>
              </div>
            </div>
            <a
              href="/trust#provenance"
              className="inline-flex shrink-0 items-center gap-1 font-mono text-[10px] uppercase tracking-[0.12em] text-caramel hover:underline"
            >
              how it works
              <Link2 className="size-3" />
            </a>
          </div>

          <div className="grid gap-px bg-line lg:grid-cols-2">
            <div className="bg-surface px-5 py-5">
              <div className="flex items-center gap-2">
                <ShieldCheck className="size-3.5 text-mint" />
                <Label>C2PA assertions</Label>
              </div>
              <ul className="mt-3.5 space-y-2">
                {r.c2pa.assertions.map((a) => (
                  <li key={a} className="flex gap-2.5">
                    <span className="mt-[7px] block size-1 shrink-0 rounded-full bg-mint/70" />
                    <span className="font-mono text-[11.5px] leading-relaxed text-ink-2">{a}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-4 flex items-center gap-2 border-t border-line pt-3.5">
                <FingerprintTiny />
                <code className="truncate font-mono text-[10px] text-ink-faint">
                  {r.c2pa.manifestHash}
                </code>
              </div>
            </div>

            <div className="space-y-px">
              <div className="bg-surface px-5 py-5">
                <div className="flex items-center gap-2">
                  <ScanSearch className="size-3.5 text-violet" />
                  <Label>Invisible watermark</Label>
                </div>
                <dl className="mt-3.5 space-y-2 font-mono text-[11.5px] tabular-nums">
                  <KV k="provider" v={r.synthid.provider} />
                  <KV k="payload" v={r.synthid.payloadId} />
                  <KV k="strength" v={r.synthid.strength.toFixed(2)} />
                  <KV k="embedded" v={r.synthid.embedded ? "yes" : "no"} />
                  <KV k="extractable" v={r.synthid.extractable ? "yes" : "no"} />
                  {r.synthid.lastDetection && (
                    <KV
                      k="last detection"
                      v={`matched ${r.synthid.lastDetection.matched ? "at" : "no"} ${pct(
                        r.synthid.lastDetection.confidence * 100,
                      )}`}
                      tone="mint"
                    />
                  )}
                </dl>
              </div>

              <div className="bg-surface px-5 py-5">
                <div className="flex items-center gap-2">
                  <Stamp className="size-3.5 text-caramel" />
                  <Label>Visible burn-in</Label>
                </div>
                <div className="mt-3.5 rounded-lg border border-line bg-bg-deep/40 px-3.5 py-3">
                  <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-ink">
                    {r.visible.creatorWatermark} · {r.visible.platformWatermark}
                  </div>
                  <div className="mt-1.5 font-mono text-[9.5px] uppercase tracking-[0.14em] text-ink-faint">
                    pre-approval watermark · not licensed for use
                  </div>
                </div>
                <dl className="mt-3.5 space-y-2 font-mono text-[11.5px] tabular-nums">
                  <KV k="position" v={r.visible.position} />
                  <KV k="opacity" v={r.visible.opacity.toFixed(2)} />
                </dl>
              </div>
            </div>
          </div>

          <div className="border-t border-line px-5 py-5">
            <div className="flex items-center gap-2">
              <GitBranch className="size-3.5 text-caramel" />
              <Label>Chain of custody</Label>
            </div>
            <ol className="mt-4 space-y-0 border-l border-line pl-6">
              {r.chainOfCustody.map((c) => (
                <li key={c.event} className="relative pb-4 last:pb-0">
                  <span className="absolute -left-[1.6rem] top-1 grid size-3.5 place-items-center rounded-full border border-line bg-surface">
                    <span className="size-1 rounded-full bg-caramel" />
                  </span>
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <span className="text-[12.5px] text-ink">{c.event}</span>
                    <span className="font-mono text-[10px] tabular-nums text-ink-faint">
                      {formatDateTime(c.at)}
                    </span>
                  </div>
                  <div className="mt-0.5 text-[11.5px] text-ink-faint">{c.actor}</div>
                </li>
              ))}
            </ol>
          </div>
        </article>
      ))}
    </div>
  );
}

function FingerprintTiny() {
  return <ScanSearch className="size-3 shrink-0 text-ink-faint" />;
}

function KV({ k, v, tone }: { k: string; v: string; tone?: "mint" }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-ink-faint">{k}</dt>
      <dd className={tone === "mint" ? "truncate text-mint" : "truncate text-ink-2"}>{v}</dd>
    </div>
  );
}
