import { NextResponse } from "next/server";
import { detect, stamp, visibleBurnIn, PROVENANCE_LAYERS } from "@/lib/integrations/provenance";
import { getCreators, getProvenance } from "@/lib/data";
import { isLive } from "@/lib/integrations/registry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({ mode: isLive("synthid") ? "live" : "mock", layers: PROVENANCE_LAYERS });
}

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const action = String(body.action ?? "stamp");

  if (action === "detect") {
    const [provenance, creators] = await Promise.all([getProvenance(), getCreators()]);
    const payloadId = String(body.payloadId ?? "");
    if (!payloadId) {
      return NextResponse.json({ error: "payloadId is required" }, { status: 400 });
    }
    const record =
      typeof body.recordId === "string"
        ? provenance.find((r) => r.id === body.recordId)
        : provenance.find((r) => r.synthid.payloadId === payloadId);
    const creatorById = new Map(creators.map((c) => [c.id, c]));

    return NextResponse.json({
      detection: detect({
        payloadId,
        knownPayloadId: record?.synthid.payloadId,
        creator: record ? (creatorById.get(record.engagementId.replace("en-", "cr-"))?.displayName ?? record.visible.creatorWatermark) : undefined,
      }),
      records: provenance.map((r) => ({
        id: r.id,
        assetName: r.assetName,
        payloadId: r.synthid.payloadId,
        creator: r.visible.creatorWatermark,
      })),
    });
  }

  const required = ["engagementId", "roundId", "assetName", "creatorName", "brandName"];
  for (const key of required) {
    if (!body[key]) {
      return NextResponse.json({ error: `${key} is required` }, { status: 400 });
    }
  }

  const record = await stamp({
    engagementId: String(body.engagementId),
    roundId: String(body.roundId),
    assetName: String(body.assetName),
    creatorId: String(body.creatorId ?? ""),
    creatorName: String(body.creatorName),
    brandName: String(body.brandName),
    tools: (body.tools as string[]) ?? [],
    models: (body.models as string[]) ?? [],
    humanCheckpoints: (body.humanCheckpoints as string[]) ?? [],
    promptLineage: (body.promptLineage as string[]) ?? [],
    contractCode: String(body.contractCode ?? "n/a"),
  });

  return NextResponse.json({ record, burnIn: visibleBurnIn({ creatorName: String(body.creatorName) }) });
}