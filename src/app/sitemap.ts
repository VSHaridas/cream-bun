import type { MetadataRoute } from "next";
import { getCreators } from "@/lib/data";

/**
 * Generated at request time and cached, never at build time.
 *
 * A sitemap that queries the database during `next build` makes the build
 * depend on the database being reachable — so a brief outage, or a build
 * racing a migration, fails the deploy for a file a crawler reads once an hour.
 */
export const dynamic = "force-dynamic";
export const revalidate = 3600;

const BASE = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes = ["", "/discover", "/briefs", "/briefs/new", "/engagements", "/trust", "/model", "/deck", "/onboarding/identity"];

  const creators = await getCreators();

  return [
    ...staticRoutes.map((route) => ({
      url: `${BASE}${route}`,
      lastModified: new Date(),
      changeFrequency: "weekly" as const,
      priority: route === "" ? 1 : 0.7,
    })),
    ...creators.map((c) => ({
      url: `${BASE}/creators/${c.handle}`,
      lastModified: new Date(c.verifiedAt ?? "2026-01-01"),
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
  ];
}