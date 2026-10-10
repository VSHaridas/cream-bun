"use client";

import * as React from "react";
import { BookmarkCheck, Bookmark, Send, Share2, MapPin, Clock, Globe, Check } from "lucide-react";
import type { Creator, PortfolioPiece, Review, TrustAssessment, Workflow } from "@/lib/domain/types";
import { CONTENT_TYPE_META } from "@/lib/domain/types";
import { SKILL_NAME_BY_ID, SKILL_TAXONOMY, toolById } from "@/lib/domain/taxonomy";
import { SIGNAL_META } from "@/lib/domain/trust";
import { useApp } from "@/lib/store";
import { cn, compactInr, formatDate, relativeTime } from "@/lib/utils";
import { Badge, Button, Chip, Label } from "@/components/ui/primitives";
import { CreatorAvatar } from "@/components/creator/avatar";
import { TrustDial, TrustPanel } from "@/components/trust/trust";
import { PieceCard, PieceDialog } from "@/components/portfolio/piece-gallery";
import { GenerativeArt } from "@/components/media/generative-art";

export function CreatorProfile({
  creator,
  pieces,
  workflows,
  reviews,
  trust,
}: {
  creator: Creator;
  pieces: PortfolioPiece[];
  workflows: Workflow[];
  reviews: Review[];
  trust: TrustAssessment;
}) {
  const shortlisted = useApp((s) => s.shortlist.includes(creator.id));
  const toggle = useApp((s) => s.toggleShortlist);
  const sendOffer = useApp((s) => s.sendOffer);
  const offerSent = useApp((s) => s.offersSent.includes(creator.id));
  const [copied, setCopied] = React.useState(false);

  const [typeFilter, setTypeFilter] = React.useState<string | null>(null);
  const [openPiece, setOpenPiece] = React.useState<PortfolioPiece | null>(null);

  
  const shown = typeFilter ? pieces.filter((p) => p.contentType === typeFilter) : pieces;
  const types = Array.from(new Set(pieces.map((p) => p.contentType)));

  async function copy() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="pb-24">
      {/* ── hero ── */}
      <section className="relative overflow-hidden border-b border-line">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage: `radial-gradient(70% 90% at 22% -20%, ${creator.accent}22, transparent 62%)`,
          }}
        />
        <div className="container-x relative py-12 md:py-16">
          <div className="grid gap-10 lg:grid-cols-[1fr_auto] lg:items-start">
            <div className="flex flex-col gap-7 md:flex-row md:gap-9">
              <CreatorAvatar creator={creator} size={116} className="shrink-0" />

              <div className="min-w-0 max-w-2xl">
                <div className="flex flex-wrap items-center gap-2">
                  {creator.studioName && (
                    <Badge tone="neutral" className="font-mono text-[10px] uppercase tracking-[0.1em]">
                      {creator.studioName}
                    </Badge>
                  )}
                  <Badge tone={creator.availability === "open" ? "mint" : creator.availability === "limited" ? "caramel" : "neutral"}>
                    {creator.availability === "open" ? "Open for briefs" : creator.availability === "limited" ? "Limited capacity" : "Waitlist"}
                  </Badge>
                  {creator.badges.map((b) => (
                    <Badge key={b} tone="violet">
                      {b}
                    </Badge>
                  ))}
                </div>

                <h1 className="mt-4 display-lg">{creator.displayName}</h1>
                <p className="mt-2 font-mono text-[12px] text-ink-faint">@{creator.handle}</p>
                <p className="mt-5 text-balance-pretty font-display text-[21px] leading-snug tracking-[-0.02em] text-ink-2">
                  {creator.headline}
                </p>

                <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-[12.5px] text-ink-muted">
                  <span className="inline-flex items-center gap-1.5">
                    <MapPin className="size-3.5 text-ink-faint" />
                    {creator.location}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Clock className="size-3.5 text-ink-faint" />
                    {creator.timezone}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Globe className="size-3.5 text-ink-faint" />
                    {creator.languages.join(", ")}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-col items-start gap-4 lg:items-end">
              <div className="flex items-center gap-4 rounded-xl border border-line bg-surface/80 p-4 backdrop-blur">
                <TrustDial assessment={trust} size={92} />
                <div className="space-y-1">
                  <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-faint">
                    Day rate
                  </div>
                  <div className="font-display text-[26px] leading-none tabular-nums text-ink">
                    {compactInr(creator.dayRateInr)}
                  </div>
                  <div className="text-[11px] text-ink-faint">
                    min {compactInr(creator.minimumEngagementInr)}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  variant={shortlisted ? "accent" : "outline"}
                  onClick={() => toggle(creator.id)}
                >
                  {shortlisted ? <BookmarkCheck className="size-3.5" /> : <Bookmark className="size-3.5" />}
                  {shortlisted ? "Shortlisted" : "Shortlist"}
                </Button>
                <Button
                  variant={offerSent ? "subtle" : "primary"}
                  onClick={() => sendOffer(creator.id)}
                >
                  {offerSent ? <Check className="size-3.5" /> : <Send className="size-3.5" />}
                  {offerSent ? "Offer sent" : "Send offer"}
                </Button>
                <Button variant="ghost" size="icon" onClick={copy} aria-label="Copy profile link">
                  {copied ? <Check className="size-4 text-mint" /> : <Share2 className="size-4" />}
                </Button>
              </div>
            </div>
          </div>

          {/* stat strip */}
          <dl className="mt-12 grid grid-cols-2 gap-x-6 gap-y-6 border-t border-line pt-8 sm:grid-cols-3 lg:grid-cols-6">
            {[
              { k: "Engagements", v: creator.stats.engagements },
              { k: "On time", v: `${creator.stats.onTimeRate}%` },
              { k: "Approved first pass", v: `${creator.stats.approvalRate}%` },
              { k: "Repeat clients", v: `${creator.stats.repeatClientRate}%` },
              { k: "Quoted turnaround", v: `${creator.turnaroundDays}d` },
              { k: "Median reply", v: `${creator.stats.responseMinutes}m` },
            ].map((s) => (
              <div key={s.k}>
                <dt className="label-xs">{s.k}</dt>
                <dd className="mt-2 font-display text-[26px] leading-none tracking-[-0.02em] tabular-nums text-ink">
                  {s.v}
                </dd>
              </div>
            ))}
          </dl>
          <p className="mt-6 max-w-2xl text-[11.5px] leading-relaxed text-ink-faint">
            Every figure above is derived from closed engagements and payout releases. None of it is
            self-reported, which is why CREAM cannot show a creator a metric they have inflated.
          </p>
        </div>
      </section>

      <div className="container-x mt-14 grid gap-10 lg:grid-cols-[1fr_340px] lg:gap-14">
        {/* ── main column ── */}
        <div className="min-w-0 space-y-16">
          <section>
            <h2 className="display-md">The work</h2>
            <p className="mt-3 max-w-2xl text-[14px] leading-relaxed text-ink-muted">
              {creator.philosophy}
            </p>

            <div className="mt-7 flex flex-wrap items-center gap-1.5">
              <Chip active={typeFilter === null} onClick={() => setTypeFilter(null)}>
                All work · {pieces.length}
              </Chip>
              {types.map((t) => (
                <Chip key={t} active={typeFilter === t} onClick={() => setTypeFilter(t)}>
                  {CONTENT_TYPE_META[t as keyof typeof CONTENT_TYPE_META].label} ·{" "}
                  {pieces.filter((p) => p.contentType === t).length}
                </Chip>
              ))}
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {shown.map((p) => (
                <PieceCard key={p.id} piece={p} onOpen={() => setOpenPiece(p)} />
              ))}
            </div>
          </section>

          {/* workflows */}
          <section>
            <h2 className="display-md">Published workflows</h2>
            <p className="mt-3 max-w-2xl text-[14px] leading-relaxed text-ink-muted">
              A portfolio tells you what the result looked like. A workflow tells you whether the
              creator can do it again on your deadline. Every stage names where a human made the
              call.
            </p>

            <div className="mt-7 space-y-4">
              {workflows.map((w) => (
                <article key={w.id} className="overflow-hidden rounded-lg border border-line bg-surface">
                  <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line p-5">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-[15px] font-medium text-ink">{w.name}</h3>
                        {w.verified && <Badge tone="mint">verified workflow</Badge>}
                      </div>
                      <p className="mt-2 max-w-xl text-[13px] leading-relaxed text-ink-muted">{w.summary}</p>
                    </div>
                    <div className="text-right">
                      <div className="label-xs">Run time</div>
                      <div className="mt-1.5 font-display text-[20px] leading-none tabular-nums text-ink">
                        {w.durationHours}h
                      </div>
                      <div className="mt-1.5 text-[10.5px] text-ink-faint">
                        last run {formatDate(w.lastRunAt)}
                      </div>
                    </div>
                  </div>

                  <div className="hidden h-1.5 sm:flex">
                    {w.stages.map((s) => (
                      <div
                        key={s.id}
                        style={{ flex: s.weight, background: `color-mix(in oklab, var(--caramel) ${18 + (s.weight / 100) * 62}%, transparent)` }}
                        title={`${s.name} — ${s.weight}%`}
                      />
                    ))}
                  </div>

                  <ol className="divide-y divide-line/70">
                    {w.stages.map((s, i) => (
                      <li key={s.id} className="grid gap-3 p-5 sm:grid-cols-[28px_1fr_150px] sm:gap-4">
                        <span className="font-mono text-[10.5px] tabular-nums text-ink-faint">
                          {String(i + 1).padStart(2, "0")}
                        </span>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-baseline gap-2.5">
                            <span className="text-[13.5px] font-medium text-ink">{s.name}</span>
                            <span className="font-mono text-[10px] tabular-nums text-caramel">{s.weight}%</span>
                          </div>
                          <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink-muted">{s.description}</p>
                          <p className="mt-2.5 border-l-2 border-caramel/40 pl-3 text-[12px] leading-relaxed text-ink-2">
                            <span className="label-xs mr-1.5">Human</span>
                            {s.humanCheckpoint}
                          </p>
                        </div>
                        <div className="flex flex-wrap content-start gap-1">
                          {s.tools.length === 0 ? (
                            <span className="text-[11px] text-ink-faint">no tooling</span>
                          ) : (
                            s.tools.map((t) => (
                              <span key={t} className="chip px-1.5 py-0.5 text-[10px]">
                                {toolById(t)?.name ?? t}
                              </span>
                            ))
                          )}
                        </div>
                      </li>
                    ))}
                  </ol>
                </article>
              ))}
            </div>
          </section>

          {/* tools & models */}
          <section>
            <h2 className="display-md">Toolchain</h2>
            <p className="mt-3 max-w-2xl text-[14px] leading-relaxed text-ink-muted">
              Split deliberately between tools the vendor has credentialed and tools the creator has
              merely asserted. The trust score counts only the first kind.
            </p>

            <div className="mt-7 grid gap-4 md:grid-cols-2">
              {(["verified", "attested"] as const).map((tier) => {
                const list = creator.tools
                  .map((t) => toolById(t))
                  .filter(Boolean)
                  .filter((t) => (tier === "verified" ? t!.verified : !t!.verified));
                if (!list.length) return null;
                return (
                  <div key={tier} className="rounded-lg border border-line bg-surface p-5">
                    <div className="mb-4 flex items-center justify-between">
                      <Label>{tier === "verified" ? "Vendor-verified" : "Self-attested"}</Label>
                      <span className="font-mono text-[10px] tabular-nums text-ink-faint">{list.length}</span>
                    </div>
                    <ul className="space-y-2">
                      {list.map((t) => (
                        <li key={t!.id} className="flex items-center justify-between gap-3">
                          <span className="flex min-w-0 items-center gap-2.5">
                            <span className="size-2 shrink-0 rounded-full" style={{ background: t!.accent }} />
                            <span className="truncate text-[13px] text-ink">{t!.name}</span>
                          </span>
                          <span className="shrink-0 font-mono text-[10.5px] tabular-nums text-ink-faint">
                            {t!.hoursLogged.toLocaleString("en-IN")}h
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}

              {creator.models.length > 0 && (
                <div className="rounded-lg border border-line bg-surface p-5 md:col-span-2">
                  <Label>Models</Label>
                  <div className="mt-3.5 flex flex-wrap gap-1.5">
                    {creator.models.map((m) => (
                      <span key={m} className="chip font-mono text-[10.5px]">
                        {m}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* skills */}
          <section>
            <h2 className="display-md">Skills</h2>
            <div className="mt-7 grid gap-4 sm:grid-cols-2">
              {Array.from(new Set(creator.skills))
                .map((s) => SKILL_TAXONOMY.find((x) => x.id === s))
                .filter(Boolean)
                .sort((a, b) => a!.category.localeCompare(b!.category))
                .map((s) => (
                  <div key={s!.id} className="rounded-lg border border-line bg-surface px-4 py-3.5">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="text-[13px] text-ink">{s!.name}</span>
                      <span className="font-mono text-[9.5px] uppercase tracking-[0.12em] text-ink-faint">
                        {s!.category}
                      </span>
                    </div>
                    <div className="mt-2.5 flex gap-1">
                      {[1, 2, 3, 4, 5].map((n) => (
                        <span
                          key={n}
                          className={cn(
                            "h-1 flex-1 rounded-full",
                            n <= 4 ? "bg-caramel/70" : "bg-line-strong",
                          )}
                        />
                      ))}
                    </div>
                  </div>
                ))}
            </div>
          </section>

          {/* reviews */}
          <section>
            <h2 className="display-md">What clients say</h2>
            <div className="mt-7 space-y-3">
              {reviews.map((r) => (
                <blockquote key={r.id} className="rounded-lg border border-line bg-surface p-5">
                  <p className="text-balance-pretty text-[14px] leading-relaxed text-ink-2">“{r.body}”</p>
                  <footer className="mt-4 flex flex-wrap items-center gap-3 border-t border-line pt-3.5 text-[11.5px] text-ink-faint">
                    <span className="text-ink-muted">{r.brandName}</span>
                    <span className="font-mono">{r.engagementCode}</span>
                    <span>{formatDate(r.at)}</span>
                    {r.verified && <Badge tone="mint">bound to a paid engagement</Badge>}
                  </footer>
                </blockquote>
              ))}
            </div>
          </section>
        </div>

        {/* ── rail ── */}
        <aside className="space-y-5 lg:sticky lg:top-24 lg:self-start">
          <TrustPanel assessment={trust} />

          <div className="rounded-lg border border-line bg-surface p-5">
            <Label>What this profile gives you</Label>
            <ul className="mt-4 space-y-3">
              {[
                { k: "Specialisations", v: creator.specializations },
                { k: "Content types", v: creator.contentTypes.map((c) => CONTENT_TYPE_META[c].label) },
                { k: "Formats", v: [...creator.aspectRatios] },
                { k: "Working languages", v: creator.languagesOffered },
              ].map((g) => (
                <li key={g.k}>
                  <div className="label-xs">{g.k}</div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {g.v.map((x) => (
                      <span key={x} className="chip">
                        {x}
                      </span>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className="relative overflow-hidden rounded-lg border border-line bg-surface p-5">
            <GenerativeArt
              seed={`${creator.avatarSeed}-card`}
              palette={[creator.accent, "#2a2420", "#f3e7d2"]}
              ratio="16/9"
              className="absolute inset-0 size-full opacity-30"
            />
            <div className="relative">
              <Label>Send a brief instead</Label>
              <p className="mt-3 text-[13px] leading-relaxed text-ink-muted">
                You do not have to write a structured brief. Describe the campaign the way you
                would to a colleague and the builder will turn it into one.
              </p>
              <Button asChild variant="primary" size="sm" className="mt-4 w-full">
                <a href={`/briefs/new?creator=${creator.handle}`}>Brief the assistant</a>
              </Button>
            </div>
          </div>
        </aside>
      </div>

      {openPiece && (
        <PieceDialog
          piece={openPiece}
          workflow={workflows.find((w) => w.id === openPiece.workflowId)}
          onClose={() => setOpenPiece(null)}
        />
      )}
    </div>
  );
}

export { SIGNAL_META, SKILL_NAME_BY_ID, relativeTime };