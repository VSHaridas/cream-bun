"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowUpRight, CircleDashed, Database, Radar, Sparkles } from "lucide-react";
import type { Brief, Creator, PortfolioPiece, Workflow } from "@/lib/domain/types";
import { CONTENT_TYPE_META } from "@/lib/domain/types";
import { SKILL_NAME_BY_ID, toolById } from "@/lib/domain/taxonomy";
import { SIGNAL_META, createTrustEngine } from "@/lib/domain/trust";
import { EMPTY_FILTERS, runDiscovery } from "@/lib/search/engine";
import { Badge, Label } from "@/components/ui/primitives";
import { CreatorRow } from "@/components/creator/creator-card";
import { buildFacetValues } from "@/components/discover/filter-rail";

export function BriefMatchPanel({
  brief,
  creators,
  portfolio,
  workflows,
}: {
  brief: Brief;
  creators: Creator[];
  portfolio: PortfolioPiece[];
  workflows: Workflow[];
}) {
  const workflowById = React.useMemo(
    () => new Map(workflows.map((w) => [w.id, w])),
    [workflows],
  );
  const trust = React.useMemo(
    () => createTrustEngine({ portfolio, workflows: workflowById }),
    [portfolio, workflowById],
  );
  const facetValues = React.useMemo(() => buildFacetValues(creators), [creators]);

  const filters = React.useMemo(
    () => ({
      ...EMPTY_FILTERS,
      q: brief.embeddingNote,
      contentTypes: brief.contentTypes,
      aspectRatios: brief.aspectRatios,
      verification: brief.mustHaveSignals,
    }),
    [brief],
  );

  const result = React.useMemo(
    () =>
      runDiscovery(creators, filters, {
        toolName: (id: string) => toolById(id)?.name ?? id,
        skillName: (id: string) => SKILL_NAME_BY_ID.get(id) ?? id,
        portfolio,
        workflows: workflowById,
        facetValues,
      }),
    [creators, filters, portfolio, workflowById, facetValues],
  );
  const top = result.hits.slice(0, 3);
  const poolShare = Math.round((result.total / result.totalUnfiltered) * 100);

  return (
    <div className="overflow-hidden rounded-xl border border-line bg-surface">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line px-5 py-4">
        <div className="flex items-center gap-2.5">
          <Radar className="size-3.5 text-caramel" />
          <span className="text-[14px] font-medium text-ink">Match against the pool</span>
        </div>
        <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-faint">
          runDiscovery() · no model in the loop
        </span>
      </div>

      <div className="grid gap-px bg-line md:grid-cols-[1.25fr_1fr]">
        <div className="bg-surface px-5 py-5">
          <Label>Query derived from this brief</Label>
          <dl className="mt-3.5 space-y-2.5">
            <FilterRow k="Free text" v="brief.embeddingNote" note={brief.embeddingNote} />
            <FilterRow
              k="Content type"
              v={brief.contentTypes.map((c) => CONTENT_TYPE_META[c].label).join(" OR ")}
            />
            <FilterRow k="Format" v={brief.aspectRatios.join(" OR ")} />
            <FilterRow
              k="Trust signal"
              v={brief.mustHaveSignals.map((s) => SIGNAL_META[s].label).join(" OR ")}
              note="must be tier=verified, not merely asserted"
            />
          </dl>
        </div>

        <div className="bg-bg-deep/30 px-5 py-5">
          <Label>Result</Label>
          <div className="mt-3 flex items-end gap-3">
            <div className="font-display text-[44px] leading-none tracking-[-0.035em] tabular-nums text-caramel">
              {result.total}
            </div>
            <div className="pb-1.5 text-[12.5px] leading-snug text-ink-muted">
              of {result.totalUnfiltered} creators
              <br />
              clear every filter
            </div>
          </div>
          <div className="mt-4 flex h-1.5 gap-[2px] overflow-hidden rounded-full bg-surface-3">
            <span className="h-full rounded-full bg-caramel" style={{ flex: result.total || 0.001 }} />
            <span className="h-full rounded-full bg-line-strong" style={{ flex: result.totalUnfiltered - result.total || 0.001 }} />
          </div>
          <p className="mt-2.5 font-mono text-[10.5px] tabular-nums text-ink-faint">
            {poolShare}% of the pool is addressable by this brief
          </p>

          {result.blockers.length > 0 && (
            <p className="mt-4 flex items-start gap-2 rounded-lg border border-rose/30 bg-rose/[0.05] px-3 py-2.5 text-[11.5px] leading-relaxed text-ink-2">
              <CircleDashed className="mt-0.5 size-3.5 shrink-0 text-rose" />
              Eliminated by {result.blockers.map((b) => b.label).join(" and ")}. Widen that field and
              the pool reopens.
            </p>
          )}
        </div>
      </div>

      <div className="border-t border-line">
        <div className="flex items-center justify-between gap-3 px-5 py-3.5">
          <Label>Top three matches</Label>
          <Link
            href="/discover"
            className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.12em] text-caramel hover:underline"
          >
            open in discovery <ArrowUpRight className="size-3" />
          </Link>
        </div>

        {top.length === 0 ? (
          <p className="border-t border-line px-5 py-6 text-[13px] text-ink-muted">
            No creator in the pool clears this brief as written. That is a real answer, not an error
            &mdash; the brief is executable as a query, and the query returns nothing.
          </p>
        ) : (
          <div className="border-t border-line px-5">
            {top.map((h, i) => (
              <div key={h.creator.id} className="relative">
                <CreatorRow
                  creator={h.creator}
                  index={i}
                  trust={trust.assess(h.creator)}
                />
                {h.reasons.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pb-3">
                    {h.reasons.map((r) => (
                      <Badge key={r} tone="caramel" className="font-mono text-[9.5px]">
                        <Sparkles className="size-2.5" />
                        {r}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex gap-3 border-t border-line bg-bg-deep/30 px-5 py-4">
        <Database className="mt-0.5 size-3.5 shrink-0 text-caramel" />
        <p className="max-w-3xl text-[12px] leading-relaxed text-ink-muted">
          This is the same engine and the same facet values that power{" "}
          <Link href="/discover" className="text-caramel hover:underline">
            discovery
          </Link>
          . A program executed the query; it could not have invented a creator, because it never
          generated one.
        </p>
      </div>
    </div>
  );
}

function FilterRow({ k, v, note }: { k: string; v: string; note?: string }) {
  return (
    <div className="grid grid-cols-[86px_1fr] gap-3">
      <dt className="label-xs pt-0.5">{k}</dt>
      <dd className="min-w-0">
        <div className="truncate font-mono text-[11.5px] text-ink-2">{v}</div>
        {note && <div className="mt-1 text-[11px] leading-relaxed text-ink-faint">{note}</div>}
      </dd>
    </div>
  );
}
