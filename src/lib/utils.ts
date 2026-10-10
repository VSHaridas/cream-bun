import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/* ── formatting ───────────────────────────────────────────────────────────── */

const inr0 = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });
const inr2 = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

export function inr(value: number) {
  return inr0.format(Math.round(value));
}

export function rupees(value: number) {
  return inr2.format(Math.round(value));
}

/** Compact Indian lakh/crore notation: 12.4L, 1.2Cr. */
export function compactInr(value: number) {
  if (value >= 10_000_000) return `₹${(value / 10_000_000).toFixed(value >= 100_000_000 ? 0 : 1)}Cr`;
  if (value >= 100_000) return `₹${(value / 100_000).toFixed(value >= 1_000_000 ? 0 : 1)}L`;
  if (value >= 1_000) return `₹${(value / 1_000).toFixed(0)}K`;
  return `₹${inr(value)}`;
}

export function compactNumber(value: number) {
  if (value >= 10_000_000) return `${(value / 10_000_000).toFixed(1)}Cr`;
  if (value >= 100_000) return `${(value / 100_000).toFixed(1)}L`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return `${value}`;
}

export function relativeTime(input: string | Date) {
  const date = typeof input === "string" ? new Date(input) : input;
  const diff = Date.now() - date.getTime();
  const mins = Math.round(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.round(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.round(months / 12)}y ago`;
}

export function formatDate(input: string | Date) {
  const d = typeof input === "string" ? new Date(input) : input;
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export function formatDateTime(input: string | Date) {
  const d = typeof input === "string" ? new Date(input) : input;
  return `${formatDate(d)} · ${d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: false })}`;
}

export function titleCase(value: string) {
  return value
    .split(/[\s-]+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function pct(n: number, digits = 0) {
  return `${n.toFixed(digits)}%`;
}

/** Deterministic short id for demo records. */
export function shortCode(prefix: string) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 6; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return `${prefix}-${out}`;
}

export function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

export function unique<T>(items: T[]): T[] {
  return Array.from(new Set(items));
}

/** Stable score used to shuffle results deterministically per session seed. */
export function seededJitter(seed: string, salt = 0) {
  let h = hashString(`${seed}::${salt}`);
  h ^= h >>> 15;
  return ((h >>> 0) % 1000) / 1000;
}

export function hashString(value: string) {
  let h = 2166136261;
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}