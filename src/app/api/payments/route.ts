import { NextResponse } from "next/server";
import {
  ESCROW_POLICY,
  authorizePayment,
  capturePayment,
  createOrder,
  planRoute,
  payoutBreakdown,
  refundPayment,
} from "@/lib/integrations/razorpay";
import { isLive } from "@/lib/integrations/registry";
import type { Escrow } from "@/lib/domain/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({ mode: isLive("razorpay") ? "live" : "mock", policy: ESCROW_POLICY });
}

type Action = "order" | "authorize" | "capture" | "refund" | "breakdown";

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const action = String(body.action ?? "") as Action;

  switch (action) {
    case "order": {
      const amount = Number(body.amountInr);
      const receipt = String(body.receipt ?? "BRF");
      if (!Number.isFinite(amount) || amount <= 0) {
        return NextResponse.json({ error: "amountInr must be a positive number" }, { status: 400 });
      }
      const order = await createOrder({
        amountInr: amount,
        receipt,
        notes: {
          engagement: String(body.engagementCode ?? ""),
          brand: String(body.brandName ?? ""),
          creator: String(body.creatorName ?? ""),
        },
      });
      return NextResponse.json({ order, policy: ESCROW_POLICY });
    }

    case "authorize": {
      const amount = Number(body.amountInr);
      const orderId = String(body.orderId ?? "");
      if (!orderId || !Number.isFinite(amount)) {
        return NextResponse.json({ error: "orderId and amountInr are required" }, { status: 400 });
      }
      const payment = await authorizePayment({ orderId, amountInr: amount });
      return NextResponse.json({ payment });
    }

    case "capture": {
      const amount = Number(body.amountInr);
      const orderId = String(body.orderId ?? "");
      const payment = await authorizePayment({ orderId, amountInr: amount });
      const captured = await capturePayment(payment);
      return NextResponse.json({
        payment: captured,
        breakdown: payoutBreakdown(amount),
        route: {
          account: "CREAM sub-account · cream_escrow_v1",
          transferGroup: String(body.receipt ?? ""),
          onwardAccount: String(body.payoutRoute ?? ""),
        },
      });
    }

    case "refund": {
      const paymentId = String(body.paymentId ?? "");
      const amount = Number(body.amountInr);
      if (!paymentId || !Number.isFinite(amount)) {
        return NextResponse.json({ error: "paymentId and amountInr are required" }, { status: 400 });
      }
      const refund = await refundPayment({
        paymentId,
        amountInr: amount,
        reason: (body.reason as "rejection-upheld") ?? "rejection-upheld",
        note: String(body.note ?? "Reviewed jointly by CREAM and both parties."),
      });
      return NextResponse.json({ refund });
    }

    case "breakdown": {
      const escrow = body.escrow as Escrow | undefined;
      return NextResponse.json({
        breakdown: payoutBreakdown(Number(body.amountInr ?? 0)),
        route: escrow ? planRoute(escrow) : null,
      });
    }

    default:
      return NextResponse.json({ error: `Unknown action "${body.action}"` }, { status: 400 });
  }
}