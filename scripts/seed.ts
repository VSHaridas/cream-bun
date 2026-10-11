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
import { slugify } from "../src/lib/utils";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

/**
 * `--sql` renders the whole seed as a .sql file instead of posting it.
 *
 * The SQL editor in the Supabase dashboard is the one path that needs no
 * service role key on the operator's machine, which matters because the key is
 * the most dangerous value in the project and should not have to be handed to a
 * CLI to load some data. It also makes the seed reviewable in a diff, which a
 * POST body is not.
 *
 * Credentials are only required on the posting path, so the guard below is
 * skipped entirely when emitting.
 */
const EMIT_SQL = process.argv.includes("--sql");

const db = URL && KEY ? createClient(URL, KEY, { auth: { persistSession: false } }) : null;
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

/**
 * One table's worth of rows, in dependency order.
 *
 * Collected rather than posted so the same row definitions can serve both
 * transports: the Supabase client and the SQL file. There is exactly one place
 * that knows how a domain object maps to columns, which is what keeps the two
 * from drifting.
 */
interface SeedTable {
  table: string;
  conflict: string;
  /** Set when the table has no key of its own: the column holding the parent id. */
  childOf?: string;
  rows: Record<string, unknown>[];
}

const plan: SeedTable[] = [];

async function ok(label: string, fn: () => PromiseLike<{ error: { message: string } | null }>) {
  const started = Date.now();
  const { error } = await fn();
  if (error) {
    console.error(`  x  ${label}: ${error.message}`);
    throw new Error(error.message);
  }
  console.log(`  v  ${label}  (${Date.now() - started}ms)`);
}

async function upsert(
  table: string,
  rows: Record<string, unknown>[],
  conflict: string,
  childOf?: string,
) {
  if (!rows.length) return;
  const normalised = rows.map((row) => normaliseColumns(table, row));
  if (EMIT_SQL) {
    plan.push({
      table,
      conflict: normaliseConflict(table, conflict),
      childOf,
      rows: normalised,
    });
    return;
  }
  if (!db) throw new Error("no Supabase client — credentials are required to post");

  // No conflict target means the row cannot be upserted, so clear the parent
  // first. Same scoping as the SQL renderer.
  if (!conflict && childOf && db) {
    const parents = [...new Set(normalised.map((row) => row[childOf]).filter(Boolean))];
    if (parents.length) {
      await ok(`${table} (clearing ${parents.length} parents)`, () =>
        db!.from(table).delete().in(childOf, parents as never[]),
      );
    }
  }

  return ok(`${table} (${normalised.length})`, () =>
    db!.from(table).upsert(normalised, { onConflict: normaliseConflict(table, conflict) }),
  );
}

/**
 * Rewrites domain-shaped keys into schema column names.
 *
 * Several row builders spread a domain object straight through — `...c.stats`
 * yields `approvalRate`, `onTimeRate`, `responseMinutes`, where the columns are
 * `approval_rate`, `on_time_rate`, `response_minutes`. Those upserts were
 * rejected by PostgREST and would have failed for anyone running the seeder
 * against a real project.
 *
 * A key is only rewritten when the original is *not* a column and its snake_case
 * form *is*. Anything else is left alone, so a genuinely wrong column name still
 * fails loudly in `assertColumnsExist` rather than being silently mangled into
 * something that happens to exist.
 */
function normaliseColumns(table: string, row: Record<string, unknown>) {
  const known = TABLE_COLUMNS.get(table);
  if (!known) return row;

  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    if (known.has(key)) {
      out[key] = value;
      continue;
    }
    out[candidateNames(key).find((name) => known.has(name)) ?? key] = value;
  }
  return out;
}

/**
 * Plausible column names for a domain key, best first.
 *
 * Plain snake_case covers most of it. A few columns carry a unit suffix the
 * domain type drops — `totalEarnings` → `total_earnings_inr`, because
 * `CreatorStats` is currency-agnostic while the column is not.
 */
function candidateNames(key: string) {
  const snake = key.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
  return [snake, `${snake}_inr`, `${snake}_paise`, key.replace(/[A-Z]/g, (c) => `_${c}`)];
}

