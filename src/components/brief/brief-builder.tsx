"use client";

import * as React from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import {
  ArrowUp,
  ChevronDown,
  CircleCheck,
  CircleDashed,
  Compass,
  FileText,
  Loader2,
  RotateCcw,
  Sparkles,
  TriangleAlert,
  Wand2,
} from "lucide-react";
import { renderBriefMarkdown, briefAsText, downloadText, copyToClipboard } from "@/lib/brief/export";
import { ASPECT_RATIOS, CONTENT_TYPE_META } from "@/lib/domain/types";
import { MISSING_META, type BriefDraft, type MissingField } from "@/lib/llm/contract";
import { EMPTY_DRAFT, SUGGESTION_POOL, missingFields, progressOf } from "@/lib/llm/reasoner";
import { cn, compactInr } from "@/lib/utils";
import { Badge, Button, Label, Meter, Textarea } from "@/components/ui/primitives";

interface Turn {
  id: string;
  role: "user" | "assistant";
  text: string;
  fields: string[];
  simulated?: boolean;
}

const FIELD_LABEL: Record<string, string> = {
  campaignObjective: "objective",
  audience: "audience",
  contentTypes: "content types",
  aspectRatios: "formats",
  styleTags: "style",
  tone: "tone",
  deliverables: "deliverables",
  commercialUse: "commercial use",
  budget: "budget",
  timeline: "timeline",
  revisionsIncluded: "revisions",
  conceptRoundsIncluded: "concept rounds",
  targetChannels: "channels",
  referenceNotes: "references",
  excludedStyles: "exclusions",
  audience_tone: "audience",
};

interface ModelOption {
  id: string;
  label: string;
  contextWindow: number | null;
}

/**
 * The model list is read from the API, never from a constant in this file.
 *
 * Three honest states: loading, unavailable (with the reason the API gave),
 * and ready. There is no silent fallback to a compiled-in name, because the
 * whole point of discovering models at runtime is that it stays true.
 */
