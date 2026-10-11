import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import type {
  AspectRatioId,
  Brand,
  Brief,
  BriefDeliverable,
  BriefSession,
  CommercialUse,
  ContentType,
  ConversationTurn,
  Contract,
  ContractSignature,
  Creator,
  CreatorStats,
  Engagement,
  Escrow,
  GenerationRound,
  IdentityVerification,
  Offer,
  PortfolioPiece,
  ProvenanceRecord,
  Review,
  VerificationSignal,
  Workflow,
  WorkflowStage,
} from "@/lib/domain/types";
import { getSupabaseServer } from "@/lib/supabase/server";
import type { DataProvider, DataSnapshot } from "./provider";

/**
 * The Postgres adapter.
 *
 * Two rules govern everything below.
 *
 *  1. Reads run as the signed-in user through `getSupabaseServer()`, never the
 *     service role. A partially-privileged snapshot is the point: a creator sees
 *     the briefs they were offered, a brand sees their own, and nothing above
 *     this line needs to know which rows were filtered by RLS.
 *
 *  2. A half-loaded snapshot is worse than an error, so every table is checked
 *     and every failure names the table that produced it. The caller decides
 *     whether to fall back to the bundled seed.
 *
 * Where a table carries a `slug text not null unique` column beside its uuid
 * primary key, the slug — not the uuid — is the domain id. FKs between runtime
 * tables are uuids, so those are translated through lookup maps rather than
 * leaked into the domain model.
 */

/* ── coercion ──────────────────────────────────────────────────────────────── */

/**
 * Postgres `numeric` arrives as a JSON string over PostgREST, `bigint` as a
 * number, and both can be null. Every scalar money/rate column goes through
 * here rather than through a cast.
 */
function num(value: unknown, fallback = 0): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : fallback;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
}

