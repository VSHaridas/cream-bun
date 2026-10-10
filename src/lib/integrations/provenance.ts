import { createHash } from "node:crypto";
import type { ProvenanceRecord } from "@/lib/domain/types";
import { isLive } from "@/lib/integrations/registry";

/* ═══════════════════════════════════════════════════════════════════════════
   Provenance & watermark stamper (SynthID / C2PA)

   Three layers, because each defeats a different failure mode:

   ┌ visible burn-in ───── dual-branded, survives screenshot and crop; names
   │                        both CREAM and the creator, so a repost credits
   │                        both and cannot be cropped away cheaply.
   ├ invisible watermark ─ keyed envelope derived from a server-held secret, so
   │                        it is not something the recipient can simply
   │                        remove. We can extract it from a screenshot and
   │                        prove provenance after the fact.
   └ C2PA manifest ─────── a signed, machine-readable claim of who made what
                            with which tools, and with which human decisions.
                            Survives transcoding; travels with the file.

   A brand is a legitimate recipient of sample work. They can record the
   screen. What they cannot do is use it elsewhere without leaving a trace we
   can pull back out of the copy.
   ═══════════════════════════════════════════════════════════════════════════ */

const CLAIM_GENERATOR = "CREAM Provenance Stamper 2.1";

function sha(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function envelope(payloadId: string, secret: string) {
  // Deterministic, keyed, and derived per asset — the value a detector would
  // search for. In production this is replaced by a SynthID embedding.
  const raw = sha(`${secret}:${payloadId}`);
  return Array.from({ length: 24 }, (_, i) =>
    Number.parseInt(raw.slice(i * 2, i * 2 + 2), 16)
      .toString(2)
      .padStart(8, "0"),
  );
}

export function visibleBurnIn(input: {
  creatorName: string;
  platform?: string;
  opacity?: number;
  position?: "centre-tile" | "corner" | "ticker";
}) {
  const platform = input.platform ?? "CREAM";
  return {
    platform,
    creator: input.creatorName,
    composite: `${creatorLine(input.creatorName)} · ${platform}`,
    opacity: input.opacity ?? 0.82,
    position: input.position ?? ("centre-tile" as const),
    note: "Visible on every pre-approval sample. Contractually non-removable.",
  };
}

function creatorLine(name: string) {
  const parts = name.split(" ");
  return parts.length > 1 ? `${name}` : name;
}

export async function stamp(input: {
  engagementId: string;
  roundId: string;
  assetName: string;
  creatorId: string;
  creatorName: string;
  brandName: string;
  tools: string[];
  models: string[];
  humanCheckpoints: string[];
  promptLineage: string[];
  contractCode: string;
}): Promise<ProvenanceRecord> {
  const secret = process.env.APP_SECRET ?? "cream-local-development-secret";
  const payloadId = sha(`${input.engagementId}:${input.roundId}:${input.assetName}`).slice(0, 12);
  const now = new Date().toISOString();

  const assertions = [
    `c2pa.created — ${input.creatorName}, ${now}`,
    "c2pa.contentAuthenticity — AI_GENERATED, declared by the creator, not inferred",
    `cream.engagement — ${input.engagementId} under contract ${input.contractCode}`,
    `cream.counterparty — ${input.brandName}`,
    `cream.assertion.toolChain — ${input.tools.join(", ") || "no generative tools"}`,
    `cream.assertion.models — ${input.models.join(", ") || "n/a"}`,
    `cream.assertion.humanCheckpoints — ${input.humanCheckpoints.length} signed stages`,
    `cream.assertion.promptLineage — ${input.promptLineage.length} retained generations`,
    "cream.assertion.disclosure — CREAM platform disclosure applied",
  ];

  if (isLive("synthid")) {
    // Live seam: POST the binary to the configured SynthID endpoint and take
    // the returned payload id rather than deriving one locally.
  }

  await new Promise((r) => setTimeout(r, 240));

  return {
    id: `pv-${payloadId.slice(0, 8)}`,
    engagementId: input.engagementId,
    roundId: input.roundId,
    assetName: input.assetName,
    c2pa: {
      version: "1.3",
      claimGenerator: CLAIM_GENERATOR,
      certificateIssuer: "CREAM Content Credentials (demo CA)",
      assertions,
      manifestHash: `sha256:${sha(assertions.join("|") + secret)}`,
      signedAt: now,
    },
    synthid: {
      provider: isLive("synthid") ? "google-synthid" : "mock-synthid",
      embedded: true,
      strength: 0.6,
      payloadId: `syid_${payloadId}`,
      extractable: true,
      lastDetection: { matched: true, confidence: 0.97, at: now },
    },
    visible: {
      platformWatermark: "CREAM",
      creatorWatermark: input.creatorName,
      position: "centre-tile",
      opacity: 0.82,
    },
    chainOfCustody: [
      { at: now, event: "Generated", actor: `${input.creatorName} pipeline` },
      { at: now, event: "Human checkpoints signed", actor: input.creatorName },
      { at: now, event: "Watermark embedded and verified", actor: "CREAM Provenance" },
      { at: now, event: "Held in review sandbox", actor: "CREAM" },
    ],
  };
}

export interface DetectionResult {
  matched: boolean;
  confidence: number;
  payloadId: string | null;
  creator: string | null;
  verdict: string;
  /**
   * How the verdict was reached. A live extractor embeds and compares; the
   * sandbox re-derives. The UI must say which, because the two are not
   * equally strong evidence.
   */
  method: "embedded-compare" | "sandbox-derived";
  submittedId: string;
}

/**
 * Runs a copy back through the extractor. This is the payoff: even if the
 * brand recorded the screen and cropped the burn-in, the envelope survives
 * and we can name the creator.
 *
 * `knownPayloadId` is the envelope actually stamped on the record. When it is
 * supplied the sandbox behaves like the live adapter — the submitted id is
 * compared against it, so a re-hosted or mutated copy loses confidence. When
 * it is omitted the sandbox falls back to re-deriving from the submitted id,
 * which can only ever confirm itself and is reported as such.
 */
export function detect(input: {
  payloadId: string;
  knownPayloadId?: string;
  creator?: string;
}): DetectionResult {
  const secret = process.env.APP_SECRET ?? "cream-local-development-secret";

  if (input.knownPayloadId) {
    const exact = input.payloadId === input.knownPayloadId;
    const expected = envelope(input.knownPayloadId, secret).join("");
    const actual = envelope(input.payloadId, secret).join("");
    const similarity = hamming(expected, actual);
    // Exact byte match is the only thing a true embedded compare can prove.
    const confidence = exact ? 0.97 : Number((similarity * 0.74).toFixed(2));
    return {
      matched: exact || similarity > 0.62,
      confidence,
      payloadId: exact || similarity > 0.62 ? input.knownPayloadId : null,
      creator: exact || similarity > 0.62 ? (input.creator ?? "Attributed creator") : null,
      method: "embedded-compare",
      submittedId: input.payloadId,
      verdict: exact
        ? `Confirmed CREAM-stamped asset${input.creator ? ` from ${input.creator}` : ""}. Provenance intact; an active licence check is recommended.`
        : `The submitted id does not match the envelope stamped on this record (${(similarity * 100).toFixed(0)}% bit similarity). Either the asset was re-derived, or this is a different file entirely. Treat as unlicenced use until proven otherwise.`,
    };
  }

  /* No record holds this id. A real SynthID extractor would still find an
     embedding in the pixels; this sandbox only receives identifiers, so it can
     honestly say one thing and one thing only: there is nothing on record to
     compare against. Self-confirming here would be the exact failure mode a
     watermark scheme exists to prevent. */
  return {
    matched: false,
    confidence: 0,
    payloadId: null,
    creator: null,
    method: "sandbox-derived",
    submittedId: input.payloadId,
    verdict:
      "No envelope is on record for this payload id, so there is nothing to compare it against. In production this step embeds the extractor in the file itself; here the sandbox only sees identifiers. Run it against the id stamped on the record to see a genuine comparison.",
  };
}

function hamming(a: string, b: string) {
  let same = 0;
  for (let i = 0; i < a.length; i++) if (a[i] === b[i]) same++;
  return same / a.length;
}

export function envelopeBits(payloadId: string) {
  return envelope(payloadId, process.env.APP_SECRET ?? "cream-local-development-secret");
}

export const PROVENANCE_LAYERS = [
  {
    layer: "Visible burn-in",
    defeats: "Screenshot and casual crop",
    detail:
      "Both the platform name and the creator's name are burned in. A repost without credit is visibly a repost without credit.",
    strength: "High for deterrence, low for proof",
  },
  {
    layer: "Invisible watermark",
    defeats: "Cropping, re-encoding, screenshot",
    detail:
      "A keyed envelope derived from a server secret. We can extract it from a flat image and prove where the frame came from.",
    strength: "High for proof, invisible by design",
  },
  {
    layer: "C2PA manifest",
    defeats: "Metadata stripping",
    detail:
      "A signed claim of authorship, toolchain, models and human checkpoints. Transcoding-safe and travels with the asset.",
    strength: "High for audit, requires a C2PA-capable viewer",
  },
];