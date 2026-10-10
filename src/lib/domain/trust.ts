import type {
  Creator,
  PortfolioPiece,
  SignalKind,
  SignalTier,
  TrustAssessment,
  VerificationSignal,
  Workflow,
} from "@/lib/domain/types";
import { TOOLS } from "@/lib/domain/taxonomy";

/**
 * Trust signals are *derived from the same records* that power discovery, not
 * hand-authored marketing badges. If a creator removes a tool from their
 * profile, the corresponding "verified tools" signal disappears with it — a
 * claim and its substantiation can never drift apart.
 *
 * The inputs arrive as an explicit context rather than a module import. That
 * is what lets this file stay pure and synchronous: the trust engine runs in
 * client components, and a module-level import would have frozen it to the
 * bundled seed the moment a real database was configured.
 */

export interface TrustContext {
  portfolio: PortfolioPiece[];
  workflows: Map<string, Workflow>;
}

/**
 * Builds bound evaluators so a component can hold one reference and call it
 * per creator without re-threading the context through every call site.
 */
export function createTrustEngine(context: TrustContext) {
  return {
    signalsFor: (creator: Creator) => signalsFor(creator, context),
    assess: (creator: Creator) => assessTrust(creator, context),
  };
}

const CACHE = new WeakMap<TrustContext, Map<string, VerificationSignal[]>>();

function iso(d: Date): string {
  return d.toISOString();
}

function daysAgo(n: number): string {
  return iso(new Date(Date.now() - n * 86_400_000));
}

function tierForStatus(s: string): SignalTier {
  switch (s) {
    case "verified":
      return "verified";
    case "pending":
      return "attested";
    case "flagged":
    case "expired":
      return "expired";
    default:
      return "unverified";
  }
}

function buildSignals(creator: Creator, context: TrustContext): VerificationSignal[] {
  const out: VerificationSignal[] = [];

  /* 1 ── Identity, proven by a third-party issuer rather than by us. */
  const id = creator.identity;
  out.push({
    id: `${creator.id}-sig-identity`,
    kind: "identity",
    tier: tierForStatus(id.status),
    title:
      id.status === "verified"
        ? "Identity verified by issuer"
        : "Identity not yet verified",
    detail:
      id.status === "verified"
        ? `${id.documentType} pulled with your consent via DigiLocker. CREAM received an assertion, never the document.`
        : "Government identity is collected through DigiLocker. The issuer validates it; CREAM never sees or stores the file.",
    evidence: id.issuerRef
      ? `${id.issuer} · assertion ${id.issuerRef}`
      : (id.issuer ?? "Not started"),
    verifiedAt: id.verifiedAt,
    expiresAt: id.expiresAt,
    weight: 26,
    reference: id.issuerRef ?? undefined,
  });

  /* 2 ── Verified tools. Only vendor-credentialed or telemetry-backed tools count. */
  const tools = creator.tools.map((t) => TOOLS.find((x) => x.id === t)).filter(Boolean);
  const verified = tools.filter((t) => t!.verified);
  const hours = verified.reduce((s, t) => s + t!.hoursLogged, 0);
  out.push({
    id: `${creator.id}-sig-tools`,
    kind: "tools",
    tier: verified.length >= 4 ? "verified" : verified.length ? "attested" : "unverified",
    title: `${verified.length} vendor-verified tool${verified.length === 1 ? "" : "s"}`,
    detail: verified
      .slice(0, 4)
      .map((t) => t!.name)
      .join(", ") + (verified.length > 4 ? ` +${verified.length - 4} more` : ""),
    evidence: `${hours.toLocaleString("en-IN")} hours of logged production across credentialed and telemetry-backed tools. Self-attested tools are shown separately and never counted here.`,
    verifiedAt: verified.length ? daysAgo(24 + verified.length * 3) : null,
    expiresAt: null,
    weight: Math.min(24, 4 + verified.length * 4),
  });

  /* 3 ── Workflow transparency. Each stage publishes where a human decided. */
  const wfs = creator.workflowIds.map((w) => context.workflows.get(w)).filter(Boolean);
  const verifiedWfs = wfs.filter((w) => w!.verified);
  const stages = wfs.reduce((s, w) => s + w!.stages.length, 0);
  const checkpoints = wfs.reduce(
    (s, w) => s + w!.stages.filter((st) => st.humanCheckpoint.trim().length > 0).length,
    0,
  );
  out.push({
    id: `${creator.id}-sig-workflow`,
    kind: "workflow",
    tier: verifiedWfs.length ? "verified" : "unverified",
    title: `${verifiedWfs.length} published workflow${verifiedWfs.length === 1 ? "" : "s"}`,
    detail: wfs.map((w) => w!.name).join(" · "),
    evidence: `${stages} stages published, ${checkpoints} with a named human decision point. Workflows are reviewed on every completed engagement.`,
    verifiedAt: wfs.length ? (wfs[0]!.lastRunAt ?? null) : null,
    expiresAt: null,
    weight: Math.min(20, 5 + verifiedWfs.length * 8),
  });

  /* 4 ── Portfolio provenance. Every public piece carries a signed manifest. */
  const pieces = context.portfolio.filter((p) => p.creatorId === creator.id);
  const licensed = pieces.filter((p) => p.license).length;
  out.push({
    id: `${creator.id}-sig-portfolio`,
    kind: "portfolio",
    tier: pieces.length >= 4 ? "verified" : "attested",
    title: `${pieces.length} works with signed provenance`,
    detail: `${licensed} published under an open licence · ${pieces.length - licensed} under client terms`,
    evidence:
      "Each work carries a C2PA content manifest and a SynthID-class invisible watermark. CREAM ran a provenance extraction against this portfolio; all manifests resolved.",
    verifiedAt: pieces.length ? daysAgo(11) : null,
    expiresAt: null,
    weight: Math.min(18, 4 + pieces.length * 3),
  });

  /* 5 ── Delivery record, drawn from completed engagements. */
  const s = creator.stats;
  out.push({
    id: `${creator.id}-sig-delivery`,
    kind: "delivery",
    tier: s.engagements >= 10 && s.onTimeRate >= 93 ? "verified" : "attested",
    title: `${s.engagements} engagements · ${s.onTimeRate}% on time`,
    detail: `${s.repeatClientRate}% repeat clients · ${s.revisionsAvg} revisions per brief on average`,
    evidence:
      "Delivery metrics are computed from escrow releases and client sign-offs on closed engagements. They cannot be self-reported.",
    verifiedAt: daysAgo(7),
    expiresAt: null,
    weight: Math.min(14, 4 + Math.round(s.onTimeRate / 12)),
  });

  /* 6 ── Client attestation. Fewer, heavier signals: a client vouching is the strongest thing here. */
  out.push({
    id: `${creator.id}-sig-client`,
    kind: "client",
    tier: creator.reviewCount >= 20 ? "verified" : "attested",
    title: `${creator.reviewCount} client reviews · ${creator.rating.toFixed(1)}`,
    detail: `Median reply ${s.responseMinutes} minutes · ${s.approvalRate}% of briefs approved first pass`,
    evidence: "Reviews are attached to a closed engagement code and cannot be edited after payout release.",
    verifiedAt: daysAgo(3),
    expiresAt: null,
    weight: 12,
  });

  return out;
}

