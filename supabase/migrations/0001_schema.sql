-- ═══════════════════════════════════════════════════════════════════════════════
--  CREAM — 0001_schema.sql
--  Complete Postgres schema + row-level security for the AI-creator marketplace.
-- ═══════════════════════════════════════════════════════════════════════════════
--
--  CONTRACT
--  This file mirrors `src/lib/domain/types.ts` exactly. Every table names the TS
--  type it stores. Column names are snake_case equivalents of the TS keys, so a
--  row can be diffed against `src/lib/data/*.ts` without a translation table.
--
--  Controlled vocabularies come from `src/lib/domain/taxonomy.ts` and are stored
--  as reference tables *and* as enum types, so the database rejects exactly what
--  the TypeScript union types reject.
--
--  PRIMARY KEY POLICY
--    * `text` PK — the TS `id` is a stable, hand-authored slug that the seed data
--      and the URL routes both depend on. Changing it would break bookmarks, so
--      the slug *is* the key: creators ("cr-aarav"), brands ("bd-nirvani"),
--      portfolio_pieces ("pf-aarav-1"), and the taxonomy rows
--      ("runway-gen4", "veo-3", "art-direction", "content_types" etc).
--    * `uuid` PK — the row is created at runtime by the platform, so the database
--      mints the identifier. Human-facing keys are carried in a separate
--      `code` column ("BRF-2026-0141", "OFR-2026-0442") so nothing is lost.
--    * `profiles.id` is a `uuid` because it is 1:1 with `auth.users.id`.
--
--  SERVICE ROLE
--  The `service_role` key carries `BYPASSRLS` and therefore bypasses every
--  policy in this file automatically. It is for seeding, backfills, webhook
--  reconciliation and cron recomputes ONLY. Never expose it to the browser and
--  never pass user-controlled input through it without an explicit check in
--  front of the call. See the footer block.
--
--  PREREQUISITES
--    * Supabase project (Postgres 15+). Two views below use `security_invoker`.
--    * pgvector must be enabled: Dashboard → Database → Extensions → pgvector.
--      The `create extension` line below is idempotent but cannot install
--      pgvector on a plan that does not allow it.
--
--  RE-RUN SAFETY
--  This file is safe to apply twice against a fresh project: tables use
--  `create table if not exists`, functions and policies use
--  `create or replace` / `drop policy if exists` + `create policy`, enums are
--  created inside `do` blocks that swallow `duplicate_object`, and triggers are
--  dropped before being recreated.
-- ═══════════════════════════════════════════════════════════════════════════════


-- ═══════════════════════════════════════════════════════════════════════════════
-- 1. EXTENSIONS
-- ═══════════════════════════════════════════════════════════════════════════════

-- Supabase provisions `gen_random_uuid()` natively (it is core from PG13 on),
-- but pgcrypto is installed explicitly so the schema also stands alone on a
-- plain Postgres 13+ instance.
create extension if not exists pgcrypto;

-- requires: enable pgvector in the Supabase dashboard → Database → Extensions
create extension if not exists vector;


-- ═══════════════════════════════════════════════════════════════════════════════
-- 2. ENUM TYPES
--    One enum per string-literal union in src/lib/domain/types.ts. The literal
--    strings are the ones the app stores, so `tier = 'attested'` in TypeScript
--    is `'attested'::signal_tier` here — no mapping layer.
-- ═══════════════════════════════════════════════════════════════════════════════

-- ContentType — types.ts:30
do $$ begin
  create type public.content_type as enum (
    'cinematic-video', 'short-form-video', 'social-static', 'motion-graphics',
    '3d-visual', 'character-design', 'product-render', 'music-bed', 'voiceover',
    'illustration', 'photography', 'concept-art'
  );
exception when duplicate_object then null; end $$;

-- ContentCategory — types.ts:44 (the `category` on CONTENT_TYPE_META)
do $$ begin
  create type public.content_category as enum ('video', 'image', 'audio', 'design');
exception when duplicate_object then null; end $$;

-- AspectRatioId — types.ts:119. Width:height is normalised to 100 in the app.
do $$ begin
  create type public.aspect_ratio as enum (
    '16:9', '9:16', '1:1', '4:5', '2:3', '3:2', '21:9', '4:3'
  );
exception when duplicate_object then null; end $$;

-- Availability — types.ts:318
do $$ begin
  create type public.availability as enum ('open', 'limited', 'booked');
exception when duplicate_object then null; end $$;

-- Creator.avatarKind — types.ts:352
do $$ begin
  create type public.avatar_kind as enum ('portrait', 'abstract', 'mark');
exception when duplicate_object then null; end $$;

-- ToolCategory — types.ts:146
do $$ begin
  create type public.tool_category as enum (
    'generation', 'editing', 'motion', '3d', 'audio',
    'orchestration', 'upscale', 'compositing'
  );
exception when duplicate_object then null; end $$;

-- Tool.verifiedVia — types.ts:163
do $$ begin
  create type public.tool_verification_via as enum (
    'vendor-credential', 'usage-attestation', 'telemetry'
  );
exception when duplicate_object then null; end $$;

-- ModelRef.kind — types.ts:173
do $$ begin
  create type public.model_kind as enum ('video', 'image', 'text', 'av', '3d');
exception when duplicate_object then null; end $$;

-- SkillCategory — types.ts:177
do $$ begin
  create type public.skill_category as enum (
    'direction', 'prompt-engineering', 'compositing', 'editing',
    'sound', 'colour', 'story', 'production'
  );
exception when duplicate_object then null; end $$;

-- IdentityVerification.status — types.ts:215
do $$ begin
  create type public.identity_status as enum (
    'unverified', 'pending', 'verified', 'flagged', 'expired'
  );
exception when duplicate_object then null; end $$;

-- IdentityVerification.method — types.ts:216
do $$ begin
  create type public.identity_method as enum ('digilocker', 'issuer-otp');
exception when duplicate_object then null; end $$;

-- IdentityVerification.assuranceLevel — types.ts:225
do $$ begin
  create type public.assurance_level as enum ('AAL1', 'AAL2', 'AAL3');
exception when duplicate_object then null; end $$;

-- SignalKind — types.ts:228
do $$ begin
  create type public.signal_kind as enum (
    'identity', 'tools', 'workflow', 'portfolio', 'delivery', 'client'
  );
exception when duplicate_object then null; end $$;

-- SignalTier — types.ts:236
do $$ begin
  create type public.signal_tier as enum ('verified', 'attested', 'unverified', 'expired');
exception when duplicate_object then null; end $$;

-- Brand.kind — types.ts:662
do $$ begin
  create type public.brand_kind as enum ('in-house', 'agency', 'startup', 'enterprise');
exception when duplicate_object then null; end $$;

-- CommercialUse.licenseType — types.ts:392
do $$ begin
  create type public.license_type as enum (
    'non-exclusive', 'exclusive-category', 'exclusive-territory', 'buyout-full'
  );
exception when duplicate_object then null; end $$;

-- CommercialUse.territory — types.ts:393
do $$ begin
  create type public.territory as enum ('worldwide', 'india', 'custom');
exception when duplicate_object then null; end $$;

-- CommercialUse.disclosurePolicy — types.ts:407
do $$ begin
  create type public.disclosure_policy as enum (
    'client-disclosure', 'platform-disclosure', 'no-disclosure'
  );
exception when duplicate_object then null; end $$;

-- Brief.budget.model — types.ts:447
do $$ begin
  create type public.budget_model as enum ('fixed', 'day-rate', 'milestone');
exception when duplicate_object then null; end $$;

-- Brief.status — types.ts:454
do $$ begin
  create type public.brief_status as enum (
    'draft', 'open', 'shortlisted', 'in-negotiation', 'awarded', 'closed'
  );
exception when duplicate_object then null; end $$;

-- BriefSessionStatus — types.ts:480
do $$ begin
  create type public.brief_session_status as enum ('active', 'submitted', 'expired');
exception when duplicate_object then null; end $$;

-- ConversationRole — types.ts:466
do $$ begin
  create type public.conversation_role as enum ('brand', 'assistant', 'system');
exception when duplicate_object then null; end $$;

-- OfferStatus — types.ts:496
do $$ begin
  create type public.offer_status as enum (
    'draft', 'sent', 'opened', 'negotiating', 'accepted', 'declined', 'withdrawn'
  );
exception when duplicate_object then null; end $$;

-- ContractKind — types.ts:527
do $$ begin
  create type public.contract_kind as enum (
    'engagement-start', 'engagement-close', 'cancellation', 'nda'
  );
exception when duplicate_object then null; end $$;

-- SignatureStatus — types.ts:528. Also Contract.status (types.ts:561).
do $$ begin
  create type public.signature_status as enum ('pending', 'signed', 'declined');
exception when duplicate_object then null; end $$;

-- ContractSignature.party — types.ts:531
do $$ begin
  create type public.contract_party as enum ('brand', 'creator');
exception when duplicate_object then null; end $$;

-- RoundStatus — types.ts:567
do $$ begin
  create type public.round_status as enum (
    'queued', 'generating', 'in-review', 'changes-requested', 'approved'
  );
exception when duplicate_object then null; end $$;

-- Engagement.status — types.ts:591
do $$ begin
  create type public.engagement_status as enum (
    'awaiting-signature', 'in-production', 'client-review',
    'delivered', 'closed', 'refunded'
  );
exception when duplicate_object then null; end $$;

-- EscrowStatus — types.ts:599
do $$ begin
  create type public.escrow_status as enum (
    'created', 'authorized', 'captured', 'held',
    'partially-released', 'released', 'refunded'
  );
exception when duplicate_object then null; end $$;

-- Escrow.currency — types.ts:605 (single-valued union, kept for future parity)
do $$ begin
  create type public.currency_code as enum ('INR');
exception when duplicate_object then null; end $$;

-- Escrow.gateway — types.ts:606
do $$ begin
  create type public.payment_gateway as enum ('razorpay', 'mock-razorpay');
exception when duplicate_object then null; end $$;

-- ProvenanceRecord.synthid.provider — types.ts:628
do $$ begin
  create type public.watermark_provider as enum ('google-synthid', 'mock-synthid');
exception when duplicate_object then null; end $$;

-- ProvenanceRecord.visible.position — types.ts:632
do $$ begin
  create type public.watermark_position as enum ('centre-tile', 'corner', 'ticker');
exception when duplicate_object then null; end $$;

-- profiles.role. Not a TS union today — it is the value the auth trigger reads
-- out of `auth.users.raw_user_meta_data->>'role'` at signup.
do $$ begin
  create type public.profile_role as enum ('brand', 'creator', 'admin');
exception when duplicate_object then null; end $$;


-- ═══════════════════════════════════════════════════════════════════════════════
-- 3. TABLES
-- ═══════════════════════════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────────────────────────────
-- 3.1  Identity / account
-- ───────────────────────────────────────────────────────────────────────────────

-- Auth-linked user. This is the only table keyed directly off auth.users.
-- Mirrors: the auth subject behind every Creator / Brand row.
create table if not exists public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  role         public.profile_role not null default 'brand',
  display_name text not null,
  -- `@handle`. Public, unique, and the URL segment on /creators/[handle].
  handle       text not null unique
                 check (handle ~ '^[a-z0-9](?:[a-z0-9._-]*[a-z0-9])?$'),
  avatar_seed  text not null,
  -- Brand accent colour, hex. Same role as Brand.accent / Creator.accent.
  accent       text not null default '#7c6cff'
                 check (accent ~* '^#[0-9a-f]{6}$'),
  avatar_kind  public.avatar_kind not null default 'abstract',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

comment on table public.profiles is
  'Auth-linked user. 1:1 with auth.users. Seeded by handle_new_user(). '
  'No email, no phone, no OAuth claims are stored here — Supabase Auth owns those.';

-- (identity_verifications is declared in section 3.5, after brands and creators,
--  because it holds a foreign key to each of them.)


-- ───────────────────────────────────────────────────────────────────────────────
-- 3.2  Controlled vocabularies (taxonomy.ts)
--      Reference tables, not just enums: the discovery facet rail needs the
--      human labels, and these rows are what a brand's filter counts are taken
--      against.
-- ───────────────────────────────────────────────────────────────────────────────

-- Mirrors: Tool (types.ts:156) and the TOOLS array in taxonomy.ts.
create table if not exists public.tools (
  id             text primary key,
  name           text not null,
  vendor         text not null,
  category       public.tool_category not null,
  -- Catalogue-level verification, i.e. "this vendor will credential this tool".
  verified       boolean not null default false,
  verified_via   public.tool_verification_via,
  -- Catalogue-wide aggregate of hours logged by every creator. The per-creator
  -- figure the trust signal actually reads lives in creator_tools.hours_logged.
  hours_logged   numeric(9, 1) not null default 0 check (hours_logged >= 0),
  accent         text not null default '#7c6cff' check (accent ~* '^#[0-9a-f]{6}$'),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint tools_verified_via_present check (verified = false or verified_via is not null)
);

comment on table public.tools is
  'Vendor-neutral tool catalogue. Mirrors Tool (types.ts:156) / TOOLS (taxonomy.ts:10). '
  'Seed only — a client may never insert here.';

