"use client";

import * as React from "react";
import Link from "next/link";
import { RotateCcw, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/primitives";

export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="container-x flex min-h-[70vh] flex-col items-center justify-center py-20 text-center">
      <span className="grid size-12 place-items-center rounded-xl border border-rose/35 bg-rose/[0.08] text-rose">
        <TriangleAlert className="size-5" />
      </span>
      <h1 className="mt-7 display-md">Something broke on our side.</h1>
      <p className="mt-4 max-w-md text-balance-pretty text-[14.5px] leading-relaxed text-ink-muted">
        This is not your fault, and nothing you have entered has been lost. If you were mid-brief,
        the transcript is still on the server.
      </p>
      {error.digest && (
        <code className="mt-5 rounded-lg border border-line bg-surface px-3 py-1.5 font-mono text-[11px] text-ink-faint">
          digest {error.digest}
        </code>
      )}
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Button variant="primary" onClick={reset}>
          <RotateCcw className="size-3.5" />
          Try again
        </Button>
        <Button asChild variant="outline">
          <Link href="/">Back to CREAM</Link>
        </Button>
        <Button asChild variant="ghost">
          <Link href="/briefs/new">Open the brief builder</Link>
        </Button>
      </div>
    </div>
  );
}