export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  Boxes,
  FileSignature,
  Fingerprint,
  GitBranch,
  Layers,
  Lock,
  Milestone,
  ScanText,
  Search,
  ShieldCheck,
  Tag,
  Workflow as WorkflowIcon,
} from "lucide-react";
import {
  getBrands,
  getBriefs,
  getContracts,
  getCreators,
  getEngagements,
  getEscrows,
  getOffers,
  getPortfolio,
  getProvenance,
  getReviews,
  getWorkflows,
} from "@/lib/data";
import { activeSource } from "@/lib/data";
import { DatasetEmpty, missingTables } from "@/components/system/dataset-empty";
import {
  CHANNELS,
  INDUSTRIES,
  MODELS,
  REGIONS,
  SKILL_TAXONOMY,
  SPECIALIZATIONS,
  STYLE_TAGS,
  TONE_TAGS,
  TOOLS,
  TOOL_CATEGORY_LABEL,
} from "@/lib/domain/taxonomy";
import {
  ASPECT_RATIOS,
  CONTENT_TYPES,
  CONTENT_TYPE_META,
  SKILL_CATEGORY_LABEL,
  type SkillCategory,
  type ToolCategory,
} from "@/lib/domain/types";
import { SIGNAL_META, createTrustEngine } from "@/lib/domain/trust";
import { Reveal, Section, SectionHead, Stagger, StaggerItem } from "@/components/shared/motion";
import { Badge } from "@/components/ui/primitives";
import { compactInr, compactNumber, pct, rupees } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Data model note",
  description:
    "A field-by-field note on the CREAM profile and brief data model: entities, relations, commercial-use struct, taxonomy counts and retrieval.",
};

/* ── static constants ───────────────────────────────────────────────────────── */

const TOOL_BY_CATEGORY = (Object.keys(TOOL_CATEGORY_LABEL) as ToolCategory[]).map((key) => ({
  key,
  label: TOOL_CATEGORY_LABEL[key],
  items: TOOLS.filter((t) => t.category === key),
}));

const SKILL_BY_CATEGORY = (Object.keys(SKILL_CATEGORY_LABEL) as SkillCategory[]).map((key) => ({
  key,
  label: SKILL_CATEGORY_LABEL[key],
  items: SKILL_TAXONOMY.filter((s) => s.category === key),
}));

const LICENSE_LADDER: { id: string; label: string; mult: number; note: string }[] = [
  { id: "non-exclusive", label: "non-exclusive", mult: 1, note: "Everyone may hold this licence" },
  { id: "exclusive-category", label: "exclusive-category", mult: 1.9, note: "Creator may not license a rival in the same category" },
  { id: "exclusive-territory", label: "exclusive-territory", mult: 3.1, note: "No other brand in the named territories" },
  { id: "buyout-full", label: "buyout-full", mult: 5, note: "The work leaves the creator's hands entirely" },
];

/* ── primitives ────────────────────────────────────────────────────────────── */

function Row({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`grid gap-x-5 gap-y-2 border-t border-line px-1 py-3.5 md:grid-cols-[minmax(150px,1fr)_minmax(120px,0.85fr)_2fr] md:items-baseline ${className ?? ""}`}
    >
      {children}
    </div>
  );
}

function RowHead({ children }: { children: ReactNode }) {
  return (
    <div className="hidden border-b border-line-strong pb-2.5 md:grid md:grid-cols-[minmax(150px,1fr)_minmax(120px,0.85fr)_2fr] md:gap-x-5">
      {children}
    </div>
  );
}

function Fn({ children }: { children: ReactNode }) {
  return <span className="font-mono text-[12.5px] text-caramel">{children}</span>;
}

function Ty({ children }: { children: ReactNode }) {
  return <span className="font-mono text-[11px] leading-snug text-ink-faint">{children}</span>;
}

function FieldTable({
  rows,
}: {
  rows: { field: string; type: string; why: string; sample?: ReactNode }[];
}) {
  return (
    <div className="font-sans">
      <RowHead>
        <span className="label-xs">Field</span>
        <span className="label-xs">Type</span>
        <span className="label-xs">Why this field exists</span>
      </RowHead>
      <div className="font-mono text-[11px] text-ink-faint">
        {rows.map((r) => (
          <Row key={r.field}>
            <Fn>{r.field}</Fn>
            <Ty>{r.type}</Ty>
            <div className="font-sans">
              <p className="text-[13.5px] leading-relaxed text-ink-2">{r.why}</p>
              {r.sample && (
                <p className="mt-1.5 font-mono text-[11px] leading-relaxed text-ink-faint">
                  {r.sample}
                </p>
              )}
            </div>
          </Row>
        ))}
      </div>
    </div>
  );
}

function EntityNode({
  name,
  fields,
  tone = "caramel",
  icon: Icon,
}: {
  name: string;
  fields: string;
  tone?: "caramel" | "violet" | "mint" | "rose";
  icon: typeof Boxes;
}) {
  const toneClass = {
    caramel: "text-caramel border-caramel/35 bg-caramel/[0.07]",
    violet: "text-violet border-violet/35 bg-violet/[0.07]",
    mint: "text-mint border-mint/35 bg-mint/[0.07]",
    rose: "text-rose border-rose/35 bg-rose/[0.07]",
  }[tone];
  return (
    <div className="rounded-lg border border-line bg-surface p-4 shadow-e1 transition-colors hover:border-line-strong">
      <div className="flex items-center gap-2.5">
        <span className={`grid size-7 shrink-0 place-items-center rounded-md border ${toneClass}`}>
          <Icon className="size-3.5" />
        </span>
        <span className="font-mono text-[12.5px] tracking-tight text-ink">{name}</span>
      </div>
      <div className="mt-3 font-mono text-[10.5px] leading-[1.7] text-ink-faint">{fields}</div>
    </div>
  );
}

function Edge({ label, kind }: { label: string; kind?: "fork" }) {
  return (
    <div className="relative flex items-center justify-center py-3">
      <span aria-hidden className="absolute inset-x-[12%] h-px bg-line" />
      <span
        aria-hidden
        className={`absolute size-1.5 rotate-45 border-r border-b border-line-strong ${
          kind === "fork" ? "right-[12%]" : "left-1/2 -translate-x-1/2"
        }`}
        style={{ bottom: "calc(50% - 5px)" }}
      />
      <span className="relative z-10 rounded-full border border-line bg-bg-deep px-3 py-1 font-mono text-[9.5px] uppercase tracking-[0.14em] text-ink-faint">
        {label}
      </span>
    </div>
  );
}

function Branch({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 py-1">
      <span aria-hidden className="h-px w-6 shrink-0 bg-line-strong" />
      <span className="font-mono text-[9.5px] uppercase tracking-[0.13em] text-ink-faint">{label}</span>
    </div>
  );
}

function Count({ n, label }: { n: ReactNode; label: string }) {
  return (
    <div>
      <div className="font-display text-[34px] leading-none tracking-[-0.03em] text-ink">{n}</div>
      <div className="label-xs mt-2.5">{label}</div>
    </div>
  );
}

function TaxonomyBlock({
  title,
  count,
  caption,
  children,
}: {
  title: string;
  count: number;
  caption: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-line bg-surface/60 p-5">
      <div className="flex items-baseline justify-between gap-4 border-b border-line pb-3">
        <h3 className="font-mono text-[12.5px] text-ink">{title}</h3>
        <span className="font-mono text-[11px] text-caramel">{count}</span>
      </div>
      <p className="mt-2.5 text-[12.5px] leading-relaxed text-ink-faint">{caption}</p>
      <div className="mt-4">{children}</div>
    </div>
  );
}

/* ── page ──────────────────────────────────────────────────────────────────── */

