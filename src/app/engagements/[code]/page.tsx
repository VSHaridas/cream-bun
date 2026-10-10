export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  getBrief,
  getContracts,
  getCreator,
  getEngagementByCode,
  getEscrows,
  getOffers,
  getPortfolio,
  getProvenance,
  getWorkflows,
} from "@/lib/data";
import { createTrustEngine } from "@/lib/domain/trust";
import { ESCROW_POLICY, payoutBreakdown } from "@/lib/integrations/razorpay";
import { EngagementWorkspace } from "@/components/engagement/engagement-workspace";
import type { PayoutMath } from "@/components/engagement/escrow-panel";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ code: string }>;
}): Promise<Metadata> {
  const { code } = await params;
  const engagement = await getEngagementByCode(code);
  if (!engagement) return { title: "Engagement not found" };
  const brief = await getBrief(engagement.briefId);
  const creator = await getCreator(engagement.creatorId);
  return {
    title: `${engagement.code}${brief ? ` — ${brief.title}` : ""}`,
    description: `Production workspace for ${creator?.displayName ?? "an AI creator"}: gated stages, escrow position, contract stack, generation rounds and provenance.`,
  };
}

export default async function EngagementDetailPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const engagement = await getEngagementByCode(code);
  if (!engagement) notFound();

  const [brief, creator, offers, contracts, escrows, provenanceRecords, portfolio, workflows] =
    await Promise.all([
      getBrief(engagement.briefId),
      getCreator(engagement.creatorId),
      getOffers(),
      getContracts(),
      getEscrows(),
      getProvenance(),
      getPortfolio(),
      getWorkflows(),
    ]);

  const trust = creator
    ? createTrustEngine({ portfolio, workflows: new Map(workflows.map((w) => [w.id, w])) }).assess(creator)
    : null;
  const offer = offers.find((o) => o.id === engagement.offerId);
  const engagementContracts = contracts.filter((c) => engagement.contractIds.includes(c.id));
  const escrow = escrows.find((e) => e.id === engagement.escrowId);
  const provenance = [
    ...engagement.provenance,
    ...provenanceRecords.filter((p) => p.engagementId === engagement.id),
  ];

  const payout: PayoutMath | null = escrow
    ? payoutBreakdown(escrow.releasedInr)
    : null;

  const daysRemaining = Math.ceil(
    (new Date(engagement.dueAt).getTime() - Date.now()) / 86_400_000,
  );

  return (
    <EngagementWorkspace
      engagement={engagement}
      brief={brief}
      creator={creator}
      trust={trust}
      offer={offer}
      contracts={engagementContracts}
      escrow={escrow}
      provenance={provenance}
      policy={ESCROW_POLICY}
      payout={payout}
      daysRemaining={daysRemaining}
    />
  );
}
