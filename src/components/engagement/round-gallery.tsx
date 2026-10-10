"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Check,
  CircleCheck,
  MessageSquare,
  Play,
  Sparkles,
  TriangleAlert,
  X,
} from "lucide-react";
import type { GenerationRound, RoundStatus } from "@/lib/domain/types";
import { cn, formatDateTime } from "@/lib/utils";
import { Badge, Button, Label, Textarea, inputClasses } from "@/components/ui/primitives";
import { GenerativeArt } from "@/components/media/generative-art";

const ROUND_TONE: Record<RoundStatus, { badge: "neutral" | "ink" | "caramel" | "mint" | "rose" | "violet"; dot: string }> = {
  queued: { badge: "neutral", dot: "bg-ink-faint" },
  generating: { badge: "violet", dot: "bg-violet" },
  "in-review": { badge: "caramel", dot: "bg-caramel" },
  "changes-requested": { badge: "rose", dot: "bg-rose" },
  approved: { badge: "mint", dot: "bg-mint" },
};

export interface RoundOverride {
  status: RoundStatus;
  approvedAt: string | null;
  feedback: string | null;
}

export function RoundGallery({
  rounds,
  creatorName,
  overrides,
  onApprove,
  onRequestChanges,
}: {
  rounds: GenerationRound[];
  creatorName: string;
  overrides: Record<string, RoundOverride>;
  onApprove: (id: string) => void;
  onRequestChanges: (id: string, note: string) => void;
}) {
  const [openFeedback, setOpenFeedback] = React.useState<string | null>(null);
  const [note, setNote] = React.useState("");

  if (rounds.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-line bg-surface/40 px-6 py-8 text-center">
        <Play className="mx-auto size-4 text-ink-faint" />
        <p className="mt-3 text-[13px] leading-relaxed text-ink-muted">
          No generation rounds on this engagement. Rounds cannot start until the escrow is captured and
          both signatures are on the start contract.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {rounds.map((r) => {
        const over = overrides[r.id];
        const status = over?.status ?? r.status;
        const tone = ROUND_TONE[status];
        const approvedAt = over?.approvedAt ?? r.approvedAt;
        const feedback = over?.feedback ?? r.feedback;
        const locked = status === "approved";

        return (
          <article key={r.id} className="overflow-hidden rounded-xl border border-line bg-surface">
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-line px-5 py-4">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2.5">
                  <span className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-ink-faint">
                    round {String(r.index).padStart(2, "0")}
                  </span>
                  <span className="text-[15px] font-medium text-ink">{r.label}</span>
                  <Badge tone={tone.badge} className="gap-1.5">
                    <span className={cn("size-1.5 rounded-full", tone.dot)} aria-hidden />
                    {status.replace(/-/g, " ")}
                  </Badge>
                </div>
                <p className="mt-2 font-mono text-[10.5px] tabular-nums text-ink-faint">
                  raised {formatDateTime(r.createdAt)} · {r.samples.length} samples
                  {approvedAt ? ` · approved ${formatDateTime(approvedAt)}` : ""}
                </p>
              </div>

              <div className="flex shrink-0 flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  variant={locked ? "subtle" : "primary"}
                  disabled={locked}
                  onClick={() => onApprove(r.id)}
                >
                  <Check className="size-3.5" />
                  {locked ? "Approved" : "Approve round"}
                </Button>
                <Button
                  size="sm"
                  variant={status === "changes-requested" ? "subtle" : "outline"}
                  onClick={() => {
                    setOpenFeedback((v) => (v === r.id ? null : r.id));
                    setNote(feedback ?? "");
                  }}
                >
                  <MessageSquare className="size-3.5" />
                  Request changes
                </Button>
              </div>
            </div>

            <div className="grid gap-6 p-5 lg:grid-cols-[1.6fr_1fr]">
              <div>
                <div className="flex items-center justify-between gap-3">
                  <Label>Samples · burn-in applied</Label>
                  <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-faint">
                    {r.samples.length} frames
                  </span>
                </div>
                <div className="mt-3.5 grid gap-3 sm:grid-cols-2">
                  {r.samples.map((s) => (
                    <figure
                      key={s.id}
                      className="group relative overflow-hidden rounded-lg border border-line bg-surface-2"
                    >
                      <div className="relative">
                        <GenerativeArt
                          seed={s.artSeed}
                          palette={s.palette}
                          ratio={s.aspectRatio.replace(":", "/")}
                          variant="frame"
                          chrome
                          className="w-full"
                        />
                        <div className="pointer-events-none absolute inset-0 grid place-content-center">
                          <div className="px-3 py-2 text-center">
                            <div
                              className="rounded-md border border-white/18 bg-[oklch(0_0_0/0.42)] px-3 py-1.5 backdrop-blur-[2px]"
                              style={{ opacity: 0.82 }}
                            >
                              <div className="font-mono text-[9.5px] uppercase tracking-[0.18em] text-white/90">
                                {creatorName} · CREAM
                              </div>
                              <div className="mt-1 font-mono text-[8.5px] uppercase tracking-[0.14em] text-white/55">
                                pre-approval watermark · not licensed for use
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                      <figcaption className="flex items-center justify-between gap-3 border-t border-line px-3 py-2.5">
                        <span className="truncate text-[12px] text-ink-2">{s.title}</span>
                        <span className="shrink-0 font-mono text-[10px] tabular-nums text-ink-faint">
                          {s.aspectRatio}
                        </span>
                      </figcaption>
                    </figure>
                  ))}
                </div>
                <p className="mt-3 text-[11px] leading-relaxed text-ink-faint">
                  The burn-in is dual-branded and contractually non-removable. It stays until final
                  approval, at which point the licence attaches and the visible mark is retired —
                  the invisible envelope and the signed manifest do not retire with it.
                </p>
              </div>

              <div className="space-y-5">
                <div>
                  <Label>Tool chain</Label>
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    {r.toolChain.map((t) => (
                      <span key={t} className="chip px-2 py-0.5 font-mono text-[10px]">
                        {t}
                      </span>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="flex items-center gap-2">
                    <Sparkles className="size-3 text-caramel" />
                    <Label>Prompt lineage</Label>
                  </div>
                  <ol className="mt-2.5 space-y-0 border-l border-line pl-4">
                    {r.promptLineage.map((p, i) => (
                      <li key={p} className="relative py-2">
                        <span className="absolute -left-[1.35rem] top-[9px] font-mono text-[9px] tabular-nums text-caramel">
                          {String(i + 1).padStart(2, "0")}
                        </span>
                        <p className="font-mono text-[11.5px] leading-relaxed text-ink-2">{p}</p>
                      </li>
                    ))}
                  </ol>
                  <p className="mt-2.5 text-[11px] leading-relaxed text-ink-faint">
                    Every generation the creator kept, in the order it was kept. This is what makes a
                    rejected frame arguable rather than a matter of taste.
                  </p>
                </div>
              </div>
            </div>

            <AnimatePresence initial={false}>
              {feedback && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
                  className="overflow-hidden border-t border-line"
                >
                  <div
                    className={cn(
                      "flex items-start gap-3 px-5 py-4",
                      status === "changes-requested"
                        ? "bg-rose/[0.05]"
                        : "bg-mint/[0.05]",
                    )}
                  >
                    {status === "changes-requested" ? (
                      <TriangleAlert className="mt-0.5 size-3.5 shrink-0 text-rose" />
                    ) : (
                      <CircleCheck className="mt-0.5 size-3.5 shrink-0 text-mint" />
                    )}
                    <div className="min-w-0">
                      <Label>
                        {status === "changes-requested" ? "Changes requested" : "Round feedback"}
                      </Label>
                      <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink-2">{feedback}</p>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence initial={false}>
              {openFeedback === r.id && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
                  className="overflow-hidden border-t border-line bg-bg-deep/30"
                >
                  <div className="px-5 py-5">
                    <div className="flex items-start gap-2.5">
                      <TriangleAlert className="mt-0.5 size-3.5 shrink-0 text-caramel" />
                      <p className="text-[12px] leading-relaxed text-ink-muted">
                        Prototype control. This writes to local component state only — nothing is sent
                        to the creator, no contract clause is amended and no milestone is released. On
                        a live deployment the note attaches to the round and re-opens the next revision
                        allowance against the engagement-start contract.
                      </p>
                    </div>
                    <div className="relative mt-3.5">
                      <Textarea
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        rows={3}
                        placeholder="Name the specific frame, the specific beat, the specific change…"
                        className={cn(inputClasses, "min-h-[76px]")}
                      />
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <Button
                        size="sm"
                        variant="accent"
                        disabled={!note.trim()}
                        onClick={() => {
                          onRequestChanges(r.id, note.trim());
                          setOpenFeedback(null);
                          setNote("");
                        }}
                      >
                        <TriangleAlert className="size-3.5" />
                        Submit change request
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setOpenFeedback(null);
                          setNote("");
                        }}
                      >
                        <X className="size-3.5" />
                        cancel
                      </Button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </article>
        );
      })}
    </div>
  );
}
