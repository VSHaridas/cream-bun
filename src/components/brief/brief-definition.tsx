import Link from "next/link";
import {
  Ban,
  CalendarClock,
  Coins,
  FileText,
  Info,
  Quote,
  Scale,
  ScanSearch,
  ShieldCheck,
  Sparkles,
  TriangleAlert,
} from "lucide-react";
import type { Brief, CommercialUse } from "@/lib/domain/types";
import { ASPECT_RATIOS, CONTENT_TYPE_META } from "@/lib/domain/types";
import { SIGNAL_META } from "@/lib/domain/trust";
import { compactInr, formatDate, inr, rupees } from "@/lib/utils";
import { Badge, Label, Meter } from "@/components/ui/primitives";

/* ── 1 · header ───────────────────────────────────────────────────────────── */

type StatusTone = "neutral" | "ink" | "caramel" | "mint" | "violet";

const BRIEF_STATUS: Record<Brief["status"], { tone: StatusTone; label: string }> = {
  draft: { tone: "neutral", label: "Draft" },
  open: { tone: "mint", label: "Open" },
  shortlisted: { tone: "violet", label: "Shortlisted" },
  "in-negotiation": { tone: "caramel", label: "In negotiation" },
  awarded: { tone: "ink", label: "Awarded" },
  closed: { tone: "neutral", label: "Closed" },
};

