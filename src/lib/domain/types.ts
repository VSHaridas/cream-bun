/**
 * CREAM — domain model
 * ────────────────────────────────────────────────────────────────────────────
 * The single source of truth for every entity the marketplace reasons about.
 * Both the Supabase adapter and the local mock adapter are typed against this
 * file, so swapping the datastore can never change the shape of the product.
 *
 * Design notes worth reading before you touch this file:
 *
 *  1. Everything a brief needs to be *actionable* is a first-class field.
 *     "Style" alone is not a contract; a brief that a creator cannot quote
 *     against is a brief that generates disputes.
 *
 *  2. Commercial use is a *struct*, not a boolean. Rights differ by territory,
 *     duration, channel, and whether the model owner may train on the output.
 *
 *  3. Tool / model claims carry provenance. An unverified claim and a verified
 *     claim are different data types, not a different colour.
 *
 *  4. Conversation turns are a first-class persisted entity. Preserving the
 *     exact brief conversation is the platform's core differentiator: the same
 *     context is re-hydrated for the creator when an offer arrives.
 */

export type Id = string;
export type Iso = string;

/* ── taxonomy ─────────────────────────────────────────────────────────────── */

export type ContentType =
  | "cinematic-video"
  | "short-form-video"
  | "social-static"
  | "motion-graphics"
  | "3d-visual"
  | "character-design"
  | "product-render"
  | "music-bed"
  | "voiceover"
  | "illustration"
  | "photography"
  | "concept-art";

export type ContentCategory =
  | "video"
  | "image"
  | "audio"
  | "design";

export const CONTENT_TYPE_META: Record<
  ContentType,
  { label: string; category: ContentCategory; hint: string }
> = {
  "cinematic-video": {
    label: "Cinematic video",
    category: "video",
    hint: "30–180s narrative or brand films, 4K master",
  },
  "short-form-video": {
    label: "Short-form video",
    category: "video",
    hint: "9:16 social cutdowns, 6–60s, hook-first",
  },
  "social-static": {
    label: "Social static",
    category: "image",
    hint: "Feed stills, carousels, paid-social variants",
  },
  "motion-graphics": {
    label: "Motion graphics",
    category: "video",
    hint: "Title systems, kinetic type, broadcast packages",
  },
  "3d-visual": {
    label: "3D visual",
    category: "image",
    hint: "Product and environment renders, turntables",
  },
  "character-design": {
    label: "Character design",
    category: "design",
    hint: "Loose sheets, turnaround, style frames",
  },
  "product-render": {
    label: "Product render",
    category: "image",
    hint: "Packaging, hero renders, e-commerce sets",
  },
  "music-bed": {
    label: "Music bed",
    category: "audio",
    hint: "Licensed, cleared stems and mixes",
  },
  voiceover: {
    label: "Voiceover",
    category: "audio",
    hint: "Synth or hybrid VO in regional languages",
  },
  illustration: {
    label: "Illustration",
    category: "image",
    hint: "Editorial and campaign illustration sets",
  },
  photography: {
    label: "AI photography",
    category: "image",
    hint: "Synthetic photoreal sets and retouching",
  },
  "concept-art": {
    label: "Concept art",
    category: "image",
    hint: "Worldbuilding, pre-vis, mood boards",
  },
};

export const CONTENT_TYPES = Object.keys(CONTENT_TYPE_META) as ContentType[];

/** Delivery aspect ratios. Width:Height is normalised to 100. */
export type AspectRatioId =
  | "16:9"
  | "9:16"
  | "1:1"
  | "4:5"
  | "2:3"
  | "3:2"
  | "21:9"
  | "4:3";