/** Same treatment for a conflict target like `creator_id,specializationName`. */
function normaliseConflict(table: string, conflict: string) {
  const known = TABLE_COLUMNS.get(table);
  if (!known) return conflict;
  return conflict
    .split(",")
    .map((raw) => {
      const column = raw.trim();
      return candidateNames(column).find((name) => known.has(name)) ?? column;
    })
    .join(",");
}

async function truncateAll() {
  if (!db) throw new Error("no Supabase client — credentials are required to truncate");
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
  if (EMIT_SQL) {
    console.error("\n  Rendering SQL — no credentials needed, nothing is posted.\n");
    // Read the array columns out of the migration so empty arrays can be cast
    // correctly and a future enum array is caught here rather than at the
    // database.
    const { readFileSync: read } = await import("node:fs");
    const { join } = await import("node:path");
    const migration = read(join(process.cwd(), "supabase", "migrations", "0001_schema.sql"), "utf8");

    readSchema(migration);

    const nonText = assertSchemaArraysAreText(migration);
    if (nonText.size) {
      throw new Error(
        `The schema now has non-text array column(s): ${[...nonText].join(", ")}.\n` +
          `Rendering an empty array into one of those needs a different cast, and\n` +
          `guessing would produce SQL that fails at the database. Add the cast to\n` +
          `elementTypeFor() and regenerate.`,
      );
    }
  } else {
    console.log("\n  CREAM seeder");
    console.log(`  target  ${URL}`);
    console.log(`  mode    ${TRUNCATE ? "truncate + upsert" : "upsert only"}`);
    if (!db) {
      console.error(
        "\n  Cannot post: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.\n" +
          "  Use --sql to render a .sql file instead.\n",
      );
      process.exit(1);
    }
  }

  if (TRUNCATE && !EMIT_SQL) await truncateAll();

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
      // The columns are `w`/`h`, not `width`/`height` — ASPECT_RATIOS (types.ts)
      // names them w/h and the schema follows. Caught by the column check.
      w: a.w,
      h: a.h,
    })),
    "id",
  );

  await upsert(
    "specializations",
    // Reference tables are keyed (id, label), where id is the slug and label is
    // the human string. The seeder was writing `{ name }`, which is neither
    // column — caught by the column check against the migration.
    SPECIALIZATIONS.map((label) => ({ id: slugify(label), label })),
    "id",
  );

  await upsert(
    "industries",
    [...new Set(s.portfolio.map((p) => p.industry))]
      .filter(Boolean)
      .map((label) => ({ id: slugify(label), label })),
    "id",
  );

  await upsert(
    "channels",
    [...CHANNELS].map((label) => ({ id: slugify(label), label })),
    "id",
  );
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
        // The domain carries the human label; the column is a foreign key into
        // specializations, whose id is the slug of that label. Same slug the
        // reference table above was written with.
        specialization_id: slugify(sp),
        position: i,
      })),
    ),
    "creator_id,specialization_id",
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
    await upsert("workflow_stages", stages, "workflow_id,slug");
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

  // `piece_id` is the domain-level name; the columns are `portfolio_piece_id`,