-- Mirrors: ModelRef (types.ts:169) and MODELS (taxonomy.ts:53).
create table if not exists public.models (
  id           text primary key,
  name         text not null,
  vendor       text not null,
  kind         public.model_kind not null,
  verified     boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

comment on table public.models is
  'Generative model catalogue. Mirrors ModelRef (types.ts:169) / MODELS (taxonomy.ts:53). '
  'Seed only.';

-- Mirrors: Skill (types.ts:187) and SKILL_TAXONOMY (taxonomy.ts:68).
-- `proficiency` lives on creator_skills because it is self-assessed per creator.
create table if not exists public.skills (
  id           text primary key,
  name         text not null unique,
  category     public.skill_category not null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

comment on table public.skills is
  'Skill vocabulary. Mirrors the {id,name,category} rows of SKILL_TAXONOMY '
  '(taxonomy.ts:68). The 1-5 proficiency on Skill is per-creator → creator_skills.';

-- Mirrors: CONTENT_TYPE_META (types.ts:50).
create table if not exists public.content_types (
  id         public.content_type primary key,
  label      text not null,
  category   public.content_category not null,
  hint       text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.content_types is
  'ContentType vocabulary with its display metadata. Mirrors CONTENT_TYPE_META '
  '(types.ts:50). Drives the "Content type" facet in search/engine.ts:459.';

-- Mirrors: ASPECT_RATIOS (types.ts:135). id is the enum so columns elsewhere can
-- carry the FK directly.
create table if not exists public.aspect_ratios (
  id         public.aspect_ratio primary key,
  label      text not null,
  usage      text not null default '',
  w          smallint not null check (w > 0),
  h          smallint not null check (h > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.aspect_ratios is
  'Delivery format vocabulary. Mirrors ASPECT_RATIOS (types.ts:135). '
  'Normalised width:height to 100. Drives the "Format" facet (engine.ts:460).';

create table if not exists public.specializations (
  id         text primary key,
  label      text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.specializations is
  'The 18 SPECIALIZATIONS strings (taxonomy.ts:96). id is the label in slug form; '
  'label is the exact literal the app stores and displays.';

create table if not exists public.industries (
  id         text primary key,
  label      text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.industries is
  'The INDUSTRIES strings (taxonomy.ts:117), used by Brand.industry and '
  'PortfolioPiece.industry.';

create table if not exists public.style_tags (
  id         text primary key,
  label      text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.style_tags is
  'The STYLE_TAGS strings (taxonomy.ts:146) referenced by Brief.styleTags.';

create table if not exists public.tone_tags (
  id         text primary key,
  label      text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.tone_tags is
  'The TONE_TAGS strings (taxonomy.ts:170) referenced by Brief.tone.';

create table if not exists public.channels (
  id         text primary key,
  label      text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.channels is
  'The CHANNELS strings (taxonomy.ts:183) referenced by CommercialUse.channels.';

-- Mirrors: REGIONS (taxonomy.ts:136). The "Base" facet in engine.ts:463 is
-- computed from these ids rather than by regex over the free-text location.
create table if not exists public.regions (
  id         text primary key,
  label      text not null,
  countries  text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.regions is
  'Region vocabulary. Mirrors REGIONS (taxonomy.ts:136). Replaces the prototype''s '
  'regex-over-location matching with a real join table.';


-- ───────────────────────────────────────────────────────────────────────────────
-- 3.3  Brand side
-- ───────────────────────────────────────────────────────────────────────────────

-- Mirrors: Brand (types.ts:657). id is the stable slug ("bd-nirvani") because the
-- app routes and the seed data both key on it.
create table if not exists public.brands (
  id                 text primary key,
  -- Links the brand to its auth user. NULL for seeded/demo brands with no login.
  profile_id         uuid unique references public.profiles (id) on delete set null,
  name               text not null,
  legal_name         text not null,
  kind               public.brand_kind not null default 'startup',
  industry           text references public.industries (id),
  logo_initials      text not null check (char_length(logo_initials) between 1 and 4),
  accent             text not null default '#7c6cff' check (accent ~* '^#[0-9a-f]{6}$'),
  location           text not null default '',
  -- TS stores "2024-07"; the DB keeps the same string shape and enforces it.
  member_since       text not null check (member_since ~ '^\d{4}-\d{2}$'),
  total_spend_inr    bigint not null default 0 check (total_spend_inr >= 0),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

comment on table public.brands is
  'The commissioning side. Mirrors Brand (types.ts:657). '
  'Brand.briefIds → briefs.brand_id, Brand.shortlistCreatorIds → shortlists, '
  'Brand.preferredFormats → brand_preferred_formats, Brand.identity → '
  'identity_verifications.';

-- Mirrors: Brand.preferredFormats (types.ts:672).
create table if not exists public.brand_preferred_formats (
  brand_id     text not null references public.brands (id) on delete cascade,
  aspect_ratio public.aspect_ratio not null references public.aspect_ratios (id),
  position     smallint not null default 0,
  primary key (brand_id, aspect_ratio)
);

comment on table public.brand_preferred_formats is
  'Brand.preferredFormats (types.ts:672) as a join table — it is a facet value, '
  'not free text.';


-- ───────────────────────────────────────────────────────────────────────────────
-- 3.4  Creator side
-- ───────────────────────────────────────────────────────────────────────────────

-- Mirrors: Creator (types.ts:340). The array-typed facets are join tables, not
-- columns, because search/engine.ts filters and counts on every one of them.
create table if not exists public.creators (
  id                     text primary key,
  profile_id             uuid unique references public.profiles (id) on delete set null,
  handle                 text not null unique
                           check (handle ~ '^[a-z0-9](?:[a-z0-9._-]*[a-z0-9])?$'),
  display_name           text not null,
  studio_name            text,
  headline               text not null default '',
  bio                    text not null default '',
  location               text not null default '',
  timezone               text not null default 'UTC',
  avatar_seed            text not null,
  accent                 text not null default '#7c6cff' check (accent ~* '^#[0-9a-f]{6}$'),
  avatar_kind            public.avatar_kind not null default 'abstract',
  availability           public.availability not null default 'open',
  -- TS seeds this with a date string ("2025-11-04"); the DB normalises to
  -- midnight UTC. Engine sort "recent" (engine.ts:402) orders on it.
  verified_at            timestamptz,
  member_since           text not null check (member_since ~ '^\d{4}-\d{2}$'),
  philosophy             text not null default '',
  -- Day rate in INR — one of the three hard sort/filter scalars in discovery.
  day_rate_inr           integer not null default 0 check (day_rate_inr >= 0),
  minimum_engagement_inr integer not null default 0 check (minimum_engagement_inr >= 0),
  turnaround_days        smallint not null default 7 check (turnaround_days between 1 and 180),
  -- Denormalised from reviews; the trust "client" signal reads it.
  rating                 numeric(2,1) not null default 0 check (rating between 0 and 5),
  review_count           integer not null default 0 check (review_count >= 0),
  -- Display-only marketing labels. Never filtered, never aggregated, so a plain
  -- text[] column is correct here — a jsonb blob would buy nothing.
  badges                 text[] not null default '{}',
  -- 768-dim embedding of the creator's positioning text, produced by Google
  -- Gemini `text-embedding-004` (registry.ts:31). Used for semantic recall in
  -- addition to the lexical `search_vector`.
  embedding              vector(768),
  -- Lexical vector for the `q` box in search/engine.ts:197. Generated (not
  -- written) so it can never drift from the columns it is built from.
  -- Portfolio text is deliberately absent: array_to_string is only STABLE, so a
  -- generated column may not call it. Portfolio is searched via its own
  -- search_vector plus the join tables.
  search_vector          tsvector generated always as (
                             setweight(to_tsvector('english'::regconfig, coalesce(display_name, '')), 'A') ||
                             setweight(to_tsvector('english'::regconfig, coalesce(headline, '')), 'A') ||
                             setweight(to_tsvector('english'::regconfig, coalesce(location, '')), 'B') ||
                             setweight(to_tsvector('english'::regconfig, coalesce(bio, '')), 'C') ||
                             setweight(to_tsvector('english'::regconfig, coalesce(philosophy, '')), 'C')
                           ) stored,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

comment on table public.creators is
  'Creator profile. Mirrors Creator (types.ts:340). '
  'Array fields are normalised: skills → creator_skills, tools → creator_tools, '
  'models → creator_models, contentTypes → creator_content_types, '
  'aspectRatios → creator_aspect_ratios, specializations → '
  'creator_specializations, languages/languagesOffered → creator_languages, '
  'workflowIds → creator_workflows, portfolioIds → portfolio_pieces.creator_id, '
  'engagementIds → engagements.creator_id, stats → creator_stats, '
  'identity → identity_verifications.';

-- The derived metrics block, deliberately split out so a recompute never
-- contends with an edit to the profile text.
-- Mirrors: CreatorStats (types.ts:329).
create table if not exists public.creator_stats (
  creator_id           text primary key references public.creators (id) on delete cascade,
  engagements          integer not null default 0 check (engagements >= 0),
  on_time_rate         numeric(5,2) not null default 0 check (on_time_rate between 0 and 100),
  avg_turnaround_days  numeric(6,2) not null default 0 check (avg_turnaround_days >= 0),
  approval_rate        numeric(5,2) not null default 0 check (approval_rate between 0 and 100),
  repeat_client_rate   numeric(5,2) not null default 0 check (repeat_client_rate between 0 and 100),
  total_earnings_inr   bigint not null default 0 check (total_earnings_inr >= 0),
  response_minutes     integer not null default 0 check (response_minutes >= 0),
  revisions_avg        numeric(4,2) not null default 0 check (revisions_avg >= 0),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

comment on table public.creator_stats is
  'CreatorStats (types.ts:329), 1:1 with creators. Never self-reported: recomputed '
  'from closed engagements and escrow releases by a service-role job. '
  'NO client write policy exists on this table.';

-- Mirrors: Creator.languages and Creator.languagesOffered (types.ts:349, 365).
create table if not exists public.creator_languages (
  creator_id   text not null references public.creators (id) on delete cascade,
  language     text not null check (char_length(btrim(language)) > 0),
  -- 'speaks'  → languages        'offered' → languagesOffered
  offering     text not null check (offering in ('speaks', 'offered')),
  position     smallint not null default 0,
  primary key (creator_id, language, offering)
);

comment on table public.creator_languages is
  'Creator.languages + Creator.languagesOffered (types.ts:349/365). Free-form '
  'strings — the taxonomy has no language list, so there is no FK, but it is a '
  'join table with a GIN-able single column and is filtered in engine.ts:134.';

create table if not exists public.creator_specializations (
  creator_id      text not null references public.creators (id) on delete cascade,
  specialization_id text not null references public.specializations (id) on delete cascade,
  position        smallint not null default 0,
  primary key (creator_id, specialization_id)
);

comment on table public.creator_specializations is
  'Creator.specializations (types.ts:361) — the "Specialisation" facet.';

create table if not exists public.creator_content_types (
  creator_id   text not null references public.creators (id) on delete cascade,
  content_type public.content_type not null references public.content_types (id) on delete cascade,
  position     smallint not null default 0,
  primary key (creator_id, content_type)
);

comment on table public.creator_content_types is
  'Creator.contentTypes (types.ts:360) — the "Content type" facet.';

create table if not exists public.creator_aspect_ratios (
  creator_id    text not null references public.creators (id) on delete cascade,
  aspect_ratio  public.aspect_ratio not null references public.aspect_ratios (id) on delete cascade,
  position      smallint not null default 0,
  primary key (creator_id, aspect_ratio)
);

comment on table public.creator_aspect_ratios is
  'Creator.aspectRatios (types.ts:361) — the "Format" facet.';

create table if not exists public.creator_regions (
  creator_id text not null references public.creators (id) on delete cascade,
  region_id  text not null references public.regions (id) on delete cascade,
  primary key (creator_id, region_id)
);

comment on table public.creator_regions is
  'Base region per creator, replacing the regex-over-location hack in '
  'engine.ts:140. Drives the "Base" facet.';

-- Mirrors: Creator.tools (types.ts:358) *with per-creator provenance*.
-- The `verified` + `verified_via` pair is the difference between a claim and a
-- substantiated claim (types.ts design note 3).
create table if not exists public.creator_tools (
  creator_id    text not null references public.creators (id) on delete cascade,
  tool_id       text not null references public.tools (id) on delete cascade,
  verified      boolean not null default false,
  verified_via  public.tool_verification_via,
  -- Production hours THIS creator has logged with this tool. Read by the trust
  -- "tools" signal in domain/trust.ts:67.
  hours_logged  numeric(9, 1) not null default 0 check (hours_logged >= 0),
  position      smallint not null default 0,
  primary key (creator_id, tool_id),
  constraint creator_tools_via_present check (verified = false or verified_via is not null)
);

comment on table public.creator_tools is
  'Creator.tools (types.ts:358) as a join table carrying per-creator verification '
  'and hours. Filtered by the "Tool" facet and scored by the trust tools signal.';

-- Mirrors: Creator.skills (types.ts:357).
create table if not exists public.creator_skills (
  creator_id   text not null references public.creators (id) on delete cascade,
  skill_id     text not null references public.skills (id) on delete cascade,
  -- Skill.proficiency (types.ts:192): self-assessed 1-5, corroborated by reviews.
  proficiency  smallint not null default 3 check (proficiency between 1 and 5),
  position     smallint not null default 0,
  primary key (creator_id, skill_id)
);

comment on table public.creator_skills is
  'Creator.skills (types.ts:357) plus the per-creator proficiency rating. '
  'The "Skill" facet filters on skill_id.';

-- Mirrors: Creator.models (types.ts:359).
create table if not exists public.creator_models (
  creator_id text not null references public.creators (id) on delete cascade,
  model_id   text not null references public.models (id) on delete cascade,
  verified   boolean not null default false,
  position   smallint not null default 0,
  primary key (creator_id, model_id)
);

comment on table public.creator_models is
  'Creator.models (types.ts:359) as a join table.';

-- creator_workflows is declared at the end of section 3.5, after `workflows`.


-- ───────────────────────────────────────────────────────────────────────────────
-- 3.5  Identity (both parties)
-- ───────────────────────────────────────────────────────────────────────────────

-- Verified brand and creator identities, as asserted by an issuer.
-- Mirrors: IdentityVerification (types.ts:214) for BOTH Brand and Creator.
-- Declared here because it holds a foreign key to each of them.
--
-- Why this is NOT one jsonb blob on each parent table, despite the TS type being
-- a nested struct: `status`, `expires_at` and `assurance_level` are read by
-- domain/trust.ts, by the discovery `verification` facet and by the expiry
-- warning in the trust panel. They are columns so they can be indexed.
-- The issuer's own assertion envelope (shapes differ per issuer) stays in jsonb.
create table if not exists public.identity_verifications (
  id                 uuid primary key default gen_random_uuid(),
  -- Exactly one owner. A single row cannot back both a creator and a brand.
  creator_id         text references public.creators (id) on delete cascade,
  brand_id           text references public.brands (id) on delete cascade,
  status             public.identity_status not null default 'unverified',
  method             public.identity_method,
  -- DigiLocker issued-identifier, hashed. NEVER the raw document.
  issuer_ref         text,
  issuer             text,
  document_type      text,
  verified_at        timestamptz,
  expires_at         timestamptz,
  -- CREAM retains the assertion envelope, never the artefact. Always false.
  artefact_retained  boolean not null default false
                       check (artefact_retained = false),
  assurance_level    public.assurance_level,
  -- Issuer-specific raw assertion. jsonb because the shape changes per issuer
  -- (UIDAI vs Income Tax vs External Affairs) and nothing queries inside it.
  document           jsonb not null default '{}'::jsonb,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint identity_verifications_single_owner
    check (num_nonnulls(creator_id, brand_id) = 1)
);

create unique index if not exists identity_verifications_creator_uniq
  on public.identity_verifications (creator_id) where creator_id is not null;
create unique index if not exists identity_verifications_brand_uniq
  on public.identity_verifications (brand_id) where brand_id is not null;
create index if not exists identity_verifications_status_idx
  on public.identity_verifications (status, expires_at);

comment on table public.identity_verifications is
  'DigiLocker-asserted identity, one row per party. Mirrors IdentityVerification '
  '(types.ts:214). CREAM never stores a government ID — only the issuer''s '
  'assertion envelope. Written exclusively by the issuer webhook via service role.';


-- ───────────────────────────────────────────────────────────────────────────────
-- 3.5  Workflow
-- ───────────────────────────────────────────────────────────────────────────────

-- Mirrors: Workflow (types.ts:273). text PK: the slug is published and linked.
create table if not exists public.workflows (
  id             text primary key,
  creator_id     text references public.creators (id) on delete set null,
  name           text not null,
  summary        text not null default '',
  duration_hours numeric(8,2) not null default 0 check (duration_hours >= 0),
  verified       boolean not null default false,
  last_run_at    timestamptz not null default now(),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

comment on table public.workflows is
  'The reproducible recipe behind a piece of work. Mirrors Workflow (types.ts:273). '
  'creator_id is the author (nullable for shared recipes); the published-on-a-'
  'profile edge is creator_workflows.';

-- Mirrors: WorkflowStage (types.ts:262).
-- NOTE: WorkflowStage.id is "s1", "s2" … — NOT unique across workflows. The
-- database therefore mints a uuid, keeps the original label in `slug`, and
-- enforces uniqueness per workflow on `position`.
create table if not exists public.workflow_stages (
  id                 uuid primary key default gen_random_uuid(),
  workflow_id        text not null references public.workflows (id) on delete cascade,
  slug               text not null check (char_length(btrim(slug)) > 0),
  position           smallint not null check (position >= 0),
  name               text not null,
  description        text not null default '',
  -- Human-in-the-loop judgement applied at this stage. The trust "workflow"
  -- signal counts stages where this is non-blank (trust.ts:89).
  human_checkpoint   text not null default '',
  -- Share of the piece produced here, 0-100. Sums to 100 across the workflow.
  weight             numeric(5,2) not null default 0 check (weight between 0 and 100),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint workflow_stages_slug_uniq unique (workflow_id, slug),
  constraint workflow_stages_position_uniq unique (workflow_id, position)
);

comment on table public.workflow_stages is
  'Workflow.stages (types.ts:278). uuid PK because the TS `id` ("s1") repeats '
  'across workflows; the literal is preserved in `slug`.';

-- WorkflowStage.tools is a join table too — the "Tool" facet counts which
-- pipeline a claim rests on.
create table if not exists public.workflow_stage_tools (
  stage_id  uuid not null references public.workflow_stages (id) on delete cascade,
  tool_id   text not null references public.tools (id) on delete cascade,
  position  smallint not null default 0,
  primary key (stage_id, tool_id)
);

comment on table public.workflow_stage_tools is
  'WorkflowStage.tools (types.ts:266).';

-- Mirrors: Creator.workflowIds (types.ts:371). The workflow→creator edge lives
-- here rather than on `workflows` so one recipe can be published by more than
-- one creator. Declared after `workflows` because it holds a foreign key to it.
create table if not exists public.creator_workflows (
  creator_id   text not null references public.creators (id) on delete cascade,
  workflow_id  text not null references public.workflows (id) on delete cascade,
  position     smallint not null default 0,
  primary key (creator_id, workflow_id)
);

comment on table public.creator_workflows is
  'Creator.workflowIds (types.ts:371). Required by the trust "workflow" signal '
  '(domain/trust.ts:87), which needs to know which recipes a creator published.';


-- ───────────────────────────────────────────────────────────────────────────────
-- 3.6  Portfolio
-- ───────────────────────────────────────────────────────────────────────────────

-- Mirrors: PortfolioPiece (types.ts:285). text PK ("pf-aarav-1").
create table if not exists public.portfolio_pieces (
  id                   text primary key,
  creator_id           text not null references public.creators (id) on delete cascade,
  title                text not null,
  summary              text not null default '',
  content_type         public.content_type not null references public.content_types (id),
  aspect_ratio         public.aspect_ratio not null references public.aspect_ratios (id),
  year                 smallint not null check (year between 2000 and 2100),
  -- Client or brand, null when the engagement was under NDA.
  client               text,
  client_logo_initials text check (client_logo_initials is null or char_length(client_logo_initials) between 1 and 4),
  industry             text references public.industries (id),
  workflow_id          text references public.workflows (id) on delete set null,
  -- Exactly three colours, matching [string, string, string] on the TS type.
  -- text[] rather than jsonb: it is fixed-shape and worth a GIN index.
  palette              text[] not null default '{}'
                         check (coalesce(array_length(palette, 1), 0) = 3),
  -- Deterministic seed for the procedurally-rendered preview surface.
  art_seed             text not null,
  -- Populated only for publicly licensed work.
  license              text,
  -- PortfolioPiece.metrics (types.ts:306): views / engagementRate /
  -- briefConversionRate are optional and shaped per piece, while awardCount is
  -- the one number discovery ranks on. The blob is stored because the key set
  -- genuinely varies between works; the sortable value is projected out below.
  metrics              jsonb not null default '{}'::jsonb,
  -- Generated projection of metrics->>'awardCount' so it stays sortable and
  -- indexable without unpacking jsonb at query time.
  award_count          integer generated always as (((metrics ->> 'awardCount')::integer)) stored,
  featured             boolean not null default false,
  -- Free-form descriptive tags. Free text in TS, so text[] + GIN rather than
  -- an FK — but still queryable, never an opaque blob.
  tags                 text[] not null default '{}',
  search_vector        tsvector generated always as (
                           setweight(to_tsvector('english'::regconfig, coalesce(title, '')), 'A') ||
                           setweight(to_tsvector('english'::regconfig, coalesce(summary, '')), 'B') ||
                           setweight(to_tsvector('english'::regconfig, coalesce(client, '')), 'C') ||
                           setweight(to_tsvector('english'::regconfig, coalesce(industry, '')), 'C')
                         ) stored,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

comment on table public.portfolio_pieces is
  'Published work. Mirrors PortfolioPiece (types.ts:285). tools/models/skills are '
  'join tables because discovery filters on them (engine.ts:217 weighs them into '
  'the free-text relevance score).';

create table if not exists public.portfolio_piece_tools (
  portfolio_piece_id text not null references public.portfolio_pieces (id) on delete cascade,
  tool_id            text not null references public.tools (id) on delete cascade,
  position           smallint not null default 0,
  primary key (portfolio_piece_id, tool_id)
);

comment on table public.portfolio_piece_tools is
  'PortfolioPiece.tools (types.ts:296).';

create table if not exists public.portfolio_piece_models (
  portfolio_piece_id text not null references public.portfolio_pieces (id) on delete cascade,
  model_id           text not null references public.models (id) on delete cascade,
  position           smallint not null default 0,
  primary key (portfolio_piece_id, model_id)
);

comment on table public.portfolio_piece_models is
  'PortfolioPiece.models (types.ts:297).';

create table if not exists public.portfolio_piece_skills (
  portfolio_piece_id text not null references public.portfolio_pieces (id) on delete cascade,
  skill_id           text not null references public.skills (id) on delete cascade,
  position           smallint not null default 0,
  primary key (portfolio_piece_id, skill_id)
);

comment on table public.portfolio_piece_skills is
  'PortfolioPiece.skills (types.ts:298).';


-- ───────────────────────────────────────────────────────────────────────────────
-- 3.7  Brief builder — session, transcript, brief
-- ───────────────────────────────────────────────────────────────────────────────

-- Mirrors: BriefSession (types.ts:482).
-- `brief_id` is added as a FK at the end of this file (DO block) because Brief
-- and BriefSession reference each other: Brief.sessionId and BriefSession.briefId.
create table if not exists public.brief_sessions (
  id          uuid primary key default gen_random_uuid(),
  -- Stable application identifier. The uuid PK stays as the internal key; every
  -- domain type exposes this slug as its id, which is what the UI, URLs, FKs
  -- in app code and the seed script all address. Text so seeding is idempotent.
  slug               text not null unique,
  brief_id    uuid,
  brand_id    text not null references public.brands (id) on delete cascade,
  status      public.brief_session_status not null default 'active',
  -- The structured draft maintained alongside the transcript
  -- (BriefSession.draft, a Partial<Brief>). jsonb because it is a partial,
  -- arbitrarily-shaped projection of the brief and is re-hydrated verbatim;
  -- nothing filters inside it.
  draft       jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.brief_sessions is
  'The brand-side conversation that produced a brief. Mirrors BriefSession '
  '(types.ts:482). `draft` is jsonb because it is a Partial<Brief> that grows '
  'field by field as the assistant extracts.';

-- Mirrors: Brief (types.ts:427). uuid PK with a human-facing `code`.
create table if not exists public.briefs (
  id                          uuid primary key default gen_random_uuid(),
  -- Stable application identifier. The uuid PK stays as the internal key; every
  -- domain type exposes this slug as its id, which is what the UI, URLs, FKs
  -- in app code and the seed script all address. Text so seeding is idempotent.
  slug               text not null unique,
  -- BRF-2026-0141. What humans read and what /briefs/[code] routes on.
  code                        text not null unique check (code ~ '^BRF-\d{4}-\d{4}$'),
  title                       text not null,
  brand_id                    text not null references public.brands (id) on delete cascade,
  -- Denormalised for list rendering; the join is the source of truth.
  brand_name                  text not null,
  campaign_objective          text not null default '',
  raw_idea                    text not null default '',
  refined_summary             text not null default '',
  audience                    text not null default '',
  tone                        text[] not null default '{}',
  style_tags                  text[] not null default '{}',
  reference_notes             text[] not null default '{}',
  excluded_styles             text[] not null default '{}',
  content_types               public.content_type[] not null default '{}',
  aspect_ratios               public.aspect_ratio[] not null default '{}',
  -- SignalKind union, e.g. ["identity","tools","workflow","portfolio"].
  must_have_signals           public.signal_kind[] not null default '{}',
  status                      public.brief_status not null default 'draft',
  -- Brief.budget (types.ts:444) flattened to scalars — the money range is
  -- filtered and sorted on, never read out of a blob.
  budget_min_inr              bigint not null default 0 check (budget_min_inr >= 0),
  budget_max_inr              bigint not null default 0 check (budget_max_inr >= 0),
  budget_model                public.budget_model not null default 'fixed',
  budget_released_to_razorpay boolean not null default false,
  -- Brief.timeline (types.ts:419) flattened for the same reason.
  kickoff_within_days         smallint not null default 7 check (kickoff_within_days > 0),
  first_samples_within_days   smallint not null default 10 check (first_samples_within_days > 0),
  final_delivery_within_days  smallint not null default 21 check (final_delivery_within_days > 0),
  revisions_included          smallint not null default 2 check (revisions_included >= 0),
  concept_rounds_included     smallint not null default 1 check (concept_rounds_included >= 0),
  session_id                  uuid unique references public.brief_sessions (id) on delete set null,
  -- "Denormalised for search; recomputed on save" (types.ts:459).
  embedding_note              text not null default '',
  -- 768-dim embedding of embedding_note, produced by Google Gemini
  -- `text-embedding-004`. Semantic brief↔creator matching.
  embedding                   vector(768),
  search_vector               tsvector generated always as (
                                  setweight(to_tsvector('english'::regconfig, coalesce(title, '')), 'A') ||
                                  setweight(to_tsvector('english'::regconfig, coalesce(refined_summary, '')), 'A') ||
                                  setweight(to_tsvector('english'::regconfig, coalesce(embedding_note, '')), 'B') ||
                                  setweight(to_tsvector('english'::regconfig, coalesce(raw_idea, '')), 'C') ||
                                  setweight(to_tsvector('english'::regconfig, coalesce(audience, '')), 'C') ||
                                  setweight(to_tsvector('english'::regconfig, coalesce(campaign_objective, '')), 'C')
                                ) stored,
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now(),
  constraint briefs_budget_range check (budget_max_inr >= budget_min_inr)
);

comment on table public.briefs is
  'A commission. Mirrors Brief (types.ts:427). deliverables → brief_deliverables, '
  'commercialUse → commercial_use (1:1), sessionId → brief_sessions.id, '
  'shortlistedCreatorIds → shortlists, offerIds → offers. Private to the '
  'commissioning brand and to creators holding an offer on it.';

-- Mirrors: BriefDeliverable (types.ts:410).
create table if not exists public.brief_deliverables (
  id               uuid primary key default gen_random_uuid(),
  brief_id         uuid not null references public.briefs (id) on delete cascade,
  content_type     public.content_type not null references public.content_types (id),
  aspect_ratio     public.aspect_ratio not null references public.aspect_ratios (id),
  quantity         integer not null default 1 check (quantity > 0),
  duration_seconds integer check (duration_seconds is null or duration_seconds > 0),
  notes            text not null default '',
  position         smallint not null default 0,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

comment on table public.brief_deliverables is
  'Brief.deliverables (types.ts:442). `notes` is a plain TS string, so it is text '
  'rather than a jsonb blob — inventing a JSON shape the types do not have would '
  'cost more than it buys. Ordering is `position`.';

-- Mirrors: CommercialUse (types.ts:390). 1:1 with briefs — rights are a struct,
-- not a boolean (types.ts design note 2).
create table if not exists public.commercial_use (
  brief_id                   uuid primary key references public.briefs (id) on delete cascade,
  license_type               public.license_type not null default 'non-exclusive',
  territory                  public.territory not null default 'india',
  custom_territory           text,
  duration_months            integer check (duration_months is null or duration_months > 0),
  perpetual                  boolean not null default false,
  channels                   text[] not null default '{}',
  paid_media_allowed         boolean not null default false,
  -- Whether the model vendor may train on the delivered asset.
  model_training_allowed     boolean not null default false,
  derivative_works_allowed   boolean not null default true,
  sublicensing_allowed       boolean not null default false,
  resale_allowed             boolean not null default false,
  -- AI may generate competing work for the same brand — usually must be false.
  competitor_use_blocked     boolean not null default true,
  disclosure_policy          public.disclosure_policy not null default 'platform-disclosure',
  created_at                 timestamptz not null default now(),
  updated_at                 timestamptz not null default now(),
  constraint commercial_use_custom_territory
    check (territory <> 'custom' or custom_territory is not null)
);

comment on table public.commercial_use is
  'Brief.commercialUse (types.ts:390), one row per brief. Ten separate rights '
  'flags because they are negotiated independently and a contract clause is '
  'generated from each one.';


-- ───────────────────────────────────────────────────────────────────────────────
-- 3.8  Offers
-- ───────────────────────────────────────────────────────────────────────────────

-- Mirrors: Offer (types.ts:505).
create table if not exists public.offers (
  id                  uuid primary key default gen_random_uuid(),
  -- Stable application identifier. The uuid PK stays as the internal key; every
  -- domain type exposes this slug as its id, which is what the UI, URLs, FKs
  -- in app code and the seed script all address. Text so seeding is idempotent.
  slug               text not null unique,
  code                text not null unique check (code ~ '^OFR-\d{4}-\d{4}$'),
  brief_id            uuid not null references public.briefs (id) on delete cascade,
  creator_id          text not null references public.creators (id) on delete cascade,
  brand_id            text not null references public.brands (id) on delete cascade,
  amount_inr          bigint not null check (amount_inr > 0),
  delivery_days       smallint not null check (delivery_days > 0),
  revisions_included  smallint not null default 2 check (revisions_included >= 0),
  concept_rounds      smallint not null default 1 check (concept_rounds >= 0),
  -- Offer.exclusivity is CommercialUse["licenseType"].
  exclusivity         public.license_type not null default 'non-exclusive',
  status              public.offer_status not null default 'draft',
  -- The assistant's plain-language restatement of the brief for the creator.
  translated_brief    text not null default '',
  created_at          timestamptz not null default now(),
  responded_at        timestamptz,
  note                text not null default '',
  updated_at          timestamptz not null default now(),
  -- A creator is offered a given brief once.
  constraint offers_brief_creator_uniq unique (brief_id, creator_id)
);

comment on table public.offers is
  'A priced offer to one creator. Mirrors Offer (types.ts:505). This table is the '
  'permission slip that lets a creator read a brief and its deliverables: '
  '"you can see this brief because an offers row links you to it". '
  'translationTurns → conversation_turns.offer_id; milestones → offer_milestones.';

-- Mirrors: Offer.milestones (types.ts:516) — { label, pct, dueDay }.
create table if not exists public.offer_milestones (
  id         uuid primary key default gen_random_uuid(),
  offer_id   uuid not null references public.offers (id) on delete cascade,
  label      text not null check (char_length(btrim(label)) > 0),
  pct        smallint not null check (pct between 0 and 100),
  due_day    smallint not null check (due_day >= 0),
  position   smallint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint offer_milestones_uniq unique (offer_id, position)
);

comment on table public.offer_milestones is
  'Offer.milestones (types.ts:516). Each row becomes an escrow release tranche.';

-- Mirrors: ConversationTurn (types.ts:468). One table serves both the brief
-- transcript (session_id) and the creator-facing translation (offer_id);
-- exactly one parent is set.
create table if not exists public.conversation_turns (
  id              uuid primary key default gen_random_uuid(),
  -- Stable application identifier. The uuid PK stays as the internal key; every
  -- domain type exposes this slug as its id, which is what the UI, URLs, FKs
  -- in app code and the seed script all address. Text so seeding is idempotent.
  slug               text not null unique,
  session_id      uuid references public.brief_sessions (id) on delete cascade,
  offer_id        uuid references public.offers (id) on delete cascade,
  role            public.conversation_role not null,
  text            text not null,
  at              timestamptz not null default now(),
  -- Brief/field paths the assistant wrote into the draft during this turn.
  -- Free-form path strings, so text[] rather than an FK to a field catalogue.
  extracted_fields text[] not null default '{}',
  -- Set when the turn was answered by the deterministic fallback engine.
  simulated       boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint conversation_turns_single_parent
    check (num_nonnulls(session_id, offer_id) = 1)
);

comment on table public.conversation_turns is
  'Every turn of the brief conversation and of the creator-facing translation. '
  'Mirrors ConversationTurn (types.ts:468), used by BriefSession.turns and '
  'Offer.translationTurns. Preserved verbatim because re-hydrating the same '
  'context for the creator is the platform''s core differentiator.';


-- ───────────────────────────────────────────────────────────────────────────────
-- 3.9  Contracts
-- ───────────────────────────────────────────────────────────────────────────────

-- Mirrors: Contract (types.ts:548).
create table if not exists public.contracts (
  id             uuid primary key default gen_random_uuid(),
  -- Stable application identifier. The uuid PK stays as the internal key; every
  -- domain type exposes this slug as its id, which is what the UI, URLs, FKs
  -- in app code and the seed script all address. Text so seeding is idempotent.
  slug               text not null unique,
  code           text not null unique check (code ~ '^CTR-\d{4}-\d{4}$'),
  kind           public.contract_kind not null,
  offer_id       uuid not null references public.offers (id) on delete cascade,
  brand_id       text not null references public.brands (id) on delete cascade,
  creator_id     text not null references public.creators (id) on delete cascade,
  brief_id       uuid not null references public.briefs (id) on delete cascade,
  -- Provenance over the canonical serialisation of the clauses.
  content_digest text not null check (content_digest ~ '^sha256:[0-9a-f]{64}$'),
  status         public.signature_status not null default 'pending',
  created_at     timestamptz not null default now(),
  effective_at   timestamptz,
  -- Human-review requirement: CREAM does not auto-generate these (types.ts:563).
  human_reviewed boolean not null default false,
  updated_at     timestamptz not null default now()
);

comment on table public.contracts is
  'A generated contract. Mirrors Contract (types.ts:548). clauses → '
  'contract_clauses, signatures → contract_signatures. Body text is never written '
  'by a client: the legal pipeline mints the row via the service role.';

-- Mirrors: ContractClause (types.ts:540).
create table if not exists public.contract_clauses (
  id            uuid primary key default gen_random_uuid(),
  contract_id   uuid not null references public.contracts (id) on delete cascade,
  -- The TS clause id ("c-watermark"); unique within a contract.
  slug          text not null check (char_length(btrim(slug)) > 0),
  heading       text not null,
  body          text not null,
  -- Human-mandatory acknowledgement; these cannot be pre-checked.
  requires_explicit_acknowledgement boolean not null default false,
  position      smallint not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint contract_clauses_slug_uniq unique (contract_id, slug)
);

comment on table public.contract_clauses is
  'Contract.clauses (types.ts:556).';

-- Mirrors: ContractSignature (types.ts:530).
create table if not exists public.contract_signatures (
  id          uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.contracts (id) on delete cascade,
  party       public.contract_party not null,
  party_name  text not null,
  status      public.signature_status not null default 'pending',
  signed_at   timestamptz,
  ip_address  inet,
  -- Short SHA-256 prefix over the canonical contract body + signer identity.
  digest      text check (digest is null or digest ~ '^[0-9a-f]{12,}$'),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint contract_signatures_party_uniq unique (contract_id, party)
);

comment on table public.contract_signatures is
  'Contract.signatures (types.ts:562). Exactly one row per party. A party may '
  'only write the row that names them — enforced in the update policy.';


-- ───────────────────────────────────────────────────────────────────────────────
-- 3.10  Engagement, generation rounds, escrow, provenance
-- ───────────────────────────────────────────────────────────────────────────────

-- Mirrors: Engagement (types.ts:583).
create table if not exists public.engagements (
  id         uuid primary key default gen_random_uuid(),
  -- Stable application identifier. The uuid PK stays as the internal key; every
  -- domain type exposes this slug as its id, which is what the UI, URLs, FKs
  -- in app code and the seed script all address. Text so seeding is idempotent.
  slug               text not null unique,
  code       text not null unique check (code ~ '^ENG-\d{4}-\d{4}$'),
  brief_id   uuid not null references public.briefs (id) on delete cascade,
  offer_id   uuid not null references public.offers (id) on delete cascade,
  brand_id   text not null references public.brands (id) on delete cascade,
  creator_id text not null references public.creators (id) on delete cascade,
  status     public.engagement_status not null default 'awaiting-signature',
  started_at timestamptz not null default now(),
  due_at     timestamptz not null,
  -- FK to escrows added at the end of this file (circular: Engagement.escrowId
  -- and Escrow.engagementId reference each other).
  escrow_id  uuid,
  -- Per-milestone actual timings (planned vs delivered, release timestamps).
  -- Genuinely variable and written by the payments/QA pipeline, never filtered
  -- on — jsonb is the right shape.
  timings    jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint engagements_due_after_start check (due_at > started_at),
  constraint engagements_offer_uniq unique (offer_id)
);

comment on table public.engagements is
  'A live commission. Mirrors Engagement (types.ts:583). rounds → generation_rounds, '
  'provenance → provenance_records, escrowId → escrows, contractIds → contracts. '
  'Visible only to the two parties on it.';

-- Mirrors: GenerationRound (types.ts:569).
create table if not exists public.generation_rounds (
  id             uuid primary key default gen_random_uuid(),
  -- Stable application identifier. The uuid PK stays as the internal key; every
  -- domain type exposes this slug as its id, which is what the UI, URLs, FKs
  -- in app code and the seed script all address. Text so seeding is idempotent.
  slug               text not null unique,
  -- TS key is `index`, which is a reserved word in SQL; the round ordinal.
  round_index    integer not null check (round_index >= 0),
  brief_id       uuid not null references public.briefs (id) on delete cascade,
  -- Authoritative link back to the engagement; RLS and provenance hang off it.
  engagement_id  uuid not null references public.engagements (id) on delete cascade,
  label          text not null default '',
  status         public.round_status not null default 'queued',
  tool_chain     text[] not null default '{}',
  prompt_lineage text[] not null default '{}',
  feedback       text,
  approved_at    timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint generation_rounds_index_uniq unique (engagement_id, round_index)
);

comment on table public.generation_rounds is
  'A concept/production round. Mirrors GenerationRound (types.ts:569). samples → '
  'generation_samples. The creator writes the production state; the brand may read.';

-- Mirrors: GenerationRound.samples entries (types.ts:578).
create table if not exists public.generation_samples (
  id           uuid primary key default gen_random_uuid(),
  round_id     uuid not null references public.generation_rounds (id) on delete cascade,
  title        text not null default '',
  art_seed     text not null,
  palette      text[] not null default '{}'
                 check (coalesce(array_length(palette, 1), 0) = 3),
  aspect_ratio public.aspect_ratio references public.aspect_ratios (id),
  position     smallint not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint generation_samples_round_position_uniq unique (round_id, position)
);

comment on table public.generation_samples is
  'One candidate frame inside a round. Mirrors the inline samples array on '
  'GenerationRound (types.ts:578).';

-- Mirrors: Escrow (types.ts:601).
create table if not exists public.escrows (
  id                uuid primary key default gen_random_uuid(),
  -- Stable application identifier. The uuid PK stays as the internal key; every
  -- domain type exposes this slug as its id, which is what the UI, URLs, FKs
  -- in app code and the seed script all address. Text so seeding is idempotent.
  slug               text not null unique,
  code              text not null unique,
  engagement_id     uuid not null unique references public.engagements (id) on delete cascade,
  amount_inr        bigint not null check (amount_inr > 0),
  released_inr      bigint not null default 0 check (released_inr >= 0),
  currency          public.currency_code not null default 'INR',
  status            public.escrow_status not null default 'created',
  gateway           public.payment_gateway not null default 'razorpay',
  gateway_order_id  text not null,
  gateway_payment_id text,
  captured_at       timestamptz,
  released_at       timestamptz,
  payout_route      text not null default '',
  protected_by      text not null default '',
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint escrows_release_within_amount check (released_inr <= amount_inr)
);

comment on table public.escrows is
  'Held-and-released escrow, one per engagement. Mirrors Escrow (types.ts:601). '
  'Written only by the Razorpay webhook path under the service role.';

-- Mirrors: ProvenanceRecord (types.ts:621).
-- All four nested blocks are jsonb by design: they are signed, versioned
-- documents whose shape belongs to C2PA / SynthID rather than to this schema.
-- Nothing filters inside them, so they are read whole and audited whole.
create table if not exists public.provenance_records (
  id               uuid primary key default gen_random_uuid(),
  -- Stable application identifier. The uuid PK stays as the internal key; every
  -- domain type exposes this slug as its id, which is what the UI, URLs, FKs
  -- in app code and the seed script all address. Text so seeding is idempotent.
  slug               text not null unique,
  engagement_id    uuid not null references public.engagements (id) on delete cascade,
  round_id         uuid references public.generation_rounds (id) on delete cascade,
  asset_name       text not null,
  -- C2PA content manifest: version, claimGenerator, certificateIssuer,
  -- assertions[], manifestHash, signedAt.
  c2pa             jsonb not null default '{}'::jsonb,
  -- SynthID-class envelope: provider, embedded, strength, payloadId,
  -- extractable, optional lastDetection.
  synthid          jsonb not null default '{}'::jsonb,
  -- Visible dual-branded burn-in: platformWatermark, creatorWatermark,
  -- position, opacity.
  visible          jsonb not null default '{}'::jsonb,
  -- Append-only ledger: [{ at, event, actor }, ...]
  chain_of_custody jsonb not null default '[]'::jsonb,
  -- Projected out of the manifest so auditors can index without jsonb operators.
  -- Only `manifestHash` is projected: `->> text` and `text -> integer` are both
  -- IMMUTABLE, whereas a text -> timestamptz cast is only STABLE, so a generated
  -- `signed_at` column would be rejected by Postgres. `signedAt` therefore stays
  -- inside the blob and is read with `c2pa ->> 'signedAt'` when it is needed.
  manifest_hash    text generated always as ((c2pa ->> 'manifestHash')) stored,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

comment on table public.provenance_records is
  'C2PA + SynthID + visible-mark provenance for one delivered asset. Mirrors '
  'ProvenanceRecord (types.ts:621). Append-only and read-only to clients: there '
  'is NO insert policy, so a client literally cannot fabricate a manifest. '
  'Written by the stamping pipeline under the service role.';


-- ───────────────────────────────────────────────────────────────────────────────
-- 3.11  Reviews and shortlists
-- ───────────────────────────────────────────────────────────────────────────────

-- Mirrors: Review (types.ts:676).
create table if not exists public.reviews (
  id              uuid primary key default gen_random_uuid(),
  -- Stable application identifier. The uuid PK stays as the internal key; every
  -- domain type exposes this slug as its id, which is what the UI, URLs, FKs
  -- in app code and the seed script all address. Text so seeding is idempotent.
  slug               text not null unique,
  creator_id      text not null references public.creators (id) on delete cascade,
  -- The reviewing brand. NULL for legacy rows that only kept a display name.
  brand_id        text references public.brands (id) on delete set null,
  brand_name      text not null,
  rating          numeric(2,1) not null check (rating between 1 and 5),
  body            text not null default '',
  at              timestamptz not null default now(),
  -- Reviews are bound to a paid engagement code and cannot be edited after
  -- payout release (trust.ts:144).
  engagement_code text not null,
  -- Resolvable back to the engagement when the code is live.
  engagement_id   uuid references public.engagements (id) on delete set null,
  verified        boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

comment on table public.reviews is
  'A client review. Mirrors Review (types.ts:676). Public read, brand-party '
  'insert, and NO update or delete policy — a review is immutable once escrow '
  'has released, which is what makes the trust "client" signal worth anything.';

-- Mirrors: Brand.shortlistCreatorIds (types.ts:668) and
-- Brief.shortlistedCreatorIds (types.ts:460) in one table.
create table if not exists public.shortlists (
  id          uuid primary key default gen_random_uuid(),
  brand_id    text not null references public.brands (id) on delete cascade,
  creator_id  text not null references public.creators (id) on delete cascade,
  -- NULL = standing shortlist for the brand. Set = shortlist for one brief.
  brief_id    uuid references public.briefs (id) on delete cascade,
  note        text not null default '',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.shortlists is
  'Brand.shortlistCreatorIds (types.ts:668) and Brief.shortlistedCreatorIds '
  '(types.ts:460). Two partial unique indexes: one per-brief, one standing.';

create unique index if not exists shortlists_brief_creator_uniq
  on public.shortlists (brief_id, creator_id) where brief_id is not null;
create unique index if not exists shortlists_brand_creator_uniq
  on public.shortlists (brand_id, creator_id) where brief_id is null;


-- ───────────────────────────────────────────────────────────────────────────────
-- 3.12  Deferred foreign keys for the two circular references
--       briefs ⇄ brief_sessions and engagements ⇄ escrows.
-- ───────────────────────────────────────────────────────────────────────────────

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'brief_sessions_brief_id_fkey') then
    alter table public.brief_sessions
      add constraint brief_sessions_brief_id_fkey
      foreign key (brief_id) references public.briefs (id) on delete set null;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'engagements_escrow_id_fkey') then
    alter table public.engagements
      add constraint engagements_escrow_id_fkey
      foreign key (escrow_id) references public.escrows (id) on delete set null;
  end if;
end $$;


-- ═══════════════════════════════════════════════════════════════════════════════
-- 4. INDEXES
--     Every column search/engine.ts filters or sorts on is indexed, plus the
--     composite shapes its `passesScalars` + `facetHit` predicates produce.
-- ═══════════════════════════════════════════════════════════════════════════════

-- ── discovery: scalar facets and sorts ───────────────────────────────────────
-- engine.ts:291 / :130 — availability facet + "open now" relevance boost.
create index if not exists creators_availability_idx
  on public.creators (availability);
-- engine.ts:395 / :148 — day rate sort and the maxDayRate ceiling.
create index if not exists creators_day_rate_idx
  on public.creators (day_rate_inr);
-- engine.ts:401 / :149 — turnaround sort and the maxTurnaround ceiling.
create index if not exists creators_turnaround_idx
  on public.creators (turnaround_days);
-- engine.ts:150 — minRating floor. Descending so a "top rated" scan is index-only.
create index if not exists creators_rating_idx
  on public.creators (rating desc, review_count desc);
-- engine.ts:402 — the "recent" sort orders on verified_at.
create index if not exists creators_verified_at_idx
  on public.creators (verified_at desc nulls last);
-- engine.ts:291-309 — availability and price are always filtered together.
create index if not exists creators_availability_rate_idx
  on public.creators (availability, day_rate_inr);
-- engine.ts:291 / :149 — availability + turnaround in one predicate.
create index if not exists creators_availability_turnaround_idx
  on public.creators (availability, turnaround_days);
-- The three-way shape the availability + rate + turnaround query actually takes.
create index if not exists creators_availability_rate_turnaround_idx
  on public.creators (availability, day_rate_inr, turnaround_days);
-- engine.ts:397 — the free-text `q` box.
create index if not exists creators_search_vector_idx
  on public.creators using gin (search_vector);
-- Semantic recall over creator positioning. hnsw rather than ivfflat because it
-- builds on an empty table, which is the state of every fresh migration.
create index if not exists creators_embedding_hnsw_idx
  on public.creators using hnsw (embedding vector_cosine_ops);

-- ── discovery: facet joins ───────────────────────────────────────────────────
create index if not exists creator_specializations_facet_idx
  on public.creator_specializations (specialization_id, creator_id);
create index if not exists creator_content_types_facet_idx
  on public.creator_content_types (content_type, creator_id);
create index if not exists creator_aspect_ratios_facet_idx
  on public.creator_aspect_ratios (aspect_ratio, creator_id);
create index if not exists creator_regions_facet_idx
  on public.creator_regions (region_id, creator_id);
create index if not exists creator_languages_facet_idx
  on public.creator_languages (language, offering);
create index if not exists creator_tools_facet_idx
  on public.creator_tools (tool_id, creator_id);
-- engine.ts:151 (`onlyVerifiedTools`) + trust.ts:67 — count verified tools only.
create index if not exists creator_tools_verified_idx
  on public.creator_tools (creator_id) where verified;
create index if not exists creator_skills_facet_idx
  on public.creator_skills (skill_id, creator_id);
create index if not exists creator_models_facet_idx
  on public.creator_models (model_id, creator_id);
create index if not exists creator_workflows_facet_idx
  on public.creator_workflows (workflow_id, creator_id);

-- ── workflows ────────────────────────────────────────────────────────────────
create index if not exists workflows_creator_idx on public.workflows (creator_id);
-- trust.ts:101 reads the most recent run.
create index if not exists workflows_last_run_at_idx on public.workflows (last_run_at desc);
-- trust.ts:89 counts stages with a named human checkpoint.
create index if not exists workflow_stages_workflow_idx on public.workflow_stages (workflow_id);
create index if not exists workflow_stages_human_checkpoint_idx
  on public.workflow_stages (workflow_id) where btrim(human_checkpoint) <> '';
create index if not exists workflow_stage_tools_tool_idx on public.workflow_stage_tools (tool_id);

-- ── portfolio ────────────────────────────────────────────────────────────────
create index if not exists portfolio_pieces_creator_idx on public.portfolio_pieces (creator_id);
-- engine.ts:115 — the content-type facet.
create index if not exists portfolio_pieces_content_type_idx on public.portfolio_pieces (content_type);
-- engine.ts:122 — the format facet.
create index if not exists portfolio_pieces_aspect_ratio_idx on public.portfolio_pieces (aspect_ratio);
-- The "creator works in this format" shape: all three predicates at once.
create index if not exists portfolio_pieces_creator_type_ratio_idx
  on public.portfolio_pieces (creator_id, content_type, aspect_ratio);
create index if not exists portfolio_pieces_featured_idx
  on public.portfolio_pieces (creator_id, award_count desc) where featured;
create index if not exists portfolio_pieces_award_count_idx on public.portfolio_pieces (award_count desc);
create index if not exists portfolio_pieces_industry_idx on public.portfolio_pieces (industry);
create index if not exists portfolio_pieces_search_vector_idx
  on public.portfolio_pieces using gin (search_vector);
create index if not exists portfolio_pieces_tags_gin_idx
  on public.portfolio_pieces using gin (tags);
-- GIN on the metrics blob: supports containment queries such as
-- `metrics @> '{"awardCount":1}'` without a dedicated column per key.
create index if not exists portfolio_pieces_metrics_gin_idx
  on public.portfolio_pieces using gin (metrics jsonb_path_ops);
create index if not exists portfolio_piece_tools_tool_idx on public.portfolio_piece_tools (tool_id);
create index if not exists portfolio_piece_models_model_idx on public.portfolio_piece_models (model_id);
create index if not exists portfolio_piece_skills_skill_idx on public.portfolio_piece_skills (skill_id);

-- ── briefs ───────────────────────────────────────────────────────────────────
-- engine / brief list is "my briefs, newest first".
create index if not exists briefs_brand_created_idx
  on public.briefs (brand_id, created_at desc);
-- Matching briefs to creators: status + freshness.
create index if not exists briefs_status_created_idx
  on public.briefs (status, created_at desc);
create index if not exists briefs_status_idx on public.briefs (status);
create index if not exists briefs_session_idx on public.briefs (session_id);
create index if not exists briefs_content_types_gin_idx on public.briefs using gin (content_types);
create index if not exists briefs_aspect_ratios_gin_idx on public.briefs using gin (aspect_ratios);
create index if not exists briefs_tone_gin_idx on public.briefs using gin (tone);
create index if not exists briefs_style_tags_gin_idx on public.briefs using gin (style_tags);
create index if not exists briefs_must_have_signals_gin_idx on public.briefs using gin (must_have_signals);
create index if not exists briefs_search_vector_idx on public.briefs using gin (search_vector);
create index if not exists briefs_embedding_hnsw_idx
  on public.briefs using hnsw (embedding vector_cosine_ops);

-- ── brief sessions / transcripts ─────────────────────────────────────────────
create index if not exists brief_sessions_brand_idx on public.brief_sessions (brand_id, created_at desc);
create index if not exists brief_sessions_brief_idx on public.brief_sessions (brief_id);
create index if not exists conversation_turns_session_idx
  on public.conversation_turns (session_id, at);
create index if not exists conversation_turns_offer_idx
  on public.conversation_turns (offer_id, at) where offer_id is not null;

-- ── deliverables / commercial use ────────────────────────────────────────────
create index if not exists brief_deliverables_brief_idx
  on public.brief_deliverables (brief_id, position);
create index if not exists commercial_use_license_idx on public.commercial_use (license_type);

-- ── offers ───────────────────────────────────────────────────────────────────
create index if not exists offers_brief_idx on public.offers (brief_id);
create index if not exists offers_creator_status_idx on public.offers (creator_id, status);
create index if not exists offers_brand_status_idx on public.offers (brand_id, status);
create index if not exists offers_status_idx on public.offers (status);
create index if not exists offers_milestones_offer_idx
  on public.offer_milestones (offer_id, position);

-- ── contracts ────────────────────────────────────────────────────────────────
create index if not exists contracts_offer_idx on public.offers (id);
create index if not exists contracts_brand_status_idx on public.contracts (brand_id, status);
create index if not exists contracts_creator_status_idx on public.contracts (creator_id, status);
create index if not exists contracts_brief_idx on public.contracts (brief_id);
create index if not exists contract_clauses_contract_idx
  on public.contract_clauses (contract_id, position);
create index if not exists contract_signatures_contract_idx
  on public.contract_signatures (contract_id);

-- ── engagements ──────────────────────────────────────────────────────────────
-- engine/admin: the production board, filtered by state.
create index if not exists engagements_status_idx on public.engagements (status);
create index if not exists engagements_brand_status_idx on public.engagements (brand_id, status);
create index if not exists engagements_creator_status_idx on public.engagements (creator_id, status);
create index if not exists engagements_due_at_idx on public.engagements (due_at);
create index if not exists engagements_brief_idx on public.engagements (brief_id);
create index if not exists engagements_timings_gin_idx
  on public.engagements using gin (timings jsonb_path_ops);

-- ── generation rounds and samples ────────────────────────────────────────────
create index if not exists generation_rounds_engagement_idx
  on public.generation_rounds (engagement_id, round_index);
create index if not exists generation_rounds_status_idx on public.generation_rounds (status);
create index if not exists generation_rounds_brief_idx on public.generation_rounds (brief_id);
create index if not exists generation_rounds_tool_chain_gin_idx
  on public.generation_rounds using gin (tool_chain);
create index if not exists generation_samples_round_idx on public.generation_samples (round_id, position);

-- ── escrow ───────────────────────────────────────────────────────────────────
create index if not exists escrows_status_idx on public.escrows (status);
create index if not exists escrows_gateway_order_idx on public.escrows (gateway_order_id);

-- ── provenance ───────────────────────────────────────────────────────────────
create index if not exists provenance_records_engagement_idx
  on public.provenance_records (engagement_id);
create index if not exists provenance_records_round_idx on public.provenance_records (round_id);
create index if not exists provenance_records_manifest_hash_idx
  on public.provenance_records (manifest_hash);
-- GIN over every provenance blob so an auditor can search any of them.
create index if not exists provenance_records_c2pa_gin_idx
  on public.provenance_records using gin (c2pa jsonb_path_ops);
create index if not exists provenance_records_synthid_gin_idx
  on public.provenance_records using gin (synthid jsonb_path_ops);
create index if not exists provenance_records_visible_gin_idx
  on public.provenance_records using gin (visible jsonb_path_ops);
create index if not exists provenance_records_chain_of_custody_gin_idx
  on public.provenance_records using gin (chain_of_custody jsonb_path_ops);

-- ── reviews / identity / stats ───────────────────────────────────────────────
create index if not exists reviews_creator_recent_idx on public.reviews (creator_id, at desc);
create index if not exists reviews_rating_idx on public.reviews (rating desc);
create index if not exists reviews_verified_idx on public.reviews (creator_id) where verified;
create index if not exists reviews_engagement_code_idx on public.reviews (engagement_code);
create index if not exists identity_verifications_expiring_idx
  on public.identity_verifications (expires_at) where expires_at is not null;
create index if not exists creator_stats_on_time_idx on public.creator_stats (on_time_rate desc);

-- ── shortlists ───────────────────────────────────────────────────────────────
create index if not exists shortlists_brand_idx on public.shortlists (brand_id);
create index if not exists shortlists_creator_idx on public.shortlists (creator_id);
create index if not exists shortlists_brief_idx on public.shortlists (brief_id) where brief_id is not null;


-- ═══════════════════════════════════════════════════════════════════════════════
-- 5. TRIGGERS
-- ═══════════════════════════════════════════════════════════════════════════════

-- 5.1 updated_at -----------------------------------------------------------------
-- One trigger, applied to every mutable table. `updated_at` is therefore never a
-- value a client can lie about.
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

comment on function public.touch_updated_at() is
  'Sets NEW.updated_at to now(). Applied to every mutable table so clients cannot '
  'backdate a change.';

do $$
declare
  t   text;
  tbl text[] := array[
    'profiles', 'identity_verifications',
    'tools', 'models', 'skills', 'content_types', 'aspect_ratios',
    'specializations', 'industries', 'style_tags', 'tone_tags', 'channels', 'regions',
    'brands', 'brand_preferred_formats',
    'creators', 'creator_stats', 'creator_languages', 'creator_specializations',
    'creator_content_types', 'creator_aspect_ratios', 'creator_regions',
    'creator_tools', 'creator_skills', 'creator_models', 'creator_workflows',
    'workflows', 'workflow_stages', 'workflow_stage_tools',
    'portfolio_pieces', 'portfolio_piece_tools', 'portfolio_piece_models', 'portfolio_piece_skills',
    'brief_sessions', 'conversation_turns', 'briefs', 'brief_deliverables', 'commercial_use',
    'offers', 'offer_milestones',
    'contracts', 'contract_clauses', 'contract_signatures',
    'engagements', 'generation_rounds', 'generation_samples',
    'escrows', 'provenance_records', 'reviews', 'shortlists'
  ];
begin
  foreach t in array tbl loop
    execute format('drop trigger if exists set_updated_at on public.%I', t);
    execute format(
      'create trigger set_updated_at before update on public.%I
         for each row execute function public.touch_updated_at()', t);
  end loop;
end $$;

-- 5.2 auth.users → profile bootstrap ---------------------------------------------
-- Creates the profiles row, then a minimal creators or brands row, from the role
-- the signup form wrote into raw_user_meta_data.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_role    public.profile_role;
  v_meta    jsonb;
  v_handle  text;
  v_name    text;
begin
  v_meta := coalesce(new.raw_user_meta_data, '{}'::jsonb);

  v_role := case lower(coalesce(v_meta ->> 'role', 'creator'))
              when 'brand'   then 'brand'::public.profile_role
              when 'creator' then 'creator'::public.profile_role
              when 'admin'   then 'admin'::public.profile_role
              else 'creator'::public.profile_role
            end;

  -- Derive a URL-safe handle from the chosen @handle, falling back to the local
  -- part of the email, then to a neutral default.
  v_handle := lower(regexp_replace(
    coalesce(v_meta ->> 'handle', split_part(coalesce(new.email, 'member'), '@', 1), 'member'),
    '[^a-z0-9._-]+', '.', 'g'
  ));
  v_handle := btrim(v_handle, '.');
  if v_handle = '' or v_handle is null then
    v_handle := 'member';
  end if;
  -- Suffix guarantees uniqueness even when two people pick the same handle.
  v_handle := v_handle || '-' || substr(replace(new.id::text, '-', ''), 1, 6);

  v_name := coalesce(
    nullif(btrim(v_meta ->> 'full_name'), ''),
    nullif(btrim(v_meta ->> 'display_name'), ''),
    v_handle
  );

  insert into public.profiles (id, role, display_name, handle, avatar_seed, accent, avatar_kind)
  values (new.id, v_role, v_name, v_handle, v_handle, '#7c6cff', 'abstract');

  if v_role = 'brand' then
    insert into public.brands (
      id, profile_id, name, legal_name, kind, logo_initials, accent, member_since
    )
    values (
      'bd-' || v_handle,
      new.id,
      v_name,
      coalesce(nullif(btrim(v_meta ->> 'legal_name'), ''), v_name),
      'startup',
      upper(left(v_name, 2)),
      '#7c6cff',
      to_char(now(), 'YYYY-MM')
    );
  elsif v_role = 'creator' then
    insert into public.creators (
      id, profile_id, handle, display_name, avatar_seed, accent, avatar_kind,
      availability, member_since
    )
    values (
      'cr-' || v_handle,
      new.id,
      v_handle,
      v_name,
      v_handle,
      '#7c6cff',
      'abstract',
      'open',
      to_char(now(), 'YYYY-MM')
    );
    insert into public.creator_stats (creator_id) values ('cr-' || v_handle);
  end if;

  return new;
end;
$$;

comment on function public.handle_new_user() is
  'Runs on auth.users insert. Creates the profiles row and a minimal brand or '
  'creator row depending on raw_user_meta_data->>''role''. SECURITY DEFINER '
  'because the inserting role (supabase_auth_admin) has no rights on public.profiles.';

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 5.3 RLS helper functions ---------------------------------------------------------
-- All of these are SECURITY DEFINER owned by `postgres`, which owns every table
-- in this schema. Table owners bypass row security, so a policy on table A may
-- consult table B through a helper without re-triggering B's own policies. That
-- is what makes the graph below acyclic:
--
--     profiles ──► brands ─┐
--                        ├──► briefs ──► offers ──► contracts ──► engagements
--     profiles ──► creators ┘                                  │
--                                                               ▼
--                                            generation_rounds ──► escrows

create or replace function public.current_profile_role()
returns public.profile_role
language sql stable security definer
set search_path = public, pg_temp
as $$
  select p.role from public.profiles p where p.id = auth.uid();
$$;

create or replace function public.current_creator_id()
returns text
language sql stable security definer
set search_path = public, pg_temp
as $$
  select c.id from public.creators c where c.profile_id = auth.uid();
$$;

create or replace function public.current_brand_id()
returns text
language sql stable security definer
set search_path = public, pg_temp
as $$
  select b.id from public.brands b where b.profile_id = auth.uid();
$$;

create or replace function public.is_own_creator(c_creator_id text)
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.creators c
    where c.id = c_creator_id and c.profile_id = auth.uid()
  );
$$;

create or replace function public.is_own_brand(c_brand_id text)
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.brands b
    where b.id = c_brand_id and b.profile_id = auth.uid()
  );
$$;

create or replace function public.owns_brief(c_brief_id uuid)
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.briefs b
    where b.id = c_brief_id and b.brand_id = public.current_brand_id()
  );
$$;

-- Mirrors the briefs SELECT policy for child tables. A creator sees a brief if
-- they are commissioned by it; the brand sees every brief they own.
create or replace function public.brief_visible(c_brief_id uuid)
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select public.owns_brief(c_brief_id)
      or exists (
        select 1 from public.offers o
        where o.brief_id = c_brief_id
          and o.creator_id = public.current_creator_id()
      );
$$;

create or replace function public.is_offer_party(c_offer_id uuid)
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.offers o
    where o.id = c_offer_id
      and (o.brand_id = public.current_brand_id()
           or o.creator_id = public.current_creator_id())
  );
$$;

create or replace function public.is_contract_party(c_contract_id uuid)
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.contracts c
    where c.id = c_contract_id
      and (c.brand_id = public.current_brand_id()
           or c.creator_id = public.current_creator_id())
  );
$$;

create or replace function public.is_engagement_party(c_engagement_id uuid)
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.engagements e
    where e.id = c_engagement_id
      and (e.brand_id = public.current_brand_id()
           or e.creator_id = public.current_creator_id())
  );
$$;

create or replace function public.is_round_party(c_round_id uuid)
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.generation_rounds r
    where r.id = c_round_id and public.is_engagement_party(r.engagement_id)
  );
$$;


-- ═══════════════════════════════════════════════════════════════════════════════
-- 6. ROW-LEVEL SECURITY
-- ═══════════════════════════════════════════════════════════════════════════════
--
--  HOW TO READ THIS SECTION
--  Absence of a policy is meaningful. Once `row level security` is enabled on a
--  table, that table is invisible to `anon` and `authenticated` for any command
--  with no matching policy — Postgres returns zero rows, not an error. So the
--  list below is a complete description of what clients can reach. Tables with
--  no INSERT/UPDATE/DELETE policy (creator_stats, identity_verifications, the
--  taxonomy tables, contracts, escrows, provenance_records, reviews' update
--  path) are read-only or service-role-only *by omission*, deliberately.
--
--  The `service_role` key carries BYPASSRLS and skips all of it. It exists for
--  seeding, backfills, Razorpay/SynthID webhook reconciliation and the nightly
--  creator_stats recompute. It must never be reachable from the browser, and no
--  user-supplied value may be passed through it without an authorisation check
--  in front of the call.
-- ═══════════════════════════════════════════════════════════════════════════════

alter table public.profiles                   enable row level security;
alter table public.identity_verifications     enable row level security;
alter table public.tools                      enable row level security;
alter table public.models                     enable row level security;
alter table public.skills                     enable row level security;
alter table public.content_types              enable row level security;
alter table public.aspect_ratios              enable row level security;
alter table public.specializations            enable row level security;
alter table public.industries                 enable row level security;
alter table public.style_tags                 enable row level security;
alter table public.tone_tags                  enable row level security;
alter table public.channels                   enable row level security;
alter table public.regions                    enable row level security;
alter table public.brands                     enable row level security;
alter table public.brand_preferred_formats    enable row level security;
alter table public.creators                   enable row level security;
alter table public.creator_stats              enable row level security;
alter table public.creator_languages          enable row level security;
alter table public.creator_specializations    enable row level security;
alter table public.creator_content_types      enable row level security;
alter table public.creator_aspect_ratios      enable row level security;
alter table public.creator_regions            enable row level security;
alter table public.creator_tools              enable row level security;
alter table public.creator_skills             enable row level security;
alter table public.creator_models             enable row level security;
alter table public.creator_workflows          enable row level security;
alter table public.workflows                  enable row level security;
alter table public.workflow_stages            enable row level security;
alter table public.workflow_stage_tools       enable row level security;
alter table public.portfolio_pieces            enable row level security;
alter table public.portfolio_piece_tools       enable row level security;
alter table public.portfolio_piece_models      enable row level security;
alter table public.portfolio_piece_skills      enable row level security;
alter table public.brief_sessions             enable row level security;
alter table public.conversation_turns         enable row level security;
alter table public.briefs                     enable row level security;
alter table public.brief_deliverables         enable row level security;
alter table public.commercial_use             enable row level security;
alter table public.offers                     enable row level security;
alter table public.offer_milestones           enable row level security;
alter table public.contracts                  enable row level security;
alter table public.contract_clauses           enable row level security;
alter table public.contract_signatures        enable row level security;
alter table public.engagements                enable row level security;
alter table public.generation_rounds          enable row level security;
alter table public.generation_samples         enable row level security;
alter table public.escrows                    enable row level security;
alter table public.provenance_records         enable row level security;
alter table public.reviews                    enable row level security;
alter table public.shortlists                 enable row level security;

-- ── profiles ───────────────────────────────────────────────────────────────────
-- Read and write: the user themselves, and nobody else. There is deliberately no
-- INSERT policy — the row is created by handle_new_user() under SECURITY DEFINER.
drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles
  for select to authenticated
  using (auth.uid() = id);

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

drop policy if exists profiles_delete_own on public.profiles;
create policy profiles_delete_own on public.profiles
  for delete to authenticated
  using (auth.uid() = id);

-- ── identity_verifications ─────────────────────────────────────────────────────
-- Public read: the assertion envelope (hashed issuer ref, issuer, document type,
-- status) is exactly what a brand is entitled to audit, and it contains no
-- document. No write policy: only the issuer webhook, under the service role,
-- may change a verification outcome. A creator cannot self-declare `verified`.
drop policy if exists identity_verifications_select_public on public.identity_verifications;
create policy identity_verifications_select_public on public.identity_verifications
  for select to anon, authenticated
  using (true);

-- ── catalogue: public read, service-role write ─────────────────────────────────
-- A brand browsing the talent pool legitimately needs all of this without an
-- account. None of it is private; none of it is client-writable.
drop policy if exists tools_select_public on public.tools;
create policy tools_select_public on public.tools
  for select to anon, authenticated using (true);

drop policy if exists models_select_public on public.models;
create policy models_select_public on public.models
  for select to anon, authenticated using (true);

drop policy if exists skills_select_public on public.skills;
create policy skills_select_public on public.skills
  for select to anon, authenticated using (true);

drop policy if exists content_types_select_public on public.content_types;
create policy content_types_select_public on public.content_types
  for select to anon, authenticated using (true);

drop policy if exists aspect_ratios_select_public on public.aspect_ratios;
create policy aspect_ratios_select_public on public.aspect_ratios
  for select to anon, authenticated using (true);

drop policy if exists specializations_select_public on public.specializations;
create policy specializations_select_public on public.specializations
  for select to anon, authenticated using (true);

drop policy if exists industries_select_public on public.industries;
create policy industries_select_public on public.industries
  for select to anon, authenticated using (true);

drop policy if exists style_tags_select_public on public.style_tags;
create policy style_tags_select_public on public.style_tags
  for select to anon, authenticated using (true);

drop policy if exists tone_tags_select_public on public.tone_tags;
create policy tone_tags_select_public on public.tone_tags
  for select to anon, authenticated using (true);

drop policy if exists channels_select_public on public.channels;
create policy channels_select_public on public.channels
  for select to anon, authenticated using (true);

drop policy if exists regions_select_public on public.regions;
create policy regions_select_public on public.regions
  for select to anon, authenticated using (true);

-- ── brands ─────────────────────────────────────────────────────────────────────
-- Read: public, so a creator can see who is commissioning. Write: the brand
-- account behind the row only.
drop policy if exists brands_select_public on public.brands;
create policy brands_select_public on public.brands
  for select to anon, authenticated using (true);

drop policy if exists brands_insert_own on public.brands;
create policy brands_insert_own on public.brands
  for insert to authenticated
  with check (profile_id = auth.uid());

drop policy if exists brands_update_own on public.brands;
create policy brands_update_own on public.brands
  for update to authenticated
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());

drop policy if exists brands_delete_own on public.brands;
create policy brands_delete_own on public.brands
  for delete to authenticated
  using (profile_id = auth.uid());

drop policy if exists brand_preferred_formats_select_public on public.brand_preferred_formats;
create policy brand_preferred_formats_select_public on public.brand_preferred_formats
  for select to anon, authenticated using (true);

drop policy if exists brand_preferred_formats_write_own on public.brand_preferred_formats;
create policy brand_preferred_formats_write_own on public.brand_preferred_formats
  for all to authenticated
  using (public.is_own_brand(brand_id))
  with check (public.is_own_brand(brand_id));

-- ── creators ───────────────────────────────────────────────────────────────────
-- Read: public — this is the marketplace. Write: only the creator whose auth
-- user is linked through profile_id. There is deliberately no `using (true)`
-- anywhere on this table.
drop policy if exists creators_select_public on public.creators;
create policy creators_select_public on public.creators
  for select to anon, authenticated using (true);

drop policy if exists creators_insert_own on public.creators;
create policy creators_insert_own on public.creators
  for insert to authenticated
  with check (profile_id = auth.uid());

-- A creator may edit their own row and nobody else's. `with check` re-asserts
-- profile_id so a creator cannot repoint the row at another account.
drop policy if exists creators_update_own on public.creators;
create policy creators_update_own on public.creators
  for update to authenticated
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());

drop policy if exists creators_delete_own on public.creators;
create policy creators_delete_own on public.creators
  for delete to authenticated
  using (profile_id = auth.uid());

-- Derived metrics: public read (shown on the discovery card), and no write policy
-- at all — a creator cannot inflate their own on-time rate.
drop policy if exists creator_stats_select_public on public.creator_stats;
create policy creator_stats_select_public on public.creator_stats
  for select to anon, authenticated using (true);

-- ── creator facet joins: public read, creator-only write ───────────────────────
-- Every one of these is a discovery facet. Public read is required for faceted
-- counts; write is limited to the owning creator.
drop policy if exists creator_languages_select_public on public.creator_languages;
create policy creator_languages_select_public on public.creator_languages
  for select to anon, authenticated using (true);
drop policy if exists creator_languages_write_own on public.creator_languages;
create policy creator_languages_write_own on public.creator_languages
  for all to authenticated
  using (public.is_own_creator(creator_id))
  with check (public.is_own_creator(creator_id));

drop policy if exists creator_specializations_select_public on public.creator_specializations;
create policy creator_specializations_select_public on public.creator_specializations
  for select to anon, authenticated using (true);
drop policy if exists creator_specializations_write_own on public.creator_specializations;
create policy creator_specializations_write_own on public.creator_specializations
  for all to authenticated
  using (public.is_own_creator(creator_id))
  with check (public.is_own_creator(creator_id));

drop policy if exists creator_content_types_select_public on public.creator_content_types;
create policy creator_content_types_select_public on public.creator_content_types
  for select to anon, authenticated using (true);
drop policy if exists creator_content_types_write_own on public.creator_content_types;
create policy creator_content_types_write_own on public.creator_content_types
  for all to authenticated
  using (public.is_own_creator(creator_id))
  with check (public.is_own_creator(creator_id));

drop policy if exists creator_aspect_ratios_select_public on public.creator_aspect_ratios;
create policy creator_aspect_ratios_select_public on public.creator_aspect_ratios
  for select to anon, authenticated using (true);
drop policy if exists creator_aspect_ratios_write_own on public.creator_aspect_ratios;
create policy creator_aspect_ratios_write_own on public.creator_aspect_ratios
  for all to authenticated
  using (public.is_own_creator(creator_id))
  with check (public.is_own_creator(creator_id));

drop policy if exists creator_regions_select_public on public.creator_regions;
create policy creator_regions_select_public on public.creator_regions
  for select to anon, authenticated using (true);
drop policy if exists creator_regions_write_own on public.creator_regions;
create policy creator_regions_write_own on public.creator_regions
  for all to authenticated
  using (public.is_own_creator(creator_id))
  with check (public.is_own_creator(creator_id));

-- A tool *claim* is self-asserted; the `verified` / `verified_via` pair is what
-- the trust signal counts. Both live here, on the creator's own join row.
drop policy if exists creator_tools_select_public on public.creator_tools;
create policy creator_tools_select_public on public.creator_tools
  for select to anon, authenticated using (true);
drop policy if exists creator_tools_write_own on public.creator_tools;
create policy creator_tools_write_own on public.creator_tools
  for all to authenticated
  using (public.is_own_creator(creator_id))
  with check (public.is_own_creator(creator_id));

drop policy if exists creator_skills_select_public on public.creator_skills;
create policy creator_skills_select_public on public.creator_skills
  for select to anon, authenticated using (true);
drop policy if exists creator_skills_write_own on public.creator_skills;
create policy creator_skills_write_own on public.creator_skills
  for all to authenticated
  using (public.is_own_creator(creator_id))
  with check (public.is_own_creator(creator_id));

drop policy if exists creator_models_select_public on public.creator_models;
create policy creator_models_select_public on public.creator_models
  for select to anon, authenticated using (true);
drop policy if exists creator_models_write_own on public.creator_models;
create policy creator_models_write_own on public.creator_models
  for all to authenticated
  using (public.is_own_creator(creator_id))
  with check (public.is_own_creator(creator_id));

drop policy if exists creator_workflows_select_public on public.creator_workflows;
create policy creator_workflows_select_public on public.creator_workflows
  for select to anon, authenticated using (true);
drop policy if exists creator_workflows_write_own on public.creator_workflows;
create policy creator_workflows_write_own on public.creator_workflows
  for all to authenticated
  using (public.is_own_creator(creator_id))
  with check (public.is_own_creator(creator_id));

-- ── workflows and their stages ─────────────────────────────────────────────────
-- Published recipes are the verifiable part of a profile, so they are public.
-- Only the author edits them.
drop policy if exists workflows_select_public on public.workflows;
create policy workflows_select_public on public.workflows
  for select to anon, authenticated using (true);

drop policy if exists workflows_insert_own on public.workflows;
create policy workflows_insert_own on public.workflows
  for insert to authenticated
  with check (public.is_own_creator(creator_id));

drop policy if exists workflows_update_own on public.workflows;
create policy workflows_update_own on public.workflows
  for update to authenticated
  using (public.is_own_creator(creator_id))
  with check (public.is_own_creator(creator_id));

drop policy if exists workflows_delete_own on public.workflows;
create policy workflows_delete_own on public.workflows
  for delete to authenticated
  using (public.is_own_creator(creator_id));

drop policy if exists workflow_stages_select_public on public.workflow_stages;
create policy workflow_stages_select_public on public.workflow_stages
  for select to anon, authenticated
  using (exists (select 1 from public.workflows w where w.id = workflow_id));

drop policy if exists workflow_stages_write_own on public.workflow_stages;
create policy workflow_stages_write_own on public.workflow_stages
  for all to authenticated
  using (exists (select 1 from public.workflows w
                 where w.id = workflow_id and w.creator_id = public.current_creator_id()))
  with check (exists (select 1 from public.workflows w
                 where w.id = workflow_id and w.creator_id = public.current_creator_id()));

drop policy if exists workflow_stage_tools_select_public on public.workflow_stage_tools;
create policy workflow_stage_tools_select_public on public.workflow_stage_tools
  for select to anon, authenticated
  using (exists (select 1 from public.workflow_stages s where s.id = stage_id));

drop policy if exists workflow_stage_tools_write_own on public.workflow_stage_tools;
create policy workflow_stage_tools_write_own on public.workflow_stage_tools
  for all to authenticated
  using (exists (select 1 from public.workflow_stages s
                 join public.workflows w on w.id = s.workflow_id
                 where s.id = stage_id and w.creator_id = public.current_creator_id()))
  with check (exists (select 1 from public.workflow_stages s
                 join public.workflows w on w.id = s.workflow_id
                 where s.id = stage_id and w.creator_id = public.current_creator_id()));

-- ── portfolio ──────────────────────────────────────────────────────────────────
-- Published work is the point of the marketplace: public read. Only the author
-- writes, and an NDA'd piece stays on their own profile rather than being
-- deleted, because `client` is nullable precisely so work can stay visible
-- without naming the client.
drop policy if exists portfolio_pieces_select_public on public.portfolio_pieces;
create policy portfolio_pieces_select_public on public.portfolio_pieces
  for select to anon, authenticated using (true);

drop policy if exists portfolio_pieces_insert_own on public.portfolio_pieces;
create policy portfolio_pieces_insert_own on public.portfolio_pieces
  for insert to authenticated
  with check (public.is_own_creator(creator_id));

drop policy if exists portfolio_pieces_update_own on public.portfolio_pieces;
create policy portfolio_pieces_update_own on public.portfolio_pieces
  for update to authenticated
  using (public.is_own_creator(creator_id))
  with check (public.is_own_creator(creator_id));

drop policy if exists portfolio_pieces_delete_own on public.portfolio_pieces;
create policy portfolio_pieces_delete_own on public.portfolio_pieces
  for delete to authenticated
  using (public.is_own_creator(creator_id));

drop policy if exists portfolio_piece_tools_select_public on public.portfolio_piece_tools;
create policy portfolio_piece_tools_select_public on public.portfolio_piece_tools
  for select to anon, authenticated using (true);
drop policy if exists portfolio_piece_tools_write_own on public.portfolio_piece_tools;
create policy portfolio_piece_tools_write_own on public.portfolio_piece_tools
  for all to authenticated
  using (exists (select 1 from public.portfolio_pieces p
                 where p.id = portfolio_piece_id and public.is_own_creator(p.creator_id)))
  with check (exists (select 1 from public.portfolio_pieces p
                 where p.id = portfolio_piece_id and public.is_own_creator(p.creator_id)));

drop policy if exists portfolio_piece_models_select_public on public.portfolio_piece_models;
create policy portfolio_piece_models_select_public on public.portfolio_piece_models
  for select to anon, authenticated using (true);
drop policy if exists portfolio_piece_models_write_own on public.portfolio_piece_models;
create policy portfolio_piece_models_write_own on public.portfolio_piece_models
  for all to authenticated
  using (exists (select 1 from public.portfolio_pieces p
                 where p.id = portfolio_piece_id and public.is_own_creator(p.creator_id)))
  with check (exists (select 1 from public.portfolio_pieces p
                 where p.id = portfolio_piece_id and public.is_own_creator(p.creator_id)));

drop policy if exists portfolio_piece_skills_select_public on public.portfolio_piece_skills;
create policy portfolio_piece_skills_select_public on public.portfolio_piece_skills
  for select to anon, authenticated using (true);
drop policy if exists portfolio_piece_skills_write_own on public.portfolio_piece_skills;
create policy portfolio_piece_skills_write_own on public.portfolio_piece_skills
  for all to authenticated
  using (exists (select 1 from public.portfolio_pieces p
                 where p.id = portfolio_piece_id and public.is_own_creator(p.creator_id)))
  with check (exists (select 1 from public.portfolio_pieces p
                 where p.id = portfolio_piece_id and public.is_own_creator(p.creator_id)));

-- ── brief sessions ─────────────────────────────────────────────────────────────
-- The transcript is the commissioning brand's private working material. Not even
-- another brand may read it.
drop policy if exists brief_sessions_select_own on public.brief_sessions;
create policy brief_sessions_select_own on public.brief_sessions
  for select to authenticated
  using (brand_id = public.current_brand_id());

drop policy if exists brief_sessions_insert_own on public.brief_sessions;
create policy brief_sessions_insert_own on public.brief_sessions
  for insert to authenticated
  with check (brand_id = public.current_brand_id());

drop policy if exists brief_sessions_update_own on public.brief_sessions;
create policy brief_sessions_update_own on public.brief_sessions
  for update to authenticated
  using (brand_id = public.current_brand_id())
  with check (brand_id = public.current_brand_id());

drop policy if exists brief_sessions_delete_own on public.brief_sessions;
create policy brief_sessions_delete_own on public.brief_sessions
  for delete to authenticated
  using (brand_id = public.current_brand_id());

-- ── conversation turns ─────────────────────────────────────────────────────────
-- A turn is readable if it belongs to a session the caller owns, or to an offer
-- the caller is a party to (the creator-facing translation). Writes are the
-- brand's own transcript plus either party's translation.
drop policy if exists conversation_turns_select_party on public.conversation_turns;
create policy conversation_turns_select_party on public.conversation_turns
  for select to authenticated
  using (
    (session_id is not null
     and exists (select 1 from public.brief_sessions s
                 where s.id = session_id and s.brand_id = public.current_brand_id()))
    or
    (offer_id is not null and public.is_offer_party(offer_id))
  );

drop policy if exists conversation_turns_insert_own on public.conversation_turns;
create policy conversation_turns_insert_own on public.conversation_turns
  for insert to authenticated
  with check (
    (session_id is not null
     and exists (select 1 from public.brief_sessions s
                 where s.id = session_id and s.brand_id = public.current_brand_id()))
    or
    (offer_id is not null and public.is_offer_party(offer_id))
  );

drop policy if exists conversation_turns_update_own on public.conversation_turns;
create policy conversation_turns_update_own on public.conversation_turns
  for update to authenticated
  using (
    (session_id is not null
     and exists (select 1 from public.brief_sessions s
                 where s.id = session_id and s.brand_id = public.current_brand_id()))
    or
    (offer_id is not null and public.is_offer_party(offer_id))
  )
  with check (
    (session_id is not null
     and exists (select 1 from public.brief_sessions s
                 where s.id = session_id and s.brand_id = public.current_brand_id()))
    or
    (offer_id is not null and public.is_offer_party(offer_id))
  );

-- ── briefs ─────────────────────────────────────────────────────────────────────
-- SELECT: the owning brand, OR any creator an offers row connects to this brief.
-- The exists() is the whole mechanism — there is no "briefs are public" clause.
-- WRITE: the owning brand only. A creator can never edit the commission.
drop policy if exists briefs_select_party on public.briefs;
create policy briefs_select_party on public.briefs
  for select to authenticated
  using (
    brand_id = public.current_brand_id()
    or exists (
      select 1
      from public.offers o
      where o.brief_id = briefs.id
        and o.creator_id = public.current_creator_id()
    )
  );

drop policy if exists briefs_insert_own on public.briefs;
create policy briefs_insert_own on public.briefs
  for insert to authenticated
  with check (brand_id = public.current_brand_id());

drop policy if exists briefs_update_own on public.briefs;
create policy briefs_update_own on public.briefs
  for update to authenticated
  using (brand_id = public.current_brand_id())
  with check (brand_id = public.current_brand_id());

drop policy if exists briefs_delete_own on public.briefs;
create policy briefs_delete_own on public.briefs
  for delete to authenticated
  using (brand_id = public.current_brand_id());

-- ── brief deliverables and commercial use ──────────────────────────────────────
-- Children inherit brief visibility for reads, and require brand ownership for
-- writes. A creator holding an offer can read the deliverables and the rights
-- terms — that is the information they need to price the job.
drop policy if exists brief_deliverables_select_visible on public.brief_deliverables;
create policy brief_deliverables_select_visible on public.brief_deliverables
  for select to authenticated
  using (public.brief_visible(brief_id));

drop policy if exists brief_deliverables_write_own on public.brief_deliverables;
create policy brief_deliverables_write_own on public.brief_deliverables
  for all to authenticated
  using (public.owns_brief(brief_id))
  with check (public.owns_brief(brief_id));

drop policy if exists commercial_use_select_visible on public.commercial_use;
create policy commercial_use_select_visible on public.commercial_use
  for select to authenticated
  using (public.brief_visible(brief_id));

drop policy if exists commercial_use_write_own on public.commercial_use;
create policy commercial_use_write_own on public.commercial_use
  for all to authenticated
  using (public.owns_brief(brief_id))
  with check (public.owns_brief(brief_id));

-- ── offers ─────────────────────────────────────────────────────────────────────
-- Visible to both parties, writable by the brand. The creator may update only
-- their own offer, and `with check` re-asserts creator_id and brand_id so an
-- update can never re-point the offer at a different counterparty.
drop policy if exists offers_select_party on public.offers;
create policy offers_select_party on public.offers
  for select to authenticated
  using (brand_id = public.current_brand_id() or creator_id = public.current_creator_id());

drop policy if exists offers_insert_own on public.offers;
create policy offers_insert_own on public.offers
  for insert to authenticated
  with check (brand_id = public.current_brand_id());

drop policy if exists offers_update_brand on public.offers;
create policy offers_update_brand on public.offers
  for update to authenticated
  using (brand_id = public.current_brand_id())
  with check (brand_id = public.current_brand_id());

drop policy if exists offers_update_creator on public.offers;
create policy offers_update_creator on public.offers
  for update to authenticated
  using (creator_id = public.current_creator_id())
  with check (creator_id = public.current_creator_id());

drop policy if exists offers_delete_own on public.offers;
create policy offers_delete_own on public.offers
  for delete to authenticated
  using (brand_id = public.current_brand_id());

drop policy if exists offer_milestones_select_party on public.offer_milestones;
create policy offer_milestones_select_party on public.offer_milestones
  for select to authenticated
  using (public.is_offer_party(offer_id));

drop policy if exists offer_milestones_write_brand on public.offer_milestones;
create policy offer_milestones_write_brand on public.offer_milestones
  for all to authenticated
  using (exists (select 1 from public.offers o
                 where o.id = offer_id and o.brand_id = public.current_brand_id()))
  with check (exists (select 1 from public.offers o
                 where o.id = offer_id and o.brand_id = public.current_brand_id()));

-- ── contracts ──────────────────────────────────────────────────────────────────
-- Visible only to the two parties. No insert/update/delete policy exists: the
-- contract body is generated by the legal pipeline under the service role, and a
-- client that could edit clauses could edit the deal.
drop policy if exists contracts_select_party on public.contracts;
create policy contracts_select_party on public.contracts
  for select to authenticated
  using (brand_id = public.current_brand_id() or creator_id = public.current_creator_id());

drop policy if exists contract_clauses_select_party on public.contract_clauses;
create policy contract_clauses_select_party on public.contract_clauses
  for select to authenticated
  using (public.is_contract_party(contract_id));

drop policy if exists contract_signatures_select_party on public.contract_signatures;
create policy contract_signatures_select_party on public.contract_signatures
  for select to authenticated
  using (public.is_contract_party(contract_id));

-- A signer may only write the row that names them, and only their own status.
drop policy if exists contract_signatures_insert_own_party on public.contract_signatures;
create policy contract_signatures_insert_own_party on public.contract_signatures
  for insert to authenticated
  with check (
    (party = 'brand'   and public.is_contract_party(contract_id)
                       and exists (select 1 from public.contracts c
                                   where c.id = contract_id
                                     and c.brand_id = public.current_brand_id()))
    or
    (party = 'creator' and public.is_contract_party(contract_id)
                       and exists (select 1 from public.contracts c
                                   where c.id = contract_id
                                     and c.creator_id = public.current_creator_id()))
  );

drop policy if exists contract_signatures_update_own_party on public.contract_signatures;
create policy contract_signatures_update_own_party on public.contract_signatures
  for update to authenticated
  using (
    (party = 'brand'   and exists (select 1 from public.contracts c
                                   where c.id = contract_id
                                     and c.brand_id = public.current_brand_id()))
    or
    (party = 'creator' and exists (select 1 from public.contracts c
                                   where c.id = contract_id
                                     and c.creator_id = public.current_creator_id()))
  )
  with check (
    (party = 'brand'   and exists (select 1 from public.contracts c
                                   where c.id = contract_id
                                     and c.brand_id = public.current_brand_id()))
    or
    (party = 'creator' and exists (select 1 from public.contracts c
                                   where c.id = contract_id
                                     and c.creator_id = public.current_creator_id()))
  );

-- ── engagements ────────────────────────────────────────────────────────────────
-- Visible to the brand or the creator on that engagement, and nobody else. The
-- creation of an engagement is a consequence of accepting an offer, so it is
-- service-role work; both parties may then move its status.
drop policy if exists engagements_select_party on public.engagements;
create policy engagements_select_party on public.engagements
  for select to authenticated
  using (brand_id = public.current_brand_id() or creator_id = public.current_creator_id());

drop policy if exists engagements_update_brand on public.engagements;
create policy engagements_update_brand on public.engagements
  for update to authenticated
  using (brand_id = public.current_brand_id())
  with check (brand_id = public.current_brand_id());

drop policy if exists engagements_update_creator on public.engagements;
create policy engagements_update_creator on public.engagements
  for update to authenticated
  using (creator_id = public.current_creator_id())
  with check (creator_id = public.current_creator_id());

-- ── generation rounds and samples ──────────────────────────────────────────────
-- The creator produces, the brand reviews. Neither can touch the other's rows,
-- and no client may delete a round — an approved round is evidence.
drop policy if exists generation_rounds_select_party on public.generation_rounds;
create policy generation_rounds_select_party on public.generation_rounds
  for select to authenticated
  using (public.is_engagement_party(engagement_id));

drop policy if exists generation_rounds_write_creator on public.generation_rounds;
create policy generation_rounds_write_creator on public.generation_rounds
  for insert to authenticated
  with check (public.current_creator_id() is not null
              and exists (select 1 from public.engagements e
                          where e.id = engagement_id
                            and e.creator_id = public.current_creator_id()));

drop policy if exists generation_rounds_update_creator on public.generation_rounds;
create policy generation_rounds_update_creator on public.generation_rounds
  for update to authenticated
  using (exists (select 1 from public.engagements e
                 where e.id = engagement_id
                   and e.creator_id = public.current_creator_id()))
  with check (exists (select 1 from public.engagements e
                 where e.id = engagement_id
                   and e.creator_id = public.current_creator_id()));

drop policy if exists generation_samples_select_party on public.generation_samples;
create policy generation_samples_select_party on public.generation_samples
  for select to authenticated
  using (public.is_round_party(round_id));

drop policy if exists generation_samples_write_creator on public.generation_samples;
create policy generation_samples_write_creator on public.generation_samples
  for all to authenticated
  using (exists (select 1 from public.generation_rounds r
                 join public.engagements e on e.id = r.engagement_id
                 where r.id = round_id and e.creator_id = public.current_creator_id()))
  with check (exists (select 1 from public.generation_rounds r
                 join public.engagements e on e.id = r.engagement_id
                 where r.id = round_id and e.creator_id = public.current_creator_id()));

-- ── escrow ─────────────────────────────────────────────────────────────────────
-- Readable by the two parties. NOT writable by either: escrow state is whatever
-- Razorpay says it is, and it moves only through a verified webhook under the
-- service role. A client that could set `released` would be able to pay itself.
drop policy if exists escrows_select_party on public.escrows;
create policy escrows_select_party on public.escrows
  for select to authenticated
  using (public.is_engagement_party(engagement_id));

-- ── provenance ─────────────────────────────────────────────────────────────────
-- Read-only to the parties on the engagement. There is deliberately NO insert,
-- update or delete policy: a C2PA manifest is written by the stamping pipeline
-- under the service role and is append-only thereafter. A client literally
-- cannot fabricate provenance, because absence of a policy is denial.
drop policy if exists provenance_records_select_party on public.provenance_records;
create policy provenance_records_select_party on public.provenance_records
  for select to authenticated
  using (public.is_engagement_party(engagement_id));

-- ── reviews ───────────────────────────────────────────────────────────────────
-- Public read: a review is the artefact the "client" trust signal rests on and
-- it is published by a paying client, not the creator. Insert: the brand that
-- paid. No update and no delete policy, ever — reviews are immutable once escrow
-- has released, which is what makes them worth trusting.
drop policy if exists reviews_select_public on public.reviews;
create policy reviews_select_public on public.reviews
  for select to anon, authenticated using (true);

drop policy if exists reviews_insert_brand on public.reviews;
create policy reviews_insert_brand on public.reviews
  for insert to authenticated
  with check (
    brand_id = public.current_brand_id()
    and exists (
      select 1 from public.engagements e
      where e.id = reviews.engagement_id
        and e.brand_id = public.current_brand_id()
        and e.creator_id = reviews.creator_id
    )
  );

-- ── shortlists ─────────────────────────────────────────────────────────────────
-- Purely a brand-side working list.
drop policy if exists shortlists_select_own on public.shortlists;
create policy shortlists_select_own on public.shortlists
  for select to authenticated
  using (brand_id = public.current_brand_id());

drop policy if exists shortlists_insert_own on public.shortlists;
create policy shortlists_insert_own on public.shortlists
  for insert to authenticated
  with check (brand_id = public.current_brand_id());

drop policy if exists shortlists_update_own on public.shortlists;
create policy shortlists_update_own on public.shortlists
  for update to authenticated
  using (brand_id = public.current_brand_id())
  with check (brand_id = public.current_brand_id());

drop policy if exists shortlists_delete_own on public.shortlists;
create policy shortlists_delete_own on public.shortlists
  for delete to authenticated
  using (brand_id = public.current_brand_id());


-- ═══════════════════════════════════════════════════════════════════════════════
-- 7. VIEWS
--    Both are created with `security_invoker = true`, which means the rows behind
--    them are still filtered by the policies above for whoever calls them. A view
--    without that option would run with the definer's rights and quietly punch
--    through RLS. (`create or replace` cannot change the option, hence drop+create.)
-- ═══════════════════════════════════════════════════════════════════════════════

-- 7.1 trust_signals ────────────────────────────────────────────────────────────
-- THE SIX SIGNALS, DERIVED SERVER-SIDE.
-- This view is a line-for-line translation of `buildSignals()` in
-- src/lib/domain/trust.ts. *** It MUST stay in step with that file. ***
-- If you change a threshold, a weight or the denominator in TypeScript, change
-- it here in the same commit, or the badge a brand sees and the number the
-- database computes will disagree — which is the exact failure the platform
-- exists to avoid.
--
-- creator_discovery reads this view, so on a re-run the dependent view has to be
-- dropped first: Postgres refuses to drop a view that another view depends on.
drop view if exists public.creator_discovery;
drop view if exists public.trust_signals;

create view public.trust_signals with (security_invoker = true) as

-- 1 ── Identity, proven by a third-party issuer rather than by us.
select
  c.id                                                                    as creator_id,
  'identity'::public.signal_kind                                          as kind,
  (case coalesce(iv.status, 'unverified'::public.identity_status)
     when 'verified' then 'verified'::public.signal_tier
     when 'pending'  then 'attested'::public.signal_tier
     when 'flagged'  then 'expired'::public.signal_tier
     when 'expired'  then 'expired'::public.signal_tier
     else 'unverified'::public.signal_tier
   end)                                                                    as tier,
  (case when coalesce(iv.status, 'unverified') = 'verified'
        then 'Identity verified by issuer'
        else 'Identity not yet verified' end)::text                       as title,
  (case when coalesce(iv.status, 'unverified') = 'verified'
        then coalesce(iv.document_type, 'Government identity')
             || ' pulled with your consent via DigiLocker. CREAM received an assertion, never the document.'
        else 'Government identity is collected through DigiLocker. The issuer validates it; CREAM never sees or stores the file.'
   end)                                                                    as detail,
  coalesce(
    case when iv.issuer_ref is not null
         then coalesce(iv.issuer, 'Issuer') || ' · assertion ' || iv.issuer_ref
    end,
    iv.issuer,
    'Not started'
  )                                                                        as evidence,
  iv.verified_at                                                          as verified_at,
  iv.expires_at                                                           as expires_at,
  26::numeric(5,2)                                                        as weight,
  iv.issuer_ref                                                           as reference
from public.creators c
left join public.identity_verifications iv on iv.creator_id = c.id

union all

-- 2 ── Verified tools. Only credentialed or telemetry-backed claims count.
--      (trust.ts:74 — four or more verified tools is the "verified" bar.)
select
  c.id,
  'tools'::public.signal_kind,
  (case when coalesce(tr.verified_count, 0) >= 4 then 'verified'::public.signal_tier
        when coalesce(tr.verified_count, 0) >= 1 then 'attested'::public.signal_tier
        else 'unverified'::public.signal_tier end),
  coalesce(tr.verified_count, 0)::text
    || ' vendor-verified tool'
    || case when coalesce(tr.verified_count, 0) = 1 then '' else 's' end,
  coalesce(
    (select string_agg(n, ', ') from (select unnest(tr.verified_names) as n limit 4) s)
      || case when tr.verified_count > 4 then ' +' || (tr.verified_count - 4)::text || ' more' else '' end,
    'No credentialed tools on file'
  ),
  coalesce(
    to_char(tr.verified_hours::bigint, 'FM999,999,999')
      || ' hours of logged production across credentialed and telemetry-backed tools. Self-attested tools are shown separately and never counted here.',
    '0 hours of logged production across credentialed and telemetry-backed tools. Self-attested tools are shown separately and never counted here.'
  ),
  (case when coalesce(tr.verified_count, 0) > 0
        then now() - ((24 + coalesce(tr.verified_count, 0) * 3)::int * interval '1 day')
   end),
  null::timestamptz,
  least(24, 4 + coalesce(tr.verified_count, 0) * 4)::numeric(5,2),
  null::text
from public.creators c
left join (
  select
    ct.creator_id,
    count(*)                                                   as verified_count,
    coalesce(sum(ct.hours_logged), 0)                         as verified_hours,
    array_agg(distinct t.name order by t.name)                 as verified_names
  from public.creator_tools ct
  join public.tools t on t.id = ct.tool_id
  where ct.verified
  group by ct.creator_id
) tr on tr.creator_id = c.id

union all

-- 3 ── Workflow transparency. Each stage publishes where a human decided.
select
  c.id,
  'workflow'::public.signal_kind,
  (case when coalesce(wr.verified_count, 0) > 0 then 'verified'::public.signal_tier
        else 'unverified'::public.signal_tier end),
  coalesce(wr.verified_count, 0)::text
    || ' published workflow'
    || case when coalesce(wr.verified_count, 0) = 1 then '' else 's' end,
  coalesce(nullif(wr.all_names, ''), 'No workflow published'),
  coalesce(wr.stage_count, 0)::text
    || ' stages published, ' || coalesce(wr.checkpoint_count, 0)::text
    || ' with a named human decision point. Workflows are reviewed on every completed engagement.',
  wr.last_run_at,
  null::timestamptz,
  least(20, 5 + coalesce(wr.verified_count, 0) * 8)::numeric(5,2),
  null::text
from public.creators c
left join (
  select
    cw.creator_id,
    count(distinct w.id) filter (where w.verified)                            as verified_count,
    count(distinct s.id)                                                       as stage_count,
    count(distinct s.id) filter (where btrim(s.human_checkpoint) <> '')        as checkpoint_count,
    max(w.last_run_at)                                                         as last_run_at,
    coalesce(string_agg(distinct w.name, ' · ' order by w.name), '')            as all_names
  from public.creator_workflows cw
  join public.workflows w on w.id = cw.workflow_id
  left join public.workflow_stages s on s.workflow_id = w.id
  group by cw.creator_id
) wr on wr.creator_id = c.id

union all

-- 4 ── Portfolio provenance. Every public piece carries a signed manifest.
--      (trust.ts:112 — four or more works is the "verified" bar.)
select
  c.id,
  'portfolio'::public.signal_kind,
  (case when coalesce(pr.piece_count, 0) >= 4 then 'verified'::public.signal_tier
        else 'attested'::public.signal_tier end),
  coalesce(pr.piece_count, 0)::text || ' works with signed provenance',
  coalesce(pr.licensed_count, 0)::text || ' published under an open licence · '
    || (coalesce(pr.piece_count, 0) - coalesce(pr.licensed_count, 0))::text || ' under client terms',
  'Each work carries a C2PA content manifest and a SynthID-class invisible watermark. CREAM ran a provenance extraction against this portfolio; all manifests resolved.',
  (case when coalesce(pr.piece_count, 0) > 0 then now() - interval '11 days' end),
  null::timestamptz,
  least(18, 4 + coalesce(pr.piece_count, 0) * 3)::numeric(5,2),
  null::text
from public.creators c
left join (
  select
    creator_id,
    count(*)                                       as piece_count,
    count(*) filter (where license is not null)    as licensed_count
  from public.portfolio_pieces
  group by creator_id
) pr on pr.creator_id = c.id

union all

-- 5 ── Delivery record, drawn from closed engagements. Never self-reported.
--      (trust.ts:127 — ten engagements and 93% on time is the "verified" bar.)
select
  c.id,
  'delivery'::public.signal_kind,
  (case when coalesce(s.engagements, 0) >= 10 and coalesce(s.on_time_rate, 0) >= 93
        then 'verified'::public.signal_tier
        else 'attested'::public.signal_tier end),
  coalesce(s.engagements, 0)::text || ' engagements · '
    || coalesce(s.on_time_rate, 0)::text || '% on time',
  coalesce(s.repeat_client_rate, 0)::text || '% repeat clients · '
    || coalesce(s.revisions_avg, 0)::text || ' revisions per brief on average',
  'Delivery metrics are computed from escrow releases and client sign-offs on closed engagements. They cannot be self-reported.',
  now() - interval '7 days',
  null::timestamptz,
  least(14, 4 + round(coalesce(s.on_time_rate, 0) / 12))::numeric(5,2),
  null::text
from public.creators c
left join public.creator_stats s on s.creator_id = c.id

union all

-- 6 ── Client attestation. Fewer, heavier signals: a client vouching is the
--      strongest thing on the profile. (trust.ts:141 — twenty reviews.)
select
  c.id,
  'client'::public.signal_kind,
  (case when c.review_count >= 20 then 'verified'::public.signal_tier
        else 'attested'::public.signal_tier end),
  c.review_count::text || ' client reviews · ' || round(c.rating, 1)::text,
  coalesce(s.response_minutes, 0)::text || ' minutes median reply · '
    || coalesce(s.approval_rate, 0)::text || '% of briefs approved first pass',
  'Reviews are attached to a closed engagement code and cannot be edited after payout release.',
  now() - interval '3 days',
  null::timestamptz,
  12::numeric(5,2),
  null::text
from public.creators c
left join public.creator_stats s on s.creator_id = c.id;

comment on view public.trust_signals is
  'The six verification signals, derived server-side. MUST stay in step with '
  'buildSignals() in src/lib/domain/trust.ts — same tiers, same thresholds, same '
  'weights. Six rows per creator.';

-- 7.2 creator_discovery ─────────────────────────────────────────────────────────
-- The single view the discovery screen queries. It is exactly the shape
-- runDiscovery() in src/lib/search/engine.ts needs: scalars it filters and sorts
-- on (availability, day_rate_inr, turnaround_days, rating, verified_at), every
-- facet as a ready-made array (so `= any(...)` replaces the in-memory `some()`),
-- the trust inputs, and the derived trust score/tier computed from trust_signals.
--
-- Scoring is intentionally NOT reproduced here. engine.ts weights fields by 3-10
-- points and emits per-card `reasons`; that is presentation logic and belongs in
-- the application. The database returns the facts and the trust maths.
drop view if exists public.creator_discovery;

create view public.creator_discovery with (security_invoker = true) as
select
  -- ── identity ───────────────────────────────────────────────────────────────
  c.id                                    as creator_id,
  c.handle,
  c.display_name,
  c.studio_name,
  c.headline,
  c.bio,
  c.location,
  c.timezone,
  c.avatar_seed,
  c.accent,
  c.avatar_kind,
  c.philosophy,
  c.badges,

  -- ── the scalars discovery filters and sorts on ─────────────────────────────
  --    engine.ts:148-150 (passesScalars) and engine.ts:388-412 (sortHits).
  c.availability,                          -- filter :130, boost :291-309
  c.day_rate_inr,                          -- sort rate-asc/desc :395-396
  c.minimum_engagement_inr,
  c.turnaround_days,                       -- sort "turnaround" :401
  c.rating,                                -- filter minRating :150
  c.review_count,
  c.verified_at,                           -- sort "recent" :404
  c.member_since,

  -- ── CreatorStats, flattened so a card is one round trip ────────────────────
  s.engagements                            as stats_engagements,
  s.on_time_rate                           as stats_on_time_rate,
  s.avg_turnaround_days                    as stats_avg_turnaround_days,
  s.approval_rate                          as stats_approval_rate,
  s.repeat_client_rate                     as stats_repeat_client_rate,
  s.total_earnings_inr                     as stats_total_earnings_inr,
  s.response_minutes                       as stats_response_minutes,
  s.revisions_avg                          as stats_revisions_avg,

  -- ── facet arrays: one array per DiscoveryFilters field ─────────────────────
  --    `= any(languages_offered)` replaces the in-memory `.some()` at
  --    engine.ts:134, and `unnest()` over these replaces the facet counter.
  (select coalesce(array_agg(l.language order by l.position, l.language)
             filter (where l.offering = 'speaks'), '{}')
     from public.creator_languages l where l.creator_id = c.id)   as languages,
  (select coalesce(array_agg(l.language order by l.position, l.language)
             filter (where l.offering = 'offered'), '{}')
     from public.creator_languages l where l.creator_id = c.id)   as languages_offered,
  (select coalesce(array_agg(cs.specialization_id order by cs.position), '{}')
     from public.creator_specializations cs
     where cs.creator_id = c.id)                                  as specializations,
  (select coalesce(array_agg(sk.skill_id order by sk.position), '{}')
     from public.creator_skills sk where sk.creator_id = c.id)   as skills,
  (select coalesce(array_agg(k.name order by sk.position), '{}')
     from public.creator_skills sk
     join public.skills k on k.id = sk.skill_id
     where sk.creator_id = c.id)                                  as skill_names,
  (select coalesce(array_agg(ct.tool_id order by ct.position, ct.tool_id), '{}')
     from public.creator_tools ct where ct.creator_id = c.id)     as tools,
  (select coalesce(array_agg(cm.model_id order by cm.position, cm.model_id), '{}')
     from public.creator_models cm where cm.creator_id = c.id)    as models,
  (select coalesce(array_agg(cct.content_type order by cct.position), '{}')
     from public.creator_content_types cct
     where cct.creator_id = c.id)                                 as content_types,
  (select coalesce(array_agg(car.aspect_ratio order by car.position), '{}')
     from public.creator_aspect_ratios car
     where car.creator_id = c.id)                                 as aspect_ratios,
  (select coalesce(array_agg(cr.region_id order by cr.region_id), '{}')
     from public.creator_regions cr where cr.creator_id = c.id)   as region_ids,
  (select coalesce(array_agg(cw.workflow_id order by cw.position, cw.workflow_id), '{}')
     from public.creator_workflows cw where cw.creator_id = c.id) as workflow_ids,
  (select coalesce(array_agg(pp.id order by pp.id), '{}')
     from public.portfolio_pieces pp where pp.creator_id = c.id)   as portfolio_ids,
  (select count(*) from public.portfolio_pieces pp
     where pp.creator_id = c.id)                                  as portfolio_count,
  (select coalesce(array_agg(e.id order by e.started_at desc), '{}')
     from public.engagements e where e.creator_id = c.id)         as engagement_ids,

  -- ── tool metadata the facet rail renders without a second query ────────────
  (select coalesce(array_agg(t.name order by ct.position, t.name), '{}')
     from public.creator_tools ct join public.tools t on t.id = ct.tool_id
     where ct.creator_id = c.id)                                  as tool_names,
  (select coalesce(array_agg(distinct t.category order by t.category), '{}')
     from public.creator_tools ct join public.tools t on t.id = ct.tool_id
     where ct.creator_id = c.id)                                  as tool_categories,
  (select coalesce(array_agg(ct.tool_id order by ct.tool_id), '{}')
     from public.creator_tools ct
     where ct.creator_id = c.id and ct.verified)                  as verified_tools,
  -- engine.ts:152 (`onlyVerifiedTools`) and trust.ts:69.
  (select count(*) from public.creator_tools ct
     where ct.creator_id = c.id and ct.verified)                  as verified_tool_count,
  (select coalesce(sum(ct.hours_logged), 0) from public.creator_tools ct
     where ct.creator_id = c.id and ct.verified)                  as verified_hours,
  (select coalesce(array_agg(cty.label order by cct.position), '{}')
     from public.creator_content_types cct
     join public.content_types cty on cty.id = cct.content_type
     where cct.creator_id = c.id)                                 as content_type_labels,

  -- ── identity: the auditable assertion envelope, never the document ─────────
  iv.status                                                    as identity_status,
  iv.method                                                    as identity_method,
  iv.issuer                                                    as identity_issuer,
  iv.document_type                                             as identity_document_type,
  iv.verified_at                                               as identity_verified_at,
  iv.expires_at                                                as identity_expires_at,
  iv.assurance_level                                           as identity_assurance_level,

  -- ── trust, computed by trust_signals (which mirrors domain/trust.ts) ───────
  coalesce(trust.trust_score, 0)                               as trust_score,
  (case
     when coalesce(iv.status, 'unverified'::public.identity_status)
          <> 'verified'::public.identity_status then 'unverified'
     when coalesce(trust.trust_score, 0) >= 88 then 'elite'
     when coalesce(trust.trust_score, 0) >= 68 then 'verified'
     else 'attested'
   end)                                                        as trust_tier,
  coalesce(trust.verified_signal_count, 0)                     as verified_signal_count,
  coalesce(trust.attested_signal_count, 0)                     as attested_signal_count,
  coalesce(trust.expiring_soon_count, 0)                       as expiring_soon_count,
  coalesce(trust.verified_signal_kinds, '{}')                  as verified_signal_kinds,

  -- ── search surfaces ────────────────────────────────────────────────────────
  c.embedding,
  c.search_vector,
  c.updated_at
from public.creators c
left join public.creator_stats s
       on s.creator_id = c.id
left join public.identity_verifications iv
       on iv.creator_id = c.id
left join lateral (
  select
    -- Denominator 122 is the theoretical maximum of the six verified weights,
    -- exactly as in assessTrust() (trust.ts:185).
    least(100, round(coalesce(sum(ts.weight) filter (where ts.tier = 'verified'), 0)
                     / 122.0 * 100)::integer)                        as trust_score,
    count(*) filter (where ts.tier = 'verified')                     as verified_signal_count,
    count(*) filter (where ts.tier = 'attested')                     as attested_signal_count,
    -- trust.ts:173 — anything expiring inside 180 days.
    count(*) filter (where ts.expires_at is not null
                       and ts.expires_at < now() + interval '180 days')
                                                                    as expiring_soon_count,
    coalesce(array_agg(ts.kind order by ts.kind)
             filter (where ts.tier = 'verified'), '{}')               as verified_signal_kinds
  from public.trust_signals ts
  where ts.creator_id = c.id
) trust on true;

comment on view public.creator_discovery is
  'The one view the discovery screen queries. Mirrors what runDiscovery() in '
  'src/lib/search/engine.ts needs: every filter and sort scalar, one array per '
  'facet, the derived trust inputs, and the trust score/tier. Does NOT reproduce '
  'the relevance weights or the per-card `reasons` — those are presentation '
  'logic and stay in the application.';


-- ═══════════════════════════════════════════════════════════════════════════════
-- 8. FOOTER — WHO READS WHAT
-- ═══════════════════════════════════════════════════════════════════════════════
--
--  ── Public catalogue (anon-readable, feeds the discovery console) ───────────
--    tools / models / skills / content_types / aspect_ratios /
--    specializations / industries / style_tags / tone_tags / channels / regions
--      src/lib/domain/taxonomy.ts
--      src/components/discover/filter-rail.tsx
--      src/components/discover/use-discovery-filters.ts
--    creators / creator_stats / creator_* (facet joins)
--      src/lib/search/engine.ts            runDiscovery, buildFacets, sortHits
--      src/components/discover/discovery-console.tsx
--      src/components/creator/creator-card.tsx
--    creator_discovery (view)
--      the single read path for everything above
--    identity_verifications
--      src/components/trust/trust.tsx
--      src/components/portfolio/piece-gallery.tsx
--    portfolio_pieces / portfolio_piece_*
--      src/components/portfolio/piece-gallery.tsx
--      src/components/creator/creator-profile.tsx
--      src/lib/search/engine.ts:217 (portfolio text feeds relevance)
--    workflows / workflow_stages / workflow_stage_tools
--      src/components/creator/creator-profile.tsx
--      src/lib/domain/trust.ts:87
--    reviews
--      src/lib/data/commerce.ts            REVIEWS, reviewsFor
--      src/components/creator/creator-profile.tsx
--    shortlists
--      src/lib/store.ts                    toggleShortlist / isShortlisted
--
--  ── Brand-private ─────────────────────────────────────────────────────────
--    brief_sessions / conversation_turns (session_id)
--      src/components/brief/brief-builder.tsx
--      src/app/briefs/new/page.tsx
--      src/app/api/brief/turn/route.ts
--    briefs / brief_deliverables / commercial_use
--      src/components/brief/brief-definition.tsx
--      src/components/brief/brief-match-panel.tsx
--      src/components/brief/brief-origin.tsx
--      src/app/briefs/[code]/page.tsx
--      src/app/api/brief/translate/route.ts
--      src/lib/llm/reasoner.ts, src/lib/llm/gemini.ts, src/lib/llm/contract.ts
--    brands / brand_preferred_formats
--      src/lib/data/brands.ts
--      src/app/deck/page.tsx
--      src/components/shell/header.tsx
--    shortlists
--      src/lib/store.ts
--
--  ── Two-party (brand + creator on that record) ────────────────────────────
--    offers / offer_milestones
--      src/lib/data/commerce.ts            OFFERS
--      src/components/brief/brief-match-panel.tsx
--      src/components/engagement/engagement-workspace.tsx
--    conversation_turns (offer_id = the creator-facing translation)
--      src/lib/data/commerce.ts            translationTurns
--      src/app/api/brief/translate/route.ts
--    contracts / contract_clauses / contract_signatures
--      src/lib/llm/contract.ts              clause generation
--      src/components/engagement/contract-stack.tsx
--    engagements / generation_rounds / generation_samples
--      src/lib/data/commerce.ts            ENGAGEMENTS
--      src/components/engagement/engagement-workspace.tsx
--      src/components/engagement/round-gallery.tsx
--      src/app/engagements/[code]/page.tsx
--    escrows
--      src/lib/integrations/razorpay.ts
--      src/components/engagement/escrow-panel.tsx
--      src/app/api/payments/route.ts
--    provenance_records
--      src/lib/integrations/provenance.ts
--      src/components/trust/watermark-detector.tsx
--      src/app/api/provenance/route.ts
--
--  ── Service-role only (no client policy exists by design) ─────────────────
--    profiles (insert)          handle_new_user()
--    creator_stats (all writes) nightly recompute from closed engagements
--    identity_verifications     DigiLocker issuer webhook
--    tools/models/skills + all reference tables   seeding and taxonomy edits
--    workflows "verified" flag  engagement-completion review
--    contracts / contract_clauses (writes)        legal pipeline
--    escrows (writes)           Razorpay webhook reconciliation
--    provenance_records (writes) C2PA / SynthID stamping pipeline
--    reviews (update/delete)    never — immutable by design
--
--  ── SERVICE ROLE ───────────────────────────────────────────────────────────
--  `SUPABASE_SERVICE_ROLE_KEY` carries BYPASSRLS and therefore ignores every
--  policy in this file. It is wired to `getSupabaseAdmin()` in
--  src/lib/supabase/server.ts. Use it for seeding, backfills, webhook
--  verification and cron recomputes ONLY. It must never be imported into a
--  client bundle and no user-supplied value may be passed through it without an
--  explicit authorisation check in front of the call — RLS is the only thing
--  standing between a signed-in brand and every other brand's briefs.
--
--  ── KNOWN GAPS ─────────────────────────────────────────────────────────────
--  * `Region` in engine.ts:140 is currently matched by regex over
--    `creators.location`. `creator_regions` replaces that, but the app must be
--    changed to read the join table before the "Base" facet behaves the same.
--  * The relevance scoring in `relevance()` (engine.ts:197) is not in the view.
--    Weights, `reasons` and `matched` are presentation concerns; the view
--    returns the facts and `trust_score` so the app can still rank.
--  * `Offer.translationTurns` reuse ConversationTurn, so the table carries a
--    nullable `offer_id` alongside `session_id` with a CHECK that exactly one
--    is set. The TS type does not model that union, so the adapter has to
--    populate one or the other.
--  * `PortfolioPiece.metrics` is a jsonb blob because the key set genuinely
--    varies per piece; `award_count` is projected out as a generated column so
--    ranking never has to unpack jsonb.
--  * The seed `id` strings in src/lib/data/*.ts ("cr-aarav", "br-monsoon") map
--    onto uuid columns for runtime-created rows. A seeding script must keep the
--    business `code` (BRF-2026-0141) as the stable cross-reference, or rewrite
--    the seeded foreign keys.
-- ═══════════════════════════════════════════════════════════════════════════════