export const ASPECT_RATIOS: {
  id: AspectRatioId;
  label: string;
  usage: string;
  w: number;
  h: number;
}[] = [
  { id: "16:9", label: "16:9 Landscape", usage: "YouTube, CTV, broadcast, OOH screens", w: 16, h: 9 },
  { id: "9:16", label: "9:16 Vertical", usage: "Reels, Shorts, TikTok, Stories", w: 9, h: 16 },
  { id: "1:1", label: "1:1 Square", usage: "Feed, marketplace listings", w: 1, h: 1 },
  { id: "4:5", label: "4:5 Portrait", usage: "Instagram feed, Pinterest", w: 4, h: 5 },
  { id: "2:3", label: "2:3 Poster", usage: "Print, OOH, editorial spreads", w: 2, h: 3 },
  { id: "3:2", label: "3:2 Classic", usage: "Lifestyle stills, decks", w: 3, h: 2 },
  { id: "21:9", label: "21:9 Anamorphic", usage: "Hero film, cinematic bumpers", w: 21, h: 9 },
  { id: "4:3", label: "4:3 Classic", usage: "Legacy broadcast, marketplaces", w: 4, h: 3 },
];

export type ToolCategory =
  | "generation"
  | "editing"
  | "motion"
  | "3d"
  | "audio"
  | "orchestration"
  | "upscale"
  | "compositing";

export interface Tool {
  id: string;
  name: string;
  vendor: string;
  category: ToolCategory;
  /** Brand-owned credential supplied by the vendor; surfaced as a verified tool. */
  verified: boolean;
  verifiedVia?: "vendor-credential" | "usage-attestation" | "telemetry";
  /** Number of production hours the creator has logged with this tool. */
  hoursLogged: number;
  accent: string;
}

export interface ModelRef {
  id: string;
  name: string;
  vendor: string;
  kind: "video" | "image" | "text" | "av" | "3d";
  verified: boolean;
}

export type SkillCategory =
  | "direction"
  | "prompt-engineering"
  | "compositing"
  | "editing"
  | "sound"
  | "colour"
  | "story"
  | "production";

export interface Skill {
  id: string;
  name: string;
  category: SkillCategory;
  /** Self-assessed 1–5, corroborated by peer reviews on delivered work. */
  proficiency: 1 | 2 | 3 | 4 | 5;
}

export const SKILL_CATEGORY_LABEL: Record<SkillCategory, string> = {
  direction: "Art direction",
  "prompt-engineering": "Prompt engineering",
  compositing: "Compositing",
  editing: "Editing & grade",
  sound: "Sound design",
  colour: "Colour",
  story: "Narrative",
  production: "Production",
};

/* ── verification ─────────────────────────────────────────────────────────── */

/**
 * CREAM never stores a government ID. Identity is proven by a consented
 * DigiLocker pull — the issuer validates the document, CREAM receives only an
 * assertion envelope. This is the whole reason a new platform can ask for
 * identity without asking for trust.
 */
export interface IdentityVerification {
  status: "unverified" | "pending" | "verified" | "flagged" | "expired";
  method: "digilocker" | "issuer-otp" | null;
  /** DigiLocker issued-identifier (hashed). Never the raw document. */
  issuerRef: string | null;
  issuer: string | null;
  documentType: string | null;
  verifiedAt: Iso | null;
  expiresAt: Iso | null;
  /** CREAM retains the assertion, never the artefact. */
  artefactRetained: false;
  assuranceLevel: "AAL1" | "AAL2" | "AAL3" | null;
}

export type SignalKind =
  | "identity"
  | "tools"
  | "workflow"
  | "portfolio"
  | "delivery"
  | "client";

export type SignalTier = "verified" | "attested" | "unverified" | "expired";

/** A single visible trust indicator on a profile. */
export interface VerificationSignal {
  id: string;
  kind: SignalKind;
  tier: SignalTier;
  title: string;
  detail: string;
  /** How the claim is substantiated, in plain language a brand can audit. */
  evidence: string;
  verifiedAt: Iso | null;
  expiresAt: Iso | null;
  /** Signal-weight contribution to the trust score, 0–100. */
  weight: number;
  /** Verifiable audit reference, e.g. a DigiLocker request id. */
  reference?: string;
}

/* ── workflow ─────────────────────────────────────────────────────────────── */

/**
 * A workflow is the reproducible recipe behind a piece of work. Publishing it
 * is what separates a portfolio slideshow from a professional AI profile: a
 * brand can see the pipeline, the handoffs, and the human decision points.
 */