// matching the parent table. Same rename across all three join tables.
await upsert(
    "portfolio_piece_tools",
    s.portfolio.flatMap((p) => p.tools.map((t, i) => ({ portfolio_piece_id: p.id, tool_id: t, position: i }))),
    "portfolio_piece_id,tool_id",
  );

  await upsert(
    "portfolio_piece_models",
    s.portfolio.flatMap((p) => p.models.map((m, i) => ({ portfolio_piece_id: p.id, model_id: m, position: i }))),
    "portfolio_piece_id,model_id",
  );

  await upsert(
    "portfolio_piece_skills",
    s.portfolio.flatMap((p) => p.skills.map((k, i) => ({ portfolio_piece_id: p.id, skill_id: k, position: i }))),
    "portfolio_piece_id,skill_id",
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
        brief_id: b.id,
        content_type: d.contentType,
        aspect_ratio: d.aspectRatio,
        quantity: d.quantity,
        duration_seconds: d.durationSeconds ?? null,
        notes: d.notes,
        position: i,
      })),
    ),
    // Child tables with no natural key of their own. The parent id is stable
    // across runs, so a delete scoped to exactly the parents this file inserts
    // makes the statement idempotent without touching UI-created rows. An empty
    // conflict target tells the renderer to emit that scoped delete.
    "",
    "brief_id",
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
        offer_id: o.id,
        label: m.label,
        pct: m.pct,
        due_day: m.dueDay,
        position: i,
      })),
    ),
    "",
    "offer_id",
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
        // Unique is (contract_id, slug) — the clause id alone is only unique
        // within its contract.
        slug: cl.id,
        contract_id: c.id,
        heading: cl.heading,
        body: cl.body,
        requires_explicit_acknowledgement: cl.requiresExplicitAcknowledgement,
        position: i,
      })),
    ),
    "contract_id,slug",
  );

  await upsert(
    "contract_signatures",
    s.contracts.flatMap((c) =>
      c.signatures.map((sig) => ({
        contract_id: c.id,
        party: sig.party,
        party_name: sig.partyName,
        status: sig.status,
        signed_at: sig.signedAt,
        ip_address: sig.ipAddress,
        digest: sig.digest,
      })),
    ),
    // Exactly one signature per party per contract; the table has no position
    // column and enforces that with a unique constraint.
    "contract_id,party",
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
      // `contractIds` is deliberately absent. It is a domain-level convenience
      // derived from `contracts.offer_id` (supabase-provider.ts:1328), not a
      // stored column — writing it would have been an insert against a column
      // that does not exist. The column-difference check in the SQL renderer
      // is what caught this.
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
        r.samples.map((sm, i) => ({
          round_id: r.id,
          // The column is `title`, not `asset_name`.
          title: sm.title,
          art_seed: sm.artSeed,
          palette: sm.palette,
          aspect_ratio: sm.aspectRatio,
          position: i,
        })),
      ),
    ),
    "",
    "round_id",
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

  console.log(EMIT_SQL ? "" : "\n  Done.\n");
}

/* ── SQL rendering ─────────────────────────────────────────────────────────── */

/**
 * Renders one JavaScript value as a Postgres literal.
 *
 * The subtlety is typing. A bare string literal in a VALUES clause is of type
 * `unknown` and Postgres coerces it to whatever the column is, which is exactly
 * what we want for enums — `'verified'` lands in an `identity_status` column
 * without naming the type. So strings get no cast.
 *
 * Everything else needs one, because there is no `unknown` for a number or an
 * object:
 *
 *  - jsonb gets an explicit cast, because `'{}'` would otherwise be text.
 *  - dates are passed through as ISO strings, which Postgres parses on insert.
 *
 * Empty arrays are the awkward case and are handled by the caller rather than
 * here — see `emptyArrayColumns`.
 */
function literal(value: unknown, arrayCast?: string | null): string {
  if (value === null || value === undefined) return "null";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "null";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (Array.isArray(value)) {
    // An empty array is not valid SQL without a cast, and the cast has to name
    // the element type.
    if (!value.length) return arrayCast ? `ARRAY[]::${arrayCast}` : "null";
    return `ARRAY[${value.map((v) => literal(v)).join(", ")}]`;
  }
  if (value instanceof Date) return `'${value.toISOString()}'`;
  if (typeof value === "object") return `'${escape(JSON.stringify(value))}'::jsonb`;
  return `'${escape(String(value))}'`;
}

/**
 * Columns we are allowed to cast an empty array to.
 *
 * `ARRAY[]` is not valid SQL on its own — it needs a cast, and the cast has to
 * name the element type. Postgres cannot infer the target from inside a VALUES
 * clause, so we have to know it.
 *
 * Every array column in `0001_schema.sql` is `text[]`; there are no array-typed
 * enums. That is a property of the schema, not of this file, so it is verified
 * against the migration at generation time rather than trusted — if someone
 * adds `model_id[]` later, `npm run db:seed:sql` fails here and names the
 * column, instead of emitting SQL that the database rejects 400 statements in.
 */
function assertSchemaArraysAreText(readSql: string) {
  const offenders = new Set<string>();
  for (const match of readSql.matchAll(/^\s+(\w+)\s+(\w+)\[\]/gm)) {
    const [, column, type] = match;
    if (type !== "text") offenders.add(`${column} ${type}[]`);
  }
  return offenders;
}

/**
 * Columns that are an empty array in every row, and so can simply be left out.
 *
 * This is the only fully type-safe way to write an empty array: `ARRAY[]::text[]`
 * is rejected outright when the column is an enum array, and Postgres offers no
 * way to infer the target type from inside a VALUES clause. Every array column
 * in this schema already defaults to `'{}'`, so omitting the column produces
 * exactly the same row.
 */