export default async function ModelNotePage() {
  const [
    creators,
    portfolio,
    briefs,
    workflows,
    brands,
    offers,
    escrows,
    provenance,
    contracts,
    engagements,
    reviews,
  ] = await Promise.all([
    getCreators(),
    getPortfolio(),
    getBriefs(),
    getWorkflows(),
    getBrands(),
    getOffers(),
    getEscrows(),
    getProvenance(),
    getContracts(),
    getEngagements(),
    getReviews(),
  ]);

  const trust = createTrustEngine({
    portfolio,
    workflows: new Map(workflows.map((w) => [w.id, w])),
  });

  // The data-model note walks one concrete brief through the whole graph:
  // brief, creator, offer, escrow, provenance record, contract, engagement and
  // one specific revision round. Every one of those is indexed at position 0 or
  // 1, which is only safe when the dataset is populated.
  const empty = missingTables({
    briefs,
    creators,
    offers,
    escrows,
    provenance_records: provenance,
    contracts,
    engagements,
    workflows,
  });
  if (empty.length) return <DatasetEmpty missing={empty} source={activeSource()} />;

  const MONSOON = briefs[0];
  const AARAV = creators[0];
  const ACCEPTED = offers[0];
  const ESCROW = escrows[0];
  const PROV = provenance[0];
  const START_CONTRACT =
    contracts.find((c) => c.kind === "engagement-start") ?? contracts[0];
  // The page illustrates a *second* round — the revision step is the point of
  // the note. An engagement with a single round cannot illustrate it.
  const ROUND = engagements[0].rounds[1] ?? engagements[0].rounds[0];
  const STAGE = workflows[0].stages;

  const ELITE = [...creators].sort((a, b) => trust.assess(b).score - trust.assess(a).score)[0];
  const ELITE_ASSESSMENT = trust.assess(ELITE);
  const ELITE_SIGNALS = trust.signalsFor(ELITE);

  const stageTotal = STAGE.reduce((s, x) => s + x.weight, 0);
  const deliverableSeconds = MONSOON.deliverables.reduce(
    (s, d) => s + d.quantity * (d.durationSeconds ?? 0),
    0,
  );
  const deliverableCount = MONSOON.deliverables.reduce((s, d) => s + d.quantity, 0);
  // "d3" is a seeded literal. A brief created in the app will not have it, so
  // fall back to the largest still rather than asserting a row exists.
  const stillCount =
    MONSOON.deliverables.find((d) => d.id === "d3")?.quantity ??
    Math.max(0, ...MONSOON.deliverables.map((d) => d.quantity));

  return (
    <>
      {/* ─────────────────────────────── hero ─────────────────────────────── */}
      <section className="relative overflow-hidden border-b border-line">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.5]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 14% 8%, color-mix(in oklab, var(--violet) 13%, transparent) 0%, transparent 44%), radial-gradient(circle at 86% 30%, color-mix(in oklab, var(--caramel) 12%, transparent) 0%, transparent 40%)",
          }}
        />
        <div className="container-x relative py-16 md:py-24">
          <Reveal>
            <div className="inline-flex items-center gap-2.5 rounded-full border border-line bg-surface/70 py-1 pl-3.5 pr-4 backdrop-blur">
              <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-caramel">
                Deliverable 2 · Data model
              </span>
              <span aria-hidden className="h-3 w-px bg-line-strong" />
              <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-faint">
                src/lib/domain/types.ts
              </span>
            </div>
          </Reveal>

          <Reveal delay={0.06}>
            <h1 className="display-lg mt-8 max-w-4xl">
              A profile that has to <span className="serif-italic text-cream-gradient">sell</span>{" "}
              capability, and a brief that has to be{" "}
              <span className="serif-italic text-cream-gradient">quotable</span>.
            </h1>
          </Reveal>

          <Reveal delay={0.12}>
            <p className="mt-7 max-w-2xl text-balance-pretty text-[16.5px] leading-relaxed text-ink-2">
              Two very different documents, written by two very different people, about to be
              signed against each other. Almost every marketplace stores one of them well. This note
              is about the fields that make both survive the meeting.
            </p>
          </Reveal>

          <Reveal delay={0.18}>
            <dl className="mt-14 grid grid-cols-2 gap-x-8 gap-y-8 border-t border-line pt-8 sm:grid-cols-4">
              <Count n="28" label="Entity types, one file" />
              <Count n="297" label="Top-level fields" />
              <Count n={creators.length} label="Creators in the seed" />
              <Count n={portfolio.length} label="Published works" />
            </dl>
          </Reveal>
        </div>
      </section>

      {/* ─────────────────────────── the shape ───────────────────────────── */}
      <Section>
        <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16">
          <div>
            <SectionHead
              eyebrow="The shape of the problem"
              title={
                <>
                  Most marketplaces model <span className="serif-italic">neither</span> one
                  properly.
                </>
              }
              className="mb-0"
            />
          </div>
          <div className="space-y-5 text-[15px] leading-relaxed text-ink-muted lg:pt-2">
            <p>
              A creator profile is a sales document written by a person who wants to be booked. It
              exists to answer one question — <em className="text-ink">can this person actually do
              the thing, and will they still be able to next month?</em> — which is why it needs a
              toolchain, a pipeline, a turnaround and a derived delivery record rather than a
              paragraph of adjectives.
            </p>
            <p>
              A brief is a contract written by a buyer who does not yet know what they want. Its
              job is to be <em className="text-ink">quotable</em>: formats, quantities, durations,
              territory, duration of use, budget band, and what is explicitly excluded. A brief
              that cannot be quoted against produces an offer nobody can accept, and a dispute
              three weeks later about what &ldquo;a film&rdquo; meant.
            </p>
            <p>
              The two documents share almost no vocabulary. So we did not try to average them. The
              profile is a read-optimised aggregate of the creator&apos;s records; the brief is a
              write-optimised aggregate of the conversation that produced it. Both are denormalised
              on purpose, because a marketplace&apos;s first job is to answer a query fast enough
              that nobody notices the joins underneath.
            </p>
          </div>
        </div>
      </Section>

      {/* ─────────────────────────── entity map ──────────────────────────── */}
      <section className="border-y border-line bg-bg-deep/35">
        <Section>
          <SectionHead
            eyebrow="Entity map"
            title={
              <>
                Twenty-eight types, and only <span className="serif-italic">four</span> of them
                matter on day one.
              </>
            }
            lede="Account, Creator, Brief, Offer. Everything else in this file exists to make those four defensible. Edges are labelled with the relationship name used in the schema."
          />

          <Reveal>
            <div className="rounded-2xl border border-line bg-surface/50 p-6 md:p-10">
              <div className="mx-auto max-w-2xl">
                <EntityNode
                  name="Account"
                  icon={Layers}
                  tone="violet"
                  fields="id · role: brand | creator · identity · joinedAt"
                />
              </div>

              <Edge label="is one of" kind="fork" />

              <div className="grid gap-4 sm:grid-cols-2">
                <EntityNode
                  name="Creator"
                  icon={Boxes}
                  fields="dayRateInr · tools[] · models[] · skills[] · contentTypes[] · stats{} · workflowIds[] · portfolioIds[] · engagementIds[]"
                />
                <EntityNode
                  name="Brand"
                  icon={Boxes}
                  fields="industry · totalSpendInr · briefIds[] · shortlistCreatorIds[] · preferredFormats[]"
                />
              </div>

              <Edge label="publishes → references" />
              <div className="grid gap-4 sm:grid-cols-2">
                <EntityNode
                  name="PortfolioPiece"
                  icon={Tag}
                  fields="contentType · aspectRatio · tools[] · models[] · skills[] · metrics{} · license · artSeed"
                />
                <EntityNode
                  name="Workflow"
                  icon={WorkflowIcon}
                  fields="durationHours · verified · stages[] → WorkflowStage{ humanCheckpoint, weight }"
                />
              </div>

              <Edge label="writes → transcribed by → contains" />
              <div className="grid gap-4 sm:grid-cols-3">
                <EntityNode
                  name="Brief"
                  icon={ScanText}
                  tone="mint"
                  fields="rawIdea · refinedSummary · deliverables[] · commercialUse{} · budget{} · timeline{} · embeddingNote"
                />
                <EntityNode name="BriefSession" icon={GitBranch} tone="mint" fields="draft: Partial<Brief> · status" />
                <EntityNode
                  name="ConversationTurn"
                  icon={GitBranch}
                  tone="mint"
                  fields="role: brand|assistant|system · text · extractedFields[] · simulated?"
                />
              </div>

              <Edge label="proposes → gated by" />
              <div className="grid gap-4 sm:grid-cols-2">
                <EntityNode
                  name="Offer"
                  icon={Milestone}
                  tone="rose"
                  fields="amountInr · exclusivity · milestones[]{label,pct,dueDay} · translatedBrief · translationTurns[]"
                />
                <EntityNode
                  name="Contract"
                  icon={FileSignature}
                  tone="rose"
                  fields="kind · clauses[] · signatures[]{digest} · contentDigest · humanReviewed"
                />
              </div>

              <Edge label="accepted as" />
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-[0.9fr_1.1fr]">
                <EntityNode
                  name="Engagement"
                  icon={ShieldCheck}
                  tone="rose"
                  fields="status · startedAt · dueAt · escrowId · contractIds[] · rounds[] · provenance[]"
                />
                <div className="space-y-3">
                  <Branch label="runs" />
                  <EntityNode
                    name="GenerationRound"
                    icon={WorkflowIcon}
                    tone="mint"
                    fields="index · status · toolChain[] · promptLineage[] · samples[] · feedback"
                  />
                  <Branch label="stamps every sample with" />
                  <EntityNode
                    name="ProvenanceRecord"
                    icon={Fingerprint}
                    tone="mint"
                    fields="c2pa{} · synthid{} · visible{} · chainOfCustody[]"
                  />
                  <Branch label="holds the money against" />
                  <EntityNode
                    name="Escrow"
                    icon={Lock}
                    tone="mint"
                    fields="amountInr · releasedInr · status · gateway · payoutRoute · protectedBy"
                  />
                </div>
              </div>
            </div>
          </Reveal>

          <Reveal delay={0.06}>
            <p className="mt-5 text-center text-[12.5px] text-ink-faint">
              Notice what is not in the diagram. There is no <span className="font-mono text-ink-2">Message</span>{" "}
              entity, no <span className="font-mono text-ink-2">Notification</span>, and no
              generic <span className="font-mono text-ink-2">Order</span>. The only conversation
              entity is the brief intake transcript, because that is the only conversation whose
              loss would change what gets made.
            </p>
          </Reveal>
        </Section>
      </section>

      {/* ─────────────────────── field-by-field: creator ─────────────────── */}
      <Section id="creator-profile">
        <SectionHead
          eyebrow="Field note 01 · CreatorProfile"
          title={
            <>
              Thirty-four fields, and <span className="serif-italic">none</span> of them are the
              bio.
            </>
          }
          lede="`bio` and `philosophy` are the only prose on the entity. Everything a brand can filter, rank or compare on is typed."
        />
        <FieldTable
          rows={[
            { field: "availability", type: "open | limited | booked",
              why: "A ranked search result is worthless if the top hit cannot start for six weeks. Availability is a rank input, not a badge — a booked creator loses eighteen relevance points before any facet is applied.",
              sample: `cr-aarav → "${AARAV.availability}" · 14 of 14 creators carry a value` },
            { field: "dayRateInr", type: "number",
              why: "One comparable scalar is what makes a pool sortable. Without it, the only honest ranking is vibes. It is a rate, not a price: the offer is negotiated on top of it.",
              sample: `${rupees(AARAV.dayRateInr)}/day · pool range ${compactInr(Math.min(...creators.map((c) => c.dayRateInr)))}–${compactInr(Math.max(...creators.map((c) => c.dayRateInr)))}` },
            { field: "minimumEngagementInr", type: "number",
              why: "The floor under a quote. Without it a ₹40,000 brand brief lands in the same inbox as a ₹14L one and the creator either declines or, worse, accepts and under-delivers. It is also what lets a brief be rejected at intake rather than at week three.",
              sample: `${rupees(AARAV.minimumEngagementInr)} · cr-ishita ${rupees(creators[1].minimumEngagementInr)}` },
            { field: "turnaroundDays", type: "number",
              why: "Time is a facet like any other. It is the field that lets a brand say ‘by the 18th’ and get back only creators for whom that is plausible, instead of reading it in a cover letter.",
              sample: `${AARAV.turnaroundDays} days · pool median ${[...creators].sort((a, b) => a.turnaroundDays - b.turnaroundDays)[Math.floor(creators.length / 2)].turnaroundDays} days` },
            { field: "languagesOffered", type: "string[]",
              why: "Deliberately distinct from `languages`, which is what the creator can converse in. A Hindi voiceover needs a Hindi dubbing pipeline; it does not need the creator to negotiate in Hindi. Collapsing the two produces briefs that fail late.",
              sample: `${AARAV.languagesOffered.length} offered · "${AARAV.languagesOffered.join(" / ")}"` },
            { field: "specializations", type: "string[]",
              why: "The vertical axis. A brand starting from ‘I make skincare’ needs the pool to be legible by sector before it is legible by tool.",
              sample: `${AARAV.specializations.join(" · ")} · ${SPECIALIZATIONS.length} in taxonomy` },
            { field: "skills", type: "SKILL_TAXONOMY ids[]",
              why: "The horizontal axis, and deliberately separate from tools. ‘Colour grading’ is a judgement; ‘DaVinci Resolve 20’ is a product. Both are facets, and conflating them makes profiles untestable.",
              sample: `${AARAV.skills.length} skills · "${AARAV.skills.slice(0, 3).join(" ")}" · ${SKILL_TAXONOMY.length} in taxonomy` },
            { field: "tools", type: "TOOLS ids[]",
              why: "Where most platforms put a free-text ‘software’ string, we put ids. That is what makes ‘knows Nuke’ a query rather than a full-text guess, and it is what lets the tools signal recompute the moment a tool is removed from the profile.",
              sample: `${AARAV.tools.length} tools · ${TOOLS.filter((t) => t.verified).length} of ${TOOLS.length} carry a vendor credential` },
            { field: "models", type: "MODELS ids[]",
              why: "Tools and models are different nouns. A grade and an upscale are tools you operate; Veo 3 is a model you prompt. Brands filter on the model when they care about look, and on the tool when they care about controllability — usually both.",
              sample: `${AARAV.models.join(" · ")} · ${MODELS.length} models in taxonomy` },
            { field: "contentTypes", type: "ContentType[]",
              why: "The brief’s deliverable vocabulary. Twelve values, no free text, so `Brief.contentTypes` and `Creator.contentTypes` intersect exactly instead of approximately.",
              sample: `${AARAV.contentTypes.join(" · ")}` },
            { field: "aspectRatios", type: "AspectRatioId[]",
              why: "Eight canonical ratios with a stated usage. Aspect ratio is the single most reliable predictor of whether a creator can deliver — a 21:9 anamorphic hero and a 9:16 feed cutdown are different crafts — and it is free to declare.",
              sample: `${AARAV.aspectRatios.join(" · ")}` },
            { field: "stats", type: "CreatorStats",
              why: "A derived block, and the only one on the entity. `onTimeRate`, `approvalRate` and `repeatClientRate` are computed from escrow releases and client sign-offs on closed engagements. A creator cannot type them in, so they cannot flatter themselves, and they cannot go stale relative to the record that produced them.",
              sample: `cr-aarav → ${AARAV.stats.engagements} engagements · ${pct(AARAV.stats.onTimeRate)} on time · ${pct(AARAV.stats.approvalRate)} approved first pass · ${pct(AARAV.stats.repeatClientRate)} repeat` },
          ]}
        />
      </Section>

      {/* ────────────────────── field-by-field: portfolio ────────────────── */}
      <section className="border-y border-line bg-bg-deep/35">
        <Section>
          <SectionHead
            eyebrow="Field note 02 · PortfolioPiece"
            title={
              <>
                <span className="serif-italic">workflowId</span> is what makes this an AI portfolio
                rather than a mood board.
              </>
            }
            lede="A mood board answers ‘do you like pictures?’. A piece that names the pipeline it came out of answers ‘can you repeat this for us on a Tuesday?’"
          />
          <FieldTable
            rows={[
              { field: "workflowId", type: "string → Workflow",
                why: "The join key back to the published recipe. It turns a picture into evidence: the buyer can read the five stages, the named human checkpoints and the tool list that produced this exact frame. Without it the piece is decoration; with it the piece is an audit.",
                sample: `pf-aarav-1 → wf-cinematic-previs · ${STAGE.length} stages, ${workflows.length} workflows published` },
              { field: "tools / models / skills", type: "string[]",
                why: "Duplicated from `Workflow.stages[].tools` on purpose, and denormalised. Faceting a portfolio by tool is the fastest way to find the one person in the pool who has actually shipped in your stack — at the cost of accepting that a piece can claim a tool the workflow does not list, which is a fact about the creator, not a bug.",
                sample: `pf-aarav-1 · 6 tools · 3 models · 4 skills` },
              { field: "contentType + aspectRatio", type: "ContentType, AspectRatioId",
                why: "One is the medium, one is the delivery shape. Both are required facets on the buyer side, and both are cheap and unambiguous to declare. The pair is what lets a brief ask for ‘a 21:9 cinematic film’ and find the pieces that prove it has happened before.",
                sample: `pf-aarav-1 → cinematic-video @ 21:9 · ${portfolio.length} pieces indexed` },
              { field: "license", type: "string | null",
                why: "Null means client terms still apply and the client name is redacted; a string means the work is published under an open licence anyone can read. The null case is the common one, and it is a feature: a portfolio that cannot be lifted is a portfolio that does not need one.",
                sample: `${portfolio.filter((p) => p.license).length} of ${portfolio.length} pieces carry an open licence` },
              { field: "metrics", type: "views?, engagementRate?, awardCount, briefConversionRate?",
                why: "Optional per field rather than a required object, because a still has no view count and a self-initiated film has no client. `awardCount` is separated from views on purpose — reach is not the same claim as quality, and conflating them is how a marketplace starts selling follower counts.",
                sample: `pf-aarav-2 → ${compactNumber(6400000)} views · 4.1% engagement · 0 awards` },
              { field: "artSeed", type: "string",
                why: "A deterministic seed for the procedurally rendered preview. No photographs exist in this prototype and we do not fake them with grey boxes: the same seed always produces the same frame. That is the reproducibility guarantee a real generative pipeline already gives you, and it is honest about what it is.",
                sample: `"monsoon-longtake-01" · palette [${portfolio[0].palette.join(", ")}]` },
            ]}
          />
        </Section>
      </section>

      {/* ─────────────────────── field-by-field: workflow ────────────────── */}
      <Section>
        <SectionHead
          eyebrow="Field note 03 · Workflow & WorkflowStage"
