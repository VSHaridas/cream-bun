import { NextResponse } from "next/server";
import { translateForCreator } from "@/lib/llm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let body: {
    briefText?: string;
    creatorName?: string;
    brandName?: string;
    conversation?: { role: string; text: string }[];
    model?: string | null;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.briefText || !body.creatorName || !body.brandName) {
    return NextResponse.json(
      { error: "briefText, creatorName and brandName are required" },
      { status: 400 },
    );
  }

  const result = await translateForCreator({
    briefText: body.briefText,
    creatorName: body.creatorName,
    brandName: body.brandName,
    conversation: body.conversation ?? [],
    model: body.model ?? null,
  });

  return NextResponse.json(result);
}