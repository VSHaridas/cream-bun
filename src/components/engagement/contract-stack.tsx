"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Check,
  ChevronDown,
  CircleCheck,
  Fingerprint,
  Gavel,
  Lock,
  LockOpen,
  Milestone,
  ShieldCheck,
} from "lucide-react";
import type { Contract } from "@/lib/domain/types";
import { formatDateTime } from "@/lib/utils";
import { Badge, Label } from "@/components/ui/primitives";

/* ── 2 · the gated stage rail ─────────────────────────────────────────────── */

export interface GateSpec {
  key: string;
  label: string;
  gate: string;
  state: "done" | "open" | "locked";
  detail: string;
}

export function StageRail({ gates }: { gates: GateSpec[] }) {
  return (
    <div className="overflow-hidden rounded-xl border border-line bg-surface">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
        <div className="flex items-center gap-2.5">
          <Milestone className="size-3.5 text-caramel" />
          <span className="text-[14px] font-medium text-ink">Gated stage rail</span>
        </div>
        <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-faint">
          nothing advances without the gate beneath it
        </span>
      </div>

      <ol className="grid gap-px bg-line sm:grid-cols-3 lg:grid-cols-6">
        {gates.map((g, i) => {
          const done = g.state === "done";
          const open = g.state === "open";
          return (
            <li
              key={g.key}
              className="relative bg-surface px-4 py-5 transition-colors hover:bg-surface-2/40"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-faint">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span
                  className={`grid size-5 place-items-center rounded-full border ${
                    done
                      ? "border-mint/50 bg-mint/12 text-mint"
                      : open
                        ? "border-caramel/50 bg-caramel/12 text-caramel"
                        : "border-line-strong bg-surface-2 text-ink-faint"
                  }`}
                >
                  {done ? (
                    <Check className="size-3" strokeWidth={3} />
                  ) : open ? (
                    <LockOpen className="size-2.5" />
                  ) : (
                    <Lock className="size-2.5" />
                  )}
                </span>
              </div>

              <div
                className={`mt-3 text-[13px] leading-tight ${
                  open ? "text-ink" : done ? "text-ink-2" : "text-ink-faint"
                }`}
              >
                {g.label}
              </div>

              <div
                className={`mt-2 font-mono text-[10px] uppercase tracking-[0.1em] ${
                  done ? "text-mint" : open ? "text-caramel" : "text-ink-faint"
                }`}
              >
                {done ? "satisfied" : open ? "current" : "pending"}
              </div>

              <p className="mt-2.5 text-[11.5px] leading-relaxed text-ink-faint">{g.gate}</p>
              <p className="mt-2 border-t border-line pt-2 text-[11px] leading-relaxed text-ink-muted">
                {g.detail}
              </p>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/* ── 4 · contracts ────────────────────────────────────────────────────────── */

const KIND_LABEL: Record<Contract["kind"], string> = {
  "engagement-start": "Engagement start",
  "engagement-close": "Engagement close",
  cancellation: "Cancellation",
  nda: "Mutual NDA",
};

function Clause({ clause }: { clause: Contract["clauses"][number] }) {
  const [open, setOpen] = React.useState(false);
  return (
    <div className="border-b border-line/70 last:border-b-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 py-3.5 text-left transition-colors hover:bg-surface-2/40"
      >
        <ChevronDown
          className={`size-3.5 shrink-0 text-ink-faint transition-transform ${open ? "rotate-180" : ""}`}
        />
        <span className="flex-1 text-[13px] text-ink-2">{clause.heading}</span>
        {clause.requiresExplicitAcknowledgement && (
          <Badge tone="rose" className="shrink-0 font-mono text-[9px] uppercase tracking-[0.1em]">
            must acknowledge
          </Badge>
        )}
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <p className="pb-4 pl-6.5 pr-4 text-[12.5px] leading-[1.7] text-ink-muted">
              {clause.body}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function ContractStack({ contracts }: { contracts: Contract[] }) {
  if (contracts.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-line bg-surface/40 px-6 py-8 text-center">
        <Lock className="mx-auto size-4 text-ink-faint" />
        <p className="mt-3 text-[13px] leading-relaxed text-ink-muted">
          No contracts on file for this engagement. Nothing can be produced or paid until at least an
          NDA and an engagement-start agreement exist.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {contracts.map((c) => (
        <article key={c.id} className="overflow-hidden rounded-xl border border-line bg-surface">
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-line px-5 py-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-ink-faint">
                  {c.code}
                </span>
                <Badge
                  tone={c.status === "signed" ? "mint" : c.status === "declined" ? "rose" : "caramel"}
                >
                  {c.status}
                </Badge>
                <Badge tone="neutral">{KIND_LABEL[c.kind]}</Badge>
                {c.humanReviewed ? (
                  <Badge tone="violet" className="font-mono text-[9px] uppercase tracking-[0.1em]">
                    <Gavel className="size-2.5" />
                    human reviewed
                  </Badge>
                ) : (
                  <Badge tone="neutral" className="font-mono text-[9px] uppercase tracking-[0.1em]">
                    awaiting human review
                  </Badge>
                )}
              </div>
              <div className="mt-3 flex items-center gap-2">
                <Fingerprint className="size-3.5 shrink-0 text-ink-faint" />
                <code className="truncate font-mono text-[10.5px] text-ink-muted">
                  {c.contentDigest}
                </code>
              </div>
            </div>
            <div className="text-right">
              <Label>Raised</Label>
              <div className="mt-1.5 font-mono text-[11.5px] tabular-nums text-ink-2">
                {formatDateTime(c.createdAt)}
              </div>
              {c.effectiveAt && (
                <div className="mt-1 font-mono text-[10.5px] tabular-nums text-mint">
                  effective {formatDateTime(c.effectiveAt)}
                </div>
              )}
            </div>
          </div>

          <div className="grid gap-px bg-line sm:grid-cols-2">
            {c.signatures.map((s) => (
              <div key={s.party} className="bg-surface px-5 py-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="label-xs">{s.party}</span>
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-[3px] font-mono text-[9.5px] uppercase tracking-[0.1em] ${
                      s.status === "signed"
                        ? "border-mint/40 bg-mint/10 text-mint"
                        : s.status === "declined"
                          ? "border-rose/40 bg-rose/10 text-rose"
                          : "border-caramel/40 bg-caramel/10 text-caramel"
                    }`}
                  >
                    {s.status === "signed" ? (
                      <CircleCheck className="size-2.5" />
                    ) : (
                      <Lock className="size-2.5" />
                    )}
                    {s.status}
                  </span>
                </div>
                <div className="mt-2.5 text-[13.5px] text-ink">{s.partyName}</div>
                <dl className="mt-3 space-y-1.5 font-mono text-[10.5px] tabular-nums">
                  <SigRow k="signed" v={s.signedAt ? formatDateTime(s.signedAt) : "—"} />
                  <SigRow k="ip" v={s.ipAddress ?? "—"} />
                  <SigRow k="digest" v={s.digest ?? "—"} />
                </dl>
              </div>
            ))}
          </div>

          <div className="border-t border-line">
            <div className="flex items-center justify-between gap-3 px-5 py-3.5">
              <Label>Clauses</Label>
              <span className="font-mono text-[10px] tabular-nums text-ink-faint">
                {c.clauses.length} ·{" "}
                <span className="text-rose">
                  {c.clauses.filter((x) => x.requiresExplicitAcknowledgement).length} require
                  acknowledgement
                </span>
              </span>
            </div>
            <div className="border-t border-line/70 px-5">
              {c.clauses.map((cl) => (
                <Clause key={cl.id} clause={cl} />
              ))}
            </div>
          </div>

          <div className="flex gap-3 border-t border-line bg-bg-deep/30 px-5 py-4">
            <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-mint" />
            <p className="text-[11.5px] leading-relaxed text-ink-faint">
              The digest is a SHA-256 prefix over the canonical clause body plus the signer identity.
              Change a word and the signatures stop reconciling. Clauses marked{" "}
              <span className="text-rose">must acknowledge</span> cannot be pre-checked by either
              party — they are read and confirmed individually, which is why this contract is
              reviewed by a human before it takes effect.
            </p>
          </div>
        </article>
      ))}
    </div>
  );
}

function SigRow({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-baseline gap-3">
      <dt className="w-14 shrink-0 uppercase tracking-[0.1em] text-ink-faint">{k}</dt>
      <dd className="min-w-0 flex-1 truncate text-ink-2">{v}</dd>
    </div>
  );
}
