"use client";

import * as React from "react";
import { X, Layers, Clock, Award, Eye, TrendingUp, FileCheck2, ShieldCheck, Quote } from "lucide-react";
import type { PortfolioPiece, Workflow } from "@/lib/domain/types";
import { CONTENT_TYPE_META } from "@/lib/domain/types";
import { SKILL_NAME_BY_ID, toolById } from "@/lib/domain/taxonomy";
import { compactNumber, formatDate, cn } from "@/lib/utils";
import { GenerativeArt } from "@/components/media/generative-art";
import { Badge, Label } from "@/components/ui/primitives";

export function PieceCard({ piece, onOpen }: { piece: PortfolioPiece; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group relative block w-full overflow-hidden rounded-lg border border-line bg-surface text-left transition-all duration-300 hover:-translate-y-0.5 hover:border-line-strong hover:shadow-e3"
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-surface-2">
        <GenerativeArt
          seed={piece.artSeed}
          palette={piece.palette}
          ratio="4/3"
          chrome
          className="size-full transition-transform duration-[900ms] ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.05]"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-surface/95 via-transparent to-transparent" />

        <div className="absolute left-3 top-3 flex items-center gap-1.5">
          <span className="rounded-full border border-line bg-bg/70 px-2 py-1 font-mono text-[9.5px] uppercase tracking-[0.12em] text-ink-2 backdrop-blur-md">
            {piece.aspectRatio}
          </span>
          {piece.license && (
            <span className="inline-flex h-[20px] items-center gap-1 whitespace-nowrap rounded-full border border-mint/45 bg-bg/85 px-2 font-mono text-[9.5px] uppercase leading-none tracking-[0.1em] text-mint backdrop-blur-md">
              <ShieldCheck className="size-2.5" />
              open licence
            </span>
          )}
        </div>

        <div className="absolute inset-x-0 bottom-0 p-3">
          <div className="flex items-baseline justify-between gap-2">
            <span className="truncate font-mono text-[10px] uppercase tracking-[0.14em] text-ink-faint">
              {piece.client ?? piece.industry}
            </span>
            <span className="font-mono text-[10px] tabular-nums text-ink-faint">{piece.year}</span>
          </div>
        </div>
      </div>

      <div className="space-y-2.5 p-3.5">
        <h3 className="text-[14px] font-medium leading-tight text-ink">{piece.title}</h3>
        <p className="line-clamp-2 text-[12px] leading-relaxed text-ink-muted">{piece.summary}</p>
        <div className="flex flex-wrap gap-1 pt-0.5">
          {piece.tools.slice(0, 3).map((t) => (
            <span key={t} className="chip px-1.5 py-0.5 text-[10px]">
              {toolById(t)?.name ?? t}
            </span>
          ))}
          {piece.tools.length > 3 && (
            <span className="chip px-1.5 py-0.5 text-[10px]">+{piece.tools.length - 3}</span>
          )}
        </div>
      </div>
    </button>
  );
}

/* ── detail sheet ─────────────────────────────────────────────────────────── */

