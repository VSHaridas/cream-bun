import Link from "next/link";

export function Wordmark({ className, compact }: { className?: string; compact?: boolean }) {
  return (
    <Link href="/" className={`group flex items-baseline gap-2 ${className ?? ""}`}>
      <span className="relative">
        <span className="font-display text-[19px] leading-none font-normal tracking-[-0.03em] text-ink">
          CREAM
        </span>
        <span className="absolute -right-[9px] -top-[5px] block size-[5px] rounded-full bg-caramel transition-transform duration-300 group-hover:scale-150" />
      </span>
      {!compact && (
        <span className="hidden font-mono text-[9.5px] uppercase tracking-[0.18em] text-ink-faint xl:inline">
          ai creator marketplace
        </span>
      )}
    </Link>
  );
}