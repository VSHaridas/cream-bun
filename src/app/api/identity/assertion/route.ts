import { NextResponse } from "next/server";
import {
  DIGILOCKER_FLOW,
  ISSUER_CATALOGUE,
  assertionToVerification,
  requestAssertion,
} from "@/lib/integrations/digilocker";
import { isLive } from "@/lib/integrations/registry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({
    mode: isLive("digilocker") ? "live" : "mock",
    env: process.env.NEXT_PUBLIC_DIGILOCKER_ENV ?? "sandbox",
    steps: DIGILOCKER_FLOW,
    documents: ISSUER_CATALOGUE,
  });
}

export async function POST(req: Request) {
  let body: { documentType?: string; maskedIdentifier?: string; displayName?: string };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.displayName || !body.documentType) {
    return NextResponse.json(
      { error: "displayName and documentType are required" },
      { status: 400 },
    );
  }

  const assertion = await requestAssertion({
    documentType: body.documentType,
    maskedIdentifier: body.maskedIdentifier ?? "",
    displayName: body.displayName,
  });

  return NextResponse.json({
    assertion,
    verification: assertionToVerification(assertion),
  });
}