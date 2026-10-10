"use client";

import * as React from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { Compass, LayoutGrid, List, SearchX, Sparkles, X } from "lucide-react";
import { SKILL_NAME_BY_ID, toolById } from "@/lib/domain/taxonomy";
import type { Creator, PortfolioPiece, Workflow } from "@/lib/domain/types";
import { createTrustEngine } from "@/lib/domain/trust";
import { runDiscovery, activeFilterCount, type DiscoveryFilters } from "@/lib/search/engine";
import { cn } from "@/lib/utils";
import { Button, Label } from "@/components/ui/primitives";
import { CreatorCard, CreatorRow } from "@/components/creator/creator-card";
import {
  ActiveFilters,
  buildFacetValues,
  FilterRail,
  MobileFilterButton,
  SearchBox,
  SortSelect,
} from "./filter-rail";
import { useDiscoveryFilters, type ListKey } from "./use-discovery-filters";


type View = "grid" | "list";

export function DiscoveryConsole({
  creators,
  portfolio,
  workflows,
}: {
  creators: Creator[];
  portfolio: PortfolioPiece[];
  workflows: Map<string, Workflow>;
}) {
  const { filters, set, toggle, clear, resetAll } = useDiscoveryFilters();
  const [view, setView] = React.useState<View>("grid");
  const [railOpen, setRailOpen] = React.useState(false);

  const trust = React.useMemo(() => createTrustEngine({ portfolio, workflows }), [portfolio, workflows]);
  const facetValues = React.useMemo(() => buildFacetValues(creators), [creators]);
  const coverByCreator = React.useMemo(() => {
    const map = new Map<string, PortfolioPiece>();
    for (const c of creators) {
      const first = c.portfolioIds[0];
      const piece = portfolio.find((p) => p.id === first);
      if (piece) map.set(c.id, piece);
    }
    return map;
  }, [creators, portfolio]);

  const result = React.useMemo(
    () =>
      runDiscovery(creators, filters, {
        toolName: (id: string) => toolById(id)?.name ?? id,
        skillName: (id: string) => SKILL_NAME_BY_ID.get(id) ?? id,
        portfolio,
        workflows,
        facetValues,
      }),
    [creators, filters, portfolio, workflows, facetValues],
  );

  const count = activeFilterCount(filters);

  return (
    <div className="container-x pb-24 pt-12 md:pt-16">
      {/* ── head ── */}
      <div className="mb-10 max-w-3xl">
        <div className="label-xs mb-4">Discovery</div>
        <h1 className="display-lg">
          Find the people who can <span className="serif-italic text-cream-gradient">actually</span> do it.
        </h1>
        <p className="mt-5 text-balance-pretty text-[15px] leading-relaxed text-ink-muted">
          Filter by skill, specialisation, tool, content type, format and trust signal. Every
          result tells you which of your filters it matched — no opaque ranking.
        </p>
      </div>

      <div className="grid gap-10 lg:grid-cols-[268px_1fr] lg:gap-12">
        {/* ── rail ── */}
        <aside className="hidden lg:block">
          <div className="sticky top-24 max-h-[calc(100dvh-8rem)] overflow-y-auto pr-3">
            <FilterRail
              facets={result.facets}
              filters={filters}
              toggle={toggle}
              clear={clear}
              set={set}
              resetAll={resetAll}
            />
          </div>
        </aside>

        {/* ── results ── */}
        <div className="min-w-0">
          <div className="space-y-4">
            <SearchBox value={filters.q} onChange={(v) => set({ q: v })} creators={creators} />
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="font-mono text-[11px] tabular-nums text-ink-muted">
                  <span className="text-ink">{result.total}</span> of {creators.length} creators
                </span>
                <MobileFilterButton onOpen={() => setRailOpen(true)} count={count} />
              </div>
              <div className="flex items-center gap-2">
                <SortSelect value={filters.sort} onChange={(v) => set({ sort: v as DiscoveryFilters["sort"] })} />
                <div className="hidden overflow-hidden rounded-full border border-line sm:flex">
                  {(["grid", "list"] as View[]).map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setView(v)}
                      aria-label={`${v} view`}
                      className={cn(
                        "grid size-9 place-items-center transition-colors",
                        view === v ? "bg-surface-3 text-ink" : "text-ink-faint hover:text-ink-2",
                      )}
                    >
                      {v === "grid" ? <LayoutGrid className="size-3.5" /> : <List className="size-3.5" />}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <ActiveFilters
              filters={filters}
              toggle={toggle}
              clear={clear}
              resetAll={resetAll}
              facetValues={facetValues}
            />
          </div>

          {/* results */}
          <div className="mt-8">
            <AnimatePresence mode="wait">
              {result.total === 0 ? (
                <EmptyState
                  key="empty"
                  blockers={result.blockers}
                  filters={filters}
                  creators={creators}
                  resetAll={resetAll}
                  clear={clear}
                />
              ) : (
                <motion.div
                  key={`${view}-${result.total}`}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                  className={cn(
                    view === "grid"
                      ? "grid gap-4 sm:grid-cols-2 xl:grid-cols-3"
                      : "divide-y divide-line border-y border-line",
                  )}
                >
                  {result.hits.map((hit, i) =>
                    view === "grid" ? (
                      <CreatorCard
                          key={hit.creator.id}
                          creator={hit.creator}
                          reasons={hit.reasons}
                          trust={trust.assess(hit.creator)}
                          cover={coverByCreator.get(hit.creator.id)}
                        />
                    ) : (
                      <CreatorRow
                        key={hit.creator.id}
                        creator={hit.creator}
                        index={i}
                        trust={trust.assess(hit.creator)}
                        cover={coverByCreator.get(hit.creator.id)}
                      />
                    ),
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* ── mobile rail ── */}
      <AnimatePresence>
        {railOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setRailOpen(false)}
              className="fixed inset-0 z-40 bg-bg/80 backdrop-blur-sm lg:hidden"
            />
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 260 }}
              className="fixed inset-y-0 right-0 z-50 w-[86vw] max-w-sm overflow-y-auto border-l border-line bg-surface p-6 lg:hidden"
            >
              <div className="mb-4 flex items-center justify-between">
                <Label>Filters</Label>
                <button
                  onClick={() => setRailOpen(false)}
                  className="grid size-8 place-items-center rounded-full border border-line text-ink-muted"
                  aria-label="Close filters"
                >
                  <X className="size-3.5" />
                </button>
              </div>
              <FilterRail
                facets={result.facets}
                filters={filters}
                toggle={toggle}
                clear={clear}
                set={set}
                resetAll={resetAll}
              />
              <Button className="mt-5 w-full" onClick={() => setRailOpen(false)}>
                Show {result.total} creators
              </Button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ── empty state ──────────────────────────────────────────────────────────── */

function EmptyState({
  blockers,
  filters,
  resetAll,
  clear,
  creators,
}: {
  blockers: { key: ListKey | "scalar" | "query"; label: string; howMany: number }[];
  filters: DiscoveryFilters;
  resetAll: () => void;
  clear: (key?: ListKey) => void;
  creators: Creator[];
}) {
  // Targeted recovery: the engine names which filter is responsible, so we
  // never show a bare "no results" screen with a single dead Reset button.
  const relax = React.useMemo(() => {
    if (filters.maxDayRate !== null) return { key: "contentTypes" as ListKey, label: "the day-rate ceiling" };
    if (filters.maxTurnaround !== null) return { key: "contentTypes" as ListKey, label: "the turnaround ceiling" };
    if (filters.minRating > 0) return { key: "contentTypes" as ListKey, label: "the minimum rating" };
    if (filters.onlyVerifiedTools) return { key: "contentTypes" as ListKey, label: "the verified-tools requirement" };
    return null;
  }, [filters]);

  const cheapestWithBudget = React.useMemo(() => {
    if (filters.maxDayRate === null) return null;
    const viable = creators
      .filter((c) => c.dayRateInr <= filters.maxDayRate!)
      .sort((a, b) => a.dayRateInr - b.dayRateInr);
    return viable[0] ?? null;
  }, [filters.maxDayRate, creators]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="overflow-hidden rounded-xl border border-line bg-surface"
    >
      <div className="relative px-6 py-12 sm:px-10">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-70"
          style={{
            backgroundImage:
              "radial-gradient(60% 70% at 20% 0%, color-mix(in oklab, var(--caramel) 10%, transparent), transparent 70%)",
          }}
        />
        <div className="relative max-w-xl">
          <span className="grid size-11 place-items-center rounded-xl border border-line bg-surface-2 text-caramel">
            <SearchX className="size-5" />
          </span>
          <h2 className="mt-5 font-display text-[26px] leading-tight tracking-[-0.025em] text-ink">
            No creator in the pool clears all {activeFilterCount(filters)} of these at once.
          </h2>

          {blockers.length > 0 ? (
            <p className="mt-3 text-[14px] leading-relaxed text-ink-muted">
              The binding constraint is{" "}
              <span className="text-ink">
                {blockers.map((b) => b.label).join(" and ")}
              </span>
              . Everything else you selected still has candidates behind it — dropping this one is
              the shortest route to a shortlist.
            </p>
          ) : (
            <p className="mt-3 text-[14px] leading-relaxed text-ink-muted">
              The pool is {creators.length} creators, so an empty result almost always means the
              combination is too narrow rather than that nobody can do the work.
            </p>
          )}

          <div className="mt-7 flex flex-wrap gap-2.5">
            {blockers
              .filter((b) => b.key !== "scalar" && b.key !== "query")
              .map((b) => (
                <Button key={b.key} size="md" variant="accent" onClick={() => clear(b.key as ListKey)}>
                  Drop the {b.label} filter
                </Button>
              ))}
            {relax && (
              <Button size="md" variant="accent" onClick={() => resetAll()}>
                Drop {relax.label}
              </Button>
            )}
            <Button size="md" variant="outline" onClick={resetAll}>
              Start over
            </Button>
          </div>

          {cheapestWithBudget && (
            <div className="mt-9 rounded-lg border border-line bg-surface-2/50 p-5">
              <div className="flex items-start gap-3">
                <Compass className="mt-0.5 size-4 shrink-0 text-mint" />
                <div>
                  <p className="text-[13px] leading-relaxed text-ink-2">
                    For reference, the lowest day rate in the pool is{" "}
                    <span className="font-medium text-ink">{cheapestWithBudget.displayName}</span> at{" "}
                    <span className="font-mono tabular-nums">{cheapestWithBudget.dayRateInr.toLocaleString("en-IN")}</span>/
                    day, min engagement{" "}
                    <span className="font-mono tabular-nums">
                      {cheapestWithBudget.minimumEngagementInr.toLocaleString("en-IN")}
                    </span>
                    . Rates are not the place to win — scope is.
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="mt-8 border-t border-line pt-6">
            <p className="text-[12.5px] text-ink-muted">
              Rather than narrow further,{" "}
              <Link href="/briefs/new" className="text-caramel underline-offset-4 hover:underline">
                let the brief builder propose a scope
              </Link>{" "}
              — a looser brief usually surfaces a creator you would not have filtered for.
            </p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export { Sparkles };