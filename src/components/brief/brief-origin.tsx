import Link from "next/link";
import {
  ArrowUpRight,
  CircleCheck,
  MessageSquare,
  Quote,
  Send,
  Sparkles,
  User,
} from "lucide-react";
import type { Brief, BriefSession, Creator, Offer, TrustAssessment } from "@/lib/domain/types";
import { compactInr, formatDateTime } from "@/lib/utils";
import { Badge, Label } from "@/components/ui/primitives";
import { TrustStrip } from "@/components/trust/trust";

/* ── 7 · the originating conversation ─────────────────────────────────────── */

export function BriefTranscript({ session }: { session: BriefSession }) {
  const extracted = session.turns.reduce((s, t) => s + t.extractedFields.length, 0);

  return (
    <div className="overflow-hidden rounded-xl border border-line bg-surface">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line px-5 py-4">
        <div className="flex items-center gap-2.5">
          <MessageSquare className="size-3.5 text-caramel" />
          <span className="text-[14px] font-medium text-ink">The originating conversation</span>
        </div>
        <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-faint">
          {session.turns.length} turns · {extracted} fields written · {session.status}
        </span>
      </div>

      <div className="px-5 py-6 md:px-7">
        <ol className="space-y-6">
          {session.turns.map((t) => {
            const brand = t.role === "brand";
            return (
              <li key={t.id} className="flex gap-4">
                <span
                  className={`grid size-7 shrink-0 place-items-center rounded-lg border ${
                    brand
                      ? "border-line bg-surface-2 text-ink-faint"
                      : "border-caramel/35 bg-caramel/10 text-caramel"
                  }`}
                  aria-hidden
                >
                  {brand ? <User className="size-3.5" /> : <Sparkles className="size-3.5" />}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <span
                      className={`font-mono text-[10px] uppercase tracking-[0.14em] ${
                        brand ? "text-ink-faint" : "text-caramel"
                      }`}
                    >
                      {brand ? "brand" : t.role}
                    </span>
                    <span className="font-mono text-[10px] tabular-nums text-ink-faint">
                      {formatDateTime(t.at)}
                    </span>
                  </div>
                  <p
                    className={`mt-2 max-w-3xl text-[13.5px] leading-relaxed ${
                      brand ? "font-mono text-ink-2" : "text-ink-muted"
                    }`}
                  >
                    {brand && <span className="text-ink-faint">&ldquo;</span>}
                    {t.text}
                    {brand && <span className="text-ink-faint">&rdquo;</span>}
                  </p>
                  {t.extractedFields.length > 0 && (
                    <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                      <span className="label-xs">written to draft</span>
                      {t.extractedFields.map((f) => (
                        <span
                          key={f}
                          className="inline-flex items-center gap-1 rounded-full border border-mint/35 bg-mint/[0.08] px-2 py-[3px] font-mono text-[9.5px] uppercase tracking-[0.1em] text-mint"
                        >
                          <CircleCheck className="size-2.5" />
                          {f}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      </div>

      <div className="flex gap-3 border-t border-line bg-bg-deep/35 px-5 py-5 md:px-7">
        <Quote className="mt-0.5 size-3.5 shrink-0 text-caramel" />
        <p className="max-w-3xl text-[13px] leading-relaxed text-ink-2">
          This transcript is a persisted entity, not a log. It is re-hydrated on the creator&apos;s
          side when an offer arrives, alongside a plain-language restatement, so a creator receives
          the brand&apos;s actual intent instead of a summary somebody else wrote about it.
        </p>
      </div>
    </div>
  );
}

/* ── 8 · shortlist and offers ─────────────────────────────────────────────── */

export function Shortlist({
  brief,
  creators,
  assessTrust,
}: {
  brief: Brief;
  creators: Creator[];
  assessTrust: (creator: Creator) => TrustAssessment;
}) {
  if (creators.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-line bg-surface/40 p-6 text-center">
        <p className="text-[13px] text-ink-muted">
          Nobody shortlisted yet. The brief is {brief.status === "open" ? "open to the pool" : brief.status}.
        </p>
      </div>
    );
  }
  return (
    <div className="overflow-hidden rounded-xl border border-line bg-surface">
      <div className="border-b border-line px-5 py-4">
        <Label>Shortlist</Label>
      </div>
      <ul className="divide-y divide-line/70">
        {creators.map((c) => {
          const trust = assessTrust(c);
          return (
            <li key={c.id}>
              <Link
                href={`/creators/${c.handle}`}
                className="group flex items-center justify-between gap-5 px-5 py-4 transition-colors hover:bg-surface-2/40"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span className="text-[14px] font-medium text-ink">{c.displayName}</span>
                    <span className="truncate font-mono text-[10.5px] text-ink-faint">
                      @{c.handle}
                    </span>
                    {trust.score >= 88 && <Badge tone="mint">elite</Badge>}
                  </div>
                  <p className="mt-1 truncate text-[12.5px] text-ink-muted">{c.headline}</p>
                </div>
                <div className="flex shrink-0 items-center gap-4">
                  <TrustStrip assessment={trust} />
                  <span className="font-mono text-[12px] tabular-nums text-ink">
                    {compactInr(c.dayRateInr)}
                    <span className="text-ink-faint">/d</span>
                  </span>
                  <ArrowUpRight className="size-4 text-ink-faint transition-all duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-caramel" />
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function OfferCard({ offer, creator }: { offer: Offer; creator?: Creator }) {
  const released = offer.status === "accepted";
  return (
    <article className="overflow-hidden rounded-xl border border-line bg-surface">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-line px-5 py-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-ink-faint">
              {offer.code}
            </span>
            <Badge
              tone={
                offer.status === "accepted"
                  ? "mint"
                  : offer.status === "negotiating"
                    ? "caramel"
                    : offer.status === "declined"
                      ? "rose"
                      : "neutral"
              }
            >
              {offer.status}
            </Badge>
          </div>
          <p className="mt-2 text-[13px] text-ink-2">
            {creator ? (
              <Link href={`/creators/${creator.handle}`} className="hover:text-caramel">
                {creator.displayName}
              </Link>
            ) : (
              "Creator"
            )}
          </p>
        </div>
        <div className="text-right">
          <div className="font-display text-[28px] leading-none tracking-[-0.025em] tabular-nums text-caramel">
            {compactInr(offer.amountInr)}
          </div>
          <div className="mt-1.5 font-mono text-[10px] uppercase tracking-[0.1em] text-ink-faint">
            {offer.deliveryDays}d · {offer.revisionsIncluded} revisions · {offer.conceptRounds} concept
          </div>
        </div>
      </div>

      <div className="px-5 py-5">
        <div className="flex items-center justify-between gap-3">
          <Label>Milestones</Label>
          <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-faint">
            {offer.exclusivity.replace(/-/g, " ")}
          </span>
        </div>
        <div className="mt-3.5 flex h-1.5 gap-[2px] overflow-hidden rounded-full">
          {offer.milestones.map((m, i) => (
            <span
              key={m.label}
              className="h-full rounded-full"
              style={{
                flex: m.pct,
                background: released && i < 2 ? "var(--mint)" : "var(--caramel)",
                opacity: released && i >= 2 ? 0.55 : 1,
              }}
              title={`${m.label} — ${m.pct}%`}
            />
          ))}
        </div>
        <ul className="mt-3.5 space-y-2">
          {offer.milestones.map((m, i) => (
            <li key={m.label} className="flex items-center gap-3 text-[12.5px]">
              <span className="font-mono text-[10.5px] tabular-nums text-ink-faint">
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className="flex-1 truncate text-ink-2">{m.label}</span>
              <span className="font-mono text-[11.5px] tabular-nums text-caramel">{m.pct}%</span>
              <span className="font-mono text-[11px] tabular-nums text-ink-faint">d{m.dueDay}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="border-t border-line px-5 py-5">
        <div className="flex items-center gap-2">
          <Send className="size-3 text-caramel" />
          <Label>As the creator received it</Label>
        </div>
        <div className="mt-3 space-y-3 border-l-2 border-caramel/35 pl-4">
          {offer.translatedBrief.split("\n\n").map((p, i) => (
            <p key={i} className="text-[13.5px] leading-[1.7] text-ink-2">
              {p}
            </p>
          ))}
        </div>

        {offer.translationTurns.length > 0 && (
          <div className="mt-5 space-y-3 border-t border-line pt-4">
            <Label>Translation turns</Label>
            {offer.translationTurns.map((t) => (
              <div key={t.id} className="flex gap-3">
                <Sparkles className="mt-0.5 size-3.5 shrink-0 text-caramel" />
                <div className="min-w-0">
                  <p className="text-[12.5px] leading-relaxed text-ink-muted">{t.text}</p>
                  <p className="mt-1 font-mono text-[10px] tabular-nums text-ink-faint">
                    {formatDateTime(t.at)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {offer.note && (
        <div className="border-t border-line bg-bg-deep/30 px-5 py-4">
          <Label>Creator&apos;s note</Label>
          <p className="mt-2 text-[12.5px] leading-relaxed text-ink-muted">{offer.note}</p>
        </div>
      )}
    </article>
  );
}
