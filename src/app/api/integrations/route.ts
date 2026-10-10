import { NextResponse } from "next/server";
import { integrationStatus } from "@/lib/integrations/registry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET() {
  const integrations = integrationStatus();
  return NextResponse.json({
    integrations,
    liveCount: integrations.filter((i) => i.mode === "live").length,
    total: integrations.length,
  });
}