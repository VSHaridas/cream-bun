"use client";

import * as React from "react";
import { Check, ChevronDown, RotateCcw, Search, SlidersHorizontal, Sparkles, X } from "lucide-react";
import {
  ASPECT_RATIOS,
  AVAILABILITY_META,
  CONTENT_TYPE_META,
  type Availability,
  type Creator,
  type SignalKind,
} from "@/lib/domain/types";
import { REGIONS, SKILL_NAME_BY_ID, SPECIALIZATIONS, toolById, TOOLS } from "@/lib/domain/taxonomy";
import { SIGNAL_META } from "@/lib/domain/trust";

import type { FacetGroup } from "@/lib/search/engine";
import { SORT_OPTIONS, activeFilterCount, interpretQuery } from "@/lib/search/engine";
import { cn, compactInr, unique } from "@/lib/utils";
import { Badge, Button, Chip, Label } from "@/components/ui/primitives";
import type { ListKey } from "./use-discovery-filters";

const SIGNAL_ORDER: SignalKind[] = ["identity", "tools", "workflow", "portfolio", "delivery", "client"];

const AVAILABILITY_ORDER: Availability[] = ["open", "limited", "booked"];

/**
 * Facet values are derived from whatever pool is loaded, never hardcoded
 * twice. This takes the creators rather than importing them, so the filter
 * surface reflects a real database exactly as it reflects the seed.
 */
export function buildFacetValues(creators: Creator[]) {
  return {
    skills: unique(creators.flatMap((c) => c.skills))
      .map((id) => SKILL_NAME_BY_ID.get(id) ?? id)
      .sort(),
    specializations: [...SPECIALIZATIONS],
    tools: TOOLS.filter((t) => creators.some((c) => c.tools.includes(t.id))).map((t) => ({
      id: t.id,
      label: t.name,
    })),
    contentTypes: [...new Set(creators.flatMap((c) => c.contentTypes))].map((id) => ({
      id,
      label: CONTENT_TYPE_META[id].label,
    })),
    aspectRatios: [...new Set(creators.flatMap((c) => c.aspectRatios))].map((id) => ({
      id,
      label: ASPECT_RATIOS.find((a) => a.id === id)?.label ?? id,
    })),
    availability: AVAILABILITY_ORDER.map((a) => ({ id: a, label: AVAILABILITY_META[a].label })),
    verification: SIGNAL_ORDER.map((s) => ({ id: s, label: SIGNAL_META[s].label })),
    languages: unique(creators.flatMap((c) => c.languagesOffered)).sort(),
    regions: REGIONS.map((r) => ({ id: r.id, label: r.label })),
  };
}

export type FacetValues = ReturnType<typeof buildFacetValues>;

function facetLabelFor(key: ListKey, value: string, values: FacetValues) {
  const table = values as unknown as Record<string, { id: string; label: string }[] | string[]>;
  const list = table[key];
  if (!list) return value;
  if (Array.isArray(list) && list.length && typeof list[0] === "object") {
    return (list as { id: string; label: string }[]).find((v) => v.id === value)?.label ?? value;
  }
  return (list as string[]).includes(value) ? value : value;
}

/* ── collapsible group ────────────────────────────────────────────────────── */