export interface WorkflowStage {
  id: string;
  name: string;
  description: string;
  tools: string[];
  /** Human-in-the-loop judgement applied at this stage. */
  humanCheckpoint: string;
  /** Share of the piece produced here, 0–100. Sums to 100 across the workflow. */
  weight: number;
}

export interface Workflow {
  id: string;
  name: string;
  summary: string;
  durationHours: number;
  stages: WorkflowStage[];
  verified: boolean;
  lastRunAt: Iso;
}

/* ── portfolio ────────────────────────────────────────────────────────────── */

export interface PortfolioPiece {
  id: string;
  creatorId: Id;
  title: string;
  summary: string;
  contentType: ContentType;
  aspectRatio: AspectRatioId;
  year: number;
  /** Client or brand, redacted when the engagement was under NDA. */
  client: string | null;
  clientLogoInitials?: string;
  industry: string;
  tools: string[];
  models: string[];
  skills: string[];
  workflowId: string;
  palette: [string, string, string];
  /** Deterministic seed for the procedurally-rendered preview surface. */
  artSeed: string;
  /** Populated only for publicly licensed work. */
  license: string | null;
  metrics: {
    views?: number;
    engagementRate?: number;
    awardCount: number;
    briefConversionRate?: number;
  };
  featured: boolean;
  tags: string[];
}

/* ── creators ─────────────────────────────────────────────────────────────── */

export type Availability = "open" | "limited" | "booked";

export const AVAILABILITY_META: Record<
  Availability,
  { label: string; tone: "mint" | "caramel" | "ink"; note: string }
> = {
  open: { label: "Open for briefs", tone: "mint", note: "Accepting new work this month" },
  limited: { label: "Limited capacity", tone: "caramel", note: "Booking from next month" },
  booked: { label: "Fully booked", tone: "ink", note: "Waitlist only" },
};

export interface CreatorStats {
  engagements: number;
  onTimeRate: number;
  avgTurnaroundDays: number;
  approvalRate: number;
  repeatClientRate: number;
  totalEarnings: number;
  responseMinutes: number;
  revisionsAvg: number;
}

export interface Creator {
  id: Id;
  handle: string;
  displayName: string;
  studioName: string | null;
  headline: string;
  bio: string;
  location: string;
  timezone: string;
  languages: string[];
  avatarSeed: string;
  accent: string;
  avatarKind: "portrait" | "abstract" | "mark";
  availability: Availability;
  verifiedAt: Iso | null;
  memberSince: string;
  specializations: string[];
  skills: string[];
  tools: string[];
  models: string[];
  contentTypes: ContentType[];
  aspectRatios: AspectRatioId[];
  /** Day rate in INR. */
  dayRateInr: number;
  minimumEngagementInr: number;
  languagesOffered: string[];
  turnaroundDays: number;
  stats: CreatorStats;
  rating: number;
  reviewCount: number;
  identity: IdentityVerification;
  workflowIds: string[];
  portfolioIds: string[];
  engagementIds: string[];
  badges: string[];
  philosophy: string;
}

/** Everything a brand needs to score trust on a profile. */
export interface TrustAssessment {
  score: number;
  tier: "unverified" | "attested" | "verified" | "elite";
  signals: VerificationSignal[];
  verifiedCount: number;
  attestedCount: number;
  expiringSoon: VerificationSignal[];
}

/* ── briefs ───────────────────────────────────────────────────────────────── */

export interface CommercialUse {
  /** "non-exclusive" grants the client rights; "exclusive" also bars others. */
  licenseType: "non-exclusive" | "exclusive-category" | "exclusive-territory" | "buyout-full";
  territory: "worldwide" | "india" | "custom";
  customTerritory?: string;
  durationMonths: number | null;
  perpetual: boolean;
  channels: string[];
  paidMediaAllowed: boolean;
  /** Whether the model vendor may train on the delivered asset. */
  modelTrainingAllowed: boolean;
  derivativeWorksAllowed: boolean;
  sublicensingAllowed: boolean;
  resaleAllowed: boolean;
  /** AI can generate competing work for the same brand — usually must be false. */
  competitorUseBlocked: boolean;
  /** Disclosure obligations under the client's policy. */
  disclosurePolicy: "client-disclosure" | "platform-disclosure" | "no-disclosure";
}

