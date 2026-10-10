import type { DataProvider, DataSnapshot } from "./provider";
import { CREATORS } from "./creators";
import { PORTFOLIO } from "./portfolio";
import { WORKFLOWS } from "./workflows";
import { BRANDS } from "./brands";
import { BRIEFS, BRIEF_SESSIONS } from "./briefs";
import {
  CONTRACTS,
  ENGAGEMENTS,
  ESCROWS,
  OFFERS,
  PROVENANCE,
  REVIEWS,
} from "./commerce";

/**
 * The bundled dataset.
 *
 * This is not a placeholder — it is the product's seed content, and it is the
 * reason the prototype runs with zero credentials. It is also the reference
 * implementation of the domain shapes: if the Supabase adapter ever drifts,
 * this is what it is diffed against.
 */
export const seedSnapshot: DataSnapshot = {
  creators: CREATORS,
  portfolio: PORTFOLIO,
  workflows: WORKFLOWS,
  brands: BRANDS,
  briefs: BRIEFS,
  sessions: BRIEF_SESSIONS,
  offers: OFFERS,
  contracts: CONTRACTS,
  engagements: ENGAGEMENTS,
  escrows: ESCROWS,
  provenance: PROVENANCE,
  reviews: REVIEWS,
};

export const seedProvider: DataProvider = {
  name: "seed",
  writable: false,
  async load() {
    return seedSnapshot;
  },
};