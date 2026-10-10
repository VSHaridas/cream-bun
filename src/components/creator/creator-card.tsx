"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowUpRight, BookmarkCheck, Bookmark, Star, Zap } from "lucide-react";
import type { Creator, PortfolioPiece, TrustAssessment } from "@/lib/domain/types";
import { AVAILABILITY_META } from "@/lib/domain/types";
import { CONTENT_TYPE_META } from "@/lib/domain/types";
import { SKILL_NAME_BY_ID, toolById } from "@/lib/domain/taxonomy";
import { cn, compactInr } from "@/lib/utils";
import { useApp } from "@/lib/store";
import { GenerativeArt } from "@/components/media/generative-art";
import { CreatorAvatar } from "./avatar";
import { TrustStrip } from "@/components/trust/trust";
import { Badge } from "@/components/ui/primitives";

export function CreatorCard({
  creator,
  reasons,
  className,
  compact,
  trust,
  cover,
}: {
  creator: Creator;
  reasons?: string[];
  className?: string;
  compact?: boolean;
  trust: TrustAssessment;
  cover?: PortfolioPiece;
}) {
  const shortlisted = useApp((s) => s.shortlist.includes(creator.id));
  const toggle = useApp((s) => s.toggleShortlist);

  const avail = AVAILABILITY_META[creator.availability];
  const toneClass =
    avail.tone === "mint"
      ? "text-mint"
      : avail.tone === "caramel"
        ? "text-caramel"
        : "text-ink-faint";

  return (
    <article
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-lg border border-line bg-surface transition-all duration-300",
        "hover:-translate-y-0.5 hover:border-line-strong hover:shadow-e3",
        className,
      )}
    >
      <Link href={`/creators/${creator.handle}`} className="absolute inset-0 z-0" aria-label={creator.displayName} />

      <div className="relative aspect-[16/9] overflow-hidden bg-surface-2">
        {cover ? (
          <GenerativeArt
            seed={cover.artSeed}
            palette={cover.palette}
            ratio="16/9"
            chrome
            className="size-full transition-transform duration-[900ms] ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.045]"
          />
        ) : (
          <div className="size-full bg-gradient-to-br from-surface-2 to-surface-3" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-surface via-surface/10 to-transparent" />

        <div className="absolute inset-x-0 top-0 flex items-start justify-between p-3">
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border border-line bg-bg/70 px-2.5 py-1 text-[10.5px] font-medium backdrop-blur-md",
              toneClass,
            )}
          >
            <span
              className={cn(
                "size-1.5 rounded-full",
                creator.availability === "open"
                  ? "bg-mint"
                  : creator.availability === "limited"
                    ? "bg-caramel"
                    : "bg-ink-faint",
              )}
            />
            {avail.label}
          </span>
          <TrustStrip assessment={trust} className="rounded-full border border-line bg-bg/70 px-2 py-1 backdrop-blur-md" />
        </div>

        <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 p-3">
          <div className="min-w-0 pl-12">
            {cover && (
              <p className="truncate font-mono text-[10px] uppercase tracking-[0.14em] text-ink-faint">
                {cover.title}
              </p>
            )}
          </div>
          <ArrowUpRight className="size-4 shrink-0 text-ink-faint transition-all duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-caramel" />
        </div>
      </div>

      <div className="relative flex flex-1 flex-col gap-3 p-4">
        <div className="flex items-start gap-3">
          <CreatorAvatar creator={creator} size={40} className="-mt-[52px] ring-4 ring-surface" />
          <div className="min-w-0 flex-1 pt-0.5">
            <h3 className="truncate text-[15px] font-medium leading-tight text-ink">
              {creator.displayName}
            </h3>
            <p className="truncate text-[12px] text-ink-faint">
              {creator.studioName ?? `@${creator.handle}`}
            </p>
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              toggle(creator.id);
            }}
            aria-label={shortlisted ? "Remove from shortlist" : "Add to shortlist"}
            className={cn(
              "grid size-8 shrink-0 place-items-center rounded-full border transition-all duration-200",
              shortlisted
                ? "border-caramel/50 bg-caramel/12 text-caramel"
                : "border-line text-ink-faint hover:border-line-strong hover:text-ink-2",
            )}
          >
            {shortlisted ? <BookmarkCheck className="size-3.5" /> : <Bookmark className="size-3.5" />}
          </button>
        </div>

        <p className={cn("text-balance-pretty text-[13px] leading-relaxed text-ink-muted", compact && "line-clamp-2")}>
          {creator.headline}
        </p>

        {reasons && reasons.length > 0 && (
          <ul className="space-y-1 border-l border-line pl-3">
            {reasons.slice(0, compact ? 2 : 3).map((r) => (
              <li key={r} className="flex items-start gap-1.5 text-[11.5px] leading-snug text-ink-muted">
                <Zap className="mt-[2px] size-2.5 shrink-0 text-caramel" />
                {r}
              </li>
            ))}
          </ul>
        )}

        <div className="flex flex-wrap gap-1">
          {creator.specializations.slice(0, 2).map((s) => (
            <span key={s} className="chip">
              {s}
            </span>
          ))}
          {creator.contentTypes.slice(0, 2).map((t) => (
            <span key={t} className="chip border-line/60 text-ink-faint">
              {CONTENT_TYPE_META[t].label}
            </span>
          ))}
        </div>

        <div className="mt-auto flex items-center justify-between gap-3 border-t border-line pt-3">
          <div className="flex items-center gap-1.5 text-[12px]">
            <Star className="size-3 fill-caramel text-caramel" />
            <span className="font-medium text-ink tabular-nums">{creator.rating.toFixed(1)}</span>
            <span className="text-ink-faint">({creator.reviewCount})</span>
          </div>
          <div className="text-right">
            <div className="text-[12.5px] font-medium text-ink tabular-nums">
              {compactInr(creator.dayRateInr)}
              <span className="text-ink-faint">/day</span>
            </div>
            <div className="text-[10.5px] text-ink-faint">{creator.turnaroundDays}d turnaround</div>
          </div>
        </div>
      </div>
    </article>
  );
}

