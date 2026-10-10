"use client";

import * as React from "react";
import { Loader2, ScanSearch, ShieldAlert, ShieldCheck } from "lucide-react";
import type { DetectionResult } from "@/lib/integrations/provenance";
import { Badge, Button, Input, Label, Meter } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";

/**
 * The envelope extractor, as a client island.
 *
 * The point it has to make is uncomfortable and is therefore stated plainly:
 * a watermark only helps if someone runs the detector. So the demo shows the
 * detector, and shows what a mutated id does to the confidence score.
 */
export function WatermarkDetector({
  defaultPayloadId,
  className,
}: {
  defaultPayloadId: string;
  className?: string;
}) {
  const [value, setValue] = React.useState(defaultPayloadId);
  const [result, setResult] = React.useState<DetectionResult | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function run(payloadId: string) {
    const id = payloadId.trim();
    if (!id) {
      setError("A payload id is required — an envelope cannot be derived from an empty string.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/provenance", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "detect", payloadId: id }),
      });
      const data = (await res.json()) as { detection?: DetectionResult; error?: string };
      if (!res.ok || !data?.detection) throw new Error(data?.error ?? "The extractor returned nothing.");
      setResult(data.detection);
    } catch (e) {
      setError(e instanceof Error ? e.message : "The extractor failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={cn("rounded-xl border border-line bg-surface", className)}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
        <div className="flex items-center gap-2.5">
          <ScanSearch className="size-3.5 text-caramel" />
          <Label className="text-ink-2">Envelope extractor · live adapter call</Label>
        </div>
        <span className="chip font-mono text-[10px]">POST /api/provenance</span>
      </div>

      <div className="space-y-5 p-5">
        <div>
          <label htmlFor="payload-id" className="label-xs">
            SynthID payload id
          </label>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row">
            <Input
              id="payload-id"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void run(value);
              }}
              spellCheck={false}
              autoComplete="off"
              className="font-mono text-[12.5px]"
            />
            <Button
              size="md"
              variant="primary"
              className="shrink-0"
              onClick={() => void run(value)}
              loading={busy}
            >
              Run detector
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              const next = `${value}-x1`;
              setValue(next);
              void run(next);
            }}
            disabled={busy}
          >
            Simulate a stolen copy
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setValue(defaultPayloadId);
              setResult(null);
              setError(null);
            }}
            disabled={busy}
          >
            Reset to the stamped id
          </Button>
          <span className="text-[11.5px] text-ink-faint">
            Appends <code className="font-mono text-ink-muted">-x1</code> to the id to simulate a
            re-hosted, mutated copy.
          </span>
        </div>

        {error && (
          <p className="rounded-lg border border-rose/40 bg-rose/[0.08] px-4 py-3 text-[12.5px] text-rose">
            {error}
          </p>
        )}

        {busy && (
          <div className="flex items-center gap-2.5 rounded-lg border border-line bg-surface-2/50 px-4 py-4 text-[12.5px] text-ink-muted">
            <Loader2 className="size-3.5 animate-spin text-caramel" />
            Comparing the submitted id against the envelope held on the record…
          </div>
        )}

        {result && !busy && (
          <div className="space-y-4 rounded-lg border border-line bg-surface-2/40 p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Badge tone={result.matched ? "mint" : "rose"}>
                {result.matched ? "Envelope recovered" : "No match"}
              </Badge>
              <span className="flex items-center gap-2 font-mono text-[11px] tabular-nums text-ink-faint">
                <span
                  className={cn(
                    "rounded px-1.5 py-0.5 text-[9.5px] uppercase tracking-[0.1em]",
                    result.method === "embedded-compare"
                      ? "bg-mint/12 text-mint"
                      : "bg-caramel/12 text-caramel",
                  )}
                >
                  {result.method}
                </span>
                confidence {result.confidence.toFixed(2)}
              </span>
            </div>

            <Meter
              value={Math.round(result.confidence * 100)}
              tone={result.confidence > 0.85 ? "mint" : result.confidence > 0.6 ? "caramel" : "rose"}
              showLabel
            />

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-md border border-line bg-surface px-4 py-3">
                <div className="label-xs">Recovered payload</div>
                <div className="mt-1.5 font-mono text-[12px] break-all text-ink">
                  {result.payloadId ?? "null"}
                </div>
              </div>
              <div className="rounded-md border border-line bg-surface px-4 py-3">
                <div className="label-xs">Attributed creator</div>
                <div className="mt-1.5 font-mono text-[12px] text-ink">{result.creator ?? "null"}</div>
              </div>
            </div>

            <div className="flex gap-2.5">
              {result.matched ? (
                <ShieldCheck className="mt-0.5 size-4 shrink-0 text-mint" />
              ) : (
                <ShieldAlert className="mt-0.5 size-4 shrink-0 text-rose" />
              )}
              <p className="text-[13px] leading-relaxed text-ink-2">{result.verdict}</p>
            </div>

            {result.payloadId !== null && result.payloadId !== defaultPayloadId && (
              <p className="rounded-md border border-caramel/40 bg-caramel/[0.07] px-4 py-3 text-[12px] leading-relaxed text-caramel">
                The extractor echoed{" "}
                <span className="font-mono">{result.payloadId}</span>, which is not the id stamped
                on this record. A mismatch here is the useful signal.
              </p>
            )}

            {result.method === "sandbox-derived" && (
              <p className="border-t border-line pt-3 text-[11.5px] leading-relaxed text-ink-faint">
                No record on this workspace holds that id. The sandbox receives identifiers, not
                files, so it can only compare against an envelope it already has — a watermark
                scheme that self-confirms is worthless. A live SynthID extractor embeds in the
                file itself and does not need the record.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}