import { NextResponse } from "next/server";
import { listModels } from "@/lib/llm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The model catalogue.
 *
 * The UI never sees a compiled-in model name. It gets the list this API key
 * can actually call, which means a new Gemini release shows up with no code
 * change and a model the operator has not been granted cannot be selected.
 */
export function GET() {
  return listModels().then((result) =>
    NextResponse.json(result, {
      headers: { "cache-control": "public, max-age=300, stale-while-revalidate=600" },
    }),
  );
}