function Group({
  label,
  count,
  children,
  defaultOpen = true,
}: {
  label: string;
  count: number;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = React.useState(defaultOpen);
  return (
    <div className="border-b border-line last:border-b-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 py-3.5 text-left"
        aria-expanded={open}
      >
        <span className="flex items-baseline gap-2">
          <span className="text-[13px] font-medium text-ink">{label}</span>
          {count > 0 && <span className="font-mono text-[10px] text-caramel">{count}</span>}
        </span>
        <ChevronDown className={cn("size-3.5 shrink-0 text-ink-faint transition-transform", open && "rotate-180")} />
      </button>
      {open && <div className="pb-4">{children}</div>}
    </div>
  );
}

function BucketList({
  group,
  selected,
  onToggle,
  onClear,
  limit = 6,
}: {
  group: FacetGroup;
  selected: string[];
  onToggle: (key: ListKey, value: string) => void;
  onClear: (key: ListKey) => void;
  limit?: number;
}) {
  const [expanded, setExpanded] = React.useState(false);
  const hidden = !expanded && group.buckets.length > limit;
  const shown = hidden ? group.buckets.slice(0, limit) : group.buckets;

  if (group.buckets.length === 0) {
    return <p className="text-[11.5px] text-ink-faint">Nothing in the pool matches right now.</p>;
  }

  return (
    <div className="space-y-1">
      {shown.map((b) => {
        const active = selected.includes(b.value);
        return (
          <button
            key={b.value}
            type="button"
            onClick={() => onToggle(group.key as ListKey, b.value)}
            aria-pressed={active}
            className={cn(
              "flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors duration-150",
              active ? "bg-caramel/10" : "hover:bg-surface-2",
            )}
          >
            <span
              className={cn(
                "grid size-3.5 shrink-0 place-items-center rounded-[5px] border transition-colors",
                active ? "border-caramel bg-caramel text-[oklch(0.18_0.02_60)]" : "border-line-strong",
              )}
            >
              {active && <Check className="size-2.5" strokeWidth={3} />}
            </span>
            <span className={cn("flex-1 truncate text-[12.5px]", active ? "text-ink" : "text-ink-muted")}>
              {b.label}
            </span>
            <span className={cn("font-mono text-[10px] tabular-nums", b.count === 0 ? "text-ink-faint/50" : "text-ink-faint")}>
              {b.count}
            </span>
          </button>
        );
      })}
      {group.buckets.length > limit && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="ml-2 pt-1 font-mono text-[10.5px] uppercase tracking-[0.1em] text-caramel hover:underline"
        >
          {expanded ? "Show fewer" : `Show ${group.buckets.length - limit} more`}
        </button>
      )}
      {selected.length > 0 && (
        <button
          type="button"
          onClick={() => onClear(group.key as ListKey)}
          className="ml-2 pt-1 font-mono text-[10.5px] uppercase tracking-[0.1em] text-ink-faint hover:text-ink"
        >
          clear {group.label.toLowerCase()}
        </button>
      )}
    </div>
  );
}

/* ── the rail ─────────────────────────────────────────────────────────────── */

