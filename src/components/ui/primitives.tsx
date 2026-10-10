"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

/* ── Button ───────────────────────────────────────────────────────────────── */

const buttonVariants = cva(
  "relative inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium transition-all duration-200 disabled:pointer-events-none disabled:opacity-45 active:translate-y-px select-none",
  {
    variants: {
      variant: {
        primary:
          "bg-ink text-bg hover:brightness-110 shadow-[0_1px_0_0_rgba(255,255,255,0.14)_inset,0_8px_24px_-12px_rgba(0,0,0,0.6)]",
        accent:
          "bg-caramel text-[oklch(0.18_0.02_60)] hover:brightness-108 shadow-[0_1px_0_0_rgba(255,255,255,0.22)_inset,0_10px_30px_-14px_var(--caramel)]",
        outline:
          "border border-line-strong text-ink hover:bg-surface-2 hover:border-ink-faint",
        ghost: "text-ink-muted hover:text-ink hover:bg-surface-2",
        subtle: "bg-surface-2 text-ink-2 hover:bg-surface-3 border border-line",
        danger: "border border-rose/45 text-rose hover:bg-rose/10",
        link: "text-caramel underline-offset-4 hover:underline px-0",
      },
      size: {
        xs: "h-7 rounded-full px-2.5 text-[11px]",
        sm: "h-8.5 rounded-full px-3.5 text-[12.5px]",
        md: "h-10 rounded-full px-5 text-[13.5px]",
        lg: "h-12 rounded-full px-7 text-[15px]",
        icon: "h-9 w-9 rounded-full",
        iconSm: "h-7.5 w-7.5 rounded-full",
      },
    },
    defaultVariants: { variant: "subtle", size: "md" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant, size, asChild, loading, children, disabled, ...props },
  ref,
) {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp
      ref={ref}
      className={cn(buttonVariants({ variant, size }), className)}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <>
          <Loader2 className="size-3.5 animate-spin" aria-hidden />
          <span className="sr-only">Working</span>
          {children}
        </>
      ) : (
        children
      )}
    </Comp>
  );
});

/* ── Badge ────────────────────────────────────────────────────────────────── */

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-[3px] text-[11px] leading-none font-medium transition-colors",
  {
    variants: {
      tone: {
        neutral: "border-line text-ink-muted bg-surface-2/60",
        ink: "border-line-strong text-ink bg-surface-3/70",
        caramel: "border-caramel/40 text-caramel bg-caramel/10",
        mint: "border-mint/40 text-mint bg-mint/10",
        rose: "border-rose/40 text-rose bg-rose/10",
        violet: "border-violet/40 text-violet bg-violet/10",
      },
    },
    defaultVariants: { tone: "neutral" },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, tone, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}

/* ── Card / Panel ─────────────────────────────────────────────────────────── */

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("card", className)} {...props} />;
}

export function Panel({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("panel", className)} {...props} />;
}

/* ── Section label ────────────────────────────────────────────────────────── */

export function Label({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span className={cn("label-xs", className)} {...props}>
      {children}
    </span>
  );
}

/* ── Divider ──────────────────────────────────────────────────────────────── */

export function Divider({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("h-px w-full bg-line", className)} {...props} />;
}

/* ── Toggleable chip ──────────────────────────────────────────────────────── */

export interface ChipProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
  count?: number;
}

export const Chip = React.forwardRef<HTMLButtonElement, ChipProps>(function Chip(
  { active, count, className, children, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type="button"
      className={cn(
        "chip transition-all duration-150 hover:border-line-strong hover:text-ink-2",
        active && "chip-active",
        className,
      )}
      aria-pressed={active}
      {...props}
    >
      {children}
      {typeof count === "number" && (
        <span className={cn("font-mono text-[10px]", active ? "text-caramel" : "text-ink-faint")}>
          {count}
        </span>
      )}
    </button>
  );
});

/* ── Field ────────────────────────────────────────────────────────────────── */

export const inputClasses =
  "w-full rounded-lg border border-line bg-surface-2/70 px-3.5 text-[13.5px] text-ink placeholder:text-ink-faint outline-none transition-all focus:border-caramel/55 focus:bg-surface-2 focus:ring-2 focus:ring-caramel/12 disabled:opacity-50";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return <input ref={ref} className={cn(inputClasses, "h-10", className)} {...props} />;
  },
);

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(function Textarea({ className, ...props }, ref) {
  return (
    <textarea
      ref={ref}
      className={cn(inputClasses, "min-h-24 py-2.5 leading-relaxed resize-y", className)}
      {...props}
    />
  );
});

export function Field({
  label,
  hint,
  error,
  children,
  className,
  htmlFor,
}: {
  label?: React.ReactNode;
  hint?: React.ReactNode;
  error?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  htmlFor?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      {label && (
        <label htmlFor={htmlFor} className="flex items-baseline justify-between gap-3">
          <span className="label-xs">{label}</span>
          {hint && <span className="text-[11px] text-ink-faint">{hint}</span>}
        </label>
      )}
      {children}
      {error && <p className="text-[11.5px] text-rose">{error}</p>}
    </div>
  );
}

/* ── Progress ─────────────────────────────────────────────────────────────── */

export function Meter({
  value,
  max = 100,
  tone = "caramel",
  className,
  showLabel,
}: {
  value: number;
  max?: number;
  tone?: "caramel" | "mint" | "rose" | "violet";
  className?: string;
  showLabel?: boolean;
}) {
  const pctv = Math.max(0, Math.min(100, (value / max) * 100));
  const bg = {
    caramel: "bg-caramel",
    mint: "bg-mint",
    rose: "bg-rose",
    violet: "bg-violet",
  }[tone];
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-3">
        <div
          className={cn("h-full rounded-full transition-[width] duration-700 ease-out", bg)}
          style={{ width: `${pctv}%` }}
        />
      </div>
      {showLabel && <span className="font-mono text-[10.5px] text-ink-faint tabular-nums">{Math.round(pctv)}%</span>}
    </div>
  );
}

/* ── Stat ─────────────────────────────────────────────────────────────────── */

export function Stat({
  label,
  value,
  sub,
  tone,
  className,
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  sub?: React.ReactNode;
  tone?: "caramel" | "mint" | "rose";
  className?: string;
}) {
  return (
    <div className={cn("space-y-1", className)}>
      <div className="label-xs">{label}</div>
      <div
        className={cn(
          "font-display text-[26px] leading-none tracking-[-0.02em]",
          tone === "caramel" && "text-caramel",
          tone === "mint" && "text-mint",
          tone === "rose" && "text-rose",
        )}
      >
        {value}
      </div>
      {sub && <div className="text-[11.5px] leading-tight text-ink-faint">{sub}</div>}
    </div>
  );
}

/* ── Tooltip-ish hint ─────────────────────────────────────────────────────── */

export function Hint({ children }: { children: React.ReactNode }) {
  return (
    <span className="group/hint relative inline-flex">
      {children}
      <span className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 w-56 -translate-x-1/2 rounded-lg border border-line bg-surface-3 px-3 py-2 text-[11px] leading-snug font-normal tracking-normal text-ink-2 normal-case opacity-0 shadow-e3 transition-opacity duration-150 group-hover/hint:opacity-100">
        {children}
      </span>
    </span>
  );
}

/* ── Skeleton ─────────────────────────────────────────────────────────────── */

export function Shimmer({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "animate-shimmer rounded-md bg-[linear-gradient(90deg,var(--surface-2)_0%,var(--surface-3)_40%,var(--surface-2)_80%)] bg-[length:220%_100%]",
        className,
      )}
    />
  );
}