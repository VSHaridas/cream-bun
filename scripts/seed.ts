/**
 * CREAM — database seeder.
 *
 * Loads the bundled dataset into Postgres. Idempotent: every write is an
 * upsert keyed on the domain slug, so running it twice is a no-op rather than
 * a duplicate-key failure.
 *
 *   npm run db:seed              # seed
 *   npm run db:seed -- --truncate # wipe the marketplace tables first
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY. The service
 * role bypasses RLS by design — that is exactly why this script must never be
 * reachable from a request handler.
 */

import { createClient } from "@supabase/supabase-js";
import { seedSnapshot } from "../src/lib/data/seed-provider";
import { TOOLS, MODELS, SKILL_TAXONOMY, SPECIALIZATIONS } from "../src/lib/domain/taxonomy";
import { CONTENT_TYPES, CONTENT_TYPE_META, ASPECT_RATIOS } from "../src/lib/domain/types";
import { CHANNELS, REGIONS } from "../src/lib/domain/taxonomy";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

if (!URL || !KEY) {
  console.error(
    "\n  Cannot seed: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.\n  Put them in .env.local and run again.\n",
  );
  process.exit(1);
}

const db = createClient(URL, KEY, { auth: { persistSession: false } });
const TRUNCATE = process.argv.includes("--truncate");

const TABLES_IN_DEPENDENCY_ORDER = [
  "creator_workflows",
  "portfolio_piece_skills",
  "portfolio_piece_models",
  "portfolio_piece_tools",
  "portfolio_pieces",
  "workflow_stage_tools",
  "workflow_stages",
  "workflows",
  "creator_models",
  "creator_skills",
  "creator_tools",
  "creator_aspect_ratios",
  "creator_content_types",
  "creator_specializations",
  "creator_languages",
  "creator_regions",
  "creator_stats",
  "creators",
  "brand_preferred_formats",
  "identity_verifications",
  "brands",
  "commercial_use",
  "brief_deliverables",
  "briefs",
  "conversation_turns",
  "brief_sessions",
  "offer_milestones",
  "offers",
  "contract_clauses",
  "contract_signatures",
  "contracts",
  "generation_samples",
  "generation_rounds",
  "provenance_records",
  "escrows",
  "engagements",
  "reviews",
  "shortlists",
  "skills",
  "models",
  "tools",
];

async function ok(label: string, fn: () => PromiseLike<{ error: { message: string } | null }>) {
  const started = Date.now();
  const { error } = await fn();
  if (error) {
    console.error(`  x  ${label}: ${error.message}`);
    throw new Error(error.message);
  }
  console.log(`  v  ${label}  (${Date.now() - started}ms)`);
}

async function upsert(table: string, rows: Record<string, unknown>[], conflict: string) {
  if (!rows.length) return;
  return ok(`${table} (${rows.length})`, () =>
    db.from(table).upsert(rows, { onConflict: conflict }),
  );
}

async function truncateAll() {
  console.log("\n  Truncating marketplace tables…");
  // Single statement so the cascades do not fight a table-at-a-time wipe.
  const { error } = await db.rpc("exec_sql", {
    sql: `truncate table ${TABLES_IN_DEPENDENCY_ORDER.map((t) => `public.${t}`).join(", ")} restart identity cascade;`,
  });
  if (error) {
    console.error(`  x  truncate failed: ${error.message}`);
    console.error("     Create the helper first:\n");
    console.error(
      "     create or replace function public.exec_sql(sql text) returns void\n" +
        '     language sql security definer as $$ begin execute sql; end; $$;\n' +
        "     revoke all on function public.exec_sql(text) from public, anon, authenticated;\n",
    );
    process.exit(1);
  }
}

