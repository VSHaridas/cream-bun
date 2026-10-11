import { cache } from "react";
import type {
  Brand,
  Brief,
  BriefSession,
  Contract,
  Creator,
  Engagement,
  Escrow,
  Offer,
  PortfolioPiece,
  ProvenanceRecord,
  Review,
  Workflow,
} from "@/lib/domain/types";
import type { DataProvider, DataSnapshot } from "./provider";
import { withIndexes } from "./provider";
import { seedProvider } from "./seed-provider";
import { supabaseProvider } from "./supabase-provider";
import { supabaseCapability } from "@/lib/env";

/* ── provider selection ───────────────────────────────────────────────────── */

let cachedProvider: DataProvider | null = null;

/**
 * A provider that answers every query with nothing.
 *
 * Exists so the "connected but empty" case is reachable without a live project.
 * That case is not hypothetical: it is what a fresh Supabase project looks like
 * after the migration is applied but before `npm run db:seed` runs, and it is
 * the state that produced three 500s in production.
 */
const emptyProvider: DataProvider = {
  name: "supabase",
  writable: true,
  load: async () => ({
    creators: [],
    portfolio: [],
    workflows: [],
    brands: [],
    briefs: [],
    sessions: [],
    offers: [],
    contracts: [],
    engagements: [],
    escrows: [],
    provenance: [],
    reviews: [],
  }),
};

function selectProvider(): DataProvider {
  // Server-only seam. Lets a deployment pin the dataset explicitly, and lets
  // the empty-dataset guard paths be exercised in CI without a Supabase
  // project. Not NEXT_PUBLIC_, so it never reaches the client bundle.
  const forced = process.env.CREAM_FORCE_DATASET?.trim().toLowerCase();
  if (forced === "empty") return emptyProvider;
  if (forced === "seed") return seedProvider;
  return supabaseCapability().live ? supabaseProvider : seedProvider;
}

export function getProvider(): DataProvider {
  if (cachedProvider) return cachedProvider;
  cachedProvider = selectProvider();
  return cachedProvider;
}

export function activeSource() {
  return getProvider().name;
}

export function isWritable() {
  return getProvider().writable;
}

/* ── request-scoped snapshot ──────────────────────────────────────────────── */

/**
 * `cache()` from React scopes the memo to a single server render. Without it
 * a module-level snapshot would be shared across concurrent requests, which
 * under row-level security means one user's readable rows leaking into
 * another's response.
 *
 * Note what this does *not* do: it does not push the snapshot into the client
 * bundle. Components that need data receive it as props from the server
 * component above them, so a private record is never serialised into a page
 * a different user requested.
 */
export interface DatastoreStatus {
  /** True when the configured datastore could not be read and seed data is standing in. */
  degraded: boolean;
  reason: string | null;
  source: "seed" | "supabase";
}

/**
 * The single load, memoised for the life of the render.
 *
 * Both `getSnapshot` and `getDatastoreStatus` used to call `provider.load()`
 * themselves. React `cache()` memoises per function, not per underlying call,
 * so the shell's status check and the page's data read each triggered the full
 * fifteen-table `Promise.all` — thirty round trips per request instead of
 * fifteen. Every page also awaits the status check before its own data, so the
 * two ran serially as well as redundantly.
 */
const loadOnce = cache(
  async (): Promise<{ snapshot: DataSnapshot | null; error: string | null }> => {
    const provider = getProvider();
    try {
      return { snapshot: await provider.load(), error: null };
    } catch (error) {
      return { snapshot: null, error: error instanceof Error ? error.message : String(error) };
    }
  },
);

/**
 * A configured datastore that cannot be read — migration not applied, project
 * paused, network blip — must not take the whole site down with a 500. But it
 * also must not quietly present bundled seed data as though it were the
 * database. So we fall back *and* carry the reason, and the shell renders it.
 * The distinction that matters: silent fallback is dishonest, loud fallback
 * with a visible banner is a degraded mode.
 */