export function CreatorRow({
  creator,
  index,
  trust,
  cover,
}: {
  creator: Creator;
  index: number;
  trust: TrustAssessment;
  cover?: PortfolioPiece;
}) {
  const shortlisted = useApp((s) => s.shortlist.includes(creator.id));
  const toggle = useApp((s) => s.toggleShortlist);
  const skills = creator.skills.slice(0, 4).map((s) => SKILL_NAME_BY_ID.get(s) ?? s);
  const tools = creator.tools.slice(0, 3).map((t) => toolById(t)?.name).filter(Boolean);

  return (
    <Link
      href={`/creators/${creator.handle}`}
      className="group grid grid-cols-[auto_1fr] items-center gap-4 border-b border-line py-4 transition-colors hover:bg-surface-2/40 sm:grid-cols-[44px_1.6fr_1fr_auto]"
    >
      <span className="hidden font-mono text-[10.5px] tabular-nums text-ink-faint sm:block">
        {String(index + 1).padStart(2, "0")}
      </span>

      <div className="flex min-w-0 items-center gap-3">
        <CreatorAvatar creator={creator} size={38} />
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="truncate text-[14px] font-medium text-ink">{creator.displayName}</span>
            {trust.score >= 88 && <Badge tone="mint" className="shrink-0">elite</Badge>}
          </div>
          <p className="truncate text-[12px] text-ink-faint">{creator.location}</p>
        </div>
      </div>

      <div className="hidden min-w-0 sm:block">
        <p className="truncate text-[12.5px] text-ink-muted">{skills.join(" · ")}</p>
        <p className="truncate font-mono text-[10px] uppercase tracking-[0.12em] text-ink-faint">
          {tools.join(" · ")}
        </p>
      </div>

      <div className="flex items-center gap-4">
        <TrustStrip assessment={trust} className="hidden sm:flex" />
        <div className="text-right">
          <div className="text-[13px] font-medium text-ink tabular-nums">{compactInr(creator.dayRateInr)}</div>
          <div className="text-[10.5px] text-ink-faint">min {compactInr(creator.minimumEngagementInr)}</div>
        </div>
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            toggle(creator.id);
          }}
          aria-label={shortlisted ? "Remove from shortlist" : "Add to shortlist"}
          className={cn(
            "grid size-8 place-items-center rounded-full border transition-colors",
            shortlisted
              ? "border-caramel/50 bg-caramel/12 text-caramel"
              : "border-line text-ink-faint hover:border-line-strong hover:text-ink",
          )}
        >
          {shortlisted ? <BookmarkCheck className="size-3.5" /> : <Bookmark className="size-3.5" />}
        </button>
      </div>

      {cover && (
        <span className="pointer-events-none absolute right-0 opacity-0 transition-opacity group-hover:opacity-100" aria-hidden>
          <GenerativeArt seed={cover.artSeed} palette={cover.palette} className="h-12 w-20 rounded" />
        </span>
      )}
    </Link>
  );
}