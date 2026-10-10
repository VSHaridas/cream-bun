export const dynamic = "force-dynamic";

import Link from "next/link";
import { Compass } from "lucide-react";
import { getCreators } from "@/lib/data";
import { Button } from "@/components/ui/primitives";
import { GenerativeArt } from "@/components/media/generative-art";

export default async function NotFound() {
  const creators = await getCreators();
  const samples = creators.slice(0, 3);

  return (
    <div className="container-x flex min-h-[70vh] flex-col justify-center py-20">
      <div className="grid gap-12 lg:grid-cols-[1fr_0.7fr] lg:items-center">
        <div>
          <div className="label-xs mb-5">404 · no such record</div>
          <h1 className="display-lg">
            Nothing here. <span className="serif-italic text-cream-gradient">Try the pool.</span>
          </h1>
          <p className="mt-5 max-w-lg text-balance-pretty text-[15px] leading-relaxed text-ink-muted">
            This URL does not match a creator, a brief or an engagement. The three most useful
            places to go next are below.
          </p>

          <div className="mt-9 flex flex-wrap gap-3">
            <Button asChild variant="primary" size="lg">
              <Link href="/discover">
                <Compass className="size-4" />
                Discover creators
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href="/briefs">Your briefs</Link>
            </Button>
          </div>

          <div className="mt-12 border-t border-line pt-7">
            <div className="label-xs mb-4">Start here instead</div>
            <div className="grid gap-2 sm:grid-cols-3">
              {samples.map((c) => (
                <Link
                  key={c.id}
                  href={`/creators/${c.handle}`}
                  className="group rounded-lg border border-line bg-surface p-3.5 transition-colors hover:border-line-strong"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="size-7 overflow-hidden rounded-full">
                      <GenerativeArt
                        seed={c.avatarSeed}
                        palette={[c.accent, "#2a2420", "#f3e7d2"]}
                        variant="avatar"
                        grain={0.18}
                        className="size-full"
                      />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-[13px] text-ink">{c.displayName}</span>
                      <span className="block truncate text-[10.5px] text-ink-faint">
                        {c.specializations[0]}
                      </span>
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>

        <div className="relative hidden lg:block">
          <div className="aspect-[4/5] overflow-hidden rounded-2xl border border-line">
            <GenerativeArt
              seed="cream-404-empty-frame"
              palette={["#2a2118", "#8a6a45", "#e8d7b8"]}
              ratio="4/5"
              chrome
              className="size-full"
            />
            <div className="absolute inset-0 grid place-content-center">
              <EmptyFrame />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function EmptyFrame() {
  return (
    <div className="text-center">
      <div className="font-display text-[120px] leading-none tracking-[-0.05em] text-ink/10">404</div>
      <div className="-mt-6 font-mono text-[10px] uppercase tracking-[0.24em] text-ink-faint">
        empty frame
      </div>
    </div>
  );
}