export const getDatastoreStatus = cache(async (): Promise<DatastoreStatus> => {
  const provider = getProvider();
  const { error } = await loadOnce();
  if (error) {
    console.error(
      `[cream] datastore "${provider.name}" unavailable — serving bundled seed data:`,
      error,
    );
    return { degraded: true, reason: error, source: "seed" };
  }
  return { degraded: false, reason: null, source: provider.name };
});

export const getSnapshot = cache(async (): Promise<DataSnapshot> => {
  const provider = getProvider();
  const { snapshot, error } = await loadOnce();
  if (snapshot) return snapshot;
  // The seed adapter is the last line of defence. If it fails there is nothing
  // left to serve, so surface the original datastore error rather than a
  // confusing one from the fallback.
  if (provider.name === "seed") throw new Error(error ?? "seed provider returned no snapshot");
  const { seedSnapshot } = await import("./seed-provider");
  return seedSnapshot;
});

export const getIndexed = cache(async () => withIndexes(await getSnapshot()));

/* ── accessors ────────────────────────────────────────────────────────────── */

export const getCreators = cache(async (): Promise<Creator[]> => (await getSnapshot()).creators);
export const getPortfolio = cache(async (): Promise<PortfolioPiece[]> => (await getSnapshot()).portfolio);
export const getWorkflows = cache(async (): Promise<Workflow[]> => (await getSnapshot()).workflows);
export const getBrands = cache(async (): Promise<Brand[]> => (await getSnapshot()).brands);
export const getBriefs = cache(async (): Promise<Brief[]> => (await getSnapshot()).briefs);
export const getSessions = cache(async (): Promise<BriefSession[]> => (await getSnapshot()).sessions);
export const getOffers = cache(async (): Promise<Offer[]> => (await getSnapshot()).offers);
export const getContracts = cache(async (): Promise<Contract[]> => (await getSnapshot()).contracts);
export const getEngagements = cache(async (): Promise<Engagement[]> => (await getSnapshot()).engagements);
export const getEscrows = cache(async (): Promise<Escrow[]> => (await getSnapshot()).escrows);
export const getProvenance = cache(async (): Promise<ProvenanceRecord[]> => (await getSnapshot()).provenance);
export const getReviews = cache(async (): Promise<Review[]> => (await getSnapshot()).reviews);

/* ── lookups ──────────────────────────────────────────────────────────────── */

export const getCreator = cache(async (id: string) => (await getIndexed()).creatorById.get(id));
export const getCreatorByHandle = cache(async (handle: string) =>
  (await getCreators()).find((c) => c.handle === handle),
);
export const getPortfolioForCreator = cache(async (creatorId: string) =>
  (await getPortfolio()).filter((p) => p.creatorId === creatorId),
);
export const getWorkflow = cache(async (id: string) => (await getIndexed()).workflowById.get(id));
export const getBriefByCode = cache(async (code: string) =>
  (await getBriefs()).find((b) => b.code === code || b.id === code),
);
export const getBrief = cache(async (id: string) => (await getIndexed()).briefById.get(id));
export const getSession = cache(async (id: string) =>
  (await getSessions()).find((s) => s.id === id),
);
export const getOffersForBrief = cache(async (briefId: string) =>
  (await getOffers()).filter((o) => o.briefId === briefId),
);
export const getOffersForCreator = cache(async (creatorId: string) =>
  (await getOffers()).filter((o) => o.creatorId === creatorId),
);
export const getEngagementByCode = cache(async (code: string) =>
  (await getEngagements()).find((e) => e.code === code || e.id === code),
);
export const getReviewsForCreator = cache(async (creatorId: string) =>
  (await getReviews()).filter((r) => r.creatorId === creatorId),
);
export const getActiveBrand = cache(async () => {
  const brands = await getBrands();
  return brands[0] ?? null;
});

/**
 * Everything the trust engine and the discovery engine need, in one call, so
 * those two stay pure and synchronous. They are imported by client components
 * and must never await a database.
 *
 * `workflows` is returned as a Map because that is what both engines take —
 * returning the array here would just push a conversion onto every call site.
 */
export const getEngineContext = cache(async () => {
  const snapshot = await getSnapshot();
  return {
    portfolio: snapshot.portfolio,
    workflows: new Map(snapshot.workflows.map((w) => [w.id, w])),
  };
});