export function BriefHeader({ brief }: { brief: Brief }) {
  const skin = BRIEF_STATUS[brief.status];

  const deadline = new Date(
    new Date(brief.createdAt).getTime() + brief.timeline.finalDeliveryWithinDays * 86_400_000,
  );

  return (
    <header className="border-b border-line bg-bg-deep/30">
      <div className="container-x py-12 md:py-16">
        <Link
          href="/briefs"
          className="inline-flex items-center gap-1.5 font-mono text-[10.5px] uppercase tracking-[0.14em] text-ink-faint transition-colors hover:text-caramel"
        >
          ← brief workspace
        </Link>

        <div className="mt-7 flex flex-wrap items-center gap-2.5">
          <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-ink-faint">
            {brief.code}
          </span>
          <Badge tone={skin.tone}>{skin.label}</Badge>
          <span className="h-3 w-px bg-line" aria-hidden />
          <span className="font-mono text-[10.5px] uppercase tracking-[0.13em] text-ink-muted">
            {brief.brandName}
          </span>
        </div>

        <h1 className="display-lg mt-5 max-w-4xl">{brief.title}</h1>

        <p className="display-md mt-7 max-w-3xl text-balance-pretty text-ink-2">{brief.campaignObjective}</p>

        <dl className="mt-11 grid grid-cols-2 gap-x-6 gap-y-6 border-t border-line pt-7 sm:grid-cols-3 lg:grid-cols-6">
          {[
            { k: "Created", v: formatDate(brief.createdAt) },
            { k: "Last updated", v: formatDate(brief.updatedAt) },
            { k: "Delivery deadline", v: formatDate(deadline) },
            { k: "Audience", v: brief.audience.split(".")[0] },
            { k: "Session", v: brief.sessionId, mono: true },
            { k: "Brief id", v: brief.id, mono: true },
          ].map((m) => (
            <div key={m.k} className="min-w-0">
              <dt className="label-xs">{m.k}</dt>
              <dd
                className={
                  m.mono
                    ? "mt-2 truncate font-mono text-[11.5px] tabular-nums text-ink-2"
                    : "mt-2 text-[13px] leading-snug text-ink"
                }
              >
                {m.v}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </header>
  );
}

/* ── 2 · the intent, both ways ────────────────────────────────────────────── */

export function IntentComparison({ brief }: { brief: Brief }) {
  return (
    <div className="grid gap-px overflow-hidden rounded-xl border border-line bg-line lg:grid-cols-2">
      <div className="bg-surface p-6 md:p-8">
        <div className="flex items-center gap-2">
          <Quote className="size-3.5 text-ink-faint" />
          <Label>What the brand actually said</Label>
        </div>
        <blockquote className="mt-5 border-l-2 border-line-strong pl-5">
          <p className="font-mono text-[14px] leading-[1.75] text-ink-2">&ldquo;{brief.rawIdea}&rdquo;</p>
        </blockquote>
        <p className="mt-6 border-t border-line pt-4 text-[12px] leading-relaxed text-ink-faint">
          Stored verbatim as <span className="font-mono text-ink-muted">rawIdea</span>. Never edited,
          never summarised, never cleaned up for readability.
        </p>
      </div>

      <div className="bg-surface p-6 md:p-8">
        <div className="flex items-center gap-2">
          <Sparkles className="size-3.5 text-caramel" />
          <Label>What the assistant distilled</Label>
        </div>
        <p className="mt-5 text-[15px] leading-[1.7] text-ink">{brief.refinedSummary}</p>
        <p className="mt-6 border-t border-line pt-4 text-[12px] leading-relaxed text-ink-faint">
          Stored as <span className="font-mono text-ink-muted">refinedSummary</span>. Every clause
          above traces back to a sentence in the column on the left.
        </p>
      </div>

      <div className="bg-bg-deep/40 p-6 md:p-8 lg:col-span-2">
        <div className="flex flex-col gap-4 md:flex-row md:items-start">
          <div className="flex shrink-0 items-center gap-2 md:w-52">
            <ScanSearch className="size-3.5 text-violet" />
            <Label>Semantic index</Label>
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-mono text-[12.5px] leading-[1.7] text-ink-2">{brief.embeddingNote}</p>
            <p className="mt-3 text-[12px] leading-relaxed text-ink-faint">
              Recomputed on every save. This is the text the pool is matched against when the brief
              runs as a query — it exists so a creator who has never read the brand&apos;s transcript
              can still be found from it.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── 3 · deliverables ─────────────────────────────────────────────────────── */

export function DeliverablesTable({ brief }: { brief: Brief }) {
  const assetCount = brief.deliverables.reduce((s, d) => s + d.quantity, 0);
  const videoSeconds = brief.deliverables.reduce(
    (s, d) => s + (d.durationSeconds ?? 0) * d.quantity,
    0,
  );

  return (
    <div className="overflow-hidden rounded-xl border border-line bg-surface">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line px-5 py-4">
        <div className="flex items-center gap-2.5">
          <FileText className="size-3.5 text-caramel" />
          <span className="text-[14px] font-medium text-ink">Deliverables</span>
        </div>
        <div className="flex items-center gap-5 font-mono text-[11px] tabular-nums">
          <span className="text-ink-faint">
            <span className="text-ink">{assetCount}</span> assets
          </span>
          <span className="text-ink-faint">
            <span className="text-ink">{videoSeconds}</span>s of picture
          </span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[46rem] border-collapse text-left">
          <thead>
            <tr className="border-b border-line">
              {["Content type", "Aspect ratio", "Qty", "Length", "Notes"].map((h) => (
                <th key={h} className="label-xs px-5 py-3 font-normal">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line/70">
            {brief.deliverables.map((d) => {
              const meta = CONTENT_TYPE_META[d.contentType];
              const ratio = ASPECT_RATIOS.find((a) => a.id === d.aspectRatio);
              return (
                <tr key={d.id} className="align-top transition-colors hover:bg-surface-2/40">
                  <td className="px-5 py-4">
                    <div className="text-[13.5px] text-ink">{meta.label}</div>
                    <div className="mt-1 font-mono text-[10.5px] uppercase tracking-[0.1em] text-ink-faint">
                      {meta.category}
                    </div>
                    <div className="mt-1.5 max-w-[15rem] text-[11.5px] leading-relaxed text-ink-faint">
                      {meta.hint}
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <div className="font-mono text-[13px] tabular-nums text-caramel">
                      {d.aspectRatio}
                    </div>
                    <div className="mt-1 text-[12px] text-ink-2">{ratio?.label}</div>
                    <div className="mt-1 max-w-[13rem] text-[11.5px] leading-relaxed text-ink-faint">
                      {ratio?.usage}
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <div className="font-display text-[26px] leading-none tabular-nums text-ink">
                      {d.quantity}
                    </div>
                    <div className="mt-1.5 text-[10.5px] text-ink-faint">
                      {d.quantity === 1 ? "asset" : "assets"}
                    </div>
                  </td>
                  <td className="px-5 py-4 font-mono text-[12.5px] tabular-nums text-ink-2">
                    {d.durationSeconds ? `${d.durationSeconds}s` : "—"}
                  </td>
                  <td className="max-w-[18rem] px-5 py-4 text-[12.5px] leading-relaxed text-ink-muted">
                    {d.notes}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex gap-3 border-t border-line bg-bg-deep/30 px-5 py-4">
        <Info className="mt-0.5 size-3.5 shrink-0 text-caramel" />
        <p className="text-[12.5px] leading-relaxed text-ink-muted">
          Quantity is the dominant cost driver, not style. Going from one hero to{" "}
          <span className="font-mono tabular-nums text-ink">{assetCount}</span> assets multiplies
          generation, review, clean-up and rights bookkeeping; the adjectives move the grade, not the
          invoice. That is why the assistant asks for counts before it asks about mood.
        </p>
      </div>
    </div>
  );
}

/* ── 4 · commercial use ───────────────────────────────────────────────────── */

const LADDER: { id: CommercialUse["licenseType"]; label: string; note: string }[] = [
  { id: "non-exclusive", label: "Non-exclusive", note: "The creator may sell the same class of work to anyone else." },
  { id: "exclusive-category", label: "Exclusive · category", note: "Nobody else may be licensed this brand in the same category." },
  { id: "exclusive-territory", label: "Exclusive · territory", note: "Exclusivity extends across a named geography." },
  { id: "buyout-full", label: "Full buyout", note: "All rights transfer; the creator cannot reuse the asset at all." },
];

const RIGHT_ROWS: { key: keyof CommercialUse; label: string; on: string; off: string }[] = [
  { key: "paidMediaAllowed", label: "Paid media", on: "Paid placement permitted", off: "Organic placement only" },
  { key: "modelTrainingAllowed", label: "Model training", on: "Model training permitted", off: "Model training refused" },
  { key: "derivativeWorksAllowed", label: "Derivative works", on: "Derivatives permitted", off: "Derivatives refused" },
  { key: "sublicensingAllowed", label: "Sublicensing", on: "Sublicensing permitted", off: "No sublicensing" },
  { key: "resaleAllowed", label: "Resale", on: "Resale permitted", off: "No resale" },
  { key: "competitorUseBlocked", label: "Competitor use", on: "Competitor use barred", off: "Competitor use permitted" },
];

export function RightsCard({ brief }: { brief: Brief }) {
  const cu = brief.commercialUse;
  const rung = LADDER.findIndex((l) => l.id === cu.licenseType);
  const territory =
    cu.territory === "custom" ? (cu.customTerritory ?? "custom") : cu.territory;

  return (
    <div className="overflow-hidden rounded-xl border border-line bg-surface">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line px-5 py-4">
        <div className="flex items-center gap-2.5">
          <Scale className="size-3.5 text-caramel" />
          <span className="text-[14px] font-medium text-ink">Commercial use</span>
        </div>
        <Badge tone="violet">{LADDER[rung].label}</Badge>
      </div>

      <div className="px-5 py-6">
        <Label>Licence ladder</Label>
        <ol className="mt-4 grid gap-2 sm:grid-cols-4">
          {LADDER.map((l, i) => {
            const current = i === rung;
            const below = i < rung;
            return (
              <li
                key={l.id}
                className={`relative rounded-lg border px-3.5 py-3 transition-colors ${
                  current
                    ? "border-caramel/55 bg-caramel/[0.07]"
                    : "border-line bg-surface-2/30"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`grid size-4 place-items-center rounded-full border ${
                      current
                        ? "border-caramel bg-caramel text-[oklch(0.18_0.02_60)]"
                        : below
                          ? "border-caramel/45 text-caramel"
                          : "border-line-strong text-ink-faint"
                    }`}
                  >
                    {current && <span className="size-1.5 rounded-full bg-[oklch(0.18_0.02_60)]" />}
                  </span>
                  <span
                    className={`text-[12.5px] leading-tight ${
                      current ? "text-ink" : below ? "text-ink-2" : "text-ink-faint"
                    }`}
                  >
                    {l.label}
                  </span>
                </div>
                <p className="mt-2 text-[11px] leading-relaxed text-ink-faint">
                  {current ? "This brief" : below ? "Also granted" : "Not granted here"}
                </p>
              </li>
            );
          })}
        </ol>
        <p className="mt-4 text-[12.5px] leading-relaxed text-ink-muted">{LADDER[rung].note}</p>
      </div>

      <div className="grid gap-px border-t border-line bg-line md:grid-cols-3">
        <Fact k="Territory" v={territory} mono />
        <Fact
          k="Duration"
          v={cu.perpetual ? "Perpetual" : `${cu.durationMonths ?? "—"} months`}
          mono={!cu.perpetual}
        />
        <Fact k="Disclosure" v={cu.disclosurePolicy.replace("-", " ")} />
      </div>

      <div className="border-t border-line px-5 py-6">
        <Label>Channels licensed</Label>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {cu.channels.map((c) => (
            <span key={c} className="chip">
              {c}
            </span>
          ))}
        </div>
      </div>

      <div className="border-t border-line">
        <div className="px-5 py-4">
          <Label>Granted and refused</Label>
        </div>
        <div className="divide-y divide-line/70 border-t border-line/70">
          {RIGHT_ROWS.map((r) => {
            const allowed = Boolean(cu[r.key]) as boolean;
            return (
              <div
                key={String(r.key)}
                className="flex items-center justify-between gap-4 px-5 py-3.5"
              >
                <span className="text-[13px] text-ink-2">{r.label}</span>
                <span
                  className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-[3px] font-mono text-[10px] uppercase tracking-[0.1em] ${
                    allowed
                      ? "border-mint/40 bg-mint/10 text-mint"
                      : "border-rose/40 bg-rose/10 text-rose"
                  }`}
                >
                  {allowed ? <ShieldCheck className="size-2.5" /> : <Ban className="size-2.5" />}
                  {allowed ? "permitted" : "prohibited"}
                </span>
                <span className="hidden max-w-[16rem] flex-1 text-right text-[11.5px] leading-relaxed text-ink-faint sm:block">
                  {allowed ? r.on : r.off}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex gap-3 border-t border-line bg-bg-deep/30 px-5 py-5">
        <Coins className="mt-0.5 size-3.5 shrink-0 text-caramel" />
        <div className="min-w-0">
          <div className="text-[12.5px] leading-relaxed text-ink-2">
            <span className="text-ink">What this costs.</span> Territory is the single largest mover
            here: India-only is roughly a third of a worldwide buyout on an otherwise identical job.
            Duration compounds it &mdash; {cu.perpetual ? "perpetual" : `${cu.durationMonths} months`}{" "}
            at {compactInr(brief.budget.minInr)}&ndash;{compactInr(brief.budget.maxInr)} against
            {cu.perpetual ? " any finite term" : " a twelve-month term"} is the difference between a
            campaign and an asset the creator cannot resell.{" "}
            {cu.licenseType === "non-exclusive"
              ? "Non-exclusive keeps the creator's option value high, which is why it prices lowest."
              : cu.licenseType === "exclusive-category"
                ? "Category exclusivity removes the creator's ability to sell this brand's look to anyone in the same vertical, which is worth roughly 10–15% of the fee."
                : cu.licenseType === "exclusive-territory"
                  ? "Territory exclusivity is the broadest bar CREAM contracts for, and typically moves the fee into the next band."
                  : "A full buyout transfers everything, including the creator's right to reuse the asset, and is priced accordingly."}{" "}
            <span className="text-ink-muted">Refusing model training</span> removes a secondary
            income stream for the model owner and is a negotiation point, not a formality. Quantity
            ({brief.deliverables.reduce((s, d) => s + d.quantity, 0)} assets) and turnaround
            ({brief.timeline.finalDeliveryWithinDays} days) move the number more than style ever
            does.
          </div>
        </div>
      </div>
    </div>
  );
}

function Fact({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  return (
    <div className="bg-surface px-5 py-4">
      <Label>{k}</Label>
      <div
        className={
          mono
            ? "mt-2 font-mono text-[13px] tabular-nums text-ink"
            : "mt-2 text-[13px] capitalize text-ink"
        }
      >
        {v}
      </div>
    </div>
  );
}

/* ── 5 · style guardrails ─────────────────────────────────────────────────── */

export function StyleGuardrails({ brief }: { brief: Brief }) {
  return (
    <div className="grid gap-4 lg:grid-cols-[1.05fr_1fr]">
      <div className="space-y-4">
        <div className="rounded-xl border border-line bg-surface p-5">
          <Label>Style</Label>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {brief.styleTags.map((s) => (
              <span key={s} className="chip chip-active">
                {s}
              </span>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-line bg-surface p-5">
          <Label>Tone</Label>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {brief.tone.map((s) => (
              <span key={s} className="chip">
                {s}
              </span>
            ))}
          </div>
          <p className="mt-4 border-t border-line pt-4 text-[12.5px] leading-relaxed text-ink-muted">
            {brief.audience}
          </p>
        </div>

        <div className="rounded-xl border border-rose/30 bg-rose/[0.05] p-5">
          <div className="flex items-center gap-2">
            <TriangleAlert className="size-3.5 text-rose" />
            <Label className="text-rose">Prohibited — non-negotiable</Label>
          </div>
          <ul className="mt-4 space-y-2">
            {brief.excludedStyles.map((s) => (
              <li
                key={s}
                className="flex items-center gap-2.5 rounded-lg border border-rose/25 bg-surface/60 px-3 py-2"
              >
                <span className="grid size-4 shrink-0 place-items-center rounded-full border border-rose/50 text-[9px] leading-none text-rose">
                  ×
                </span>
                <span className="text-[12.5px] text-ink">{s}</span>
              </li>
            ))}
          </ul>
          <p className="mt-4 border-t border-rose/20 pt-3.5 text-[11.5px] leading-relaxed text-ink-faint">
            These are rejection grounds, not preferences. A delivered asset that violates one of them
            can be returned under the rejection clause of the engagement-start contract.
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-line bg-surface p-5">
        <div className="flex items-center justify-between gap-3">
          <Label>Instructions to the creator</Label>
          <span className="font-mono text-[10px] tabular-nums text-ink-faint">
            {brief.referenceNotes.length}
          </span>
        </div>
        <ol className="mt-4 space-y-0">
          {brief.referenceNotes.map((n, i) => (
            <li key={n} className="flex gap-4 border-b border-line py-4 last:border-b-0 last:pb-0">
              <span className="mt-0.5 font-mono text-[11px] tabular-nums text-caramel">
                {String(i + 1).padStart(2, "0")}
              </span>
              <p className="text-[13.5px] leading-relaxed text-ink-2">{n}</p>
            </li>
          ))}
        </ol>
        <p className="mt-5 rounded-lg border border-dashed border-line bg-bg-deep/30 p-3.5 text-[11.5px] leading-relaxed text-ink-faint">
          Each of these came out of the transcript as a sentence. They are reproduced here unchanged
          because a creator who reads only this page should still build what the brand meant.
        </p>
      </div>
    </div>
  );
}

/* ── 6 · budget and timeline ──────────────────────────────────────────────── */

export function BudgetTimeline({ brief }: { brief: Brief }) {
  const t = brief.timeline;
  const gates = [
    { k: "Kickoff", d: t.kickoffWithinDays, gate: "Both signatures on the engagement-start contract" },
    { k: "First samples", d: t.firstSamplesWithinDays, gate: "Escrow captured and visible to the creator" },
    { k: "Final delivery", d: t.finalDeliveryWithinDays, gate: "Every earlier round approved in writing" },
  ];
  const maxD = gates[gates.length - 1].d;

  return (
    <div className="grid gap-4 lg:grid-cols-[0.85fr_1.15fr]">
      <div className="rounded-xl border border-line bg-surface p-5">
        <Label>Budget</Label>
        <div className="mt-3 font-display text-[32px] leading-none tracking-[-0.03em] tabular-nums text-caramel">
          {compactInr(brief.budget.minInr)} &ndash; {compactInr(brief.budget.maxInr)}
        </div>
        <div className="mt-2 font-mono text-[11.5px] tabular-nums text-ink-faint">
          {rupees(brief.budget.minInr)} &ndash; {rupees(brief.budget.maxInr)}
        </div>

        <div className="mt-5 space-y-3 border-t border-line pt-4">
          <Row k="Model" v={brief.budget.model.replace("-", " ")} />
          <Row k="Midpoint" v={rupees((brief.budget.minInr + brief.budget.maxInr) / 2)} mono />
          <Row k="Per asset" v={compactInr((brief.budget.maxInr - brief.budget.minInr) / Math.max(1, brief.deliverables.reduce((s, d) => s + d.quantity, 0)))} mono />
          <Row k="Day rate equiv." v={compactInr(brief.budget.maxInr / Math.max(1, t.finalDeliveryWithinDays))} mono />
        </div>

        <div
          className={`mt-5 flex items-start gap-2.5 rounded-lg border px-3.5 py-3 ${
            brief.budget.releasedToRazorpay
              ? "border-mint/30 bg-mint/[0.06]"
              : "border-line bg-surface-2/40"
          }`}
        >
          <ShieldCheck
            className={`mt-0.5 size-3.5 shrink-0 ${brief.budget.releasedToRazorpay ? "text-mint" : "text-ink-faint"}`}
          />
          <p className="text-[12px] leading-relaxed text-ink-muted">
            {brief.budget.releasedToRazorpay
              ? `Authorised and captured into Razorpay custody against the accepted offer (${inr(brief.budget.minInr)}+). It releases against milestones, not on delivery.`
              : "No capture against Razorpay yet. The creator will not start production without it."}
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-line bg-surface p-5">
        <div className="flex items-center justify-between gap-3">
          <Label>Timeline</Label>
          <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-faint">
            {t.finalDeliveryWithinDays} days end to end
          </span>
        </div>

        <div className="mt-6">
          <div className="relative h-px w-full bg-line-strong" aria-hidden>
            <div className="absolute inset-y-0 left-0 bg-caramel" style={{ width: "100%" }} />
          </div>
          <ol className="mt-0 grid grid-cols-3">
            {gates.map((g, i) => (
              <li key={g.k} className="relative pr-4 pt-5">
                <span
                  className="absolute -top-[5px] grid size-2.5 place-items-center rounded-full border border-caramel bg-surface"
                  style={{ left: `${(g.d / maxD) * 100}%`, transform: "translateX(-50%)" }}
                >
                  <span className="size-1 rounded-full bg-caramel" />
                </span>
                <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-faint">
                  gate {String(i + 1).padStart(2, "0")}
                </div>
                <div className="mt-1.5 text-[13.5px] leading-tight text-ink">{g.k}</div>
                <div className="mt-1 font-mono text-[12px] tabular-nums text-caramel">day {g.d}</div>
                <p className="mt-2 text-[11.5px] leading-relaxed text-ink-faint">{g.gate}</p>
              </li>
            ))}
          </ol>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-2 border-t border-line pt-4">
          <span className="label-xs">Included allowances</span>
          <span className="chip chip-active font-mono text-[10.5px]">
            {t.revisionsIncluded} revision rounds
          </span>
          <span className="chip chip-active font-mono text-[10.5px]">
            {t.conceptRoundsIncluded} concept round{t.conceptRoundsIncluded === 1 ? "" : "s"}
          </span>
        </div>
        <p className="mt-3 text-[11.5px] leading-relaxed text-ink-faint">
          Anything beyond these allowances is a written scope amendment countersigned by both
          parties, with a supplementary escrow release where cost increases. A revision round is a
          correction inside the agreed direction; a concept round is a change of direction, which is
          a different and more expensive thing.
        </p>

        <div className="mt-5">
          <Meter
            value={t.finalDeliveryWithinDays}
            max={Math.max(t.finalDeliveryWithinDays, 45)}
            showLabel
            tone="caramel"
          />
          <div className="mt-2 flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.1em] text-ink-faint">
            <span>created {formatDate(brief.createdAt)}</span>
            <span>final delivery</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <span className="label-xs">{k}</span>
      <span className={mono ? "font-mono text-[12px] tabular-nums text-ink" : "text-[12.5px] capitalize text-ink"}>
        {v}
      </span>
    </div>
  );
}

/* ── 7 · trust signals required ───────────────────────────────────────────── */

export function RequiredSignals({ brief }: { brief: Brief }) {
  return (
    <div className="rounded-xl border border-line bg-surface p-5">
      <Label>Trust signals required to be shortlisted</Label>
      <div className="mt-3.5 flex flex-wrap gap-1.5">
        {brief.mustHaveSignals.map((s) => (
          <span key={s} className="chip border-mint/35 text-mint">
            {SIGNAL_META[s].label}
          </span>
        ))}
      </div>
      <p className="mt-4 flex gap-2 border-t border-line pt-3.5 text-[11.5px] leading-relaxed text-ink-faint">
        <CalendarClock className="mt-0.5 size-3 shrink-0" />
        At least one signal must be independently verified, not merely self-asserted, before a
        creator enters this brief&apos;s shortlist.
      </p>
    </div>
  );
}