export function FilterRail({
  facets,
  filters,
  toggle,
  clear,
  set,
  resetAll,
}: {
  facets: FacetGroup[];
  filters: import("@/lib/search/engine").DiscoveryFilters;
  toggle: (key: ListKey, value: string) => void;
  clear: (key?: ListKey) => void;
  set: (patch: Partial<import("@/lib/search/engine").DiscoveryFilters>) => void;
  resetAll: () => void;
}) {
  const byKey = React.useMemo(() => new Map(facets.map((f) => [f.key, f])), [facets]);

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between pb-3">
        <Label>Refine</Label>
        {activeFilterCount(filters) > 0 && (
          <button
            type="button"
            onClick={resetAll}
            className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.1em] text-caramel hover:underline"
          >
            <RotateCcw className="size-2.5" />
            reset
          </button>
        )}
      </div>

      {(["contentTypes", "specializations", "skills", "tools", "aspectRatios", "verification", "availability", "languages", "regions"] as ListKey[]).map(
        (key) => {
          const group = byKey.get(key);
          if (!group) return null;
          return (
            <Group
              key={key}
              label={group.label}
              count={(filters[key] as string[])?.length ?? 0}
              defaultOpen={["contentTypes", "specializations", "tools"].includes(key)}
            >
              <BucketList
                group={group}
                selected={(filters[key] as string[]) ?? []}
                onToggle={toggle}
                onClear={clear}
                limit={key === "specializations" || key === "skills" ? 6 : 5}
              />
            </Group>
          );
        },
      )}

      <Group label="Budget & speed" count={(filters.maxDayRate !== null ? 1 : 0) + (filters.maxTurnaround !== null ? 1 : 0)} defaultOpen={false}>
        <div className="space-y-5 px-2 pt-1">
          <div>
            <div className="flex items-baseline justify-between">
              <Label>Max day rate</Label>
              <span className="font-mono text-[11px] tabular-nums text-ink">
                {filters.maxDayRate ? compactInr(filters.maxDayRate) : "any"}
              </span>
            </div>
            <input
              type="range"
              min={50000}
              max={200000}
              step={5000}
              value={filters.maxDayRate ?? 200000}
              onChange={(e) => {
                const v = Number(e.target.value);
                set({ maxDayRate: v >= 200000 ? null : v });
              }}
              className="mt-2.5 h-1 w-full cursor-pointer appearance-none rounded-full bg-surface-3 accent-caramel"
              aria-label="Maximum day rate"
            />
          </div>
          <div>
            <div className="flex items-baseline justify-between">
              <Label>Max turnaround</Label>
              <span className="font-mono text-[11px] tabular-nums text-ink">
                {filters.maxTurnaround ? `${filters.maxTurnaround} days` : "any"}
              </span>
            </div>
            <input
              type="range"
              min={3}
              max={20}
              step={1}
              value={filters.maxTurnaround ?? 20}
              onChange={(e) => {
                const v = Number(e.target.value);
                set({ maxTurnaround: v >= 20 ? null : v });
              }}
              className="mt-2.5 h-1 w-full cursor-pointer appearance-none rounded-full bg-surface-3 accent-caramel"
              aria-label="Maximum turnaround in days"
            />
          </div>
          <div>
            <Label>Minimum rating</Label>
            <div className="mt-2 flex gap-1.5">
              {[0, 4.5, 4.7, 4.8].map((r) => (
                <Chip key={r} active={filters.minRating === r} onClick={() => set({ minRating: r })}>
                  {r === 0 ? "Any" : `${r}+`}
                </Chip>
              ))}
            </div>
          </div>
          <label className="flex cursor-pointer items-start gap-2.5">
            <input
              type="checkbox"
              checked={filters.onlyVerifiedTools}
              onChange={(e) => set({ onlyVerifiedTools: e.target.checked })}
              className="mt-0.5 size-3.5 shrink-0 accent-caramel"
            />
            <span className="text-[12.5px] leading-snug text-ink-muted">
              Only creators with vendor-verified tools
            </span>
          </label>
        </div>
      </Group>

      <p className="pt-4 text-[11.5px] leading-relaxed text-ink-faint">
        Counts are computed against your other filters, so anything showing a number above zero is
        something you can actually select.
      </p>
    </div>
  );
}

/* ── active filter pills ──────────────────────────────────────────────────── */

export function ActiveFilters({
  filters,
  toggle,
  clear,
  resetAll,
  facetValues,
}: {
  filters: import("@/lib/search/engine").DiscoveryFilters;
  toggle: (key: ListKey, value: string) => void;
  clear: (key?: ListKey) => void;
  resetAll: () => void;
  facetValues: FacetValues;
}) {
  const pills: { key: ListKey; value: string; label: string }[] = [];
  for (const key of [
    "contentTypes",
    "specializations",
    "skills",
    "tools",
    "aspectRatios",
    "verification",
    "availability",
    "languages",
    "regions",
  ] as ListKey[]) {
    for (const v of (filters[key] as string[]) ?? []) {
      pills.push({ key, value: v, label: facetLabelFor(key, v, facetValues) });
    }
  }
  if (filters.maxDayRate !== null)
    pills.push({ key: "contentTypes", value: "__rate", label: `≤ ${compactInr(filters.maxDayRate)}/day` });
  if (filters.maxTurnaround !== null)
    pills.push({ key: "contentTypes", value: "__turn", label: `≤ ${filters.maxTurnaround} days` });
  if (filters.minRating > 0) pills.push({ key: "contentTypes", value: "__rate", label: `${filters.minRating}+ rating` });
  if (filters.onlyVerifiedTools)
    pills.push({ key: "contentTypes", value: "__vt", label: "verified tools only" });

  if (pills.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {pills.map((p) => (
        <button
          key={`${p.key}-${p.value}`}
          type="button"
          onClick={() => {
            if (p.value.startsWith("__")) resetAll();
            else toggle(p.key, p.value);
          }}
          className="chip chip-active"
        >
          {p.label}
          <X className="size-2.5" />
        </button>
      ))}
      <button
        type="button"
        onClick={() => clear()}
        className="ml-1 font-mono text-[10px] uppercase tracking-[0.1em] text-ink-faint hover:text-ink"
      >
        clear all
      </button>
    </div>
  );
}

