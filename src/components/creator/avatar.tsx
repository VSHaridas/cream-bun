import { GenerativeArt, avatarVariant } from "@/components/media/generative-art";
import { cn } from "@/lib/utils";
import type { Creator } from "@/lib/domain/types";

export function CreatorAvatar({
  creator,
  size = 40,
  className,
  ring,
}: {
  creator: Creator;
  size?: number;
  className?: string;
  ring?: boolean;
}) {
  return (
    <span
      className={cn(
        "relative inline-grid shrink-0 place-items-center overflow-hidden rounded-full",
        ring && "ring-2 ring-bg ring-offset-0",
        className,
      )}
      style={{ width: size, height: size }}
    >
      <GenerativeArt
        seed={creator.avatarSeed}
        palette={[creator.accent, "#2a2420", "#f3e7d2"]}
        variant={avatarVariant(creator.avatarKind)}
        grain={0.18}
        className="size-full"
      />
      <span
        className="absolute inset-0 rounded-full ring-1 ring-inset ring-white/10"
        aria-hidden
      />
    </span>
  );
}

export function CreatorAvatarStack({
  creators,
  size = 28,
  max = 4,
}: {
  creators: Creator[];
  size?: number;
  max?: number;
}) {
  const shown = creators.slice(0, max);
  return (
    <div className="flex -space-x-2">
      {shown.map((c) => (
        <span key={c.id} className="rounded-full ring-2 ring-bg" style={{ width: size, height: size }}>
          <CreatorAvatar creator={c} size={size} />
        </span>
      ))}
      {creators.length > max && (
        <span
          className="grid place-items-center rounded-full border border-line bg-surface-2 font-mono text-[10px] text-ink-muted ring-2 ring-bg"
          style={{ width: size, height: size }}
        >
          +{creators.length - max}
        </span>
      )}
    </div>
  );
}