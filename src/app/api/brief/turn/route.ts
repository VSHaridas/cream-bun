import { NextResponse } from "next/server";
import { runBriefTurn } from "@/lib/llm";
import { EMPTY_DRAFT, type BriefDraft } from "@/lib/llm/contract";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let body: {
    messages?: { role: "user" | "assistant"; text: string }[];
    draft?: Partial<BriefDraft>;
    brandName?: string;
    brandIndustry?: string;
    model?: string | null;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const messages = (body.messages ?? []).filter(
    (m) => m && typeof m.text === "string" && m.text.trim().length > 0,
  );

  if (!messages.length) {
    return NextResponse.json({ error: "At least one message is required" }, { status: 400 });
  }

  const draft: BriefDraft = { ...EMPTY_DRAFT, ...(body.draft ?? {}) };

  const result = await runBriefTurn({
    messages: messages.slice(-24),
    draft,
    brandName: body.brandName || "the brand",
    brandIndustry: body.brandIndustry || "general",
    model: body.model ?? null,
  });

  return NextResponse.json(result);
}