export function PieceDialog({
  piece,
  workflow,
  onClose,
}: {
  piece: PortfolioPiece;
  workflow?: Workflow;
  onClose: () => void;
}) {
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  const stageTotal = workflow?.durationHours ?? 0;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-3 sm:p-6">
      <div className="fixed inset-0 bg-bg/85 backdrop-blur-md" onClick={onClose} aria-hidden />
      <div className="relative my-auto w-full max-w-4xl overflow-hidden rounded-2xl border border-line bg-surface shadow-e4">
        <div className="flex items-start justify-between gap-4 border-b border-line p-5">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="neutral">{CONTENT_TYPE_META[piece.contentType].label}</Badge>
              <Badge tone="neutral">{piece.aspectRatio}</Badge>
              {piece.client && <Badge tone="caramel">{piece.client}</Badge>}
            </div>
            <h2 className="mt-3 font-display text-[28px] leading-tight tracking-[-0.025em] text-ink">
              {piece.title}
            </h2>
            <p className="mt-2 max-w-2xl text-[14px] leading-relaxed text-ink-muted">{piece.summary}</p>
          </div>
          <button
            onClick={onClose}
            className="grid size-8 shrink-0 place-items-center rounded-full border border-line text-ink-muted transition-colors hover:border-line-strong hover:text-ink"
            aria-label="Close"
          >
            <X className="size-3.5" />
          </button>
        </div>

        <div className="grid gap-6 p-5 lg:grid-cols-[1.25fr_1fr]">
          <div className="space-y-5">
            <div className="relative aspect-[4/3] overflow-hidden rounded-xl border border-line">
              <GenerativeArt seed={piece.artSeed} palette={piece.palette} ratio="4/3" chrome className="size-full" />
              <div className="pointer-events-none absolute inset-0 grid place-content-center">
                <div className="rounded-md border border-white/15 bg-black/35 px-4 py-2 text-center backdrop-blur-[2px]">
                  <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/85">
                    {piece.client ?? "CREAM"} · {piece.title.toUpperCase()}
                  </div>
                  <div className="mt-1 font-mono text-[9px] uppercase tracking-[0.16em] text-white/50">
                    pre-approval watermark · not licensed for use
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {piece.metrics.views && (
                <Metric icon={Eye} label="Views" value={compactNumber(piece.metrics.views)} />
              )}
              {piece.metrics.engagementRate && (
                <Metric icon={TrendingUp} label="Engagement" value={`${piece.metrics.engagementRate}%`} />
              )}
              <Metric icon={Clock} label="Duration" value={`${stageTotal}h`} />
              <Metric icon={Award} label="Awards" value={String(piece.metrics.awardCount)} />
            </div>

            <div>
              <Label>Tags</Label>
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {piece.tags.map((t) => (
                  <span key={t} className="chip">
                    {t}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-5">
            <div>
              <Label>Toolchain</Label>
              <ul className="mt-2.5 space-y-1.5">
                {piece.tools.map((id) => {
                  const t = toolById(id);
                  return (
                    <li
                      key={id}
                      className="flex items-center justify-between gap-3 rounded-lg border border-line bg-surface-2/40 px-3 py-2"
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <span
                          className="size-2 shrink-0 rounded-full"
                          style={{ background: t?.accent ?? "var(--line-strong)" }}
                        />
                        <span className="truncate text-[12.5px] text-ink">{t?.name ?? id}</span>
                      </span>
                      <span className="flex shrink-0 items-center gap-1.5">
                        {t?.verified ? (
                          <Badge tone="mint">
                            <ShieldCheck className="size-2.5" />
                            {t.verifiedVia === "vendor-credential" ? "vendor" : "telemetry"}
                          </Badge>
                        ) : (
                          <Badge tone="neutral">attested</Badge>
                        )}
                      </span>
                    </li>
                  );
                })}
              </ul>
              {piece.models.length > 0 && (
                <>
                  <Label className="mt-5 block">Models</Label>
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    {piece.models.map((m) => (
                      <span key={m} className="chip font-mono text-[10.5px]">
                        {m}
                      </span>
                    ))}
                  </div>
                </>
              )}
            </div>

            <div>
              <Label>Skills applied</Label>
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {piece.skills.map((s) => (
                  <span key={s} className="chip">
                    {SKILL_NAME_BY_ID.get(s) ?? s}
                  </span>
                ))}
              </div>
            </div>

            {piece.license && (
              <div className="rounded-lg border border-mint/30 bg-mint/[0.06] p-4">
                <div className="flex items-center gap-2 text-mint">
                  <FileCheck2 className="size-3.5" />
                  <span className="font-mono text-[10px] uppercase tracking-[0.14em]">Licence</span>
                </div>
                <p className="mt-2 text-[12.5px] leading-relaxed text-ink-2">{piece.license}</p>
              </div>
            )}

            {workflow && (
              <div className="rounded-lg border border-line bg-surface-2/30 p-4">
                <div className="flex items-center gap-2">
                  <Layers className="size-3.5 text-caramel" />
                  <span className="text-[13px] font-medium text-ink">{workflow.name}</span>
                </div>
                <p className="mt-2 text-[12.5px] leading-relaxed text-ink-muted">{workflow.summary}</p>
                <ol className="mt-4 space-y-2.5">
                  {workflow.stages.map((s, i) => (
                    <li key={s.id} className="flex gap-3">
                      <span className="mt-0.5 font-mono text-[10px] tabular-nums text-ink-faint">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-baseline gap-2">
                          <span className="text-[12.5px] text-ink">{s.name}</span>
                          <span className="font-mono text-[10px] text-caramel">{s.weight}%</span>
                        </div>
                        <p className="mt-0.5 text-[11.5px] leading-relaxed text-ink-faint">{s.humanCheckpoint}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              </div>
            )}

            <p className="flex gap-2 border-t border-line pt-4 text-[11.5px] leading-relaxed text-ink-faint">
              <Quote className="mt-0.5 size-3 shrink-0" />
              Provenance for this work is verifiable through CREAM&apos;s stamper. Pre-approval
              assets carry a dual-branded burn-in and an extractable watermark by contract.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Metric({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="rounded-lg border border-line bg-surface-2/40 px-3 py-2.5">
      <div className="flex items-center gap-1.5">
        <Icon className="size-3 text-ink-faint" />
        <span className="label-xs">{label}</span>
      </div>
      <div className="mt-1.5 font-display text-[18px] leading-none tabular-nums text-ink">{value}</div>
    </div>
  );
}

export function PieceGallery({
  pieces,
  contentTypeFilter,
}: {
  pieces: PortfolioPiece[];
  contentTypeFilter?: string;
}) {
  const shown = React.useMemo(
    () => (contentTypeFilter ? pieces.filter((p) => p.contentType === contentTypeFilter) : pieces),
    [pieces, contentTypeFilter],
  );
  const [open, setOpen] = React.useState<PortfolioPiece | null>(null);

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {shown.map((p) => (
          <PieceCard key={p.id} piece={p} onOpen={() => setOpen(p)} />
        ))}
      </div>
      {open && (
        <PieceDialog
          piece={open}
          workflow={undefined}
          onClose={() => setOpen(null)}
        />
      )}
    </>
  );
}

export { formatDate, cn };