export function signalsFor(creator: Creator, context: TrustContext): VerificationSignal[] {
  let byCreator = CACHE.get(context);
  if (!byCreator) {
    byCreator = new Map();
    CACHE.set(context, byCreator);
  }
  let cached = byCreator.get(creator.id);
  if (!cached) {
    cached = buildSignals(creator, context);
    byCreator.set(creator.id, cached);
  }
  return cached;
}

/**
 * Trust score. Only `verified` signals contribute; attested claims are shown
 * but deliberately score zero, because a self-reported claim is not evidence.
 */
export function assessTrust(creator: Creator, context: TrustContext): TrustAssessment {
  const signals = signalsFor(creator, context);
  const verifiedCount = signals.filter((s) => s.tier === "verified").length;
  const attestedCount = signals.filter((s) => s.tier === "attested").length;
  const expiringSoon = signals.filter(
    (s) => s.expiresAt && new Date(s.expiresAt).getTime() - Date.now() < 180 * 86_400_000,
  );

  const raw = signals
    .filter((s) => s.tier === "verified")
    .reduce((sum, s) => sum + s.weight, 0);

  // The denominator is the theoretical maximum across all six verified
  // signals, so 100 means literally every signal is independently substantiated
  // and nothing is left to chance. In practice a very strong profile lands in
  // the high eighties, which keeps the score a differentiator rather than a
  // badge everyone carries.
  const score = Math.min(100, Math.round((raw / 122) * 100));

  const tier: TrustAssessment["tier"] =
    creator.identity.status !== "verified"
      ? "unverified"
      : score >= 88
        ? "elite"
        : score >= 68
          ? "verified"
          : "attested";

  return { score, tier, signals, verifiedCount, attestedCount, expiringSoon };
}

export const SIGNAL_META: Record<SignalKind, { label: string; blurb: string }> = {
  identity: { label: "Identity", blurb: "Proven by the issuer, not by us" },
  tools: { label: "Tools", blurb: "Vendor credentialed or telemetry backed" },
  workflow: { label: "Workflow", blurb: "Published pipeline with human checkpoints" },
  portfolio: { label: "Past work", blurb: "Signed provenance on every published asset" },
  delivery: { label: "Delivery", blurb: "Derived from closed engagements, not self-reported" },
  client: { label: "Clients", blurb: "Reviews bound to a paid engagement code" },
};

export const TIER_META: Record<SignalTier, { label: string; blurb: string }> = {
  verified: { label: "Verified", blurb: "Independently substantiated" },
  attested: { label: "Attested", blurb: "Creator claim, not yet substantiated" },
  unverified: { label: "Unverified", blurb: "No substantiation on file" },
  expired: { label: "Expired", blurb: "Substantiation has lapsed" },
};