function useModelCatalogue() {
  const [models, setModels] = React.useState<ModelOption[]>([]);
  const [state, setState] = React.useState<"loading" | "ready" | "unavailable">("loading");
  const [reason, setReason] = React.useState<string | null>(null);
  const [selected, setSelected] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/gemini/models");
        const data = (await res.json()) as {
          models?: ModelOption[];
          source?: string;
          reason?: string | null;
        };
        if (cancelled) return;
        if (data.models?.length) {
          setModels(data.models);
          setSelected(data.models[0].id);
          setState("ready");
        } else {
          setState("unavailable");
          setReason(data.reason ?? "No model available.");
        }
      } catch {
        if (!cancelled) {
          setState("unavailable");
          setReason("The model catalogue could not be reached.");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return { models, state, reason, selected, setSelected };
}

export function BriefBuilder({ brandName }: { brandName: string }) {
  const [draft, setDraft] = React.useState<BriefDraft>(EMPTY_DRAFT);
  const [turns, setTurns] = React.useState<Turn[]>([
    {
      id: "seed",
      role: "assistant",
      text: `Tell me about the campaign the way you would describe it to a colleague. Badly-worded is fine — the messier it is, the more structure I can pull out of it. I'll ask one thing at a time and write it all down as we go.`,
      fields: [],
    },
  ]);
  const [input, setInput] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [model, setModel] = React.useState<string>("");
  const [simulated, setSimulated] = React.useState(true);
  const [published, setPublished] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [saved, setSaved] = React.useState<{ code: string; href: string } | null>(null);
  const [saveError, setSaveError] = React.useState<string>("");
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  const catalogue = useModelCatalogue();
  const selectedModel = catalogue.selected;
  const missing = React.useMemo(() => missingFields(draft), [draft]);
  const progress = React.useMemo(() => progressOf(draft), [draft]);
  const complete = missing.length === 0;

  /**
   * Writes the brief.
   *
   * This used to be `setPublished(true)` — the button showed "Brief published"
   * and linked to a workspace that contained nothing, because no write path
   * existed. Now it posts to /api/brief and renders what actually came back.
   */
  async function copyBrief(code: string, draft: BriefDraft) {
    await copyToClipboard(briefAsText(code, draft));
  }

  function downloadMarkdown(code: string, draft: BriefDraft, turns: Turn[]) {
    downloadText(code || "brief", renderBriefMarkdown(code, draft, turns));
  }

  async function publish() {
    setSaving(true);
    setSaveError("");
    setPublished(true);
    try {
      const res = await fetch("/api/brief", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ draft, turns }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setSaved(null);
        setSaveError(
          typeof data.error === "string"
            ? data.error
            : `The server refused to save this brief (${res.status}).`,
        );
        return;
      }
      setSaved({ code: data.code, href: data.href ?? `/briefs/${data.code}` });
    } catch (error) {
      setSaved(null);
      setSaveError(
        error instanceof Error
          ? `Could not reach the server: ${error.message}`
          : "Could not reach the server.",
      );
    } finally {
      setSaving(false);
    }
  }

  React.useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [turns, busy]);

  async function send(text: string) {
    const message = text.trim();
    if (!message || busy) return;

    setInput("");
    setBusy(true);
    setTurns((t) => [...t, { id: `u-${Date.now()}`, role: "user", text: message, fields: [] }]);

    try {
      const messages = [...turns, { role: "user" as const, text: message }]
        .filter((t) => t.role === "user" || t.role === "assistant")
        .slice(-20)
        .map((t) => ({ role: t.role, text: t.text }));

      const res = await fetch("/api/brief/turn", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ messages, draft, brandName, model: selectedModel }),
      });

      if (!res.ok) throw new Error("The assistant did not respond.");

      const data = (await res.json()) as {
        reply: string;
        draft: BriefDraft;
        fieldsFilledThisTurn: string[];
        simulated: boolean;
        model: string;
      };

      setDraft(data.draft);
      setModel(data.model);
      setSimulated(data.simulated);
      setTurns((t) => [
        ...t,
        {
          id: `a-${Date.now()}`,
          role: "assistant",
          text: data.reply,
          fields: data.fieldsFilledThisTurn,
          simulated: data.simulated,
        },
      ]);
    } catch {
      setTurns((t) => [
        ...t,
        {
          id: `a-err-${Date.now()}`,
          role: "assistant",
          text: "I could not reach the assistant. Check the dev server and try again — nothing you have said so far has been lost.",
          fields: [],
        },
      ]);
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setDraft(EMPTY_DRAFT);
    setTurns([
      {
        id: "seed",
        role: "assistant",
        text: `Starting again. Tell me about the campaign however it comes out — messy is fine.`,
        fields: [],
      },
    ]);
    setPublished(false);
  }

  return (
    <div className="container-x pb-24 pt-10 md:pt-14">
      <div className="mb-10 max-w-3xl">
        <div className="label-xs mb-4">AI-assisted brief builder</div>
        <h1 className="display-lg">
          Say it badly. Get a brief a creator can <span className="serif-italic text-cream-gradient">quote against</span>.
        </h1>
        <p className="mt-5 text-balance-pretty text-[15px] leading-relaxed text-ink-muted">
          The assistant never searches for creators and never invents one. It only turns what you
          say into the fields a contract needs — content type, format, commercial use, budget and
          deadline — and asks for whatever is still missing.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.35fr_1fr]">
        {/* ── conversation ── */}
        <div className="flex min-h-[30rem] flex-col overflow-hidden rounded-xl border border-line bg-surface lg:min-h-[36rem]">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-3.5">
            <div className="flex items-center gap-2.5">
              <span className="grid size-7 place-items-center rounded-lg border border-caramel/35 bg-caramel/10">
                <Sparkles className="size-3.5 text-caramel" />
              </span>
              <div>
                <div className="text-[13px] font-medium leading-none text-ink">Brief assistant</div>
                <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.12em] text-ink-faint">
                  {simulated ? "deterministic engine" : model || "gemini"}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <ModelPicker catalogue={catalogue} />
              <button
                onClick={reset}
                className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-ink-faint transition-colors hover:text-ink"
              >
                <RotateCcw className="size-2.5" />
                restart
              </button>
            </div>
          </div>

          <div ref={scrollRef} className="flex-1 space-y-5 overflow-y-auto px-5 py-6">
            {turns.map((t) => (
              <motion.div
                key={t.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                className={cn("flex flex-col gap-2", t.role === "user" && "items-end")}
              >
                <div
                  className={cn(
                    "max-w-[86%] whitespace-pre-wrap text-[13.5px] leading-relaxed",
                    t.role === "user"
                      ? "rounded-2xl rounded-br-md border border-line bg-surface-2 px-4 py-2.5 text-ink"
                      : "rounded-2xl rounded-bl-md bg-caramel/[0.07] px-4 py-2.5 text-ink-2",
                  )}
                >
                  {t.text}
                </div>
                {t.fields.length > 0 && (
                  <div className="flex max-w-[86%] flex-wrap gap-1">
                    {t.fields.map((f) => (
                      <span
                        key={f}
                        className="inline-flex items-center gap-1 rounded-full border border-mint/35 bg-mint/[0.08] px-2 py-[3px] font-mono text-[9.5px] uppercase tracking-[0.1em] text-mint"
                      >
                        <CircleCheck className="size-2.5" />
                        {FIELD_LABEL[f] ?? f}
                      </span>
                    ))}
                  </div>
                )}
              </motion.div>
            ))}

            {busy && (
              <div className="flex items-center gap-2.5 text-[13px] text-ink-faint">
                <Loader2 className="size-3.5 animate-spin text-caramel" />
                reading that…
              </div>
            )}
          </div>

          {/* suggestions */}
          {turns.length <= 1 && (
            <div className="border-t border-line px-5 py-3.5">
              <Label>Not sure where to start? Try</Label>
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {SUGGESTION_POOL.map((s) => (
                  <button
                    key={s.label}
                    onClick={() => void send(s.text)}
                    className="chip transition-colors hover:border-line-strong hover:text-ink-2"
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="border-t border-line p-4">
            <div className="relative">
              <Textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void send(input);
                  }
                }}
                placeholder="Describe the campaign however it comes out…"
                rows={2}
                className="min-h-[64px] pr-14"
                disabled={busy}
              />
              <Button
                size="icon"
                variant="accent"
                className="absolute bottom-3 right-3"
                onClick={() => void send(input)}
                disabled={busy || !input.trim()}
                aria-label="Send"
              >
                <ArrowUp className="size-4" />
              </Button>
            </div>
            <p className="mt-2 font-mono text-[10px] text-ink-faint">
              Enter to send · Shift+Enter for a new line · the conversation is preserved verbatim and
              re-shown to the creator
            </p>
          </div>
        </div>

        {/* ── live draft ── */}
        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <div className="overflow-hidden rounded-xl border border-line bg-surface">
            <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
              <div className="flex items-center gap-2.5">
                <FileText className="size-3.5 text-caramel" />
                <span className="text-[13px] font-medium text-ink">Structured brief</span>
              </div>
              <span
                className={cn(
                  "font-mono text-[11px] tabular-nums",
                  complete ? "text-mint" : "text-ink-faint",
                )}
              >
                {progress}%
              </span>
            </div>

            <div className="px-5 py-3">
              <Meter value={progress} tone={complete ? "mint" : "caramel"} />
            </div>

            <div className="divide-y divide-line/70">
              <DraftRow label="Content type">
                {draft.contentTypes.length ? (
                  draft.contentTypes.map((c) => (
                    <Badge key={c} tone="caramel">
                      {CONTENT_TYPE_META[c].label}
                    </Badge>
                  ))
                ) : (
                  <Missing tag="contentType" />
                )}
              </DraftRow>

              <DraftRow label="Formats">
                {draft.aspectRatios.length ? (
                  draft.aspectRatios.map((a) => (
                    <Badge key={a} tone="neutral">
                      {a}
                    </Badge>
                  ))
                ) : (
                  <Missing tag="format" />
                )}
              </DraftRow>

              <DraftRow label="Deliverables">
                {draft.deliverables.length ? (
                  <span className="text-[12.5px] text-ink">
                    {draft.deliverables.reduce((s, d) => s + d.quantity, 0)} assets across{" "}
                    {draft.deliverables.length} type{draft.deliverables.length > 1 ? "s" : ""}
                    {draft.deliverables[0]?.durationSeconds
                      ? ` · ${draft.deliverables[0].durationSeconds}s`
                      : ""}
                  </span>
                ) : (
                  <Missing tag="deliverables" />
                )}
              </DraftRow>

              <DraftRow label="Audience">
                {draft.audience ? (
                  <span className="line-clamp-3 text-[12.5px] leading-relaxed text-ink">{draft.audience}</span>
                ) : (
                  <Missing tag="audience" />
                )}
              </DraftRow>

              <DraftRow label="Style & tone">
                {draft.styleTags.length || draft.tone.length ? (
                  <div className="flex flex-wrap gap-1.5">
                    {draft.styleTags.map((s) => (
                      <span key={s} className="chip">
                        {s}
                      </span>
                    ))}
                    {draft.tone.map((s) => (
                      <span key={s} className="chip border-caramel/30 text-caramel">
                        {s}
                      </span>
                    ))}
                  </div>
                ) : (
                  <Missing tag="style" />
                )}
              </DraftRow>

              <DraftRow label="Commercial use">
                {draft.commercialUse.territory && (draft.commercialUse.durationMonths || draft.commercialUse.perpetual) ? (
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap gap-1.5">
                      <Badge tone="violet">{draft.commercialUse.territory}</Badge>
                      <Badge tone="violet">
                        {draft.commercialUse.perpetual
                          ? "perpetual"
                          : `${draft.commercialUse.durationMonths} months`}
                      </Badge>
                      <Badge tone={draft.commercialUse.paidMediaAllowed ? "mint" : "neutral"}>
                        {draft.commercialUse.paidMediaAllowed ? "paid media" : "organic only"}
                      </Badge>
                      <Badge tone={draft.commercialUse.competitorUseBlocked ? "mint" : "neutral"}>
                        {draft.commercialUse.competitorUseBlocked ? "exclusive" : "non-exclusive"}
                      </Badge>
                      <Badge tone={draft.commercialUse.modelTrainingAllowed ? "rose" : "mint"}>
                        {draft.commercialUse.modelTrainingAllowed ? "model training allowed" : "no model training"}
                      </Badge>
                    </div>
                    {draft.targetChannels.length > 0 && (
                      <p className="text-[11.5px] text-ink-faint">{draft.targetChannels.join(" · ")}</p>
                    )}
                  </div>
                ) : (
                  <Missing tag="rights" />
                )}
              </DraftRow>

              <DraftRow label="Budget">
                {draft.budgetMaxInr ? (
                  <span className="font-mono text-[13px] tabular-nums text-ink">
                    {compactInr(draft.budgetMinInr)} – {compactInr(draft.budgetMaxInr)}
                  </span>
                ) : (
                  <Missing tag="budget" />
                )}
              </DraftRow>

              <DraftRow label="Timeline">
                {draft.turnaroundDays ? (
                  <div className="flex flex-wrap gap-1.5">
                    <Badge tone="neutral">{draft.turnaroundDays} days</Badge>
                    {draft.revisionsIncluded > 0 && (
                      <Badge tone="neutral">{draft.revisionsIncluded} revisions</Badge>
                    )}
                    {draft.conceptRoundsIncluded > 0 && (
                      <Badge tone="neutral">{draft.conceptRoundsIncluded} concept rounds</Badge>
                    )}
                  </div>
                ) : (
                  <Missing tag="timeline" />
                )}
              </DraftRow>

              {draft.excludedStyles.length > 0 && (
                <DraftRow label="Explicitly excluded">
                  <div className="flex flex-wrap gap-1.5">
                    {draft.excludedStyles.map((s) => (
                      <span key={s} className="chip border-rose/35 text-rose">
                        {s}
                      </span>
                    ))}
                  </div>
                </DraftRow>
              )}
            </div>

            {complete && !published && (
              <div className="border-t border-line p-5">
                <div className="mb-4 flex items-start gap-2.5">
                  <CircleCheck className="mt-0.5 size-4 shrink-0 text-mint" />
                  <p className="text-[12.5px] leading-relaxed text-ink-muted">
                    That is a complete brief. Publish it and CREAM runs it as a query against the
                    creator pool — no model in the loop.
                  </p>
                </div>
                <Button
                  variant="accent"
                  className="w-full"
                  onClick={publish}
                  loading={saving}
                  disabled={saving}
                >
                  Publish and find creators
                </Button>
              </div>
            )}

            {published && saved && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="border-t border-line bg-mint/[0.05] p-5"
              >
                <div className="mb-4 flex items-center gap-2.5">
                  <Wand2 className="size-4 text-mint" />
                  <span className="text-[13px] font-medium text-ink">
                    Brief saved as {saved.code}
                  </span>
                </div>
                <p className="text-[12.5px] leading-relaxed text-ink-muted">
                  Written to Postgres with the conversation attached verbatim — the creator will
                  see this exact exchange alongside the restated brief.
                </p>
                <div className="mt-4 flex flex-col gap-2">
                  <Button asChild variant="primary" size="sm" className="w-full">
                    <Link href={`/briefs/${saved.code}`}>Open the brief</Link>
                  </Button>
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => downloadMarkdown(saved.code, draft, turns)}
                    >
                      Export .md
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyBrief(saved.code, draft)}
                    >
                      Copy as text
                    </Button>
                  </div>
                  <Button asChild variant="outline" size="sm" className="w-full">
                    <Link href="/discover">Browse creators meanwhile</Link>
                  </Button>
                </div>
              </motion.div>
            )}

            {published && !saved && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="border-t border-line p-5"
              >
                <div className="mb-3 flex items-center gap-2.5">
                  <TriangleAlert className="size-4 text-caramel" />
                  <span className="text-[13px] font-medium text-ink">Not saved</span>
                </div>
                <p className="text-[12.5px] leading-relaxed text-ink-muted">{saveError}</p>
                <div className="mt-4 flex flex-col gap-2">
                  <Button variant="outline" size="sm" className="w-full" onClick={publish}>
                    Try again
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full"
                    onClick={() => downloadMarkdown("UNSAVED", draft, turns)}
                  >
                    Export anyway
                  </Button>
                </div>
              </motion.div>
            )}
          </div>

          {/* what's missing */}
          <div className="rounded-xl border border-line bg-surface p-5">
            <div className="mb-3.5 flex items-center justify-between">
              <Label>Still open</Label>
              <span className="font-mono text-[10.5px] tabular-nums text-ink-faint">
                {missing.length}/{10 - 1}
              </span>
            </div>
            {missing.length === 0 ? (
              <p className="flex items-start gap-2 text-[12.5px] leading-relaxed text-mint">
                <CircleCheck className="mt-0.5 size-3.5 shrink-0" />
                Nothing outstanding. Every field a creator needs in order to quote is filled.
              </p>
            ) : (
              <ul className="space-y-2.5">
                {missing.map((m: MissingField) => (
                  <li key={m} className="flex gap-2.5">
                    <CircleDashed className="mt-0.5 size-3.5 shrink-0 text-ink-faint" />
                    <div>
                      <div className="text-[12.5px] text-ink-2">{MISSING_META[m].label}</div>
                      <p className="mt-0.5 text-[11.5px] leading-relaxed text-ink-faint">
                        {MISSING_META[m].why}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-4 flex gap-2 border-t border-line pt-3.5 text-[11px] leading-relaxed text-ink-faint">
              <Compass className="mt-0.5 size-3 shrink-0" />
              The assistant asks for these in order of how much they change the price. Territory and
              duration come before style, because rights move a job by lakhs and mood adjectives do
              not.
            </p>
          </div>

          <div className="rounded-xl border border-dashed border-line bg-surface/40 p-4">
            <Label>Format reference</Label>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {ASPECT_RATIOS.map((a) => (
                <span key={a.id} className="chip" title={a.usage}>
                  {a.id}
                </span>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

/**
 * Model selection lives here, in the interface, because the catalogue is not
 * a compile-time fact. Nothing in this file names a specific model.
 */
function ModelPicker({
  catalogue,
}: {
  catalogue: {
    models: ModelOption[];
    state: "loading" | "ready" | "unavailable";
    reason: string | null;
    selected: string | null;
    setSelected: (id: string) => void;
  };
}) {
  const [open, setOpen] = React.useState(false);
  const { models, state, reason, selected, setSelected } = catalogue;

  if (state === "loading") {
    return (
      <span className="inline-flex h-8 items-center gap-1.5 rounded-full border border-line px-3 font-mono text-[10px] uppercase tracking-[0.1em] text-ink-faint">
        <Loader2 className="size-2.5 animate-spin" />
        models
      </span>
    );
  }

  if (state === "unavailable") {
    return (
      <span
        title={reason ?? undefined}
        className="inline-flex h-8 cursor-help items-center gap-1.5 rounded-full border border-dashed border-line px-3 font-mono text-[10px] uppercase tracking-[0.1em] text-ink-faint"
      >
        <CircleDashed className="size-2.5" />
        no model
      </span>
    );
  }

  const current = models.find((m) => m.id === selected) ?? models[0];

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="inline-flex h-8 items-center gap-1.5 rounded-full border border-line bg-surface-2/60 pl-3 pr-2.5 text-[11.5px] text-ink-2 transition-colors hover:border-line-strong"
      >
        <span className="max-w-28 truncate">{current?.label ?? current?.id}</span>
        <ChevronDown className={cn("size-3 shrink-0 transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-40 mt-2 w-72 overflow-hidden rounded-xl border border-line bg-surface shadow-e3">
            <div className="border-b border-line px-4 py-2.5">
              <div className="font-mono text-[9.5px] uppercase tracking-[0.12em] text-ink-faint">
                {models.length} models this key can call
              </div>
            </div>
            <div className="max-h-72 overflow-y-auto">
              {models.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => {
                    setSelected(m.id);
                    setOpen(false);
                  }}
                  className={cn(
                    "block w-full px-4 py-2.5 text-left transition-colors hover:bg-surface-2",
                    m.id === selected && "bg-caramel/[0.08]",
                  )}
                >
                  <span
                    className={cn(
                      "block truncate text-[12.5px]",
                      m.id === selected ? "text-caramel" : "text-ink",
                    )}
                  >
                    {m.label}
                  </span>
                  <span className="mt-0.5 block truncate font-mono text-[10px] text-ink-faint">
                    {m.id}
                    {m.contextWindow ? ` · ${Math.round(m.contextWindow / 1000)}k ctx` : ""}
                  </span>
                </button>
              ))}
            </div>
            <div className="border-t border-line px-4 py-2.5">
              <p className="text-[10.5px] leading-relaxed text-ink-faint">
                Read from the API at runtime. A model this key cannot call is never offered.
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function DraftRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[96px_1fr] gap-3 px-5 py-3.5">
      <Label className="pt-0.5">{label}</Label>
      <div className="flex min-w-0 flex-wrap items-center gap-1.5">{children}</div>
    </div>
  );
}

function Missing({ tag }: { tag: MissingField }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-line px-2 py-[3px] text-[11px] text-ink-faint">
      <CircleDashed className="size-2.5" />
      {MISSING_META[tag].label}
    </span>
  );
}