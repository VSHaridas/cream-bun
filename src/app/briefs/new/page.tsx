export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import { BriefBuilder } from "@/components/brief/brief-builder";
import { getActiveBrand } from "@/lib/data";

export const metadata: Metadata = {
  title: "AI brief builder",
  description:
    "Turn a rough idea into a structured, quotable creative brief — content type, format, commercial use, budget and timeline — through conversation.",
};

export default async function NewBriefPage() {
  const brand = await getActiveBrand();
  return <BriefBuilder brandName={brand?.name ?? ""} />;
}