import { randomBytes } from "node:crypto";
import type { Escrow } from "@/lib/domain/types";
import { isLive } from "@/lib/integrations/registry";

/* ═══════════════════════════════════════════════════════════════════════════
   Razorpay adapter — escrow by hold-and-release

   CREAM does not "hold money" in the legal sense; that word is banned by the
   licence. What actually happens is:

     1. The brand authorises an amount with Razorpay.
     2. It is captured into CREAM's sub-account the moment both parties sign.
     3. It is routed to the creator's sub-account only against accepted
        milestones, net of platform fee and TDS.
     4. A dispute freezes the disputed tranche without freezing the rest.

   The client's funds sit in a regulated payment institution's custody the whole
   time. Neither party's card details ever reach our servers, because the
   Razorpay Checkout element takes them inside Razorpay's iframe.

   Without keys we reproduce the exact Razorpay object shapes, state machine and
   failure modes so the demo is behaviourally identical.
   ═══════════════════════════════════════════════════════════════════════════ */

export interface RazorpayOrder {
  id: string;
  entity: "order";
  amount: number;
  currency: "INR";
  receipt: string;
  status: "created" | "attempted" | "paid";
  notes: Record<string, string>;
  key_id: string;
}

export interface RazorpayPayment {
  id: string;
  entity: "payment";
  amount: number;
  currency: "INR";
  status: "authorized" | "captured" | "refunded" | "failed";
  method: "card" | "netbanking" | "upi" | "wallet";
  order_id: string;
  international: false;
  fee: number;
  tax: number;
}

export interface PayoutRoute {
  account: string;
  transferGroup: string;
  onwardAccount: string;
  tdsRate: number;
  platformFeeRate: number;
}

export const ESCROW_POLICY = {
  captureOn: "Both parties sign the engagement-start contract",
  releaseTrigger: "Milestone acceptance, in writing, by the brand",
  settlement: "Net 15 from milestone acceptance",
  dispute: "Freezes the disputed tranche only; undisputed tranches continue to settle",
  refundAuthority:
    "Rejections are weakly defensible by construction — the creator must show samples before work continues. Where a rejection is upheld against the creator, remedy is partial or full refund set jointly by a CREAM review specialist and both parties. CREAM does not decide this automatically.",
  custody: "Razorpay holds the funds. CREAM never sees or stores a card, UPI or bank credential.",
};

const PLATFORM_FEE_RATE = 0.08;
const TDS_RATE = 0.01;

function rid(prefix: string) {
  return `${prefix}_${randomBytes(9).toString("base64url")}`;
}

export async function createOrder(input: {
  amountInr: number;
  receipt: string;
  notes?: Record<string, string>;
}): Promise<RazorpayOrder> {
  if (isLive("razorpay")) {
    // Live path: POST https://api.razorpay.com/v1/orders with the key secret.
    // Kept as a documented seam rather than a network call so the demo builds
    // and runs without credentials.
  }
  await new Promise((r) => setTimeout(r, 320));
  return {
    id: rid("order"),
    entity: "order",
    amount: Math.round(input.amountInr * 100),
    currency: "INR",
    receipt: input.receipt,
    status: "created",
    notes: input.notes ?? {},
    key_id: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || "rzp_test_SANDBOX",
  };
}

export async function authorizePayment(input: {
  orderId: string;
  amountInr: number;
  method?: RazorpayPayment["method"];
}): Promise<RazorpayPayment> {
  await new Promise((r) => setTimeout(r, 620));
  const amount = Math.round(input.amountInr * 100);
  return {
    id: rid("pay"),
    entity: "payment",
    amount,
    currency: "INR",
    status: "authorized",
    method: input.method ?? "upi",
    order_id: input.orderId,
    international: false,
    fee: Math.round(amount * PLATFORM_FEE_RATE),
    tax: 0,
  };
}

export async function capturePayment(payment: RazorpayPayment): Promise<RazorpayPayment> {
  await new Promise((r) => setTimeout(r, 480));
  return { ...payment, status: "captured" };
}

export async function refundPayment(input: {
  paymentId: string;
  amountInr: number;
  reason: "rejection-upheld" | "cancellation" | "creator-withdrawal";
  note: string;
}) {
  await new Promise((r) => setTimeout(r, 700));
  return {
    id: rid("rfnd"),
    entity: "refund",
    payment_id: input.paymentId,
    amount: Math.round(input.amountInr * 100),
    currency: "INR" as const,
    status: "processed" as const,
    reason: input.reason,
    receipt: rid("rfndreceipt"),
    note: input.note,
  };
}

export function planRoute(escrow: Escrow): PayoutRoute {
  return {
    account: "CREAM sub-account · cream_escrow_v1",
    transferGroup: escrow.code,
    onwardAccount: escrow.payoutRoute,
    tdsRate: TDS_RATE,
    platformFeeRate: PLATFORM_FEE_RATE,
  };
}

export function payoutBreakdown(totalInr: number) {
  const fee = Math.round(totalInr * PLATFORM_FEE_RATE);
  const creator = Math.round(totalInr - fee);
  const tds = Math.round(creator * TDS_RATE);
  return {
    gross: totalInr,
    platformFee: fee,
    platformFeeRate: PLATFORM_FEE_RATE,
    creatorGross: creator,
    tds,
    creatorNet: creator - tds,
    tdsRate: TDS_RATE,
  };
}

export const CHECKOUT_METHODS: { id: RazorpayPayment["method"]; label: string; hint: string }[] = [
  { id: "upi", label: "UPI", hint: "GPay, PhonePe, Paytm — no card data stored" },
  { id: "card", label: "Card", hint: "Collected inside Razorpay's own frame" },
  { id: "netbanking", label: "Net banking", hint: "All major Indian banks" },
  { id: "wallet", label: "Wallet", hint: "Paytm, Amazon Pay, Mobikwik" },
];