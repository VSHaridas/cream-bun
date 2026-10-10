export const dynamic = "force-dynamic";

import {
  getBrands,
  getBriefs,
  getContracts,
  getCreators,
  getEscrows,
  getOffers,
  getPortfolio,
  getProvenance,
  getWorkflows,
} from "@/lib/data";
import { DeckClient } from "./deck-client";

export default async function DeckPage() {
  const [
    creators,
    portfolio,
    workflows,
    briefs,
    brands,
    offers,
    escrows,
    provenance,
    contracts,
  ] = await Promise.all([
    getCreators(),
    getPortfolio(),
    getWorkflows(),
    getBriefs(),
    getBrands(),
    getOffers(),
    getEscrows(),
    getProvenance(),
    getContracts(),
  ]);

  return (
    <DeckClient
      creators={creators}
      portfolio={portfolio}
      workflows={workflows}
      briefs={briefs}
      brands={brands}
      offers={offers}
      escrows={escrows}
      provenance={provenance}
      contracts={contracts}
    />
  );
}