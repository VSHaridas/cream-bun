export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  getCreatorByHandle,
  getPortfolioForCreator,
  getReviewsForCreator,
  getWorkflows,
} from "@/lib/data";
import { createTrustEngine } from "@/lib/domain/trust";
import { CreatorProfile } from "@/components/creator/creator-profile";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ handle: string }>;
}): Promise<Metadata> {
  const { handle } = await params;
  const creator = await getCreatorByHandle(handle);
  if (!creator) return { title: "Creator not found" };
  return {
    title: `${creator.displayName} — ${creator.specializations[0] ?? "AI creator"}`,
    description: creator.headline,
  };
}

export default async function CreatorPage({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  const creator = await getCreatorByHandle(handle);
  if (!creator) notFound();

  const [pieces, reviews, allWorkflows] = await Promise.all([
    getPortfolioForCreator(creator.id),
    getReviewsForCreator(creator.id),
    getWorkflows(),
  ]);

  const workflowById = new Map(allWorkflows.map((w) => [w.id, w]));
  const trust = createTrustEngine({ portfolio: pieces, workflows: workflowById });
  const workflows = creator.workflowIds
    .map((id) => workflowById.get(id))
    .filter((w): w is NonNullable<typeof w> => Boolean(w));

  return <CreatorProfile creator={creator} pieces={pieces} workflows={workflows} reviews={reviews} trust={trust.assess(creator)} />;
}