title={<> Publish where the <span className="serif-italic">judgement</span> happened. </>}
          lede="Two fields do the work: `humanCheckpoint` says who decided, `weight` says how much of the piece they decided."
        />

        <Reveal>
          <div className="rounded-xl border border-line bg-surface/60 p-5 md:p-7">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <div>
                <div className="font-mono text-[13px] text-ink">{workflows[0].id}</div>
                <div className="mt-1 font-display text-[21px] tracking-[-0.02em] text-ink">
                  {workflows[0].name}
                </div>
              </div>
              <div className="font-mono text-[11px] text-ink-faint">
                {workflows[0].durationHours}h · weights sum to {stageTotal}
              </div>
            </div>
            <div className="mt-6 space-y-3">
              {STAGE.map((s) => (
                <div key={s.id} className="grid gap-2 rounded-lg border border-line bg-surface p-4 md:grid-cols-[150px_1fr_120px] md:items-start md:gap-5">
                  <div>
                    <div className="font-mono text-[11.5px] text-ink">{s.name}</div>
                    <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-surface-3">
                      <div className="h-full rounded-full bg-caramel" style={{ width: `${s.weight}%` }} />
                    </div>
                    <div className="mt-1 font-mono text-[10px] text-ink-faint">weight {s.weight}</div>
                  </div>
                  <div className="text-[12.5px] leading-relaxed text-ink-muted">{s.description}</div>
                  <div className="rounded-md border border-mint/25 bg-mint/[0.06] px-3 py-2">
                    <div className="label-xs !text-mint">Human checkpoint</div>
                    <div className="mt-1.5 text-[11.5px] leading-snug text-ink-2">{s.humanCheckpoint}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Reveal>

        <div className="mt-8">
          <FieldTable
            rows={[
              { field: "stages[].humanCheckpoint", type: "string",
                why: "Free text on purpose — it is a sentence a human wrote about a decision they made, and that is the only form in which it is checkable. It converts ‘AI-assisted’ from a disclaimer into an audit trail: a buyer can see that the shot list was a director’s call and the seed roll was not.",
                sample: `"Blocking review — camera height and eyeline locked against the brand's shot grammar."` },
              { field: "stages[].weight", type: "number (0–100, sums to 100)",
                why: "Prevents the most dishonest publishing behaviour there is: listing twelve stages so the pipeline looks rigorous. Weight forces a creator to say where the work actually is. Aarav’s heaviest stage is motion synthesis at 28 and his lightest is shot architecture at 10, which is the opposite of how most portfolios present it.",
                sample: `${STAGE.map((s) => `${s.name} ${s.weight}`).join(" · ")} = ${stageTotal}` },
              { field: "verified / lastRunAt", type: "boolean, Iso",
                why: "`lastRunAt` is the anti-fossil field. A workflow that has not been run in a year describes a theory of how work used to be done, and the workflow signal weights on verified workflows only. Publishing is cheap; running is not.",
                sample: `${workflows.filter((w) => w.verified).length} of ${workflows.length} verified · most recent ${workflows[0].lastRunAt}` },
            ]}
          />
        </div>
      </Section>

      {/* ─────────────────────── field-by-field: brief ───────────────────── */}
      <section className="border-y border-line bg-bg-deep/35">
        <Section>
          <SectionHead
            eyebrow="Field note 04 · Brief"
            title={
              <>
                The raw sentence and the distilled brief, kept{" "}
                <span className="serif-italic">side by side</span>.
              </>
            }
            lede={`${MONSOON.code} · ${MONSOON.brandName} · ${MONSOON.status}`}
          />
          <FieldTable
            rows={[
              { field: "rawIdea", type: "string",
                why: "The brand’s own words, unedited. It is the provenance of the intent: when a creator asks ‘why is the rain created rather than shot?’, the answer is a turn in a transcript, not an interpretation. It is also the escape hatch — every structured field below can be traced back to the sentence that produced it.",
                sample: `“${MONSOON.rawIdea}”` },
              { field: "refinedSummary", type: "string",
                why: "What the assistant distilled, in the brief’s own voice. Not a summary of the conversation — a re-statement of the deliverable. This is what renders on the offer card, where the creator decides in four seconds whether to open it.",
                sample: `“${MONSOON.refinedSummary.slice(0, 148)}…”` },
              { field: "campaignObjective", type: "string",
                why: "Separate from `refinedSummary` on purpose. The objective is what the work is for; the summary is what it is. A creator can decline a brief they could execute, and the offer form lets them say why in the first line.",
                sample: `“${MONSOON.campaignObjective.slice(0, 120)}…”` },
              { field: "audience / tone / styleTags", type: "string, string[], STYLE_TAGS[]",
                why: `Structured, closed-vocabulary tags, so tone and style are queries rather than adjectives. styleTags is drawn from a fixed set of ${STYLE_TAGS.length} values; free-text style is where briefs go to die, because nobody can filter it and nobody can price against it.`,
                sample: `audience “${MONSOON.audience.slice(0, 74)}…” · tone ${MONSOON.tone.length} · styleTags ${MONSOON.styleTags.join(", ")}` },
              { field: "referenceNotes / excludedStyles", type: "string[]",
                why: "The two fields a mood board cannot hold. `excludedStyles` is the highest-value field on the entity — “no global skin lightening, ever, we will reject the set” is a rejection ground that is enforceable because it was written down. Negative constraints are where the money is saved.",
                sample: `${MONSOON.excludedStyles.length} exclusions: ${MONSOON.excludedStyles.join(" · ")}` },
              { field: "deliverables", type: "BriefDeliverable[]",
                why: "The brief’s spine. Nothing downstream — offer, milestone ladder, escrow tranche — can be sized until the deliverables exist, because quantity is the dominant cost driver and duration is the second.",
                sample: `${MONSOON.deliverables.length} deliverables · ${MONSOON.deliverables.reduce((s, d) => s + d.quantity, 0)} units` },
              { field: "budget", type: "{minInr, maxInr, model, releasedToRazorpay}",
                why: "A band, not a number, because the creator prices the pipeline. `model` distinguishes a fixed price from a day-rate engagement from a milestone split, and the split determines how escrow is drawn down. `releasedToRazorpay` is a fact about the money, kept next to the intent so intake can check both.",
                sample: `${compactInr(MONSOON.budget.minInr)}–${compactInr(MONSOON.budget.maxInr)} · ${MONSOON.budget.model} · accepted at ${rupees(ACCEPTED.amountInr)}` },
              { field: "timeline", type: "BriefTimeline",
                why: "Three deadlines, not one. Kickoff, first samples and final delivery are separate because they are separate risks, and because the samples date is what makes the rejection grounds in the contract weakly defensible — the creator must show work before the client can walk.",
                sample: `kickoff d${MONSOON.timeline.kickoffWithinDays} · samples d${MONSOON.timeline.firstSamplesWithinDays} · final d${MONSOON.timeline.finalDeliveryWithinDays} · ${MONSOON.timeline.revisionsIncluded} revisions / ${MONSOON.timeline.conceptRoundsIncluded} concept rounds` },
              { field: "mustHaveSignals", type: "SignalKind[]",
                why: "The brief states its own trust floor, in the vocabulary of the verification system. It is a constraint on the result set rather than a sort key: a creator missing any of these is filtered out before ranking. This is how a brief says ‘I will not be the first person you work with’ without saying it.",
                sample: `${MONSOON.mustHaveSignals.join(" · ")} — ${MONSOON.mustHaveSignals.length} of 6 signal kinds required` },
              { field: "embeddingNote", type: "string",
                why: "One denormalised sentence, recomputed on save, holding everything semantic rather than everything structured. Formats, tone, budget and territory are all queryable columns and are deliberately not embedded. What is embedded is what no facet can reach: the intent words. Retrieval reads this; filtering does not.",
                sample: `“${MONSOON.embeddingNote}”` },
            ]}
          />
        </Section>
      </section>

      {/* ─────────────────────── commercial use ──────────────────────────── */}
      <Section>
        <SectionHead
          eyebrow="Field note 05 · CommercialUse"
          title={
            <>
              This is a <span className="serif-italic">struct</span>, not a boolean, because rights
              are not a price.
            </>
          }
          lede="Every field below moves money. A marketplace that stores `exclusive: true` cannot quote a brand, and a brand that cannot be quoted does not shortlist."
        />

        <Reveal>
          <div className="rounded-xl border border-line bg-surface/60 p-5 md:p-7">
            <div className="label-xs">licenseType — the ladder every other field rides on</div>
            <div className="mt-4 space-y-2.5">
              {LICENSE_LADDER.map((l) => (
                <div key={l.id} className="grid items-center gap-3 md:grid-cols-[190px_1fr_150px]">
                  <div className="flex items-baseline gap-2">
                    <Fn>{l.id}</Fn>
                    <span className="font-mono text-[10px] text-ink-faint">×{l.mult.toFixed(1)}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-surface-3">
                    <div
                      className="h-full rounded-full bg-caramel transition-[width] duration-700"
                      style={{ width: `${(l.mult / 5) * 100}%` }}
                    />
                  </div>
                  <div className="text-[11.5px] leading-snug text-ink-faint">{l.note}</div>
                </div>
              ))}
            </div>
            <div className="mt-5 border-t border-line pt-4 text-[12.5px] leading-relaxed text-ink-muted">
              Illustrative only — CREAM does not publish a rights premium table, because a published
              multiplier becomes a floor and creators start pricing to the formula instead of to the
              work. The same offer for{" "}
              <span className="text-ink">br-monsoon</span> landed at{" "}
              {rupees(ACCEPTED.amountInr)} for{" "}
              <span className="font-mono text-ink-2">{ACCEPTED.exclusivity}</span> and{" "}
              {rupees(offers[1].amountInr)} for a creator who proposed splitting the scope.
            </div>
          </div>
        </Reveal>

        <div className="mt-10">
          <div className="grid gap-x-5 gap-y-2 border-b border-line-strong px-1 pb-2.5 md:grid-cols-[minmax(150px,1fr)_minmax(120px,0.85fr)_2fr] md:items-baseline">
            <span className="label-xs">Field</span>
            <span className="label-xs">Domain</span>
            <span className="label-xs">How it moves price</span>
          </div>
          <div className="font-mono text-[11px] text-ink-faint">
            {[
              { field: "licenseType", type: "4-state enum",
                why: "Exclusivity is the single largest lever on a generative asset, because the asset is reproducible by definition. A non-exclusive licence is worth roughly a fifth of a buyout; the ladder is quoted above." },
              { field: "territory / customTerritory", type: "worldwide | india | custom",
                why: "India against worldwide is the cheapest discount in the book and brands take it immediately. `customTerritory` exists because two of the most common asks — ‘India and the Gulf’ — are neither of the built-ins." },
              { field: "durationMonths / perpetual", type: "number | null, boolean",
                why: "Perpetual is the second-largest lever and the one most often conceded for free by a creator who does not price time. `null` means perpetual; the boolean exists because a brand must be able to ask for it explicitly and see a number come back." },
              { field: "channels", type: `${CHANNELS.length} CHANNELS[]`,
                why: "Channel is where spend actually goes. OOH, CTV and packaging are multiples of organic social because each one implies a different master format, a different legal review and a different failure cost." },
              { field: "paidMediaAllowed", type: "boolean",
                why: "Paid media is the difference between a licence and an amplification budget. It is also the clause most often forgotten, and the one that turns a ₹3.8L brief into a ₹5.2L one." },
              { field: "modelTrainingAllowed", type: "boolean",
                why: "The newest and least understood field in the file. Allowing the model vendor to train on the output can be worth real money to a brand building a house visual model; refusing it is the default on every seeded brief here." },
              { field: "derivativeWorksAllowed", type: "boolean",
                why: "Whether the brand may extend the asset — a cutdown, a re-grade, an adaptation into another format. Refused, every adaptation is a new negotiation and the price multiplies by the number of formats." },
              { field: "sublicensingAllowed / resaleAllowed", type: "boolean",
                why: "Two distinct questions that collapse into one boolean too often. Sublicensing is ‘may I hand this to my media agency?’; resale is ‘may this be sold on as a template?’. The second is the one that destroys the value of the asset and is almost always refused." },
              { field: "competitorUseBlocked", type: "boolean",
                why: "The field that would not have existed five years ago. If the platform may generate competing work for the same brand, the exclusivity the client paid for is fictional. True on all three seeded briefs; the comment in `types.ts` says it usually must be." },
              { field: "disclosurePolicy", type: "client | platform | no-disclosure",
                why: "Who tells the public the asset is synthetic. `platform-disclosure` puts the statement in the CREAM watermark; `client-disclosure` puts it in the brand’s own disclosure practice and in the C2PA manifest assertions. This is a contractual obligation, not a preference, so it is typed rather than left in prose." },
            ].map((r) => (
              <Row key={r.field}>
                <Fn>{r.field}</Fn>
                <Ty>{r.type}</Ty>
                <p className="font-sans text-[13.5px] leading-relaxed text-ink-2">{r.why}</p>
              </Row>
            ))}
          </div>
        </div>

        <Reveal delay={0.05}>
          <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3 rounded-xl border border-dashed border-line bg-surface/50 px-6 py-5">
            <ScanText className="size-4 shrink-0 text-caramel" />
            <p className="flex-1 text-[13.5px] leading-relaxed text-ink-muted">
              Thirteen fields, one nested struct, embedded rather than joined. The reason is
              latency and integrity: the licence must travel with the brief into the offer, the
              contract, the close agreement and the escrow record without a single opportunity for
              the four to disagree about what was actually sold.
            </p>
            <div className="font-mono text-[11px] text-ink-faint">
              br-monsoon → {MONSOON.commercialUse.territory} · {MONSOON.commercialUse.durationMonths}mo ·{" "}
              {MONSOON.commercialUse.channels.length} channels
            </div>
          </div>
        </Reveal>
      </Section>

      {/* ──────────────────────── deliverables ──────────────────────────── */}
      <Section>
        <SectionHead
          eyebrow="Field note 06 · BriefDeliverable"
          title={
            <>
              Quantity is the <span className="serif-italic">only</span> cost driver that scales
              linearly.
            </>
          }
          lede={`br-monsoon resolves to ${MONSOON.deliverables.reduce((s, d) => s + d.quantity, 0)} units across three formats. Eight stills cost more than the hero film did.`}
        />
        <FieldTable
          rows={[
            { field: "quantity", type: "number",
              why: "Everything else about a generative asset is close to free after the first frame. Two hundred and forty seconds of video and eight stills from the same hero cost very different amounts, and nothing in the brief would be true without this number. It is the field the escrow tranches are sized from.",
              sample: `d1 ×1 @ 55s · d2 ×5 @ 18s · d3 ×${stillCount} stills` },
            { field: "durationSeconds?", type: "number | undefined",
              why: "Optional because it only means something for time-based media. When present it is a cost input, not a description: a 55-second anamorphic film is a different budget line from a 55-second vertical cutdown, and the two share a number here only because nothing stops a brand from asking for the wrong one." },
            { field: "contentType", type: "ContentType",
              why: "Twelve closed values. It routes the piece to the right creator pool and decides which proof the buyer needs — a photograph needs identity-lock evidence, a voiceover needs a clearance record.",
              sample: MONSOON.deliverables.map((d) => `${d.id}:${d.contentType}`).join(" · ") },
            { field: "aspectRatio", type: "AspectRatioId",
              why: "Not a property of the brief but a property of each deliverable, because campaigns are deliberately asymmetric — one 21:9 master and five 9:16 cutdowns. Hoisting it to the brief would force the buyer to state a false constraint.",
              sample: MONSOON.deliverables.map((d) => `${d.id}:${d.aspectRatio}`).join(" · ") },
            { field: "notes", type: "string",
              why: "The one free-text field on a structured entity, and it earns its place because it carries the constraints that did not generalise — ‘Master plus ProRes 4444 and H.264 review’, ‘each opening on a distinct beat’, ‘sound-off legible’. Anything that could be typed would have been.",
              sample: `d2 → “${MONSOON.deliverables[1].notes}”` },
          ]}
        />
        <Reveal delay={0.05}>
          <div className="mt-6 grid gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-3">
            {MONSOON.deliverables.map((d) => (
              <div key={d.id} className="bg-surface p-5">
                <div className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-ink-faint">
                  {d.contentType} · {d.aspectRatio}
                </div>
                <div className="mt-2.5 font-display text-[28px] leading-none text-ink">
                  ×{d.quantity}
                </div>
                <div className="mt-2 font-mono text-[11px] text-ink-faint">
                  {d.durationSeconds ? `${d.durationSeconds}s each` : "still"}
                </div>
              </div>
            ))}
          </div>
        </Reveal>
      </Section>

      {/* ───────────────────────── verification ──────────────────────────── */}
      <section className="border-y border-line bg-bg-deep/35">
        <Section>
          <SectionHead
            eyebrow="Field note 07 · VerificationSignal"
            title={
              <>
                A self-reported claim is not a bad colour. It is a{" "}
                <span className="serif-italic">different type</span>.
              </>
            }
            lede={`Six signal kinds, four tiers. Only ${ELITE_ASSESSMENT.verifiedCount} of ${ELITE_SIGNALS.length} signals on the strongest profile in the pool actually score.`}
          />

          <Reveal>
            <div className="rounded-xl border border-line bg-surface/60 p-5 md:p-7">
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <div>
                  <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-faint">
                    signalsFor({ELITE.id})
                  </div>
                  <div className="mt-1.5 font-display text-[21px] tracking-[-0.02em] text-ink">
                    {ELITE.displayName} · score {ELITE_ASSESSMENT.score}/100 · {ELITE_ASSESSMENT.tier}
                  </div>
                </div>
                <Badge tone="mint">{ELITE_ASSESSMENT.verifiedCount} verified</Badge>
                <Badge tone="neutral">{ELITE_ASSESSMENT.attestedCount} attested · scores zero</Badge>
              </div>

              <div className="mt-6 space-y-2.5">
                {ELITE_SIGNALS.map((s) => (
                  <div
                    key={s.id}
                    className="grid gap-2 rounded-lg border border-line bg-surface p-4 md:grid-cols-[150px_1fr_70px] md:items-start md:gap-5"
                  >
                    <div>
                      <div className="font-mono text-[11px] text-ink">{SIGNAL_META[s.kind].label}</div>
                      <div
                        className={`mt-1.5 font-mono text-[9.5px] uppercase tracking-[0.12em] ${
                          s.tier === "verified" ? "text-mint" : "text-ink-faint"
                        }`}
                      >
                        {s.tier}
                      </div>
                    </div>
                    <div>
                      <div className="text-[13px] text-ink-2">{s.title}</div>
                      <div className="mt-1 text-[12px] leading-relaxed text-ink-faint">{s.evidence}</div>
                      {s.reference && (
                        <div className="mt-1.5 font-mono text-[10.5px] text-ink-faint">
                          ref {s.reference}
                        </div>
                      )}
                    </div>
                    <div className="text-right">
                      <div
                        className={`font-display text-[22px] leading-none ${
                          s.tier === "verified" ? "text-mint" : "text-ink-faint line-through"
                        }`}
                      >
                        {s.weight}
                      </div>
                      <div className="label-xs mt-1.5">weight</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Reveal>

          <div className="mt-8">
            <FieldTable
              rows={[
                { field: "kind", type: "6 SignalKind values",
                  why: "Identity, tools, workflow, portfolio, delivery, client. Chosen so the six together approximate the six objections a procurement team actually raises, in the order they raise them.",
                  sample: Object.keys(SIGNAL_META).join(" · ") },
                { field: "tier", type: "verified | attested | unverified | expired",
                  why: "The whole argument in one enum. `attested` is a creator claim that has not been substantiated; it is shown honestly, and it scores zero. A marketplace that renders both as a tick has told the buyer nothing.",
                  sample: `${ELITE_ASSESSMENT.verifiedCount} verified · ${ELITE_ASSESSMENT.attestedCount} attested · ${ELITE_ASSESSMENT.expiringSoon.length} expiring inside 180 days` },
                { field: "evidence", type: "string",
                  why: "Plain language a brand can audit, written for someone who is not going to read the source. This is the single highest-leverage string in the file: it is what turns a badge into a reason.",
                  sample: `“${ELITE_SIGNALS[0].evidence.slice(0, 108)}…”` },
                { field: "weight", type: "number, 0–100 contribution",
                  why: "Contributes to the score only when the tier is verified. Weights are capped per kind (identity 26, tools 24, workflow 20, portfolio 18, delivery 14, client 12) so no single dimension can carry a profile on its own.",
                  sample: `26 + ${ELITE_SIGNALS[1].weight} + ${ELITE_SIGNALS[2].weight} + ${ELITE_SIGNALS[3].weight} + ${ELITE_SIGNALS[4].weight} + ${ELITE_SIGNALS[5].weight} = ${ELITE_SIGNALS.reduce((s, x) => s + x.weight, 0)} of 106` },
                { field: "reference", type: "string?",
                  why: "The audit handle — a hashed DigiLocker issuer reference, a workflow id, an engagement code. Optional because not every signal has an external artefact, but present because a claim with no handle is a claim, and we would rather say so.",
                  sample: `identity → ${ELITE.identity.issuerRef}` },
                { field: "derivation", type: "not a field",
                  why: "Signals are computed in `signalsFor()` from the same records that power discovery. If a creator removes a tool from their profile, the tools signal loses its weight in the same pass. A claim and its substantiation cannot drift apart, because there is nothing to keep in sync.",
                  sample: `identity.status ${ELITE.identity.status} → tier ${ELITE_SIGNALS[0].tier}` },
              ]}
            />
          </div>
        </Section>
      </section>

      {/* ─────────────────────── provenance ──────────────────────────────── */}
      <Section>
        <SectionHead
          eyebrow="Field note 08 · ProvenanceRecord"
          title={
            <>
              Three watermarks, because{" "}
              <span className="serif-italic">end-to-end encryption does not stop theft</span>.
            </>
          }
          lede="Provenance is not a badge on the profile. It is a record written per asset, at the moment of release, and signed."
          action={
            <Badge tone="mint">C2PA {PROV.c2pa.version}</Badge>
          }
        />
        <div className="grid gap-4 lg:grid-cols-2">
          {[
            {
              k: "c2pa",
              t: `Signed manifest · ${PROV.c2pa.version}`,
              body: "The machine-readable claim. It carries the generator, the certificate issuer and a list of assertions — including CREAM's own `humanCheckpoints` and `toolChain` assertions, which is the point: provenance that only records the model is not provenance.",
              lines: PROV.c2pa.assertions,
              foot: PROV.c2pa.manifestHash.slice(0, 34) + "…",
            },
            {
              k: "synthid",
              t: "Imperceptible, extractable watermark",
              body: "Survives a screenshot, a crop and a re-encode, which the visible mark does not. `extractable` and `lastDetection` mean CREAM can prove an asset was leaked rather than asserting that it would be noticed.",
              lines: [
                `provider ${PROV.synthid.provider}`,
                `strength ${PROV.synthid.strength} · payload ${PROV.synthid.payloadId}`,
                `detection matched ${PROV.synthid.lastDetection?.matched} @ ${PROV.synthid.lastDetection?.confidence} confidence`,
              ],
              foot: `embedded ${PROV.synthid.embedded} · extractable ${PROV.synthid.extractable}`,
            },
            {
              k: "visible",
              t: "Dual-branded burn-in",
              body: "The blunt layer, and the only one a human reacts to. Two names on the frame — platform and creator — so the exposure is attributable from either direction and nobody can quietly crop it.",
              lines: [
                `platform “${PROV.visible.platformWatermark}”`,
                `creator “${PROV.visible.creatorWatermark}”`,
                `position ${PROV.visible.position} · opacity ${PROV.visible.opacity}`,
              ],
              foot: "removed on final approval, never before",
            },
            {
              k: "chainOfCustody",
              t: "Every hand the asset passes through",
              body: "An append-only event log with actor and timestamp. It is what a dispute is actually settled from: not the asset, but the sequence of decisions that produced it.",
              lines: PROV.chainOfCustody.map((c) => `${c.event} — ${c.actor}`),
              foot: `${PROV.chainOfCustody.length} events · ${PROV.assetName}`,
            },
          ].map((p) => (
            <div key={p.k} className="rounded-xl border border-line bg-surface/60 p-6">
              <div className="font-mono text-[11px] text-caramel">{p.k}</div>
              <div className="mt-1.5 font-display text-[19px] tracking-[-0.02em] text-ink">{p.t}</div>
              <p className="mt-3 text-[13.5px] leading-relaxed text-ink-muted">{p.body}</p>
              <ul className="mt-4 space-y-1.5 rounded-lg border border-line bg-surface-2/40 p-3.5">
                {p.lines.map((l) => (
                  <li key={l} className="font-mono text-[10.5px] leading-relaxed text-ink-faint">
                    {l}
                  </li>
                ))}
              </ul>
              <div className="mt-3 font-mono text-[10px] text-ink-faint">{p.foot}</div>
            </div>
          ))}
        </div>
      </Section>

      {/* ─────────────────── escrow + contract machines ─────────────────── */}
      <section className="border-y border-line bg-bg-deep/35">
        <Section>
          <SectionHead
            eyebrow="Field note 09 · Escrow & Contract"
            title={
              <>
                Two state machines, and a{" "}
                <span className="serif-italic">human</span> in the contract loop.
              </>
            }
          />

          <div className="grid gap-6 lg:grid-cols-2">
            <Reveal>
              <div className="h-full rounded-xl border border-line bg-surface/60 p-6">
                <div className="flex items-center justify-between gap-3">
                  <div className="font-display text-[19px] tracking-[-0.02em] text-ink">Escrow</div>
                  <Badge tone="mint">{ESCROW.status}</Badge>
                </div>
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {["created", "authorized", "captured", "held", "partially-released", "released", "refunded"].map(
                    (s, i, arr) => (
                      <span
                        key={s}
                        className={`rounded-full border px-2.5 py-1 font-mono text-[9.5px] uppercase tracking-[0.1em] ${
                          i <= arr.indexOf(ESCROW.status)
                            ? "border-mint/40 bg-mint/10 text-mint"
                            : "border-line text-ink-faint"
                        }`}
                      >
                        {s}
                      </span>
                    ),
                  )}
                </div>
                <div className="mt-5 space-y-2 border-t border-line pt-4 font-mono text-[11px] text-ink-faint">
                  <div className="flex justify-between gap-4">
                    <span>{ESCROW.code}</span>
                    <span className="text-ink-2">
                      {rupees(ESCROW.releasedInr)} of {rupees(ESCROW.amountInr)} released
                    </span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span>{ESCROW.payoutRoute}</span>
                    <span className="text-ink-2">{ESCROW.gateway}</span>
                  </div>
                </div>
                <p className="mt-4 text-[12.5px] leading-relaxed text-ink-muted">{ESCROW.protectedBy}</p>
                <p className="mt-3 text-[12.5px] leading-relaxed text-ink-faint">
                  <span className="font-mono text-ink-2">amountInr</span> and{" "}
                  <span className="font-mono text-ink-2">releasedInr</span> are both stored, so the
                  released figure is a fact rather than a reconstruction from milestone history. A
                  dispute freezes the disputed tranche; the rest keeps settling.
                </p>
              </div>
            </Reveal>

            <Reveal delay={0.06}>
              <div className="h-full rounded-xl border border-line bg-surface/60 p-6">
                <div className="flex items-center justify-between gap-3">
                  <div className="font-display text-[19px] tracking-[-0.02em] text-ink">Contract</div>
                  <Badge tone="caramel">{START_CONTRACT.kind}</Badge>
                </div>
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {(["pending", "signed", "declined"] as const).map((s) => (
                    <span
                      key={s}
                      className={`rounded-full border px-2.5 py-1 font-mono text-[9.5px] uppercase tracking-[0.1em] ${
                        START_CONTRACT.status === s
                          ? "border-caramel/40 bg-caramel/10 text-caramel"
                          : "border-line text-ink-faint"
                      }`}
                    >
                      {s}
                    </span>
                  ))}
                </div>
                <div className="mt-5 space-y-2 border-t border-line pt-4 font-mono text-[11px] text-ink-faint">
                  {START_CONTRACT.signatures.map((s) => (
                    <div key={s.party} className="flex justify-between gap-4">
                      <span>
                        {s.party} · {s.partyName}
                      </span>
                      <span className="text-ink-2">
                        {s.status} · {s.digest}
                      </span>
                    </div>
                  ))}
                  <div className="flex justify-between gap-4">
                    <span>contentDigest</span>
                    <span className="truncate text-ink-2">{START_CONTRACT.contentDigest.slice(0, 26)}…</span>
                  </div>
                </div>
                <p className="mt-4 text-[12.5px] leading-relaxed text-ink-muted">
                  <span className="font-mono text-ink-2">humanReviewed: {String(START_CONTRACT.humanReviewed)}</span>{" "}
                  — CREAM does not auto-generate these documents. The clause set is templated; the
                  decision to issue one is a person&apos;s, and the flag is on the record.
                </p>
                <p className="mt-3 text-[12.5px] leading-relaxed text-ink-faint">
                  Each signature carries a short SHA-256 prefix over the canonical body plus the
                  signer identity, so a clause edited after signing invalidates the digest rather
                  than quietly surviving it.
                </p>
              </div>
            </Reveal>
          </div>

          <Reveal delay={0.1}>
            <div className="mt-8 grid gap-px overflow-hidden rounded-xl border border-line bg-line md:grid-cols-4">
              {[
                { k: "OfferStatus", v: "draft → sent → opened → negotiating → accepted | declined | withdrawn" },
                { k: "EngagementStatus", v: "awaiting-signature → in-production → client-review → delivered → closed | refunded" },
                { k: "RoundStatus", v: "queued → generating → in-review → changes-requested → approved" },
                { k: "BriefStatus", v: "draft → open → shortlisted → in-negotiation → awarded → closed" },
              ].map((m) => (
                <div key={m.k} className="bg-surface p-5">
                  <div className="font-mono text-[11px] text-ink">{m.k}</div>
                  <div className="mt-2.5 font-mono text-[10.5px] leading-relaxed text-ink-faint">{m.v}</div>
                </div>
              ))}
            </div>
          </Reveal>
        </Section>
      </section>

      {/* ─────────────────────────── taxonomy ────────────────────────────── */}
      <Section>
        <SectionHead
          eyebrow="Taxonomy"
title={<> Closed vocabularies, counted <span className="serif-italic">now</span>, not aspirationally. </>}
          lede="Every number below is read from src/lib/domain/taxonomy.ts at render time. Adding a tool is a one-line change and it flows through search, filtering, briefs and verification with no other edit."
        />

        <div className="grid gap-4 lg:grid-cols-2">
          <TaxonomyBlock
            title="TOOLS"
            count={TOOLS.length}
            caption={`${TOOLS.filter((t) => t.verified).length} carry a brand-owned vendor credential or telemetry backing. The unverified remainder (${TOOLS.filter((t) => !t.verified).length}) are usage-attested and are counted separately in the trust signal.`}
          >
            <div className="space-y-2.5">
              {TOOL_BY_CATEGORY.map((c) => (
                <div key={c.key}>
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-[12px] text-ink-2">{c.label}</span>
                    <span className="font-mono text-[10.5px] text-ink-faint">{c.items.length}</span>
                  </div>
                  <div className="mt-1 h-1 overflow-hidden rounded-full bg-surface-3">
                    <div
                      className="h-full rounded-full bg-caramel/70"
                      style={{ width: `${(c.items.length / Math.max(...TOOL_BY_CATEGORY.map((x) => x.items.length))) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 flex flex-wrap gap-1.5">
              {TOOLS.filter((t) => !t.verified).map((t) => (
                <span key={t.id} className="chip font-mono !text-[10px]">
                  {t.name}
                </span>
              ))}
            </div>
          </TaxonomyBlock>

          <TaxonomyBlock
            title="MODELS"
            count={MODELS.length}
            caption="Tools you operate, models you prompt. Kept as separate axes so a buyer can filter on look or on controllability."
          >
            <div className="grid grid-cols-2 gap-x-5 gap-y-2.5">
              {(["video", "image", "text", "av", "3d"] as const).map((kind) => {
                const items = MODELS.filter((m) => m.kind === kind);
                if (!items.length) return null;
                return (
                  <div key={kind}>
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="font-mono text-[10px] uppercase tracking-[0.13em] text-ink-faint">
                        {kind}
                      </span>
                      <span className="font-mono text-[10.5px] text-caramel">{items.length}</span>
                    </div>
                    <div className="mt-1.5 font-mono text-[10.5px] leading-[1.7] text-ink-muted">
                      {items.map((m) => m.name).join(" · ")}
                    </div>
                  </div>
                );
              })}
            </div>
          </TaxonomyBlock>

          <TaxonomyBlock
            title="SKILL_TAXONOMY"
            count={SKILL_TAXONOMY.length}
            caption="Craft, not product. Grouped into eight categories so a brand can search for judgement rather than for a logo."
          >
            <div className="space-y-2.5">
              {SKILL_BY_CATEGORY.map((c) => (
                <div key={c.key}>
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-[12px] text-ink-2">{c.label}</span>
                    <span className="font-mono text-[10.5px] text-ink-faint">{c.items.length}</span>
                  </div>
                  <div className="mt-1 font-mono text-[10.5px] leading-relaxed text-ink-faint">
                    {c.items.map((s) => s.name).join(" · ")}
                  </div>
                </div>
              ))}
            </div>
          </TaxonomyBlock>

          <TaxonomyBlock
            title="CONTENT_TYPES"
            count={CONTENT_TYPES.length}
            caption="Twelve values across four categories. Every one carries a hint, because the label alone is ambiguous and the hint is what a brief writer reads."
          >
            <div className="space-y-2">
              {CONTENT_TYPES.map((c) => (
                <div key={c} className="flex items-baseline gap-3 border-b border-line/60 pb-2 last:border-0">
                  <span className="w-[46%] shrink-0 font-mono text-[11px] text-ink-2">{c}</span>
                  <span className="font-mono text-[9.5px] uppercase tracking-[0.1em] text-caramel">
                    {CONTENT_TYPE_META[c].category}
                  </span>
                  <span className="flex-1 text-[11.5px] leading-snug text-ink-faint">
                    {CONTENT_TYPE_META[c].hint}
                  </span>
                </div>
              ))}
            </div>
          </TaxonomyBlock>

          <TaxonomyBlock
            title="ASPECT_RATIOS"
            count={ASPECT_RATIOS.length}
            caption="Width normalised to 100. Each one carries its delivery usage, which is what stops a brand asking for 21:9 and discovering the cost in week two."
          >
            <div className="space-y-2">
              {ASPECT_RATIOS.map((a) => (
                <div key={a.id} className="flex items-center gap-3">
                  <span className="w-11 shrink-0 font-mono text-[11px] text-caramel">{a.id}</span>
                  <span
                    aria-hidden
                    className="h-4 shrink-0 rounded-[2px] border border-line-strong bg-surface-2"
                    style={{ width: `${(a.w / a.h) * 18 + 6}px` }}
                  />
                  <span className="flex-1 truncate text-[11.5px] text-ink-muted">{a.usage}</span>
                </div>
              ))}
            </div>
          </TaxonomyBlock>

          <TaxonomyBlock
            title="INDUSTRIES · REGIONS"
            count={INDUSTRIES.length}
            caption={`${INDUSTRIES.length} industries and ${REGIONS.length} regions. Region is a facet on the creator, industry is a facet on the piece — they intersect differently and are stored differently on purpose.`}
          >
            <div className="flex flex-wrap gap-1.5">
              {INDUSTRIES.map((i) => (
                <span key={i} className="chip !text-[10.5px]">
                  {i}
                </span>
              ))}
            </div>
            <div className="mt-4 space-y-2 border-t border-line pt-4">
              {REGIONS.map((r) => (
                <div key={r.id} className="flex items-baseline gap-3">
                  <span className="w-[38%] shrink-0 text-[11.5px] text-ink-2">{r.label}</span>
                  <span className="font-mono text-[10.5px] text-ink-faint">{r.countries.join(" · ")}</span>
                </div>
              ))}
            </div>
          </TaxonomyBlock>

          <TaxonomyBlock
            title="CHANNELS"
            count={CHANNELS.length}
            caption="Where the licence is allowed to run. This is the `CommercialUse.channels` vocabulary and the largest single determinant of price after exclusivity."
          >
            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
              {CHANNELS.map((c) => (
                <span key={c} className="font-mono text-[11px] text-ink-muted">
                  {c}
                </span>
              ))}
            </div>
          </TaxonomyBlock>

          <TaxonomyBlock
            title="SPECIALIZATIONS · STYLE · TONE"
            count={SPECIALIZATIONS.length + STYLE_TAGS.length + TONE_TAGS.length}
            caption={`${SPECIALIZATIONS.length} vertical specialisations, ${STYLE_TAGS.length} style tags and ${TONE_TAGS.length} tone tags. All three are closed sets, and all three are drawn as chips rather than free text for exactly the same reason.`}
          >
            <div className="space-y-4">
              <div>
                <div className="label-xs mb-2">Specialisations</div>
                <div className="flex flex-wrap gap-1.5">
                  {SPECIALIZATIONS.map((s) => (
                    <span key={s} className="chip !text-[10.5px]">
                      {s}
                    </span>
                  ))}
                </div>
              </div>
              <div>
                <div className="label-xs mb-2">Style tags</div>
                <div className="flex flex-wrap gap-1.5">
                  {STYLE_TAGS.map((s) => (
                    <span key={s} className="chip font-mono !text-[10px]">
                      {s}
                    </span>
                  ))}
                </div>
              </div>
              <div>
                <div className="label-xs mb-2">Tone tags</div>
                <div className="flex flex-wrap gap-1.5">
                  {TONE_TAGS.map((s) => (
                    <span key={s} className="chip font-mono !text-[10px]">
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </TaxonomyBlock>
        </div>
      </Section>

      {/* ─────────────────────── indexing & retrieval ────────────────────── */}
      <section className="border-y border-line bg-bg-deep/35">
        <Section>
          <SectionHead
            eyebrow="Indexing & retrieval"
title={<> The model never touches the <span className="serif-italic">database</span>. </>}
            lede="Discovery runs as a deterministic program over the live pool. The assistant writes the brief; it does not answer the query."
          />

          <div className="grid gap-px overflow-hidden rounded-xl border border-line bg-line md:grid-cols-2">
            <div className="bg-surface p-6 md:p-8">
              <div className="flex items-center gap-2.5">
                <Search className="size-4 text-caramel" />
                <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-caramel">
                  Structured — filtered, faceted, exact
                </div>
              </div>
              <ul className="mt-5 space-y-2 font-mono text-[11.5px] leading-relaxed text-ink-muted">
                {[
                  "Creator.tools / models / skills / specializations",
                  "Creator.contentTypes / aspectRatios / availability",
                  "Creator.dayRateInr / turnaroundDays / minimumEngagementInr",
                  "Creator.languagesOffered · location",
                  "Brief.contentTypes / aspectRatios / mustHaveSignals",
                  "Brief.budget / timeline · CommercialUse.*",
                  "PortfolioPiece.contentType / aspectRatio / license",
                  "VerificationSignal.kind / tier",
                ].map((l) => (
                  <li key={l} className="flex gap-2.5">
                    <span className="mt-[7px] block size-1 shrink-0 rounded-full bg-caramel" />
                    {l}
                  </li>
                ))}
              </ul>
            </div>
            <div className="bg-surface p-6 md:p-8">
              <div className="flex items-center gap-2.5">
                <GitBranch className="size-4 text-violet" />
                <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-violet">
                  Embedded — semantic, approximate, one field
                </div>
              </div>
              <ul className="mt-5 space-y-2 font-mono text-[11.5px] leading-relaxed text-ink-muted">
                {[
                  "Brief.embeddingNote",
                  "Brief.refinedSummary",
                  "Brief.excludedStyles",
                  "Creator.philosophy",
                  "PortfolioPiece.summary",
                  "Workflow.summary + stage descriptions",
                ].map((l) => (
                  <li key={l} className="flex gap-2.5">
                    <span className="mt-[7px] block size-1 shrink-0 rounded-full bg-violet" />
                    {l}
                  </li>
                ))}
              </ul>
              <p className="mt-5 border-t border-line pt-4 text-[12.5px] leading-relaxed text-ink-faint">
                One denormalised sentence per brief carries the entire semantic surface. Everything
                that can be a facet has been kept out of it, so the two paths can disagree without
                either one corrupting the other.
              </p>
            </div>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {[
              {
                k: "Why the export query is code",
                v: "A query that filters 14 creators on six facets and returns ranked hits with per-hit reasons is trivial to compute and trivial to verify. Handing it to a model would make the result non-deterministic and unauditable for no gain — a program cannot hallucinate a creator, and that property is the entire reason search is a program.",
              },
              {
                k: "interpretQuery()",
                v: "Free text becomes structured filters client-side, on every keystroke, with zero network latency. It matches skill names, specialisations and tool ids out of the live pool, parses budget expressions including lakh and crore, and clamps the result to sane bounds. It is a parser, not a prompt — which is why it can run on every keypress.",
              },
              {
                k: "Why this matters for the model",
                v: "The brief is the only thing a model produces that reaches a database. Once a brand has edited the extracted fields themselves, the query that runs against the pool is pure code against typed columns. The assistant can be wrong while the system is still correct, because a human reviewed the draft before it became a query.",
              },
            ].map((c) => (
              <div key={c.k} className="rounded-xl border border-line bg-surface/60 p-6">
                <div className="font-mono text-[11.5px] text-ink">{c.k}</div>
                <p className="mt-3 text-[13.5px] leading-relaxed text-ink-muted">{c.v}</p>
              </div>
            ))}
          </div>

          <Reveal delay={0.05}>
            <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-3 rounded-xl border border-dashed border-line bg-surface/50 px-6 py-5">
              <ScanText className="size-4 shrink-0 text-caramel" />
              <p className="flex-1 font-mono text-[11.5px] leading-relaxed text-ink-muted">
                search/engine.ts → interpretQuery( &ldquo;cinematic fashion film under 3L, 10 days,
                available now&rdquo; ) →{" "}
                <span className="text-caramel">
                  {`{ maxDayRate: 300000, maxTurnaround: 10, availability: ["open"] }`}
                </span>
              </p>
              <Link
                href="/deck"
                className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.12em] text-caramel hover:underline"
              >
                see it running <ArrowRight className="size-3" />
              </Link>
            </div>
          </Reveal>
        </Section>
      </section>

      {/* ─────────────────────────── cardinality ────────────────────────── */}
      <Section>
        <SectionHead
          eyebrow="Relations & cardinality"
          title="What is one-to-many, and what would hurt if it were."
        />
        <div className="overflow-hidden rounded-xl border border-line">
          <div className="grid grid-cols-[1.4fr_0.9fr_2fr] gap-x-5 gap-y-2 bg-surface-2/60 px-5 py-3">
            <span className="label-xs">Relation</span>
            <span className="label-xs">Cardinality</span>
            <span className="label-xs">Why it is this way</span>
          </div>
          {[
    { r: "Account → Creator", c: "1 : 0..1", w: "One login, one roster entry. A person can run a studio and be a creator without two identities, and the brand side stays a separate type entirely." },
    { r: "Creator → PortfolioPiece", c: "1 : many", w: "A creator may have many works; a piece belongs to exactly one creator. The reverse reference is denormalised onto `Creator.portfolioIds` so a profile renders without a join." },
    { r: "PortfolioPiece → Workflow", c: "many : 1", w: "Many-to-one on purpose: the same pipeline produces a whole body of work. If it were one-to-one, every new piece would require a new workflow and the audit argument collapses." },
    { r: "Brief → BriefSession", c: "1 : 0..1", w: "A brief has at most one originating conversation. Keeping it on a separate entity is what lets the transcript outlive a draft that the brand then edits — the two versions are both worth having." },
    { r: "BriefSession → ConversationTurn", c: "1 : many", w: "Append-only and never rewritten. Each turn records which fields it produced (`extractedFields`), so any field on the brief can be traced to the turn that set it." },
    { r: "Brief → Offer", c: "1 : many", w: "One brief, several competing offers — the whole point of running discovery. An offer carries its own `exclusivity`, `milestones` and `translatedBrief`, so two creators can price the same brief differently and both be right." },
    { r: "Offer → Engagement", c: "1 : 0..1", w: "Created only when the offer is accepted. Everything before it is negotiable; everything after it is contractual. Splitting the two entities is what makes 'still negotiating' a real state rather than a flag." },
    { r: "Engagement → GenerationRound", c: "1 : many", w: "Rounds are indexed and immutable once approved, because a dispute is settled on the sequence, not on the final asset. `promptLineage` survives the round that produced it." },
    { r: "Engagement → Escrow", c: "1 : 0..1", w: "Null while a signature is outstanding. The link is one-directional on purpose: an escrow must always point at the engagement it protects, but an engagement may briefly have no money behind it." },
      { r: "Engagement → Contract", c: "1 : many", w: "An NDA, an engagement-start and an engagement-close are three documents on one engagement, not one document with three states. `humanReviewed` is per contract." },
        { r: "GenerationRound → ProvenanceRecord", c: "1 : many", w: "One record per released asset. The provenance is written at release, not at creation, so pre-approval samples and final masters are separately auditable." },
          ].map((row) => (
            <div
              key={row.r}
              className="grid grid-cols-1 gap-x-5 gap-y-1 border-t border-line bg-surface px-5 py-3.5 md:grid-cols-[1.4fr_0.9fr_2fr] md:items-baseline"
            >
              <span className="font-mono text-[12px] text-ink-2">{row.r}</span>
              <span className="font-mono text-[11px] text-caramel">{row.c}</span>
              <span className="text-[13px] leading-relaxed text-ink-muted">{row.w}</span>
            </div>
          ))}
        </div>
      </Section>

      {/* ───────────────────────────── closing ───────────────────────────── */}
      <section className="border-t border-line">
        <div className="container-x py-20 md:py-28">
          <Stagger className="grid gap-4 lg:grid-cols-2">
            {[
              {
                n: "Invariant 01",
                t: "A claim and its substantiation are the same computation.",
                b: "Trust signals are derived in `signalsFor()` from the same records that power discovery. Remove a tool from a profile and the verified-tools signal loses its weight in the same pass; there is no denormalised badge anywhere in the system that can go stale, and no way for a profile to claim a credential the platform cannot point at.",
              },
              {
                n: "Invariant 02",
                t: "A brief that cannot be quoted is not a brief.",
                b: "If a field is not a first-class column, it is not in the entity, and if it is not in the entity it cannot be filtered, priced, contracted or disputed. Everything in `CommercialUse` exists because a boolean cannot survive contact with a rights conversation, and everything in `BriefDeliverable` exists because ‘a film’ is not a scope of work.",
              },
            ].map((c) => (
              <StaggerItem key={c.n}>
                <div className="h-full rounded-xl border border-line bg-surface p-7">
                  <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-caramel">
                    {c.n}
                  </div>
                  <h3 className="mt-4 font-display text-[23px] leading-snug tracking-[-0.02em] text-ink">
                    {c.t}
                  </h3>
                  <p className="mt-3.5 text-[13.5px] leading-relaxed text-ink-muted">{c.b}</p>
                </div>
              </StaggerItem>
            ))}
          </Stagger>

          <Reveal delay={0.1}>
            <div className="mt-14 flex flex-wrap items-center justify-between gap-6 border-t border-line pt-8">
              <div>
                <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-ink-faint">
                  Everything on this page is read from source
                </div>
                <div className="mt-3 font-mono text-[12px] text-ink-muted">
                  {creators.length} creators · {brands.length} brands · {briefs.length} briefs ·{" "}
                  {portfolio.length} works · {workflows.length} workflows · {reviews.length} reviews ·{" "}
                  {contracts.length} contracts ·{" "}
                  {compactInr(brands.reduce((s, b) => s + b.totalSpendInr, 0))} recorded spend
                </div>
                <div className="mt-2 font-mono text-[11px] text-ink-faint">
                  {MONSOON.code} · {deliverableCount} deliverable units · {deliverableSeconds}s of
                  timed video · a {ROUND.toolChain.length}-tool round in production
                </div>
              </div>
              <div className="flex flex-wrap gap-3">
                <Link
                  href="/deck"
                  className="inline-flex items-center gap-2 rounded-full border border-line-strong px-5 py-2.5 text-[13px] text-ink transition-colors hover:bg-surface-2"
                >
                  Read the deck
                  <ArrowRight className="size-3.5" />
                </Link>
                <Link
                  href="/"
                  className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-[13px] text-ink-muted transition-colors hover:text-ink"
                >
                  Back to CREAM
                  <ArrowUpRight className="size-3.5" />
                </Link>
              </div>
            </div>
          </Reveal>
        </div>
      </section>
    </>
  );
}
