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
import { activeSource } from "@/lib/data";
import { DatasetEmpty, missingTables } from "@/components/system/dataset-empty";

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

  // The deck quotes real creators, briefs and escrows rather than illustrative
  // constants, and DeckClient reads `portfolio[0]` directly.
  const empty = missingTables({
    creators,
    portfolio,
    workflows,
    briefs,
    brands,
    offers,
    escrows,
    provenance_records: provenance,
    contracts,
  });
  if (empty.length) return <DatasetEmpty missing={empty} source={activeSource()} />;

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