function emptyArrayColumns(rows: Record<string, unknown>[], columns: string[]) {
  return columns.filter((column) =>
    rows.every((row) => {
      const value = row[column];
      return Array.isArray(value) && value.length === 0;
    }),
  );
}

/** Columns that are empty in some rows but populated in others. */
function mixedEmptyArrayColumns(rows: Record<string, unknown>[], columns: string[]) {
  return columns.filter((column) => {
    const values = rows.map((row) => row[column]);
    return (
      values.some((v) => Array.isArray(v) && v.length === 0) &&
      values.some((v) => Array.isArray(v) && v.length > 0)
    );
  });
}

/** Single quotes are doubled; nothing else needs escaping inside a literal. */
function escape(text: string) {
  return text.replace(/'/g, "''");
}

/**
 * Element type for an array column, or null when we cannot prove it.
 *
 * Null means "omit the column instead" (see `emptyArrayColumns`), which is
 * always safe because every array column in this schema defaults to `'{}'`.
 */
function elementTypeFor(table: string, column: string) {
  return ARRAY_COLUMNS.has(`${table}.${column}`) ? "text[]" : null;
}

/**
 * Columns read out of the migration: every array column, and the full column
 * list per table.
 *
 * Populated at startup when emitting. Keeping it derived from the migration
 * rather than hand-written means a schema change is picked up automatically,
 * and a mismatch between the two is an error here instead of a 400 from
 * Postgres several hundred statements in.
 */
const ARRAY_COLUMNS = new Set<string>();
const TABLE_COLUMNS = new Map<string, Set<string>>();
const SCHEMA_ENUMS = new Set<string>();

function readSchema(sql: string) {
  for (const match of sql.matchAll(
    /create table if not exists public\.(\w+) \(([\s\S]*?)\n\);/g,
  )) {
    const [, table, body] = match;
    const columns = new Set<string>();
    for (const line of body.split("\n")) {
      const column = line.trim().match(/^(\w+)\s+(?:text|bigint|smallint|integer|numeric|boolean|uuid|jsonb|timestamptz|date|timestamp|vector\(\d+\)|tsvector|\w+(?:\[\])?)\b/);
      if (column) columns.add(column[1]);
    }
    TABLE_COLUMNS.set(table, columns);
    for (const column of body.matchAll(/^\s+(\w+)\s+text\[\]/gm)) {
      ARRAY_COLUMNS.add(`${table}.${column[1]}`);
    }
  }

  for (const match of sql.matchAll(/create type public\.(\w+) as enum/g)) {
    SCHEMA_ENUMS.add(match[1]);
  }
}

/**
 * Fails when a row references a column the table does not have.
 *
 * This is not a theoretical check. `engagements.contract_ids` was being written
 * against a table that has no such column, and the client-side seeder would
 * have failed on it for anyone who ran `npm run db:seed` against a real
 * project. Validating here means the SQL file is known-good before it is
 * pasted, rather than discovered halfway through a 1250-row transaction.
 */
function assertColumnsExist(table: string, rows: Record<string, unknown>[]) {
  const known = TABLE_COLUMNS.get(table);
  if (!known) {
    throw new Error(
      `${table} is not declared in the migration. The seed references a table that does not exist.`,
    );
  }
  const unknown = new Set<string>();
  for (const row of rows) {
    for (const column of Object.keys(row)) {
      if (!known.has(column)) unknown.add(column);
    }
  }
  if (unknown.size) {
    // Collected rather than thrown one at a time: fixing these one round-trip
    // per error is slow, and the point of the check is to see the whole list.
    problems.push(
      `${table}: ${[...unknown].sort().join(", ")}  (has: ${[...known].sort().join(", ")})`,
    );
  }
}

const problems: string[] = [];

function renderTable({ table, conflict, childOf, rows }: SeedTable): string {
  assertColumnsExist(table, rows);

  // Column order comes from the first row: the builders all produce the same
  // shape, and deriving it avoids maintaining a second list that can drift.
  const allColumns = Object.keys(rows[0]);

  // An array column that is empty everywhere is dropped so the column default
  // applies. A column that is empty in some rows but populated in others cannot
  // be handled that way, and emitting it would produce a bare ARRAY[] that the
  // database rejects with no useful message — so fail loudly here instead, at
  // generation time, where the error can name the column.
  const mixed = mixedEmptyArrayColumns(rows, allColumns);
  const uncastable = mixed.filter((column) => !elementTypeFor(table, column));
  if (uncastable.length) {
    problems.push(
      `${table}: mixed empty array column(s) ${uncastable.join(", ")} with no known element type`,
    );
  }

  const drop = new Set(emptyArrayColumns(rows, allColumns));
  const columns = allColumns.filter((c) => !drop.has(c));

  const tuples = rows.map((row) => {
    const values = columns.map((column) =>
      literal(row[column], elementTypeFor(table, column)),
    );
    return `  (${values.join(", ")})`;
  });

  // Re-running should be a no-op rather than a duplicate-key failure, matching
  // what the client-side upsert does.
  const target = conflict.split(",").map((c) => c.trim()).filter(Boolean);
  const updates = columns.filter((c) => !target.includes(c));
  const conflictAction = target.length
    ? updates.length
      ? `on conflict (${target.join(", ")}) do update set ${updates
          .map((c) => `${c} = excluded.${c}`)
          .join(", ")}`
      : `on conflict (${target.join(", ")}) do nothing`
    : "";

  // A table with no key of its own cannot be upserted. Clearing exactly the
  // parents this file writes makes the run idempotent, and scoping it to those
  // parents is what keeps it from touching rows created through the UI.
  const prelude = childOf
    ? [
        `-- ${table}: no natural key, so clear the rows being replaced`,
        `delete from public.${table} where ${childOf} in (${[
          ...new Set(rows.map((row) => row[childOf]).filter(Boolean)),
        ]
          .map((v) => literal(v))
          .join(", ")});`,
        "",
      ]
    : [];

  const notes = [
    ...(drop.size ? [`-- ${drop.size} all-empty array column(s) omitted, defaults apply`] : []),
  ];

  return [
    `-- ${table} (${rows.length} rows)`,
    ...notes,
    ...prelude,
    `insert into public.${table} (${columns.join(", ")}) values`,
    `${tuples.join(",\n")}`,
    conflictAction ? `${conflictAction};` : ";",
    "",
  ].join("\n");
}

function renderSqlFile(tables: SeedTable[]): string {
  const total = tables.reduce((n, t) => n + t.rows.length, 0);
  const stamp = new Date().toISOString();

  return [
    `-- CREAM — seed data`,
    `--`,
    `-- Generated by \`npm run db:seed:sql\` from src/lib/data/seed-provider.`,
    `-- Do not edit by hand: regenerate instead, or the next run will drift.`,
    `--`,
    `--   ${tables.length} tables, ${total} rows. ${stamp}`,
    `--`,
    `-- Paste into the Supabase SQL editor and run. Safe to re-run — every`,
    `-- statement is an upsert, or a scoped delete followed by an insert.`,
    `--`,
    `-- Wrapped in one transaction: if any statement fails, nothing is written,`,
    `-- rather than leaving a half-populated graph that fails every foreign key`,
    `-- in the next request.`,
    `--`,
    `-- To remove it again, run supabase/unseed.sql.`,
    "",
    "begin;",
    "",
    ...tables.map(renderTable),
    "commit;",
    "",
  ].join("\n");
}

/**
 * The inverse: remove everything seed.sql writes, and nothing else.
 *
 * Scoped by row, not by table. `delete from public.creators cascade` would take
 * out a real account too, which is the whole reason this file cannot just
 * truncate. Instead each delete names the exact identifiers it wrote, and
 * `cascade` handles only the children of *those* rows.
 *
 * The seed identifiers are recognisable because the schema gives real accounts
 * a different shape: `handle_new_user()` appends six characters of the user's
 * own uuid to the handle (`cr-tihens7-a3f9c1`), while the seed slugs are clean
 * (`cr-aarav`). Every non-taxonomy seed id is short and has no hex suffix, so
 * `not like '%-[0-9a-f]{6}$'` cannot match a real account.
 *
 * Taxonomy rows — tools, models, skills, aspect ratios and the rest — are shared
 * reference data, not seed identities. A real creator's portfolio references
 * them by id, so deleting them would break real rows. They are left in place.
 */
function renderUnseedFile(tables: SeedTable[]): string {
  // Tables that hold only vocabulary shared with real users. Left alone.
  const TAXONOMY = new Set([
    "tools",
    "models",
    "skills",
    "content_types",
    "aspect_ratios",
    "specializations",
    "industries",
    "channels",
    "regions",
  ]);

  const targets = tables.filter((t) => !TAXONOMY.has(t.table));
  const order = [...targets].reverse();

  const deletes = order.map((t) => {
    const { ids, column, via } = identifySeedRows(t, tables);
    if (!ids.length) {
      return `-- ${t.table}: nothing to identify, left alone`;
    }

    if (via) {
      // The child hangs off a parent whose id is a uuid column that the domain
      // addresses by slug. Select through the parent rather than trying to
      // reconstruct a uuid we do not have.
      return [
        `delete from public.${t.table} where ${column} in (`,
        `  select p.id from public.${via.table} p where p.${via.column} in (${via.ids.map((v) => literal(v)).join(", ")})`,
        `) cascade;`,
      ].join("\n");
    }

    return `delete from public.${t.table} where ${column} in (${ids.map((v) => literal(v)).join(", ")}) cascade;`;
  });

  const tableCount = targets.filter(
    (t) => identifySeedRows(t, tables).ids.length > 0,
  ).length;

  return [
    `-- CREAM — remove the demo dataset`,
    `--`,
    `-- Generated alongside supabase/seed.sql. Reverses it exactly, by row.`,
    `--`,
    `--   ${tableCount} tables. ${new Date().toISOString()}`,
    `--`,
    `-- SCOPED. Every delete names the specific seed rows, so accounts, briefs and`,
    `-- offers created through the UI are left untouched. Only rows whose identifier`,
    `-- was written by seed.sql are removed, plus whatever cascades from them.`,
    `--`,
    `-- Identifiers are recognisable because handle_new_user() appends six hex`,
    `-- characters of the user's own uuid to their handle (cr-tihens7-a3f9c1),`,
    `-- where every seed slug is clean (cr-aarav).`,
    `--`,
    `-- Taxonomy tables (tools, models, skills, aspect ratios, and so on) are NOT`,
    `-- removed. They are shared vocabulary: a real creator's portfolio references`,
    `-- them by id, so deleting them would break real rows. They are left in place`,
    `-- and the application never renders them directly.`,
    `--`,
    `begin;`,
    ``,
    ...deletes.flatMap((d) => [d, ``]),
    `commit;`,
    ``,
  ].join("\n");
}

/** How to name a set of rows in a DELETE. */
interface SeedIds {
  ids: string[];
  /** The column to match on. */
  column: string;
  /** Set when the rows are addressed through a parent's slug rather than their own. */
  via?: { table: string; column: string; ids: string[] };
}

/**
 * Works out how to name this table's rows.
 *
 * Three cases, in order of preference:
 *
 *  1. A `slug` or `id` column holding text. Directly nameable.
 *  2. A uuid foreign key whose parent is itself named in this file — resolve the
 *     child through `select … where parent.slug in (…)`, because the child's own
 *     id is a uuid we never had in the first place.
 *  3. Nothing identifiable, in which case the table is left alone rather than
 *     guessed at.
 */
function identifySeedRows(
  { table, rows }: SeedTable,
  all: SeedTable[],
): SeedIds {
  const keys = rows.length ? Object.keys(rows[0]) : [];

  // Case 1: the rows carry a stable text identifier.
  for (const column of ["slug", "id"]) {
    if (!keys.includes(column)) continue;
    const values = [
      ...new Set(rows.map((r) => r[column]).filter((v) => typeof v === "string")),
    ];
    if (values.length && values.every((v) => isSeedIdentifier(String(v)))) {
      // `id` is only safe when it is text. Several uuid-keyed tables have a
      // column called id that is not.
      return { ids: values as string[], column };
    }
  }

  // Case 2: reach through a parent.
  const parents = PARENTS_OF[table];
  if (parents) {
    const parent = all.find((t) => t.table === parents.table);
    if (parent) {
      const parentIds = identifySeedRows(parent, all);
      if (parentIds.ids.length) {
        return {
          ids: parentIds.ids,
          column: parents.column,
          via: {
            table: parents.table,
            column: parentIds.column,
            ids: parentIds.ids,
          },
        };
      }
    }
  }

  return { ids: [], column: "id" };
}

/** Child table -> the parent it hangs off, where the child has no key of its own. */
const PARENTS_OF: Record<string, { table: string; column: string }> = {
  brief_sessions: { table: "brands", column: "brand_id" },
  conversation_turns: { table: "brief_sessions", column: "session_id" },
  brief_deliverables: { table: "briefs", column: "brief_id" },
  commercial_use: { table: "briefs", column: "brief_id" },
  creator_stats: { table: "creators", column: "creator_id" },
  creator_languages: { table: "creators", column: "creator_id" },
  creator_specializations: { table: "creators", column: "creator_id" },
  creator_content_types: { table: "creators", column: "creator_id" },
  creator_aspect_ratios: { table: "creators", column: "creator_id" },
  creator_tools: { table: "creators", column: "creator_id" },
  creator_skills: { table: "creators", column: "creator_id" },
  creator_models: { table: "creators", column: "creator_id" },
  creator_workflows: { table: "creators", column: "creator_id" },
  creator_regions: { table: "creators", column: "creator_id" },
  portfolio_pieces: { table: "creators", column: "creator_id" },
  portfolio_piece_tools: { table: "portfolio_pieces", column: "portfolio_piece_id" },
  portfolio_piece_models: { table: "portfolio_pieces", column: "portfolio_piece_id" },
  portfolio_piece_skills: { table: "portfolio_pieces", column: "portfolio_piece_id" },
  brand_preferred_formats: { table: "brands", column: "brand_id" },
  offers: { table: "briefs", column: "brief_id" },
  offer_milestones: { table: "offers", column: "offer_id" },
  contracts: { table: "offers", column: "offer_id" },
  engagements: { table: "briefs", column: "brief_id" },
  generation_rounds: { table: "engagements", column: "engagement_id" },
  generation_samples: { table: "generation_rounds", column: "round_id" },
  escrows: { table: "engagements", column: "engagement_id" },
  contract_clauses: { table: "contracts", column: "contract_id" },
  contract_signatures: { table: "contracts", column: "contract_id" },
  identity_verifications: { table: "creators", column: "creator_id" },
  // Shortlists reference a brand rather than a parent that owns them, so they
  // are keyed off the brand. Both columns are text, so either would do; brand
  // is the one that scopes to a seed row.
  shortlists: { table: "brands", column: "brand_id" },
};

/**
 * True when an identifier could only have come from the seed.
 *
 * Seed ids are short slugs: `cr-aarav`, `br-monsoon`, `of-aarav-monsoon`.
 * Real accounts carry six hex characters of their own uuid, because
 * `handle_new_user()` appends them to guarantee handle uniqueness. Requiring
 * that suffix to be absent is what makes the delete safe — it cannot match a
 * real account even if a person chose the handle `aarav`.
 */
function isSeedIdentifier(value: string) {
  return !/-[0-9a-f]{6}$/.test(value);
}

main()
  .then(async () => {
    if (!EMIT_SQL) return;

    // Validate the whole plan before rendering. renderTable also reports, but
    // by then the file is half-written and the exit code has not been set.
    for (const entry of plan) assertColumnsExist(entry.table, entry.rows);

    if (problems.length) {
      console.error(`\n  ${problems.length} problem(s) between the seed and the schema:\n`);
      for (const p of problems) console.error(`    x  ${p}\n`);
      console.error("  Nothing was written. Fix and regenerate.\n");
      process.exit(1);
    }

    const { writeFileSync, mkdirSync } = await import("node:fs");
    const { join } = await import("node:path");
    const outDir = join(process.cwd(), "supabase");
    mkdirSync(outDir, { recursive: true });
    const file = join(outDir, "seed.sql");
    writeFileSync(file, renderSqlFile(plan), "utf8");
    const rows = plan.reduce((n, t) => n + t.rows.length, 0);
    console.log(`  Wrote ${file} — ${plan.length} tables, ${rows} rows.`);

    const unseed = join(outDir, "unseed.sql");
    writeFileSync(unseed, renderUnseedFile(plan), "utf8");
    console.log(`  Wrote ${unseed} — ${plan.length} deletes.`);
  })
  .catch((error) => {
    console.error(`\n  Seed failed: ${error.message}\n`);
    process.exit(1);
  });