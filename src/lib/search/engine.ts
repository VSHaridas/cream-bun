import type {
  AspectRatioId,
  Availability,
  ContentType,
  Creator,
  SignalKind,
  VerificationSignal,
} from "@/lib/domain/types";
import { CONTENT_TYPE_META } from "@/lib/domain/types";
import { SKILL_NAME_BY_ID, REGIONS } from "@/lib/domain/taxonomy";
import { assessTrust, signalsFor, type TrustContext } from "@/lib/domain/trust";
import { clamp } from "@/lib/utils";

/* ═══════════════════════════════════════════════════════════════════════════
   Discovery engine.

   This is the part of the product that has to be right. Three design rules:

   1. OR within a facet, AND across facets. A creator who does film OR animation
      still shows up when you tick both — but only if they clear every other
      active filter too.

   2. Facet counts are computed against the *other* facets, so a count never
      says "42" for an option the user cannot actually select. This is the
      single most common way marketplace filters feel broken.

   3. Ranking is explainable. Every result carries a `reasons` array that is
      rendered on the card, so a brand can see *why* a creator surfaced rather
      than trusting an opaque score.
   ═══════════════════════════════════════════════════════════════════════════ */

export interface DiscoveryFilters {
  q: string;
  skills: string[];
  specializations: string[];
  tools: string[];
  contentTypes: ContentType[];
  aspectRatios: AspectRatioId[];
  verification: SignalKind[];
  availability: Availability[];
  regions: string[];
  languages: string[];
  maxDayRate: number | null;
  maxTurnaround: number | null;
  minRating: number;
  onlyVerifiedTools: boolean;
  sort: SortId;
}

export type SortId = "relevance" | "trust" | "rate-asc" | "rate-desc" | "turnaround" | "recent";

export const SORT_OPTIONS: { id: SortId; label: string; hint: string }[] = [
  { id: "relevance", label: "Best match", hint: "Weighted across every filter you set" },
  { id: "trust", label: "Most verified", hint: "Highest trust score first" },
  { id: "rate-asc", label: "Rate: low to high", hint: "Cheapest day rate first" },
  { id: "rate-desc", label: "Rate: high to low", hint: "Premium day rates first" },
  { id: "turnaround", label: "Fastest", hint: "Shortest quoted turnaround" },
  { id: "recent", label: "Recently active", hint: "Most recent verified workflow run" },
];

export const EMPTY_FILTERS: DiscoveryFilters = {
  q: "",
  skills: [],
  specializations: [],
  tools: [],
  contentTypes: [],
  aspectRatios: [],
  verification: [],
  availability: [],
  regions: [],
  languages: [],
  maxDayRate: null,
  maxTurnaround: null,
  minRating: 0,
  onlyVerifiedTools: false,
  sort: "relevance",
};

export function activeFilterCount(f: DiscoveryFilters) {
  let n = 0;
  if (f.q.trim()) n++;
  n += f.skills.length ? 1 : 0;
  n += f.specializations.length ? 1 : 0;
  n += f.tools.length ? 1 : 0;
  n += f.contentTypes.length ? 1 : 0;
  n += f.aspectRatios.length ? 1 : 0;
  n += f.verification.length ? 1 : 0;
  n += f.availability.length ? 1 : 0;
  n += f.regions.length ? 1 : 0;
  n += f.languages.length ? 1 : 0;
  if (f.maxDayRate !== null) n++;
  if (f.maxTurnaround !== null) n++;
  if (f.minRating > 0) n++;
  if (f.onlyVerifiedTools) n++;
  return n;
}

/* ── per-facet matching ───────────────────────────────────────────────────── */

type FacetKey =
  | "skills"
  | "specializations"
  | "tools"
  | "contentTypes"
  | "aspectRatios"
  | "verification"
  | "availability"
  | "regions"
  | "languages";