async function main() {
  console.log("\n  CREAM seeder");
  console.log(`  target  ${URL}`);
  console.log(`  mode    ${TRUNCATE ? "truncate + upsert" : "upsert only"}`);

  if (TRUNCATE) await truncateAll();

  const s = seedSnapshot;

  /* ── taxonomy ───────────────────────────────────────────────────────────── */

  await upsert(
    "tools",
    TOOLS.map((t) => ({
      id: t.id,
      name: t.name,
      vendor: t.vendor,
      category: t.category,
      verified: t.verified,
      verified_via: t.verifiedVia ?? null,
      hours_logged: t.hoursLogged,
      accent: t.accent,
    })),
    "id",
  );

  await upsert(
    "models",
    MODELS.map((m) => ({
      id: m.id,
      name: m.name,
      vendor: m.vendor,
      kind: m.kind,
      verified: m.verified,
    })),
    "id",
  );

  await upsert(
    "skills",
    SKILL_TAXONOMY.map((k) => ({ id: k.id, name: k.name, category: k.category })),
    "id",
  );

  await upsert(
    "content_types",
    CONTENT_TYPES.map((id) => ({
      id,
      label: CONTENT_TYPE_META[id].label,
      category: CONTENT_TYPE_META[id].category,
      hint: CONTENT_TYPE_META[id].hint,
    })),
    "id",
  );

  await upsert(
    "aspect_ratios",
    ASPECT_RATIOS.map((a) => ({
      id: a.id,
      label: a.label,
      usage: a.usage,
      width: a.w,
      height: a.h,
    })),
    "id",
  );

  await upsert(
    "specializations",
    SPECIALIZATIONS.map((name) => ({ name })),
    "name",
  );

  await upsert(
    "industries",
    [...new Set(s.portfolio.map((p) => p.industry))].map((name) => ({ name })),
    "name",
  );

  await upsert("channels", [...CHANNELS].map((name) => ({ name })), "name");
  await upsert(
    "regions",
    [...REGIONS].map((r) => ({ id: r.id, label: r.label, countries: r.countries })),
    "id",
  );

  /* ── brands ─────────────────────────────────────────────────────────────── */

  await upsert(
    "brands",
    s.brands.map((b) => ({
      id: b.id,
      name: b.name,
      legal_name: b.legalName,
      kind: b.kind,
      industry: b.industry,
      logo_initials: b.logoInitials,
      accent: b.accent,
      location: b.location,
      member_since: b.memberSince,
      total_spend_inr: b.totalSpendInr,
    })),
    "id",
  );

  await upsert(
    "brand_preferred_formats",
    s.brands.flatMap((b) => b.preferredFormats.map((f) => ({ brand_id: b.id, aspect_ratio: f }))),
    "brand_id,aspect_ratio",
  );

  /* ── creators ───────────────────────────────────────────────────────────── */

  await upsert(
    "creators",
    s.creators.map((c) => ({
      id: c.id,
      handle: c.handle,
      display_name: c.displayName,
      studio_name: c.studioName,
      headline: c.headline,
      bio: c.bio,
      location: c.location,
      timezone: c.timezone,
      avatar_seed: c.avatarSeed,
      accent: c.accent,
      avatar_kind: c.avatarKind,
      availability: c.availability,
      verified_at: c.verifiedAt,
      member_since: c.memberSince,
      philosophy: c.philosophy,
      day_rate_inr: c.dayRateInr,
      minimum_engagement_inr: c.minimumEngagementInr,
      turnaround_days: c.turnaroundDays,
      rating: c.rating,
      review_count: c.reviewCount,
      badges: c.badges,
    })),
    "id",
  );

  await upsert(
    "creator_stats",
    s.creators.map((c) => ({ creator_id: c.id, ...c.stats })),
    "creator_id",
  );

  await upsert(
    "creator_languages",
    s.creators.flatMap((c) =>
      c.languages.map((l, i) => ({ creator_id: c.id, language: l, position: i })),
    ),
    "creator_id,language",
  );

  await upsert(
    "creator_specializations",
    s.creators.flatMap((c) =>
      c.specializations.map((sp, i) => ({
        creator_id: c.id,
        specialization_name: sp,
        position: i,
      })),
    ),
    "creator_id,specialization_name",
  );

  await upsert(
    "creator_content_types",
    s.creators.flatMap((c) =>
      c.contentTypes.map((t, i) => ({ creator_id: c.id, content_type: t, position: i })),
    ),
    "creator_id,content_type",
  );

  await upsert(
    "creator_aspect_ratios",
    s.creators.flatMap((c) =>
      c.aspectRatios.map((a, i) => ({ creator_id: c.id, aspect_ratio: a, position: i })),
    ),
    "creator_id,aspect_ratio",
  );

  await upsert(
    "creator_tools",
    s.creators.flatMap((c) =>
      c.tools.map((toolId) => {
        const t = TOOLS.find((x) => x.id === toolId);
        return {
          creator_id: c.id,
          tool_id: toolId,
          verified: t?.verified ?? false,
          verified_via: t?.verifiedVia ?? null,
          hours_logged: t?.hoursLogged ?? 0,
        };
      }),
    ),
    "creator_id,tool_id",
  );

  await upsert(
    "creator_skills",
    s.creators.flatMap((c) =>
      c.skills.map((skillId) => ({ creator_id: c.id, skill_id: skillId })),
    ),
    "creator_id,skill_id",
  );

  await upsert(
    "creator_models",
    s.creators.flatMap((c) =>
      c.models.map((modelId) => ({ creator_id: c.id, model_id: modelId })),
    ),
    "creator_id,model_id",
  );

  await upsert(
    "creator_workflows",
    s.creators.flatMap((c) =>
      c.workflowIds.map((workflowId) => ({ creator_id: c.id, workflow_id: workflowId })),
    ),
    "creator_id,workflow_id",
  );

  await upsert(
    "identity_verifications",
    s.creators.map((c) => ({
      creator_id: c.id,
      status: c.identity.status,
      method: c.identity.method,
      issuer_ref: c.identity.issuerRef,
      issuer: c.identity.issuer,
      document_type: c.identity.documentType,
      verified_at: c.identity.verifiedAt,
      expires_at: c.identity.expiresAt,
      artefact_retained: false,
      assurance_level: c.identity.assuranceLevel,
      document: {},
    })),
    "creator_id",
  );

  /* ── workflows + portfolio ──────────────────────────────────────────────── */

  await upsert(
    "workflows",
    s.workflows.map((w) => ({
      id: w.id,
      name: w.name,
      summary: w.summary,
      duration_hours: w.durationHours,
      verified: w.verified,
      last_run_at: w.lastRunAt,
    })),
    "id",
  );

  const stages = s.workflows.flatMap((w) =>
    w.stages.map((st, i) => ({
      workflow_id: w.id,
      slug: st.id,
      position: i,
      name: st.name,
      description: st.description,
      human_checkpoint: st.humanCheckpoint,
      weight: st.weight,
    })),
  );
  if (stages.length) {
    await ok(`workflow_stages (${stages.length})`, () =>
      db
        .from("workflow_stages")
        .upsert(stages, { onConflict: "workflow_id,slug" }),
    );
  }

  await upsert(
    "portfolio_pieces",
    s.portfolio.map((p) => ({
      id: p.id,
      creator_id: p.creatorId,
      title: p.title,
      summary: p.summary,
      content_type: p.contentType,
      aspect_ratio: p.aspectRatio,
      year: p.year,
      client: p.client,
      client_logo_initials: p.clientLogoInitials ?? null,
      industry: p.industry,
      workflow_id: p.workflowId,
      palette: p.palette,
      art_seed: p.artSeed,
      license: p.license,
      metrics: p.metrics,
      featured: p.featured,
      tags: p.tags,
    })),
    "id",
  );

  await upsert(
    "portfolio_piece_tools",
    s.portfolio.flatMap((p) => p.tools.map((t) => ({ piece_id: p.id, tool_id: t }))),
    "piece_id,tool_id",
  );

  await upsert(
    "portfolio_piece_models",
    s.portfolio.flatMap((p) => p.models.map((m) => ({ piece_id: p.id, model_id: m }))),
    "piece_id,model_id",
  );

  await upsert(
    "portfolio_piece_skills",
    s.portfolio.flatMap((p) => p.skills.map((k) => ({ piece_id: p.id, skill_id: k }))),
    "piece_id,skill_id",
  );

  /* ── briefs ─────────────────────────────────────────────────────────────── */

  await upsert(
    "brief_sessions",
    s.sessions.map((x) => ({
      slug: x.id,
      brief_id: x.briefId,
      brand_id: x.brandId,
      status: x.status,
      draft: x.draft,
      created_at: x.createdAt,
      updated_at: x.updatedAt,
    })),
    "slug",
  );

  await upsert(
    "conversation_turns",
    s.sessions.flatMap((x) =>
      x.turns.map((t) => ({
        slug: t.id,
        session_id: x.id,
        role: t.role,
        text: t.text,
        at: t.at,
        extracted_fields: t.extractedFields,
        simulated: t.simulated ?? false,
      })),
    ),
    "slug",
  );

  await upsert(
    "briefs",
    s.briefs.map((b) => ({
      slug: b.id,
      code: b.code,
      title: b.title,
      brand_id: b.brandId,
      campaign_objective: b.campaignObjective,
      raw_idea: b.rawIdea,
      refined_summary: b.refinedSummary,
      audience: b.audience,
      tone: b.tone,
      style_tags: b.styleTags,
      reference_notes: b.referenceNotes,
      excluded_styles: b.excludedStyles,
      must_have_signals: b.mustHaveSignals,
      status: b.status,
      session_id: b.sessionId,
      embedding_note: b.embeddingNote,
      created_at: b.createdAt,
      updated_at: b.updatedAt,
    })),
    "slug",
  );

  await upsert(
    "brief_deliverables",
    s.briefs.flatMap((b) =>
      b.deliverables.map((d, i) => ({
        slug: `${b.id}-${d.id}`,
        brief_id: b.id,
        content_type: d.contentType,
        aspect_ratio: d.aspectRatio,
        quantity: d.quantity,
        duration_seconds: d.durationSeconds ?? null,
        notes: d.notes,
        position: i,
      })),
    ),
    "slug",
  );

  await upsert(
    "commercial_use",
    s.briefs.map((b) => ({ brief_id: b.id, ...b.commercialUse })),
    "brief_id",
  );

  /* ── commerce ───────────────────────────────────────────────────────────── */

  await upsert(
    "offers",
    s.offers.map((o) => ({
      slug: o.id,
      code: o.code,
      brief_id: o.briefId,
      creator_id: o.creatorId,
      brand_id: o.brandId,
      amount_inr: o.amountInr,
      delivery_days: o.deliveryDays,
      revisions_included: o.revisionsIncluded,
      concept_rounds: o.conceptRounds,
      exclusivity: o.exclusivity,
      status: o.status,
      translated_brief: o.translatedBrief,
      note: o.note,
      created_at: o.createdAt,
      responded_at: o.respondedAt,
    })),
    "slug",
  );

  await upsert(
    "offer_milestones",
    s.offers.flatMap((o) =>
      o.milestones.map((m, i) => ({
        slug: `${o.id}-${i}`,
        offer_id: o.id,
        label: m.label,
        pct: m.pct,
        due_day: m.dueDay,
        position: i,
      })),
    ),
    "slug",
  );

  await upsert(
    "contracts",
    s.contracts.map((c) => ({
      slug: c.id,
      code: c.code,
      kind: c.kind,
      offer_id: c.offerId,
      brand_id: c.brandId,
      creator_id: c.creatorId,
      brief_id: c.briefId,
      content_digest: c.contentDigest,
      status: c.status,
      human_reviewed: c.humanReviewed,
      created_at: c.createdAt,
      effective_at: c.effectiveAt,
    })),
    "slug",
  );

  await upsert(
    "contract_clauses",
    s.contracts.flatMap((c) =>
      c.clauses.map((cl, i) => ({
        slug: `${c.id}-${cl.id}`,
        contract_id: c.id,
        clause_key: cl.id,
        heading: cl.heading,
        body: cl.body,
        requires_explicit_acknowledgement: cl.requiresExplicitAcknowledgement,
        position: i,
      })),
    ),
    "slug",
  );

  await upsert(
    "contract_signatures",
    s.contracts.flatMap((c) =>
      c.signatures.map((sig, i) => ({
        slug: `${c.id}-${sig.party}`,
        contract_id: c.id,
        party: sig.party,
        party_name: sig.partyName,
        status: sig.status,
        signed_at: sig.signedAt,
        ip_address: sig.ipAddress,
        digest: sig.digest,
        position: i,
      })),
    ),
    "slug",
  );

  await upsert(
    "engagements",
    s.engagements.map((e) => ({
      slug: e.id,
      code: e.code,
      brief_id: e.briefId,
      offer_id: e.offerId,
      brand_id: e.brandId,
      creator_id: e.creatorId,
      status: e.status,
      started_at: e.startedAt,
      due_at: e.dueAt,
      escrow_id: e.escrowId,
      contract_ids: e.contractIds,
    })),
    "slug",
  );

  await upsert(
    "generation_rounds",
    s.engagements.flatMap((e) =>
      e.rounds.map((r) => ({
        slug: r.id,
        engagement_id: e.id,
        brief_id: r.briefId,
        round_index: r.index,
        label: r.label,
        status: r.status,
        tool_chain: r.toolChain,
        prompt_lineage: r.promptLineage,
        feedback: r.feedback,
        approved_at: r.approvedAt,
        created_at: r.createdAt,
      })),
    ),
    "slug",
  );

  await upsert(
    "generation_samples",
    s.engagements.flatMap((e) =>
      e.rounds.flatMap((r) =>
        r.samples.map((sm) => ({
          slug: `${r.id}-${sm.id}`,
          round_id: r.id,
          asset_name: sm.title,
          art_seed: sm.artSeed,
          palette: sm.palette,
          aspect_ratio: sm.aspectRatio,
        })),
      ),
    ),
    "slug",
  );

  await upsert(
    "escrows",
    s.escrows.map((x) => ({
      slug: x.id,
      code: x.code,
      engagement_id: x.engagementId,
      amount_inr: x.amountInr,
      released_inr: x.releasedInr,
      currency: x.currency,
      status: x.status,
      gateway: x.gateway,
      gateway_order_id: x.gatewayOrderId,
      gateway_payment_id: x.gatewayPaymentId,
      captured_at: x.capturedAt,
      released_at: x.releasedAt,
      payout_route: x.payoutRoute,
      protected_by: x.protectedBy,
    })),
    "slug",
  );

  await upsert(
    "provenance_records",
    s.provenance.map((p) => ({
      slug: p.id,
      engagement_id: p.engagementId,
      round_id: p.roundId,
      asset_name: p.assetName,
      c2pa: p.c2pa,
      synthid: p.synthid,
      visible: p.visible,
      chain_of_custody: p.chainOfCustody,
    })),
    "slug",
  );

  await upsert(
    "reviews",
    s.reviews.map((r) => ({
      slug: r.id,
      creator_id: r.creatorId,
      brand_name: r.brandName,
      rating: r.rating,
      body: r.body,
      at: r.at,
      engagement_code: r.engagementCode,
      verified: r.verified,
    })),
    "slug",
  );

  await upsert(
    "shortlists",
    s.brands.flatMap((b) =>
      b.shortlistCreatorIds.map((creatorId) => ({ brand_id: b.id, creator_id: creatorId })),
    ),
    "brand_id,creator_id",
  );

  console.log("\n  Done.\n");
}

main().catch((error) => {
  console.error(`\n  Seed failed: ${error.message}\n`);
  process.exit(1);
});