export interface BriefDeliverable {
  id: string;
  contentType: ContentType;
  aspectRatio: AspectRatioId;
  quantity: number;
  durationSeconds?: number;
  notes: string;
}

export interface BriefTimeline {
  kickoffWithinDays: number;
  firstSamplesWithinDays: number;
  finalDeliveryWithinDays: number;
  revisionsIncluded: number;
  conceptRoundsIncluded: number;
}

export interface Brief {
  id: Id;
  code: string;
  title: string;
  brandId: Id;
  brandName: string;
  campaignObjective: string;
  rawIdea: string;
  /** What the assistant distilled out of the conversation. */
  refinedSummary: string;
  audience: string;
  tone: string[];
  styleTags: string[];
  referenceNotes: string[];
  excludedStyles: string[];
  deliverables: BriefDeliverable[];
  commercialUse: CommercialUse;
  budget: {
    minInr: number;
    maxInr: number;
    model: "fixed" | "day-rate" | "milestone";
    releasedToRazorpay: boolean;
  };
  timeline: BriefTimeline;
  contentTypes: ContentType[];
  aspectRatios: AspectRatioId[];
  mustHaveSignals: VerificationSignal["kind"][];
  status: "draft" | "open" | "shortlisted" | "in-negotiation" | "awarded" | "closed";
  createdAt: Iso;
  updatedAt: Iso;
  sessionId: Id;
  /** Denormalised for search; recomputed on save. */
  embeddingNote: string;
  shortlistedCreatorIds: Id[];
  offerIds: Id[];
}

/* ── conversation (the differentiator) ────────────────────────────────────── */

export type ConversationRole = "brand" | "assistant" | "system";

export interface ConversationTurn {
  id: Id;
  sessionId: Id;
  role: ConversationRole;
  text: string;
  at: Iso;
  /** Fields the assistant wrote into the draft brief during this turn. */
  extractedFields: string[];
  /** Set when the turn was answered by the deterministic fallback engine. */
  simulated?: boolean;
}

export type BriefSessionStatus = "active" | "submitted" | "expired";

export interface BriefSession {
  id: Id;
  briefId: Id;
  brandId: Id;
  turns: ConversationTurn[];
  status: BriefSessionStatus;
  /** Structured draft maintained alongside the transcript. */
  draft: Partial<Brief>;
  createdAt: Iso;
  updatedAt: Iso;
}

/* ── offers, contracts, engagement ────────────────────────────────────────── */

export type OfferStatus =
  | "draft"
  | "sent"
  | "opened"
  | "negotiating"
  | "accepted"
  | "declined"
  | "withdrawn";

export interface Offer {
  id: Id;
  code: string;
  briefId: Id;
  creatorId: Id;
  brandId: Id;
  amountInr: number;
  deliveryDays: number;
  revisionsIncluded: number;
  conceptRounds: number;
  exclusivity: CommercialUse["licenseType"];
  milestones: { label: string; pct: number; dueDay: number }[];
  status: OfferStatus;
  /** The assistant's plain-language restatement of the brief for the creator. */
  translatedBrief: string;
  translationTurns: ConversationTurn[];
  createdAt: Iso;
  respondedAt: Iso | null;
  note: string;
}

export type ContractKind = "engagement-start" | "engagement-close" | "cancellation" | "nda";

export type SignatureStatus = "pending" | "signed" | "declined";

export interface ContractSignature {
  party: "brand" | "creator";
  partyName: string;
  status: SignatureStatus;
  signedAt: Iso | null;
  ipAddress: string | null;
  /** Short SHA-256 prefix over the canonical contract body + signer identity. */
  digest: string | null;
}

export interface ContractClause {
  id: string;
  heading: string;
  body: string;
  /** Human-mandatory acknowledgement; these cannot be pre-checked. */
  requiresExplicitAcknowledgement: boolean;
}