function facetHit(f: DiscoveryFilters, key: FacetKey, c: Creator, signals: VerificationSignal[]) {
  switch (key) {
    case "skills":
      return f.skills.length === 0 || f.skills.some((s) => c.skills.includes(s));
    case "specializations":
      return f.specializations.length === 0 || f.specializations.some((s) => c.specializations.includes(s));
    case "tools":
      return f.tools.length === 0 || f.tools.some((t) => c.tools.includes(t));
    case "contentTypes":
      return f.contentTypes.length === 0 || f.contentTypes.some((t) => c.contentTypes.includes(t));
    case "aspectRatios":
      return f.aspectRatios.length === 0 || f.aspectRatios.some((t) => c.aspectRatios.includes(t));
    case "verification":
      return (
        f.verification.length === 0 ||
        f.verification.some((k) => signals.some((s) => s.kind === k && s.tier === "verified"))
      );
    case "availability":
      return f.availability.length === 0 || f.availability.includes(c.availability);
    case "regions":
      return f.regions.length === 0 || f.regions.some((r) => matchesRegion(c, r));
    case "languages":
      return f.languages.length === 0 || f.languages.some((l) => c.languagesOffered.includes(l));
    default:
      return true;
  }
}

function matchesRegion(c: Creator, regionId: string) {
  if (regionId === "in-metro") return /Mumbai|Bengaluru|Gurugram|Hyderabad|Chennai|Kolkata/i.test(c.location);
  if (regionId === "in-tier2") return /Pune|Lucknow/i.test(c.location);
  if (regionId === "uk-eu" || regionId === "na" || regionId === "mena") return false;
  return true;
}

function passesScalars(f: DiscoveryFilters, c: Creator, context: TrustContext) {
  if (f.maxDayRate !== null && c.dayRateInr > f.maxDayRate) return false;
  if (f.maxTurnaround !== null && c.turnaroundDays > f.maxTurnaround) return false;
  if (f.minRating > 0 && c.rating < f.minRating) return false;
  if (f.onlyVerifiedTools) {
    const verifiedCount = signalsFor(c, context).filter((s) => s.kind === "tools" && s.tier === "verified").length;
    if (verifiedCount === 0) return false;
  }
  return true;
}

const ALL_FACETS: FacetKey[] = [
  "skills",
  "specializations",
  "tools",
  "contentTypes",
  "aspectRatios",
  "verification",
  "availability",
  "regions",
  "languages",
];

function passesFacet(f: DiscoveryFilters, key: FacetKey, c: Creator, signals: VerificationSignal[]) {
  return facetHit(f, key, c, signals);
}

/* ── free-text relevance ──────────────────────────────────────────────────── */

const STOP = new Set([
  "a", "an", "the", "for", "of", "and", "with", "in", "on", "to", "we", "i", "our", "need",
  "looking", "want", "some", "any", "that", "this", "is", "are", "be", "it", "at", "as", "by",
]);