/* ── search box with live query interpretation ────────────────────────────── */

export function SearchBox({
  value,
  onChange,
  creators,
}: {
  value: string;
  onChange: (v: string) => void;
  creators: Creator[];
}) {
  const [local, setLocal] = React.useState(value);
  React.useEffect(() => setLocal(value), [value]);

  const interpreted = React.useMemo(() => interpretQuery(local, creators), [local, creators]);
  const interpretedCount = Object.keys(interpreted).length;

  return (
    <div className="space-y-2.5">
      <div className="relative">
        <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-ink-faint" />
        <input
          value={local}
          onChange={(e) => {
            setLocal(e.target.value);
            onChange(e.target.value);
          }}
          placeholder="Describe the work — “vertical film, CAD-locked product, under 5L”"
          className="h-12 w-full rounded-full border border-line bg-surface pl-11 pr-11 text-[14px] text-ink placeholder:text-ink-faint outline-none transition-all focus:border-caramel/55 focus:ring-2 focus:ring-caramel/12"
          aria-label="Search creators"
        />
        {local && (
          <button
            type="button"
            onClick={() => {
              setLocal("");
              onChange("");
            }}
            className="absolute right-3.5 top-1/2 grid size-6 -translate-y-1/2 place-items-center rounded-full text-ink-faint hover:bg-surface-2 hover:text-ink"
            aria-label="Clear search"
          >
            <X className="size-3.5" />
          </button>
        )}
      </div>

      {local.trim() && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-caramel">
            <Sparkles className="size-2.5" />
            parsed on device
          </span>
          {interpretedCount === 0 ? (
            <span className="text-[12px] text-ink-faint">
              no structured terms found — matching free text across profiles, tools and portfolios
            </span>
          ) : (
            Object.entries(interpreted).map(([k, v]) => (
              <span key={k} className="chip border-caramel/35 text-caramel">
                {k} → {Array.isArray(v) ? v.join(", ") : String(v)}
              </span>
            ))
          )}
        </div>
      )}
    </div>
  );
}

/* ── sort control ─────────────────────────────────────────────────────────── */

export function SortSelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const current = SORT_OPTIONS.find((o) => o.id === value) ?? SORT_OPTIONS[0];
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex h-9 items-center gap-2 rounded-full border border-line bg-surface-2/60 pl-3.5 pr-3 text-[12.5px] text-ink-2 transition-colors hover:border-line-strong"
        aria-expanded={open}
      >
        <span className="text-ink-faint">Sort</span>
        {current.label}
        <ChevronDown className={cn("size-3 transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-40 mt-2 w-64 overflow-hidden rounded-xl border border-line bg-surface shadow-e3">
            {SORT_OPTIONS.map((o) => (
              <button
                key={o.id}
                type="button"
                onClick={() => {
                  onChange(o.id);
                  setOpen(false);
                }}
                className={cn(
                  "block w-full px-4 py-2.5 text-left transition-colors hover:bg-surface-2",
                  o.id === value && "bg-caramel/8",
                )}
              >
                <span className={cn("text-[13px]", o.id === value ? "text-caramel" : "text-ink")}>{o.label}</span>
                <span className="mt-0.5 block text-[11px] text-ink-faint">{o.hint}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export function MobileFilterButton({ onOpen, count }: { onOpen: () => void; count: number }) {
  return (
    <Button variant="outline" size="sm" onClick={onOpen} className="lg:hidden">
      <SlidersHorizontal className="size-3.5" />
      Filters
      {count > 0 && (
        <Badge tone="caramel" className="ml-1 px-1.5 py-0.5">
          {count}
        </Badge>
      )}
    </Button>
  );
}

export { toolById };