export interface Contract {
  id: Id;
  code: string;
  kind: ContractKind;
  offerId: Id;
  brandId: Id;
  creatorId: Id;
  briefId: Id;
  clauses: ContractClause[];
  signatures: ContractSignature[];
  /** Provenance over the canonical serialisation of the clauses. */
  contentDigest: string;
  status: SignatureStatus;
  createdAt: Iso;
  effectiveAt: Iso | null;
  /** Human-review requirement: CREAM does not auto-generate these. */
  humanReviewed: boolean;
}

export type RoundStatus = "queued" | "generating" | "in-review" | "changes-requested" | "approved";

export interface GenerationRound {
  id: Id;
  index: number;
  briefId: Id;
  label: string;
  createdAt: Iso;
  status: RoundStatus;
  toolChain: string[];
  promptLineage: string[];
  samples: { id: Id; title: string; artSeed: string; palette: [string, string, string]; aspectRatio: AspectRatioId }[];
  feedback: string | null;
  approvedAt: Iso | null;
}

export interface Engagement {
  id: Id;
  code: string;
  briefId: Id;
  offerId: Id;
  brandId: Id;
  creatorId: Id;
  status: "awaiting-signature" | "in-production" | "client-review" | "delivered" | "closed" | "refunded";
  startedAt: Iso;
  dueAt: Iso;
  rounds: GenerationRound[];
  provenance: ProvenanceRecord[];
  escrowId: Id | null;
  contractIds: Id[];
}

export type EscrowStatus = "created" | "authorized" | "captured" | "held" | "partially-released" | "released" | "refunded";

export interface Escrow {
  id: Id;
  code: string;
  engagementId: Id;
  amountInr: number;
  releasedInr: number;
  currency: "INR";
  status: EscrowStatus;
  gateway: "razorpay" | "mock-razorpay";
  gatewayOrderId: string;
  gatewayPaymentId: string | null;
  capturedAt: Iso | null;
  releasedAt: Iso | null;
  /** Razorpay Route / sub-account split for the creator's payout. */
  payoutRoute: string;
  protectedBy: string;
}

/* ── provenance / watermarking ────────────────────────────────────────────── */

export interface ProvenanceRecord {
  id: Id;
  engagementId: Id;
  roundId: Id;
  assetName: string;
  /** C2PA content manifest — the signed, machine-readable provenance claim. */
  c2pa: {
    version: string;
    claimGenerator: string;
    certificateIssuer: string;
    assertions: string[];
    manifestHash: string;
    signedAt: Iso;
  };
  /** SynthID-style imperceptible watermark envelope. */
  synthid: {
    provider: "google-synthid" | "mock-synthid";
    embedded: boolean;
    strength: number;
    payloadId: string;
    extractable: boolean;
    /** Detection result for a suspicious download. */
    lastDetection?: { matched: boolean; confidence: number; at: Iso };
  };
  /** Visible, dual-branded burn-in. */
  visible: {
    platformWatermark: string;
    creatorWatermark: string;
    position: "centre-tile" | "corner" | "ticker";
    opacity: number;
  };
  chainOfCustody: { at: Iso; event: string; actor: string }[];
}

/* ── brand side ───────────────────────────────────────────────────────────── */

export interface Brand {
  id: Id;
  name: string;
  legalName: string;
  kind: "in-house" | "agency" | "startup" | "enterprise";
  industry: string;
  logoInitials: string;
  accent: string;
  location: string;
  identity: IdentityVerification;
  briefIds: Id[];
  shortlistCreatorIds: Id[];
  totalSpendInr: number;
  memberSince: string;
  preferredFormats: AspectRatioId[];
}

/* ── misc ─────────────────────────────────────────────────────────────────── */

export interface Review {
  id: Id;
  creatorId: Id;
  brandName: string;
  rating: number;
  body: string;
  at: Iso;
  engagementCode: string;
  verified: boolean;
}

export interface TaxonomySnapshot {
  tools: Tool[];
  models: ModelRef[];
  skills: string[];
  specializations: string[];
  contentTypes: ContentType[];
}