function tokenize(q: string) {
  return q
    .toLowerCase()
    .replace(/[^a-z0-9+#.:/\- ]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1 && !STOP.has(t));
}

export interface SearchHit {
  creator: Creator;
  score: number;
  reasons: string[];
  matched: string[];
  trustScore: number;
}

function relevance(
  f: DiscoveryFilters,
  c: Creator,
  signals: VerificationSignal[],
  toolName: (id: string) => string,
  portfolio: import("@/lib/domain/types").PortfolioPiece[],
  context: TrustContext,
) {
  const reasons: string[] = [];
  const matched: string[] = [];
  let score = 0;

  const tokens = tokenize(f.q);
  if (tokens.length) {
    const fields: { text: string; weight: number }[] = [
      { text: c.displayName.toLowerCase(), weight: 10 },
      { text: c.headline.toLowerCase(), weight: 8 },
      { text: c.specializations.join(" ").toLowerCase(), weight: 9 },
      { text: c.skills.map((s) => (SKILL_NAME_BY_ID.get(s) ?? s).toLowerCase()).join(" "), weight: 7 },
      { text: c.tools.map(toolName).join(" ").toLowerCase(), weight: 6 },
      { text: c.contentTypes.map((t) => CONTENT_TYPE_META[t].label.toLowerCase()).join(" "), weight: 6 },
      { text: c.bio.toLowerCase(), weight: 3 },
      { text: portfolio.filter((p) => p.creatorId === c.id)
          .map((p) => `${p.title} ${p.summary} ${p.tags.join(" ")} ${p.industry}`.toLowerCase())
          .join(" "), weight: 4 },
    ];

    for (const token of tokens) {
      let best = 0;
      let bestField = "";
      for (const field of fields) {
        if (!field.text.includes(token)) continue;
        // Whole-word matches are worth considerably more than substrings.
        const whole = new RegExp(`\\b${token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`).test(field.text);
        const hit = whole ? field.weight : field.weight * 0.45;
        if (hit > best) {
          best = hit;
          bestField = field.text;
        }
      }
      if (best > 0) {
        score += best;
        matched.push(token);
        void bestField;
      }
    }
    if (matched.length) {
      reasons.push(
        `Matches “${matched.slice(0, 3).join(", ")}” across profile, tools and portfolio`,
      );
    }
  }

  // Filter-derived reasoning, surfaced verbatim on the result card.
  if (f.contentTypes.length) {
    const hits = f.contentTypes.filter((t) => c.contentTypes.includes(t));
    if (hits.length) {
      score += 12 * hits.length;
      reasons.push(`Delivers ${hits.map((t) => CONTENT_TYPE_META[t].label.toLowerCase()).join(", ")}`);
    }
  }
  if (f.skills.length) {
    const hits = f.skills.filter((s) => c.skills.includes(s));
    if (hits.length) {
      score += 9 * hits.length;
      reasons.push(`${hits.map((s) => SKILL_NAME_BY_ID.get(s) ?? s).slice(0, 3).join(" · ")}`);
    }
  }
  if (f.tools.length) {
    const hits = f.tools.filter((t) => c.tools.includes(t));
    if (hits.length) {
      score += 8 * hits.length;
      reasons.push(`Works in ${hits.map(toolName).slice(0, 3).join(", ")}`);
    }
  }
  if (f.specializations.length) {
    const hits = f.specializations.filter((s) => c.specializations.includes(s));
    if (hits.length) {
      score += 10 * hits.length;
      reasons.push(`${hits.slice(0, 2).join(" · ")}`);
    }
  }
  if (f.aspectRatios.length) {
    const hits = f.aspectRatios.filter((t) => c.aspectRatios.includes(t));
    if (hits.length) {
      score += 4 * hits.length;
      reasons.push(`Delivers ${hits.slice(0, 3).join(", ")}`);
    }
  }
  if (f.verification.length) {
    const hits = f.verification.filter((k) => signals.some((s) => s.kind === k && s.tier === "verified"));
    if (hits.length) {
      score += 11 * hits.length;
      reasons.push(`${hits.map((h) => `${h} verified`).slice(0, 2).join(" · ")}`);
    }
  }
  if (f.availability.includes("open") && c.availability === "open") {
    score += 7;
    reasons.push("Open for briefs now");
  }
  if (f.languages.length) {
    const hits = f.languages.filter((l) => c.languagesOffered.includes(l));
    if (hits.length) {
      score += 6 * hits.length;
      reasons.push(`Speaks ${hits.join(", ")}`);
    }
  }

  // Baseline quality terms keep an unfiltered "best match" list meaningful.
  const trust = assessTrust(c, context);
  score += trust.score * 0.14;
  score += c.rating * 3;
  score += Math.min(12, c.stats.engagements * 0.24);
  if (c.availability === "booked") score -= 18;
  if (c.availability === "limited") score -= 7;

  return { score, reasons: reasons.slice(0, 4), matched };
}

/* ── public API ───────────────────────────────────────────────────────────── */

export interface FacetBucket {
  value: string;
  label: string;
  count: number;
}

export interface FacetGroup {
  key: FacetKey;
  label: string;
  buckets: FacetBucket[];
}

export interface DiscoveryResult {
  hits: SearchHit[];
  total: number;
  /** Count if every active filter were cleared — used for the empty state. */
  totalUnfiltered: number;
  facets: FacetGroup[];
  /** Filters that eliminated every candidate, for a targeted recovery prompt. */
  blockers: { key: FacetKey | "scalar" | "query"; label: string; howMany: number }[];
  filters: DiscoveryFilters;
}

export interface SearchOptions {
  toolName: (id: string) => string;
  skillName: (id: string) => string;
  /**
   * Portfolio pieces for free-text matching. Supplied by the caller so this
   * module stays pure and runnable in a client component — see the note in
   * `domain/trust.ts` for the same reasoning.
   */
  portfolio: import("@/lib/domain/types").PortfolioPiece[];
  workflows?: Map<string, import("@/lib/domain/types").Workflow>;
  facetValues: {
    skills: string[];
    specializations: string[];
    tools: { id: string; label: string }[];
    contentTypes: { id: string; label: string }[];
    aspectRatios: { id: string; label: string }[];
    availability: { id: string; label: string }[];
    verification: { id: SignalKind; label: string }[];
    languages: string[];
    regions: { id: string; label: string }[];
  };
}

export function runDiscovery(
  creators: Creator[],
  filters: DiscoveryFilters,
  opts: SearchOptions,
): DiscoveryResult {
  const trustContext: TrustContext = { portfolio: opts.portfolio, workflows: opts.workflows ?? new Map() };
  const signalsByCreator = new Map(creators.map((c) => [c.id, signalsFor(c, trustContext)]));

  const scored: SearchHit[] = creators.map((creator) => {
    const signals = signalsByCreator.get(creator.id)!;
    const r = relevance(filters, creator, signals, opts.toolName, opts.portfolio, trustContext);
    return { creator, ...r, trustScore: assessTrust(creator, trustContext).score };
  });

  const survivors = scored.filter(
    ({ creator, score }) =>
      score > 0 &&
      passesScalars(filters, creator, trustContext) &&
      ALL_FACETS.every((key) => passesFacet(filters, key, creator, signalsByCreator.get(creator.id)!)),
  );

  const sorted = sortHits(survivors, filters.sort);
  const facets = buildFacets(scored, filters, signalsByCreator, opts, trustContext);

  return {
    hits: sorted,
    total: sorted.length,
    totalUnfiltered: creators.length,
    facets,
    blockers: computeBlockers(scored, filters, signalsByCreator, opts, trustContext),
    filters,
  };
}

function sortHits(hits: SearchHit[], sort: SortId) {
  const out = [...hits];
  switch (sort) {
    case "trust":
      out.sort((a, b) => b.trustScore - a.trustScore || b.score - a.score);
      break;
    case "rate-asc":
      out.sort((a, b) => a.creator.dayRateInr - b.creator.dayRateInr);
      break;
    case "rate-desc":
      out.sort((a, b) => b.creator.dayRateInr - a.creator.dayRateInr);
      break;
    case "turnaround":
      out.sort((a, b) => a.creator.turnaroundDays - b.creator.turnaroundDays);
      break;
    case "recent":
      out.sort(
        (a, b) => new Date(b.creator.verifiedAt ?? 0).getTime() - new Date(a.creator.verifiedAt ?? 0).getTime(),
      );
      break;
    default:
      out.sort((a, b) => b.score - a.score);
  }
  return out;
}

/** Counts are computed with the facet's own selections ignored — correct faceting. */
function buildFacets(
  all: SearchHit[],
  filters: DiscoveryFilters,
  signalsByCreator: Map<string, VerificationSignal[]>,
  opts: SearchOptions,
  context: TrustContext,
): FacetGroup[] {
  const poolFor = (exclude: FacetKey) =>
    all.filter(
      ({ creator, score }) =>
        score > 0 &&
        passesScalars(filters, creator, context) &&
        ALL_FACETS.filter((k) => k !== exclude).every((k) =>
          passesFacet(filters, k, creator, signalsByCreator.get(creator.id)!),
        ),
    );

  const countBy = (pool: SearchHit[], pick: (c: Creator) => string[]) => {
    const m = new Map<string, number>();
    for (const { creator } of pool) {
      const seen = new Set(pick(creator));
      for (const v of seen) m.set(v, (m.get(v) ?? 0) + 1);
    }
    return m;
  };

  const groups: FacetGroup[] = [];

  const build = (
    key: FacetKey,
    label: string,
    pool: SearchHit[],
    values: { id: string; label: string }[],
    pick: (c: Creator) => string[],
  ) => {
    const counts = countBy(pool, pick);
    const buckets = values
      .map((v) => ({ value: v.id, label: v.label, count: counts.get(v.id) ?? 0 }))
      .filter((b) => b.count > 0 || (filters[key] as string[]).includes(b.value));
    groups.push({ key, label, buckets });
  };

  build("specializations", "Specialisation", poolFor("specializations"), opts.facetValues.specializations.map((s) => ({ id: s, label: s })), (c) => c.specializations);
  build("skills", "Skill", poolFor("skills"), opts.facetValues.skills.map((s) => ({ id: s, label: s })), (c) => c.skills);
  build("tools", "Tool", poolFor("tools"), opts.facetValues.tools, (c) => c.tools);
  build("contentTypes", "Content type", poolFor("contentTypes"), opts.facetValues.contentTypes, (c) => c.contentTypes);
  build("aspectRatios", "Format", poolFor("aspectRatios"), opts.facetValues.aspectRatios, (c) => c.aspectRatios);
  build("availability", "Availability", poolFor("availability"), opts.facetValues.availability, (c) => [c.availability]);
  build("languages", "Language", poolFor("languages"), opts.facetValues.languages.map((l) => ({ id: l, label: l })), (c) => c.languagesOffered);
  build("regions", "Base", poolFor("regions"), opts.facetValues.regions, (c) =>
    REGIONS.filter((r) => matchesRegion(c, r.id)).map((r) => r.id),
  );

  const vPool = poolFor("verification");
  const vCounts = new Map<string, number>();
  for (const { creator } of vPool) {
    const signals = signalsByCreator.get(creator.id)!;
    for (const k of opts.facetValues.verification.map((v) => v.id)) {
      if (signals.some((s) => s.kind === k && s.tier === "verified")) {
        vCounts.set(k, (vCounts.get(k) ?? 0) + 1);
      }
    }
  }
  groups.push({
    key: "verification",
    label: "Trust signal",
    buckets: opts.facetValues.verification
      .map((v) => ({ value: v.id, label: v.label, count: vCounts.get(v.id) ?? 0 }))
      .filter((b) => b.count > 0 || (filters.verification as string[]).includes(b.value)),
  });

  return groups;
}

/** Names the specific filter that is responsible for an empty result set. */
function computeBlockers(
  all: SearchHit[],
  filters: DiscoveryFilters,
  signalsByCreator: Map<string, VerificationSignal[]>,
  opts: SearchOptions,
  context: TrustContext,
): DiscoveryResult["blockers"] {
  const blockers: DiscoveryResult["blockers"] = [];
  const labelFor: Record<string, string> = {
    skills: "skill",
    specializations: "specialisation",
    tools: "tool",
    contentTypes: "content type",
    aspectRatios: "format",
    verification: "trust signal",
    availability: "availability",
    regions: "base",
    languages: "language",
  };
  const labelMap = new Map<string, string>();
  for (const g of [...opts.facetValues.tools, ...opts.facetValues.contentTypes, ...opts.facetValues.aspectRatios, ...opts.facetValues.availability, ...opts.facetValues.verification.map((v) => ({ id: v.id, label: v.label }))]) {
    labelMap.set(g.id, g.label);
  }
  for (const s of opts.facetValues.skills) labelMap.set(s, s);
  for (const s of opts.facetValues.specializations) labelMap.set(s, s);

  for (const key of ALL_FACETS) {
    const sel = filters[key] as string[];
    if (!sel.length) continue;
    const pool = all.filter(
      ({ creator, score }) =>
        score > 0 &&
        passesScalars(filters, creator, context) &&
        ALL_FACETS.filter((k) => k !== key).every((k) =>
          passesFacet(filters, k, creator, signalsByCreator.get(creator.id)!),
        ),
    );
    if (pool.length === 0) {
      blockers.push({ key, label: labelFor[key], howMany: sel.length });
    }
  }
  if (!blockers.length) {
    const scalarRelaxed = all.filter(
      ({ creator, score }) => score > 0 && ALL_FACETS.every((k) => passesFacet(filters, k, creator, signalsByCreator.get(creator.id)!)),
    );
    if (scalarRelaxed.length === 0 && (filters.maxDayRate !== null || filters.maxTurnaround !== null || filters.minRating > 0 || filters.onlyVerifiedTools)) {
      blockers.push({ key: "scalar", label: "budget or turnaround limit", howMany: 1 });
    }
  }
  void labelMap;
  return blockers;
}

/* ── natural-language query → filter translation ──────────────────────────── */

/**
 * A lightweight, fully deterministic query parser. It runs on every keystroke
 * on the client, which is the whole reason it must not be a network call.
 * A production deployment swaps this for the same Gemini call that powers the
 * brief builder, streaming structured filters back.
 */
export function interpretQuery(q: string, creators: Creator[]): Partial<DiscoveryFilters> {
  const out: Partial<DiscoveryFilters> = {};
  const text = q.toLowerCase();

  const allSkills = new Set(creators.flatMap((c) => c.skills));
  const allSpecs = new Set(creators.flatMap((c) => c.specializations));
  const allTools = new Set(creators.flatMap((c) => c.tools));

  const matchedSkills: string[] = [];
  for (const s of allSkills) {
    const name = (SKILL_NAME_BY_ID.get(s) ?? s).toLowerCase();
    if (text.includes(name)) matchedSkills.push(s);
  }
  if (matchedSkills.length) out.skills = matchedSkills;

  const matchedSpecs = [...allSpecs].filter((s) => text.includes(s.toLowerCase()));
  if (matchedSpecs.length) out.specializations = matchedSpecs;

  const matchedTools = [...allTools].filter((t) => text.includes(t.replace(/-/g, " ")));
  if (matchedTools.length) out.tools = matchedTools;

  const budget = /(?:under|below|max|upto|up to|within|budget of|₹)?\s*(\d[\d,]*)\s*(k|l|lakh|lac|cr|crore)?/.exec(text);
  if (budget && /(?:under|below|max|upto|up to|within|budget)/.test(text)) {
    const n = Number(budget[1].replace(/,/g, ""));
    const unit = budget[2];
    const value = unit === "cr" || unit === "crore" ? n * 10_000_000 : unit === "l" || unit === "lakh" || unit === "lac" ? n * 100_000 : n * 1000;
    out.maxDayRate = clamp(value, 20_000, 500_000);
  }

  const days = /(\d+)\s*day/.exec(text);
  if (days) out.maxTurnaround = clamp(Number(days[1]), 1, 60);

  if (/available now|open now|bookable|immediately/.test(text)) out.availability = ["open"];
  if (/verified/.test(text)) out.verification = ["identity"];

  return out;
}