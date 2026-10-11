import { NextResponse } from "next/server";
import { getProvider } from "@/lib/data";
import { getSupabaseServer } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Creates a brief from the builder's draft.
 *
 * The builder had no write path at all: `/api/brief/turn` returned Gemini's
 * output into component state and it was lost when the tab closed. Brief count
 * stayed at zero and `brief_sessions` stayed empty because nothing was ever
 * written.
 *
 * Ownership is resolved server-side from the session, never from the request
 * body. Taking `brandId` from the client would let any signed-in user write a
 * brief against any brand, and the row-level policies on `briefs` exist on the
 * assumption that the ownership columns are honest.
 */
export async function POST(req: Request) {
  let body: { draft?: Record<string, unknown>; turns?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const draft = body.draft ?? {};
  if (typeof draft !== "object") {
    return NextResponse.json({ error: "draft must be an object" }, { status: 400 });
  }

  const provider = getProvider();
  if (!provider.persist) {
    return NextResponse.json(
      { error: "The bundled dataset is read-only. Seed Postgres to create briefs." },
      { status: 409 },
    );
  }

  const brandId = await resolveBrandId(req);
  if (!brandId) {
    return NextResponse.json(
      { error: "Sign in as a brand to create a brief. No brand profile is linked to this account." },
      { status: 403 },
    );
  }

  const turns = Array.isArray(body.turns) ? (body.turns as never[]) : [];

  try {
    const code = await provider.persist.createBrief({
      brandId,
      draft: { ...draft, brandName: draft.brandName },
      turns,
    });
    return NextResponse.json({ code, href: `/briefs/${code}` }, { status: 201 });
  } catch (error) {
    console.error(
      "[cream] createBrief failed:",
      error instanceof Error ? error.message : error,
    );
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not save the brief." },
      { status: 500 },
    );
  }
}

/**
 * The brand this session may write as.
 *
 * Resolved from `profiles.role` rather than accepted from the client, because
 * `briefs.brand_id` is an RLS boundary and a client-supplied value would
 * undermine it.
 */
async function resolveBrandId(req: Request) {
  const supabase = await getSupabaseServer();
  if (!supabase) return null;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: brand } = await supabase
    .from("brands")
    .select("id")
    .eq("profile_id", user.id)
    .maybeSingle();

  if (brand) return brand.id as string;

  // A signed-in user with no brand row of their own falls back to the demo
  // brand only when there is exactly one, which is the seeded local case.
  const { data: brands } = await supabase.from("brands").select("id").limit(2);
  if (brands && brands.length === 1) return brands[0].id as string;

  void req;
  return null;
}