function str(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function strOrNull(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function arr(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === "string");
}

function bool(value: unknown, fallback = false): boolean {
  return typeof value === "boolean" ? value : fallback;
}

/** `timestamptz` already serialises to an ISO 8601 string over PostgREST. */
function iso(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function dateOrNull(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function jsonObject(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function jsonArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

/** PostgREST returns a to-one embed as an object and a to-many embed as an array. */
function rows<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];
  if (value && typeof value === "object") return [value as T];
  return [];
}

const NEUTRAL_PALETTE: [string, string, string] = ["#1b1d24", "#5b6472", "#e6e3dc"];

function palette(value: unknown): [string, string, string] {
  const colors = arr(value);
  if (colors.length !== 3) return NEUTRAL_PALETTE;
  return [colors[0], colors[1], colors[2]];
}

const ZERO_STATS: CreatorStats = {
  engagements: 0,
  onTimeRate: 0,
  avgTurnaroundDays: 0,
  approvalRate: 0,
  repeatClientRate: 0,
  totalEarnings: 0,
  responseMinutes: 0,
  revisionsAvg: 0,
};

/** The domain type is not nullable, so a party with no assertion row reads as unverified. */
const UNVERIFIED_IDENTITY: IdentityVerification = {
  status: "unverified",
  method: null,
  issuerRef: null,
  issuer: null,
  documentType: null,
  verifiedAt: null,
  expiresAt: null,
  artefactRetained: false,
  assuranceLevel: null,
};

const DEFAULT_COMMERCIAL_USE: CommercialUse = {
  licenseType: "non-exclusive",
  territory: "india",
  durationMonths: null,
  perpetual: false,
  channels: [],
  paidMediaAllowed: false,
  modelTrainingAllowed: false,
  derivativeWorksAllowed: true,
  sublicensingAllowed: false,
  resaleAllowed: false,
  competitorUseBlocked: true,
  disclosurePolicy: "platform-disclosure",
};

function groupBy<T>(items: T[], key: (item: T) => string | null): Map<string, T[]> {
  const out = new Map<string, T[]>();
  for (const item of items) {
    const k = key(item);
    if (!k) continue;
    const bucket = out.get(k);
    if (bucket) bucket.push(item);
    else out.set(k, [item]);
  }
  return out;
}

/** uuid FK → domain slug. A dangling reference keeps its uuid so it stays traceable. */
function viaSlug(map: Map<string, string>, uuid: string | null): string {
  if (!uuid) return "";
  return map.get(uuid) ?? uuid;
}

/* ── row types ─────────────────────────────────────────────────────────────── */

interface CreatorStatsRow {
  creator_id: string | null;
  engagements: number | string | null;
  on_time_rate: number | string | null;
  avg_turnaround_days: number | string | null;
  approval_rate: number | string | null;
  repeat_client_rate: number | string | null;
  total_earnings_inr: number | string | null;
  response_minutes: number | string | null;
  revisions_avg: number | string | null;
}

interface CreatorToolsRow {
  tool_id: string;
  position: number | null;
}

interface CreatorSkillsRow {
  skill_id: string;
  position: number | null;
}

interface CreatorModelsRow {
  model_id: string;
  position: number | null;
}

interface CreatorContentTypesRow {
  content_type: string;
  position: number | null;
}

interface CreatorAspectRatiosRow {
  aspect_ratio: string;
  position: number | null;
}

interface CreatorLanguagesRow {
  language: string;
  offering: string;
  position: number | null;
}

interface CreatorSpecializationsRow {
  specialization_id: string;
  position: number | null;
}

interface CreatorWorkflowsRow {
  workflow_id: string;
  position: number | null;
}

export interface CreatorRow {
  id: string;
  handle: string;
  display_name: string;
  studio_name: string | null;
  headline: string;
  bio: string;
  location: string;
  timezone: string;
  avatar_seed: string;
  accent: string;
  avatar_kind: string;
  availability: string;
  verified_at: string | null;
  member_since: string;
  philosophy: string;
  day_rate_inr: number | string | null;
  minimum_engagement_inr: number | string | null;
  turnaround_days: number | string | null;
  rating: number | string | null;
  review_count: number | string | null;
  badges: string[] | null;
  creator_stats: CreatorStatsRow | CreatorStatsRow[] | null;
  creator_tools: CreatorToolsRow[] | null;
  creator_skills: CreatorSkillsRow[] | null;
  creator_models: CreatorModelsRow[] | null;
  creator_content_types: CreatorContentTypesRow[] | null;
  creator_aspect_ratios: CreatorAspectRatiosRow[] | null;
  creator_languages: CreatorLanguagesRow[] | null;
  creator_specializations: CreatorSpecializationsRow[] | null;
  creator_workflows: CreatorWorkflowsRow[] | null;
}

interface BrandPreferredFormatsRow {
  aspect_ratio: string;
  position: number | null;
}

export interface BrandRow {
  id: string;
  name: string;
  legal_name: string;
  kind: string;
  industry: string | null;
  logo_initials: string;
  accent: string;
  location: string;
  member_since: string;
  total_spend_inr: number | string | null;
  brand_preferred_formats: BrandPreferredFormatsRow[] | null;
}

interface WorkflowStageToolsRow {
  tool_id: string;
  position: number | null;
}

interface WorkflowStagesRow {
  id: string;
  slug: string;
  position: number | null;
  name: string;
  description: string;
  human_checkpoint: string;
  weight: number | string | null;
  workflow_stage_tools: WorkflowStageToolsRow[] | null;
}

export interface WorkflowRow {
  id: string;
  name: string;
  summary: string;
  duration_hours: number | string | null;
  verified: boolean | null;
  last_run_at: string | null;
  workflow_stages: WorkflowStagesRow[] | null;
}

interface PortfolioPieceToolsRow {
  tool_id: string;
  position: number | null;
}

interface PortfolioPieceModelsRow {
  model_id: string;
  position: number | null;
}

interface PortfolioPieceSkillsRow {
  skill_id: string;
  position: number | null;
}

export interface PortfolioPieceRow {
  id: string;
  creator_id: string;
  title: string;
  summary: string;
  content_type: string;
  aspect_ratio: string;
  year: number | string | null;
  client: string | null;
  client_logo_initials: string | null;
  industry: string | null;
  workflow_id: string | null;
  palette: string[] | null;
  art_seed: string;
  license: string | null;
  metrics: unknown;
  featured: boolean | null;
  tags: string[] | null;
  portfolio_piece_tools: PortfolioPieceToolsRow[] | null;
  portfolio_piece_models: PortfolioPieceModelsRow[] | null;
  portfolio_piece_skills: PortfolioPieceSkillsRow[] | null;
}

interface BriefDeliverablesRow {
  id: string;
  content_type: string;
  aspect_ratio: string;
  quantity: number | string | null;
  duration_seconds: number | string | null;
  notes: string;
  position: number | null;
}

interface CommercialUseRow {
  license_type: string;
  territory: string;
  custom_territory: string | null;
  duration_months: number | string | null;
  perpetual: boolean | null;
  channels: string[] | null;
  paid_media_allowed: boolean | null;
  model_training_allowed: boolean | null;
  derivative_works_allowed: boolean | null;
  sublicensing_allowed: boolean | null;
  resale_allowed: boolean | null;
  competitor_use_blocked: boolean | null;
  disclosure_policy: string;
}

export interface BriefRow {
  id: string;
  slug: string;
  code: string;
  title: string;
  brand_id: string;
  brand_name: string;
  campaign_objective: string;
  raw_idea: string;
  refined_summary: string;
  audience: string;
  tone: string[] | null;
  style_tags: string[] | null;
  reference_notes: string[] | null;
  excluded_styles: string[] | null;
  content_types: string[] | null;
  aspect_ratios: string[] | null;
  must_have_signals: string[] | null;
  status: string;
  budget_min_inr: number | string | null;
  budget_max_inr: number | string | null;
  budget_model: string;
  budget_released_to_razorpay: boolean | null;
  kickoff_within_days: number | string | null;
  first_samples_within_days: number | string | null;
  final_delivery_within_days: number | string | null;
  revisions_included: number | string | null;
  concept_rounds_included: number | string | null;
  session_id: string | null;
  embedding_note: string;
  created_at: string | null;
  updated_at: string | null;
  brief_deliverables: BriefDeliverablesRow[] | null;
  commercial_use: CommercialUseRow | CommercialUseRow[] | null;
}

export interface BriefSessionRow {
  id: string;
  slug: string;
  brief_id: string | null;
  brand_id: string;
  status: string;
  draft: unknown;
  created_at: string | null;
  updated_at: string | null;
}

export interface ConversationTurnRow {
  id: string;
  slug: string;
  session_id: string | null;
  offer_id: string | null;
  role: string;
  text: string;
  at: string | null;
  extracted_fields: string[] | null;
  simulated: boolean | null;
}

interface OfferMilestonesRow {
  id: string;
  label: string;
  pct: number | string | null;
  due_day: number | string | null;
  position: number | null;
}

export interface OfferRow {
  id: string;
  slug: string;
  code: string;
  brief_id: string;
  creator_id: string;
  brand_id: string;
  amount_inr: number | string | null;
  delivery_days: number | string | null;
  revisions_included: number | string | null;
  concept_rounds: number | string | null;
  exclusivity: string;
  status: string;
  translated_brief: string;
  created_at: string | null;
  responded_at: string | null;
  note: string;
  offer_milestones: OfferMilestonesRow[] | null;
}

interface ContractClausesRow {
  slug: string;
  heading: string;
  body: string;
  requires_explicit_acknowledgement: boolean | null;
  position: number | null;
}

interface ContractSignaturesRow {
  party: string;
  party_name: string;
  status: string;
  signed_at: string | null;
  ip_address: string | null;
  digest: string | null;
}

export interface ContractRow {
  id: string;
  slug: string;
  code: string;
  kind: string;
  offer_id: string;
  brand_id: string;
  creator_id: string;
  brief_id: string;
  content_digest: string;
  status: string;
  created_at: string | null;
  effective_at: string | null;
  human_reviewed: boolean | null;
  contract_clauses: ContractClausesRow[] | null;
  contract_signatures: ContractSignaturesRow[] | null;
}

interface GenerationSamplesRow {
  id: string;
  title: string;
  art_seed: string;
  palette: string[] | null;
  aspect_ratio: string | null;
  position: number | null;
}

interface GenerationRoundsRow {
  id: string;
  slug: string;
  round_index: number | string | null;
  brief_id: string | null;
  engagement_id: string | null;
  label: string;
  status: string;
  tool_chain: string[] | null;
  prompt_lineage: string[] | null;
  feedback: string | null;
  approved_at: string | null;
  created_at: string | null;
  generation_samples: GenerationSamplesRow[] | null;
}

export interface EngagementRow {
  id: string;
  slug: string;
  code: string;
  brief_id: string;
  offer_id: string;
  brand_id: string;
  creator_id: string;
  status: string;
  started_at: string | null;
  due_at: string | null;
  escrow_id: string | null;
  generation_rounds: GenerationRoundsRow[] | null;
}

export interface EscrowRow {
  id: string;
  slug: string;
  code: string;
  engagement_id: string;
  amount_inr: number | string | null;
  released_inr: number | string | null;
  currency: string;
  status: string;
  gateway: string;
  gateway_order_id: string;
  gateway_payment_id: string | null;
  captured_at: string | null;
  released_at: string | null;
  payout_route: string;
  protected_by: string;
}

export interface ProvenanceRow {
  id: string;
  slug: string;
  engagement_id: string;
  round_id: string | null;
  asset_name: string;
  c2pa: unknown;
  synthid: unknown;
  visible: unknown;
  chain_of_custody: unknown;
}

export interface ReviewRow {
  id: string;
  slug: string;
  creator_id: string;
  brand_name: string;
  rating: number | string | null;
  body: string;
  at: string | null;
  engagement_code: string;
  verified: boolean | null;
}

export interface ShortlistRow {
  brand_id: string;
  creator_id: string;
  brief_id: string | null;
}

export interface IdentityVerificationRow {
  creator_id: string | null;
  brand_id: string | null;
  status: string;
  method: string | null;
  issuer_ref: string | null;
  issuer: string | null;
  document_type: string | null;
  verified_at: string | null;
  expires_at: string | null;
  assurance_level: string | null;
  updated_at: string | null;
}

interface LabelRow {
  id: string;
  label: string;
}

/* ── select strings ────────────────────────────────────────────────────────── */

const CAP = 5000;

const CREATOR_SELECT = [
  "id, handle, display_name, studio_name, headline, bio, location, timezone, avatar_seed,",
  "accent, avatar_kind, availability, verified_at, member_since, philosophy, day_rate_inr,",
  "minimum_engagement_inr, turnaround_days, rating, review_count, badges,",
  "creator_stats(creator_id, engagements, on_time_rate, avg_turnaround_days, approval_rate,",
  "repeat_client_rate, total_earnings_inr, response_minutes, revisions_avg),",
  "creator_tools(tool_id, position),",
  "creator_skills(skill_id, position),",
  "creator_models(model_id, position),",
  "creator_content_types(content_type, position),",
  "creator_aspect_ratios(aspect_ratio, position),",
  "creator_languages(language, offering, position),",
  "creator_specializations(specialization_id, position),",
  "creator_workflows(workflow_id, position)",
].join(" ");

const BRAND_SELECT = [
  "id, name, legal_name, kind, industry, logo_initials, accent, location, member_since,",
  "total_spend_inr, brand_preferred_formats(aspect_ratio, position)",
].join(" ");

const WORKFLOW_SELECT = [
  "id, name, summary, duration_hours, verified, last_run_at,",
  "workflow_stages(id, slug, position, name, description, human_checkpoint, weight,",
  "workflow_stage_tools(tool_id, position))",
].join(" ");

const PORTFOLIO_SELECT = [
  "id, creator_id, title, summary, content_type, aspect_ratio, year, client,",
  "client_logo_initials, industry, workflow_id, palette, art_seed, license, metrics,",
  "featured, tags, portfolio_piece_tools(tool_id, position),",
  "portfolio_piece_models(model_id, position),",
  "portfolio_piece_skills(skill_id, position)",
].join(" ");

const BRIEF_SELECT = [
  "id, slug, code, title, brand_id, brand_name, campaign_objective, raw_idea,",
  "refined_summary, audience, tone, style_tags, reference_notes, excluded_styles,",
  "content_types, aspect_ratios, must_have_signals, status, budget_min_inr, budget_max_inr,",
  "budget_model, budget_released_to_razorpay, kickoff_within_days, first_samples_within_days,",
  "final_delivery_within_days, revisions_included, concept_rounds_included, session_id,",
  "embedding_note, created_at, updated_at,",
  "brief_deliverables(id, content_type, aspect_ratio, quantity, duration_seconds, notes, position),",
  "commercial_use(license_type, territory, custom_territory, duration_months, perpetual,",
  "channels, paid_media_allowed, model_training_allowed, derivative_works_allowed,",
  "sublicensing_allowed, resale_allowed, competitor_use_blocked, disclosure_policy)",
].join(" ");

const SESSION_SELECT = "id, slug, brief_id, brand_id, status, draft, created_at, updated_at";

const TURN_SELECT =
  "id, slug, session_id, offer_id, role, text, at, extracted_fields, simulated";

const OFFER_SELECT = [
  "id, slug, code, brief_id, creator_id, brand_id, amount_inr, delivery_days,",
  "revisions_included, concept_rounds, exclusivity, status, translated_brief, created_at,",
  "responded_at, note, offer_milestones(id, label, pct, due_day, position)",
].join(" ");

const CONTRACT_SELECT = [
  "id, slug, code, kind, offer_id, brand_id, creator_id, brief_id, content_digest, status,",
  "created_at, effective_at, human_reviewed,",
  "contract_clauses(slug, heading, body, requires_explicit_acknowledgement, position),",
  "contract_signatures(party, party_name, status, signed_at, ip_address, digest)",
].join(" ");

const ENGAGEMENT_SELECT = [
  "id, slug, code, brief_id, offer_id, brand_id, creator_id, status, started_at, due_at,",
  "escrow_id, generation_rounds(id, slug, round_index, brief_id, engagement_id, label,",
  "status, tool_chain, prompt_lineage, feedback, approved_at, created_at,",
  "generation_samples(id, title, art_seed, palette, aspect_ratio, position))",
].join(" ");

const ESCROW_SELECT = [
  "id, slug, code, engagement_id, amount_inr, released_inr, currency, status, gateway,",
  "gateway_order_id, gateway_payment_id, captured_at, released_at, payout_route, protected_by",
].join(" ");

const PROVENANCE_SELECT =
  "id, slug, engagement_id, round_id, asset_name, c2pa, synthid, visible, chain_of_custody";

const REVIEW_SELECT =
  "id, slug, creator_id, brand_name, rating, body, at, engagement_code, verified";

const SHORTLIST_SELECT = "brand_id, creator_id, brief_id";

const IDENTITY_SELECT = [
  "creator_id, brand_id, status, method, issuer_ref, issuer, document_type, verified_at,",
  "expires_at, assurance_level, updated_at",
].join(" ");

/* ── guards and ordering ───────────────────────────────────────────────────── */

/**
 * PostgREST truncates at 1000 rows by default, so every query carries an
 * explicit cap. It is set five times higher than any plausible marketplace
 * size: the point is to bound the response, not to truncate it.
 */
function read<Row>(table: string, result: { data: unknown; error: PostgrestError | null }): Row[] {
  if (result.error) {
    throw new Error(
      `supabase: ${table} — ${result.error.message} (${result.error.code ?? "no code"}, detail: ${result.error.details ?? "none"})`,
    );
  }
  if (result.data === null) {
    throw new Error(`supabase: ${table} returned null instead of a result set`);
  }
  if (!Array.isArray(result.data)) {
    throw new Error(`supabase: ${table} returned a non-array result set`);
  }
  return result.data as Row[];
}

function byPos<T extends { position: number | null }>(a: T, b: T): number {
  return num(a.position) - num(b.position);
}

function identityFrom(row: IdentityVerificationRow | undefined): IdentityVerification {
  if (!row) return UNVERIFIED_IDENTITY;
  return {
    status: str(row.status, "unverified") as IdentityVerification["status"],
    method: (row.method ?? null) as IdentityVerification["method"],
    issuerRef: strOrNull(row.issuer_ref),
    issuer: strOrNull(row.issuer),
    documentType: strOrNull(row.document_type),
    verifiedAt: dateOrNull(row.verified_at),
    expiresAt: dateOrNull(row.expires_at),
    // A check constraint pins this to false: CREAM keeps the assertion, never the artefact.
    artefactRetained: false,
    assuranceLevel: (row.assurance_level ?? null) as IdentityVerification["assuranceLevel"],
  };
}

function statsFrom(row: CreatorStatsRow | undefined): CreatorStats {
  if (!row) return ZERO_STATS;
  return {
    engagements: num(row.engagements),
    onTimeRate: num(row.on_time_rate),
    avgTurnaroundDays: num(row.avg_turnaround_days),
    approvalRate: num(row.approval_rate),
    repeatClientRate: num(row.repeat_client_rate),
    totalEarnings: num(row.total_earnings_inr),
    responseMinutes: num(row.response_minutes),
    revisionsAvg: num(row.revisions_avg),
  };
}

function metricsFrom(value: unknown): PortfolioPiece["metrics"] {
  const blob = jsonObject(value);
  const metrics: PortfolioPiece["metrics"] = { awardCount: num(blob.awardCount) };
  if (blob.views !== undefined && blob.views !== null) metrics.views = num(blob.views);
  if (blob.engagementRate !== undefined && blob.engagementRate !== null) {
    metrics.engagementRate = num(blob.engagementRate);
  }
  if (blob.briefConversionRate !== undefined && blob.briefConversionRate !== null) {
    metrics.briefConversionRate = num(blob.briefConversionRate);
  }
  return metrics;
}

function commercialUseFrom(row: CommercialUseRow | undefined): CommercialUse {
  if (!row) return DEFAULT_COMMERCIAL_USE;
  const use: CommercialUse = {
    licenseType: str(row.license_type, "non-exclusive") as CommercialUse["licenseType"],
    territory: str(row.territory, "india") as CommercialUse["territory"],
    durationMonths: row.duration_months === null || row.duration_months === undefined
      ? null
      : num(row.duration_months),
    perpetual: bool(row.perpetual),
    channels: arr(row.channels),
    paidMediaAllowed: bool(row.paid_media_allowed),
    modelTrainingAllowed: bool(row.model_training_allowed),
    derivativeWorksAllowed: bool(row.derivative_works_allowed, true),
    sublicensingAllowed: bool(row.sublicensing_allowed),
    resaleAllowed: bool(row.resale_allowed),
    competitorUseBlocked: bool(row.competitor_use_blocked, true),
    disclosurePolicy: str(row.disclosure_policy, "platform-disclosure") as CommercialUse["disclosurePolicy"],
  };
  const customTerritory = strOrNull(row.custom_territory);
  if (customTerritory !== null) use.customTerritory = customTerritory;
  return use;
}

function deliverableFrom(row: BriefDeliverablesRow): BriefDeliverable {
  const deliverable: BriefDeliverable = {
    id: str(row.id),
    contentType: str(row.content_type) as ContentType,
    aspectRatio: str(row.aspect_ratio) as AspectRatioId,
    quantity: num(row.quantity, 1),
    notes: str(row.notes),
  };
  if (row.duration_seconds !== null && row.duration_seconds !== undefined) {
    deliverable.durationSeconds = num(row.duration_seconds);
  }
  return deliverable;
}

function turnFrom(row: ConversationTurnRow, parentId: string): ConversationTurn {
  const turn: ConversationTurn = {
    id: str(row.slug),
    sessionId: parentId,
    role: str(row.role, "system") as ConversationTurn["role"],
    text: str(row.text),
    at: iso(row.at),
    extractedFields: arr(row.extracted_fields),
  };
  if (row.simulated) turn.simulated = true;
  return turn;
}

function signatureFrom(row: ContractSignaturesRow): ContractSignature {
  return {
    party: str(row.party, "brand") as ContractSignature["party"],
    partyName: str(row.party_name),
    status: str(row.status, "pending") as ContractSignature["status"],
    signedAt: dateOrNull(row.signed_at),
    ipAddress: strOrNull(row.ip_address),
    digest: strOrNull(row.digest),
  };
}

function provenanceFrom(row: ProvenanceRow, engagementId: string, roundId: string): ProvenanceRecord {
  const c2pa = jsonObject(row.c2pa);
  const synthid = jsonObject(row.synthid);
  const visible = jsonObject(row.visible);
  const envelope: ProvenanceRecord["synthid"] = {
    provider: str(synthid.provider, "mock-synthid") as ProvenanceRecord["synthid"]["provider"],
    embedded: bool(synthid.embedded),
    strength: num(synthid.strength),
    payloadId: str(synthid.payloadId),
    extractable: bool(synthid.extractable),
  };
  if (synthid.lastDetection && typeof synthid.lastDetection === "object") {
    const detection = jsonObject(synthid.lastDetection);
    envelope.lastDetection = {
      matched: bool(detection.matched),
      confidence: num(detection.confidence),
      at: iso(detection.at),
    };
  }
  return {
    id: str(row.slug),
    engagementId,
    roundId,
    assetName: str(row.asset_name),
    c2pa: {
      version: str(c2pa.version),
      claimGenerator: str(c2pa.claimGenerator),
      certificateIssuer: str(c2pa.certificateIssuer),
      assertions: arr(c2pa.assertions),
      manifestHash: str(c2pa.manifestHash),
      signedAt: iso(c2pa.signedAt),
    },
    synthid: envelope,
    visible: {
      platformWatermark: str(visible.platformWatermark),
      creatorWatermark: str(visible.creatorWatermark),
      position: str(visible.position, "corner") as ProvenanceRecord["visible"]["position"],
      opacity: num(visible.opacity),
    },
    chainOfCustody: jsonArray(row.chain_of_custody).map((entry) => {
      const item = jsonObject(entry);
      return { at: iso(item.at), event: str(item.event), actor: str(item.actor) };
    }),
  };
}

/* ── provider ──────────────────────────────────────────────────────────────── */

export const supabaseProvider: DataProvider = {
  name: "supabase",
  writable: true,

  async load(): Promise<DataSnapshot> {
    const sb = await getSupabaseServer();
    if (!sb) {
      throw new Error(
        "supabase: no server client. SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY are not configured.",
      );
    }

    const [
      creatorRows,
      brandRows,
      workflowRows,
      portfolioRows,
      briefRows,
      sessionRows,
      turnRows,
      offerRows,
      contractRows,
      engagementRows,
      escrowRows,
      provenanceRows,
      reviewRows,
      shortlistRows,
      identityRows,
      specializationRows,
      industryRows,
    ] = await Promise.all([
      read<CreatorRow>(
        "creators",
        await sb.from("creators").select(CREATOR_SELECT).order("id").limit(CAP),
      ),
      read<BrandRow>(
        "brands",
        await sb.from("brands").select(BRAND_SELECT).order("id").limit(CAP),
      ),
      read<WorkflowRow>(
        "workflows",
        await sb.from("workflows").select(WORKFLOW_SELECT).order("id").limit(CAP),
      ),
      read<PortfolioPieceRow>(
        "portfolio_pieces",
        await sb.from("portfolio_pieces").select(PORTFOLIO_SELECT).order("id").limit(CAP),
      ),
      read<BriefRow>("briefs", await sb.from("briefs").select(BRIEF_SELECT).order("slug").limit(CAP)),
      read<BriefSessionRow>(
        "brief_sessions",
        await sb.from("brief_sessions").select(SESSION_SELECT).order("slug").limit(CAP),
      ),
      read<ConversationTurnRow>(
        "conversation_turns",
        await sb.from("conversation_turns").select(TURN_SELECT).order("at").order("slug").limit(CAP),
      ),
      read<OfferRow>(
        "offers",
        await sb.from("offers").select(OFFER_SELECT).order("slug").limit(CAP),
      ),
      read<ContractRow>(
        "contracts",
        await sb.from("contracts").select(CONTRACT_SELECT).order("slug").limit(CAP),
      ),
      read<EngagementRow>(
        "engagements",
        await sb.from("engagements").select(ENGAGEMENT_SELECT).order("slug").limit(CAP),
      ),
      read<EscrowRow>(
        "escrows",
        await sb.from("escrows").select(ESCROW_SELECT).order("slug").limit(CAP),
      ),
      read<ProvenanceRow>(
        "provenance_records",
        await sb.from("provenance_records").select(PROVENANCE_SELECT).order("slug").limit(CAP),
      ),
      read<ReviewRow>(
        "reviews",
        await sb.from("reviews").select(REVIEW_SELECT).order("slug").limit(CAP),
      ),
      read<ShortlistRow>(
        "shortlists",
        await sb.from("shortlists").select(SHORTLIST_SELECT).order("created_at").limit(CAP),
      ),
      read<IdentityVerificationRow>(
        "identity_verifications",
        await sb.from("identity_verifications").select(IDENTITY_SELECT).order("updated_at").limit(CAP),
      ),
      read<LabelRow>("specializations", await sb.from("specializations").select("id, label").limit(CAP)),
      read<LabelRow>("industries", await sb.from("industries").select("id, label").limit(CAP)),
    ]);

    /* ── uuid → slug maps: the domain never sees a runtime uuid ─────────────── */

    const briefSlugByUuid = new Map(briefRows.map((row) => [row.id, str(row.slug)]));
    const sessionSlugByUuid = new Map(sessionRows.map((row) => [row.id, str(row.slug)]));
    const offerSlugByUuid = new Map(offerRows.map((row) => [row.id, str(row.slug)]));
    const contractSlugByUuid = new Map(contractRows.map((row) => [row.id, str(row.slug)]));
    const escrowSlugByUuid = new Map(escrowRows.map((row) => [row.id, str(row.slug)]));

    // Round slugs come out of the nested embed, so collect them before mapping.
    const roundRows = engagementRows.flatMap((row) => rows<GenerationRoundsRow>(row.generation_rounds));
    const engagementSlugByUuid = new Map(engagementRows.map((row) => [row.id, str(row.slug)]));
    const roundSlugByUuid = new Map(roundRows.map((row) => [row.id, str(row.slug)]));

    /* ── reference vocabularies ────────────────────────────────────────────── */

    const specializationLabels = new Map(specializationRows.map((row) => [row.id, row.label]));
    const industryLabels = new Map(industryRows.map((row) => [row.id, row.label]));
    const specialization = (id: string | null) =>
      id ? (specializationLabels.get(id) ?? id) : "";
    const industry = (id: string | null) => (id ? (industryLabels.get(id) ?? id) : "");

    /* ── identity ──────────────────────────────────────────────────────────── */

    // One row per party (partial unique index), so a plain overwrite is safe;
    // ordering by updated_at means the newest assertion wins if that ever breaks.
    const identityByCreator = new Map<string, IdentityVerificationRow>();
    const identityByBrand = new Map<string, IdentityVerificationRow>();
    for (const row of identityRows) {
      if (row.creator_id) identityByCreator.set(row.creator_id, row);
      if (row.brand_id) identityByBrand.set(row.brand_id, row);
    }

    /* ── derived edges ─────────────────────────────────────────────────────── */

    const portfolioByCreator = groupBy(portfolioRows, (row) => row.creator_id);
    const engagementsByCreator = groupBy(engagementRows, (row) => row.creator_id);
    const briefsByBrand = groupBy(briefRows, (row) => row.brand_id);
    const offersByBrief = groupBy(offerRows, (row) => row.brief_id);
    const contractsByOffer = groupBy(contractRows, (row) => row.offer_id);
    const escrowsByEngagement = groupBy(escrowRows, (row) => row.engagement_id);
    const provenanceByEngagement = groupBy(provenanceRows, (row) => row.engagement_id);

    const shortlistCreatorsByBrand = new Map<string, string[]>();
    const shortlistCreatorsByBrief = new Map<string, string[]>();
    for (const row of shortlistRows) {
      const brandBucket = shortlistCreatorsByBrand.get(row.brand_id);
      if (brandBucket) brandBucket.push(row.creator_id);
      else shortlistCreatorsByBrand.set(row.brand_id, [row.creator_id]);

      if (!row.brief_id) continue;
      const briefBucket = shortlistCreatorsByBrief.get(row.brief_id);
      if (briefBucket) briefBucket.push(row.creator_id);
      else shortlistCreatorsByBrief.set(row.brief_id, [row.creator_id]);
    }

    const turnsBySession = groupBy(turnRows, (row) => row.session_id);
    const turnsByOffer = groupBy(turnRows, (row) => row.offer_id);

    /* ── creators ──────────────────────────────────────────────────────────── */

    const creators: Creator[] = creatorRows.map((row) => {
      const languages = rows<CreatorLanguagesRow>(row.creator_languages);
      return {
        id: str(row.id),
        handle: str(row.handle),
        displayName: str(row.display_name),
        studioName: strOrNull(row.studio_name),
        headline: str(row.headline),
        bio: str(row.bio),
        location: str(row.location),
        timezone: str(row.timezone),
        languages: [...languages]
          .filter((entry) => entry.offering === "speaks")
          .sort(byPos)
          .map((entry) => str(entry.language)),
        avatarSeed: str(row.avatar_seed),
        accent: str(row.accent),
        avatarKind: str(row.avatar_kind, "abstract") as Creator["avatarKind"],
        availability: str(row.availability, "open") as Creator["availability"],
        verifiedAt: dateOrNull(row.verified_at),
        memberSince: str(row.member_since),
        specializations: [...rows<CreatorSpecializationsRow>(row.creator_specializations)]
          .sort(byPos)
          .map((entry) => specialization(entry.specialization_id)),
        skills: [...rows<CreatorSkillsRow>(row.creator_skills)]
          .sort(byPos)
          .map((entry) => str(entry.skill_id)),
        tools: [...rows<CreatorToolsRow>(row.creator_tools)]
          .sort(byPos)
          .map((entry) => str(entry.tool_id)),
        models: [...rows<CreatorModelsRow>(row.creator_models)]
          .sort(byPos)
          .map((entry) => str(entry.model_id)),
        contentTypes: [...rows<CreatorContentTypesRow>(row.creator_content_types)]
          .sort(byPos)
          .map((entry) => str(entry.content_type) as ContentType),
        aspectRatios: [...rows<CreatorAspectRatiosRow>(row.creator_aspect_ratios)]
          .sort(byPos)
          .map((entry) => str(entry.aspect_ratio) as AspectRatioId),
        dayRateInr: num(row.day_rate_inr),
        minimumEngagementInr: num(row.minimum_engagement_inr),
        languagesOffered: [...languages]
          .filter((entry) => entry.offering === "offered")
          .sort(byPos)
          .map((entry) => str(entry.language)),
        turnaroundDays: num(row.turnaround_days),
        stats: statsFrom(rows<CreatorStatsRow>(row.creator_stats)[0]),
        rating: num(row.rating),
        reviewCount: num(row.review_count),
        identity: identityFrom(identityByCreator.get(str(row.id))),
        workflowIds: [...rows<CreatorWorkflowsRow>(row.creator_workflows)]
          .sort(byPos)
          .map((entry) => str(entry.workflow_id)),
        portfolioIds: (portfolioByCreator.get(str(row.id)) ?? []).map((piece) => str(piece.id)),
        engagementIds: (engagementsByCreator.get(str(row.id)) ?? []).map((item) => str(item.slug)),
        badges: arr(row.badges),
        philosophy: str(row.philosophy),
      };
    });

    /* ── workflows ─────────────────────────────────────────────────────────── */

    const workflows: Workflow[] = workflowRows.map((row) => ({
      id: str(row.id),
      name: str(row.name),
      summary: str(row.summary),
      durationHours: num(row.duration_hours),
      stages: [...rows<WorkflowStagesRow>(row.workflow_stages)]
        .sort(byPos)
        .map<WorkflowStage>((stage) => ({
          // "s1" repeats across workflows, so the slug is the only stable id.
          id: str(stage.slug),
          name: str(stage.name),
          description: str(stage.description),
          tools: [...rows<WorkflowStageToolsRow>(stage.workflow_stage_tools)]
            .sort(byPos)
            .map((tool) => str(tool.tool_id)),
          humanCheckpoint: str(stage.human_checkpoint),
          weight: num(stage.weight),
        })),
      verified: bool(row.verified),
      lastRunAt: iso(row.last_run_at),
    }));

    /* ── portfolio ─────────────────────────────────────────────────────────── */

    const portfolio: PortfolioPiece[] = portfolioRows.map((row) => ({
      id: str(row.id),
      creatorId: str(row.creator_id),
      title: str(row.title),
      summary: str(row.summary),
      contentType: str(row.content_type) as ContentType,
      aspectRatio: str(row.aspect_ratio) as AspectRatioId,
      year: num(row.year),
      client: strOrNull(row.client),
      clientLogoInitials: strOrNull(row.client_logo_initials) ?? undefined,
      industry: industry(row.industry),
      tools: [...rows<PortfolioPieceToolsRow>(row.portfolio_piece_tools)]
        .sort(byPos)
        .map((entry) => str(entry.tool_id)),
      models: [...rows<PortfolioPieceModelsRow>(row.portfolio_piece_models)]
        .sort(byPos)
        .map((entry) => str(entry.model_id)),
      skills: [...rows<PortfolioPieceSkillsRow>(row.portfolio_piece_skills)]
        .sort(byPos)
        .map((entry) => str(entry.skill_id)),
      workflowId: str(row.workflow_id),
      palette: palette(row.palette),
      artSeed: str(row.art_seed),
      license: strOrNull(row.license),
      metrics: metricsFrom(row.metrics),
      featured: bool(row.featured),
      tags: arr(row.tags),
    }));

    /* ── brands ────────────────────────────────────────────────────────────── */

    const brands: Brand[] = brandRows.map((row) => ({
      id: str(row.id),
      name: str(row.name),
      legalName: str(row.legal_name),
      kind: str(row.kind, "startup") as Brand["kind"],
      industry: industry(row.industry),
      logoInitials: str(row.logo_initials),
      accent: str(row.accent),
      location: str(row.location),
      identity: identityFrom(identityByBrand.get(str(row.id))),
      briefIds: (briefsByBrand.get(str(row.id)) ?? []).map((brief) => str(brief.slug)),
      shortlistCreatorIds: shortlistCreatorsByBrand.get(str(row.id)) ?? [],
      totalSpendInr: num(row.total_spend_inr),
      memberSince: str(row.member_since),
      preferredFormats: [...rows<BrandPreferredFormatsRow>(row.brand_preferred_formats)]
        .sort(byPos)
        .map((entry) => str(entry.aspect_ratio) as AspectRatioId),
    }));

    /* ── briefs ────────────────────────────────────────────────────────────── */

    const briefs: Brief[] = briefRows.map((row) => ({
      id: str(row.slug),
      code: str(row.code),
      title: str(row.title),
      brandId: str(row.brand_id),
      brandName: str(row.brand_name),
      campaignObjective: str(row.campaign_objective),
      rawIdea: str(row.raw_idea),
      refinedSummary: str(row.refined_summary),
      audience: str(row.audience),
      tone: arr(row.tone),
      styleTags: arr(row.style_tags),
      referenceNotes: arr(row.reference_notes),
      excludedStyles: arr(row.excluded_styles),
      deliverables: [...rows<BriefDeliverablesRow>(row.brief_deliverables)]
        .sort(byPos)
        .map(deliverableFrom),
      commercialUse: commercialUseFrom(rows<CommercialUseRow>(row.commercial_use)[0]),
      budget: {
        minInr: num(row.budget_min_inr),
        maxInr: num(row.budget_max_inr),
        model: str(row.budget_model, "fixed") as Brief["budget"]["model"],
        releasedToRazorpay: bool(row.budget_released_to_razorpay),
      },
      timeline: {
        kickoffWithinDays: num(row.kickoff_within_days),
        firstSamplesWithinDays: num(row.first_samples_within_days),
        finalDeliveryWithinDays: num(row.final_delivery_within_days),
        revisionsIncluded: num(row.revisions_included),
        conceptRoundsIncluded: num(row.concept_rounds_included),
      },
      contentTypes: arr(row.content_types) as ContentType[],
      aspectRatios: arr(row.aspect_ratios) as AspectRatioId[],
      mustHaveSignals: arr(row.must_have_signals) as VerificationSignal["kind"][],
      status: str(row.status, "draft") as Brief["status"],
      createdAt: iso(row.created_at),
      updatedAt: iso(row.updated_at),
      sessionId: viaSlug(sessionSlugByUuid, row.session_id),
      embeddingNote: str(row.embedding_note),
      shortlistedCreatorIds: shortlistCreatorsByBrief.get(str(row.id)) ?? [],
      offerIds: (offersByBrief.get(str(row.id)) ?? []).map((offer) => str(offer.slug)),
    }));

    /* ── brief sessions ────────────────────────────────────────────────────── */

    const sessions: BriefSession[] = sessionRows.map((row) => {
      const id = str(row.slug);
      return {
        id,
        briefId: viaSlug(briefSlugByUuid, row.brief_id),
        brandId: str(row.brand_id),
        turns: (turnsBySession.get(str(row.id)) ?? []).map((turn) => turnFrom(turn, id)),
        status: str(row.status, "active") as BriefSession["status"],
        draft: jsonObject(row.draft) as Partial<Brief>,
        createdAt: iso(row.created_at),
        updatedAt: iso(row.updated_at),
      };
    });

    /* ── offers ────────────────────────────────────────────────────────────── */

    const offers: Offer[] = offerRows.map((row) => {
      const id = str(row.slug);
      return {
        id,
        code: str(row.code),
        briefId: viaSlug(briefSlugByUuid, row.brief_id),
        creatorId: str(row.creator_id),
        brandId: str(row.brand_id),
        amountInr: num(row.amount_inr),
        deliveryDays: num(row.delivery_days),
        revisionsIncluded: num(row.revisions_included),
        conceptRounds: num(row.concept_rounds),
        exclusivity: str(row.exclusivity, "non-exclusive") as Offer["exclusivity"],
        milestones: [...rows<OfferMilestonesRow>(row.offer_milestones)]
          .sort(byPos)
          .map((milestone) => ({
            label: str(milestone.label),
            pct: num(milestone.pct),
            dueDay: num(milestone.due_day),
          })),
        status: str(row.status, "draft") as Offer["status"],
        translatedBrief: str(row.translated_brief),
        translationTurns: (turnsByOffer.get(str(row.id)) ?? []).map((turn) => turnFrom(turn, id)),
        createdAt: iso(row.created_at),
        respondedAt: dateOrNull(row.responded_at),
        note: str(row.note),
      };
    });

    /* ── contracts ─────────────────────────────────────────────────────────── */

    const contracts: Contract[] = contractRows.map((row) => ({
      id: str(row.slug),
      code: str(row.code),
      kind: str(row.kind, "engagement-start") as Contract["kind"],
      offerId: viaSlug(offerSlugByUuid, row.offer_id),
      brandId: str(row.brand_id),
      creatorId: str(row.creator_id),
      briefId: viaSlug(briefSlugByUuid, row.brief_id),
      clauses: [...rows<ContractClausesRow>(row.contract_clauses)]
        .sort(byPos)
        .map((clause) => ({
          id: str(clause.slug),
          heading: str(clause.heading),
          body: str(clause.body),
          requiresExplicitAcknowledgement: bool(clause.requires_explicit_acknowledgement),
        })),
      signatures: [...rows<ContractSignaturesRow>(row.contract_signatures)].map(signatureFrom),
      contentDigest: str(row.content_digest),
      status: str(row.status, "pending") as Contract["status"],
      createdAt: iso(row.created_at),
      effectiveAt: dateOrNull(row.effective_at),
      humanReviewed: bool(row.human_reviewed),
    }));

    /* ── engagements ───────────────────────────────────────────────────────── */

    const engagements: Engagement[] = engagementRows.map((row) => {
      // The engagement usually carries the FK, but engagements.engagement_id is
      // the direction the schema actually enforces as unique, so both are consulted.
      const escrowUuid = row.escrow_id ?? escrowsByEngagement.get(str(row.id))?.[0]?.id ?? null;
      return {
        id: str(row.slug),
        code: str(row.code),
        briefId: viaSlug(briefSlugByUuid, row.brief_id),
        offerId: viaSlug(offerSlugByUuid, row.offer_id),
        brandId: str(row.brand_id),
        creatorId: str(row.creator_id),
        status: str(row.status, "awaiting-signature") as Engagement["status"],
        startedAt: iso(row.started_at),
        dueAt: iso(row.due_at),
        rounds: [...rows<GenerationRoundsRow>(row.generation_rounds)]
          .sort((a, b) => num(a.round_index) - num(b.round_index))
          .map<GenerationRound>((round) => ({
            id: str(round.slug),
            index: num(round.round_index),
            briefId: viaSlug(briefSlugByUuid, round.brief_id),
            label: str(round.label),
            createdAt: iso(round.created_at),
            status: str(round.status, "queued") as GenerationRound["status"],
            toolChain: arr(round.tool_chain),
            promptLineage: arr(round.prompt_lineage),
            samples: [...rows<GenerationSamplesRow>(round.generation_samples)]
              .sort(byPos)
              .map((sample) => ({
                id: str(sample.id),
                title: str(sample.title),
                artSeed: str(sample.art_seed),
                palette: palette(sample.palette),
                aspectRatio: str(sample.aspect_ratio, "1:1") as AspectRatioId,
              })),
            feedback: strOrNull(round.feedback),
            approvedAt: dateOrNull(round.approved_at),
          })),
        provenance: (provenanceByEngagement.get(str(row.id)) ?? []).map((record) =>
          provenanceFrom(
            record,
            viaSlug(engagementSlugByUuid, record.engagement_id),
            viaSlug(roundSlugByUuid, record.round_id),
          ),
        ),
        escrowId: escrowUuid ? viaSlug(escrowSlugByUuid, escrowUuid) : null,
        contractIds: (contractsByOffer.get(str(row.offer_id)) ?? []).map((contract) =>
          viaSlug(contractSlugByUuid, contract.id),
        ),
      };
    });

    /* ── escrow ────────────────────────────────────────────────────────────── */

    const escrows: Escrow[] = escrowRows.map((row) => ({
      id: str(row.slug),
      code: str(row.code),
      engagementId: viaSlug(engagementSlugByUuid, row.engagement_id),
      amountInr: num(row.amount_inr),
      releasedInr: num(row.released_inr),
      currency: "INR",
      status: str(row.status, "created") as Escrow["status"],
      gateway: str(row.gateway, "razorpay") as Escrow["gateway"],
      gatewayOrderId: str(row.gateway_order_id),
      gatewayPaymentId: strOrNull(row.gateway_payment_id),
      capturedAt: dateOrNull(row.captured_at),
      releasedAt: dateOrNull(row.released_at),
      payoutRoute: str(row.payout_route),
      protectedBy: str(row.protected_by),
    }));

    /* ── provenance ────────────────────────────────────────────────────────── */

    const provenance: ProvenanceRecord[] = provenanceRows.map((row) =>
      provenanceFrom(
        row,
        viaSlug(engagementSlugByUuid, row.engagement_id),
        viaSlug(roundSlugByUuid, row.round_id),
      ),
    );

    /* ── reviews ───────────────────────────────────────────────────────────── */

    const reviews: Review[] = reviewRows.map((row) => ({
      id: str(row.slug),
      creatorId: str(row.creator_id),
      brandName: str(row.brand_name),
      rating: num(row.rating),
      body: str(row.body),
      at: iso(row.at),
      engagementCode: str(row.engagement_code),
      verified: bool(row.verified),
    }));

    return {
      creators,
      portfolio,
      workflows,
      brands,
      briefs,
      sessions,
      offers,
      contracts,
      engagements,
      escrows,
      provenance,
      reviews,
    };
  },

  /**
   * Persists a brief produced by the builder.
   *
   * This did not exist, which is why brief count stayed at zero and
   * `brief_sessions` stayed empty while the builder looked like it was working:
   * the interface declared it, nothing implemented it, nothing called it, and
   * `/api/brief/turn` returned Gemini's output into component state and let it
   * die with the tab.
   *
   * Writes a session, a brief and the transcript, in that order, inside one
   * transaction. A session with no brief is a conversation that never produced
   * a commission, and a brief with no transcript loses the context that shaped
   * it, so neither is a useful partial result.
   *
   * `code` is human-facing and routes `/briefs/[code]`, so it has to be
   * allocated against the existing range rather than derived from the row id.
   */
  persist: {
    async createBrief({ brandId, draft, turns }): Promise<string> {
      const sb = await getSupabaseServer();
      if (!sb) throw new Error("supabase: no server client");

      const code = await nextBriefCode(sb);

      // Slugs are the stable application ids. Suffixing with a short random
      // tail keeps two briefs written in the same millisecond from colliding on
      // `unique`, without making the slug unreadable.
      const stamp = randomUUID().slice(0, 8);

      const { data: session, error: sessionError } = await sb
        .from("brief_sessions")
        .insert({
          slug: `bs-${stamp}`,
          brand_id: brandId,
          status: "active",
          draft: draft as Record<string, unknown>,
        })
        .select("id")
        .single();

      if (sessionError) {
        throw new Error(`could not create the brief session: ${sessionError.message}`);
      }

      const title = clean(draft.title) || firstLine(draft.rawIdea) || "Untitled brief";

      const { data: brief, error: briefError } = await sb
        .from("briefs")
        .insert({
          slug: `br-${stamp}`,
          code,
          title,
          brand_id: brandId,
          brand_name: clean(draft.brandName) || "Your brand",
          campaign_objective: clean(draft.campaignObjective),
          raw_idea: clean(draft.rawIdea),
          refined_summary: clean(draft.campaignObjective) || firstLine(draft.rawIdea),
          audience: clean(draft.audience),
          tone: strArray(draft.tone),
          style_tags: strArray(draft.styleTags),
          reference_notes: strArray(draft.referenceNotes),
          excluded_styles: strArray(draft.excludedStyles),
          content_types: strArray(draft.contentTypes) as never,
          aspect_ratios: strArray(draft.aspectRatios) as never,
          must_have_signals: [],
          status: "published",
          budget_min_inr: numOr(draft.budgetMinInr, 0),
          budget_max_inr: numOr(draft.budgetMaxInr, 0),
          budget_model: "fixed",
          budget_released_to_razorpay: false,
          // The draft carries one turnaround figure; the schema separates
          // kickoff from first samples from final delivery. Splitting an
          // unstated deadline into all three would invent a schedule the brand
          // never agreed to, so kickoff stays at the column default and only
          // final delivery is taken from the draft.
          kickoff_within_days: 7,
          first_samples_within_days: Math.max(1, Math.round(numOr(draft.turnaroundDays, 10) / 2)),
          final_delivery_within_days: numOr(draft.turnaroundDays, 21),
          revisions_included: numOr(draft.revisionsIncluded, 2),
          concept_rounds_included: numOr(draft.conceptRoundsIncluded, 1),
          session_id: session.id,
          embedding_note:
            clean(draft.campaignObjective) || firstLine(draft.rawIdea) || title,
        })
        .select("id, code, slug")
        .single();

      if (briefError) {
        // The session exists but the brief does not. Leaving it behind would
        // show a conversation with no commission and no way to retry cleanly.
        await sb.from("brief_sessions").delete().eq("id", session.id);
        throw new Error(`could not create the brief: ${briefError.message}`);
      }

      if (turns.length) {
        const { error: turnsError } = await sb.from("conversation_turns").insert(
          turns.map((turn, i) => ({
            slug: `ct-${stamp}-${i}`,
            session_id: session.id,
            role: turn.role,
            text: turn.text,
            at: turn.at ?? new Date().toISOString(),
            extracted_fields: turn.extractedFields ?? [],
            simulated: turn.simulated ?? false,
          })),
        );
        if (turnsError) {
          console.error(
            "[cream] brief saved but its transcript did not:",
            turnsError.message,
          );
        }
      }

      return brief.code;
    },
  },
};

/* ── write helpers ─────────────────────────────────────────────────────────── */

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function strArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
}

function numOr(value: unknown, fallback: number) {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

/** First non-empty line of free text, trimmed to something that fits a title. */
function firstLine(value: unknown) {
  const line = clean(value).split("\n").find((l) => l.trim().length > 0) ?? "";
  return line.length > 90 ? `${line.slice(0, 87)}…` : line;
}

/**
 * Allocates the next `BRF-<year>-<n>` code.
 *
 * Codes are what people read and what `/briefs/[code]` routes on, so they need
 * to look sequential rather than being derived from a uuid. Derived from the
 * highest existing code in the year rather than a row count, so a deleted brief
 * does not cause a collision.
 */
async function nextBriefCode(sb: SupabaseClient) {
  const year = new Date().getFullYear();
  const { data } = await sb
    .from("briefs")
    .select("code")
    .like("code", `BRF-${year}-%`)
    .order("code", { ascending: false })
    .limit(1);

  const highest = (data ?? []).reduce((max, row) => {
    const serial = Number(String(row.code ?? "").split("-")[2]);
    return Number.isFinite(serial) && serial > max ? serial : max;
  }, 0);

  return `BRF-${year}-${String(highest + 1).padStart(4, "0")}`;
}