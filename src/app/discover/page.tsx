export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import { Suspense } from "react";
import { getCreators, getPortfolio, getWorkflows } from "@/lib/data";
import { DiscoveryConsole } from "@/components/discover/discovery-console";
import { Skimmer } from "@/components/discover/console-fallback";

export const metadata: Metadata = {
  title: "Discover AI creators",
  description:
    "Search and filter AI filmmakers, animators and generative creators by skill, tool, content type, format, budget, turnaround and trust signal.",
};

export default async function DiscoverPage() {
  const [creators, portfolio, workflows] = await Promise.all([
    getCreators(),
    getPortfolio(),
    getWorkflows(),
  ]);

  return (
    <Suspense fallback={<Skimmer />}>
      <DiscoveryConsole
        creators={creators}
        portfolio={portfolio}
        workflows={new Map(workflows.map((w) => [w.id, w]))}
      />
    </Suspense>
  );
}