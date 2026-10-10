import type {
  Brand,
  Brief,
  BriefSession,
  ConversationTurn,
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

/**
 * The whole marketplace dataset, in domain types.
 *
 * Every provider returns this exact shape. That is the entire point: the
 * application above this line cannot tell whether the rows came from Postgres
 * or from the bundled seed, so swapping the datastore is a configuration
 * change rather than a rewrite.
 */
export interface DataSnapshot {
  creators: Creator[];
  portfolio: PortfolioPiece[];
  workflows: Workflow[];
  brands: Brand[];
  briefs: Brief[];
  sessions: BriefSession[];
  offers: Offer[];
  contracts: Contract[];
  engagements: Engagement[];
  escrows: Escrow[];
  provenance: ProvenanceRecord[];
  reviews: Review[];
}

export interface DataProvider {
  readonly name: "seed" | "supabase";
  /** True when writes are actually persisted rather than simulated. */
  readonly writable: boolean;
  load(): Promise<DataSnapshot>;
  /** Present on Supabase; absent on the read-only seed adapter. */
  persist?: {
    createBrief(input: {
      brandId: string;
      draft: Record<string, unknown>;
      turns: ConversationTurn[];
    }): Promise<string>;
  };
}

/* ── derived indexes ──────────────────────────────────────────────────────── */

function index<T extends { id: string }>(items: T[]) {
  return new Map(items.map((item) => [item.id, item]));
}

export function withIndexes(snapshot: DataSnapshot) {
  return {
    ...snapshot,
    creatorById: index(snapshot.creators),
    portfolioById: index(snapshot.portfolio),
    workflowById: index(snapshot.workflows),
    brandById: index(snapshot.brands),
    briefById: index(snapshot.briefs),
    offerById: index(snapshot.offers),
    engagementById: index(snapshot.engagements),
  };
}

export type IndexedSnapshot = ReturnType<typeof withIndexes>;