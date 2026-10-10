"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Check,
  CircleCheck,
  FileSignature,
  Fingerprint,
  KeyRound,
  Loader2,
  Lock,
  RefreshCw,
  ShieldCheck,
  ShieldOff,
  Sparkles,
  Users,
} from "lucide-react";

import type { DigilockerAssertion, DigilockerStep, IssuerDocument } from "@/lib/integrations/digilocker";

import type { IdentityVerification } from "@/lib/domain/types";

import { Badge, Button, Input, Label, Meter, Panel, inputClasses } from "@/components/ui/primitives";
import { Reveal } from "@/components/shared/motion";
import { cn, formatDateTime } from "@/lib/utils";

/* ═══════════════════════════════════════════════════════════════════════════
   Identity verification walkthrough.

   This page is deliberately honest about two things a real consent flow has to
   get right and most prototypes get wrong:

     1. A refusal is a first-class outcome. Nothing is sent, nothing is
        written, and the account continues — degraded, not blocked.
     2. The document never crosses the boundary. We render the assertion
        envelope and enumerate, line by line, what was withheld.

   The catalogue is fetched from /api/identity/assertion rather than imported,
   because the DigiLocker adapter is a server module (node:crypto) and this
   page is a client component.
   ═══════════════════════════════════════════════════════════════════════════ */

type RoleId = "brand" | "creator" | "other";

interface CatalogueResponse {
  mode: "live" | "mock";
  env: string;
  steps: DigilockerStep[];
  documents: IssuerDocument[];
}

interface AssertionResponse {
  assertion: DigilockerAssertion;
  verification: IdentityVerification;
}

const CONSENT_PURPOSE =
  "Identity verification for CREAM marketplace onboarding and fraud prevention";

const RESEND_SECONDS = 30;

const STEPS: { key: string; label: string; hint: string }[] = [
  { key: "intro", label: "Introduction", hint: "What we need, what we never keep" },
  { key: "role", label: "Your role", hint: "Decides which document we ask for" },
  { key: "document", label: "Issuer document", hint: "Issued to you, validated by the issuer" },
  { key: "consent", label: "Consent", hint: "Purpose-bound and revocable" },
  { key: "otp", label: "Issuer check", hint: "The OTP comes from the issuer" },
  { key: "assertion", label: "Assertion", hint: "Three fields kept, four withheld" },
];

const ROLES: {
  id: RoleId;
  icon: typeof Building2;
  title: string;
  line: string;
  body: string;
  recommends: string;
  extra: string;
}[] = [
  {
    id: "brand",
    icon: Building2,
    title: "Brand or agency",
    line: "You are commissioning the work, and you are the one paying for it.",
    body: "We verify the entity that signs the contract and receives escrow releases. A creator should not have to take it on trust that the money behind a brief is real before generating a single frame of it.",
    recommends: "GST registration certificate",
    extra:
      "Agency accounts must clear GST registration before they can fund an escrow. In-house brand accounts can proceed on a PAN assertion and upgrade later.",
  },
  {
    id: "creator",
    icon: Sparkles,
    title: "Creator",
    line: "You are being paid, and a brand is deciding whether to trust you with theirs.",
    body: "Identity is how a brand tells an established pipeline from an anonymous account. It is the single highest-weighted signal on a profile, and it cannot be self-asserted — only an issuer can say it.",
    recommends: "Aadhaar or Passport",
    extra:
      "A passport is issued by the Ministry of External Affairs at AAL2 and is the strongest document we accept. Aadhaar is equally AAL2 and far more common.",
  },
  {
    id: "other",
    icon: Users,
    title: "Something else",
    line: "Independent studio, production house, student, researcher, journalist.",
    body: "You can use CREAM unverified. Unverified accounts browse, save briefs, publish portfolios and open conversations — they simply cannot receive an escrow release.",
    recommends: "Any one issuer document",
    extra:
      "If this is not a registered business yet, an Aadhaar assertion is enough to start, and you can re-assert a business document whenever one exists.",
  },
];

const AAL_SCORE: Record<"AAL1" | "AAL2" | "AAL3", number> = { AAL1: 64, AAL2: 92, AAL3: 100 };

const AAL_COPY: Record<"AAL1" | "AAL2" | "AAL3", { title: string; body: string }> = {
  AAL1: {
    title: "AAL1 — issued, not yet re-authenticated",
    body: "The issuer confirms the document exists and is genuine. It does not confirm that the person in front of the screen is the person named on it. Acceptable for low-risk onboarding; never sufficient on its own for an escrow release.",
  },
  AAL2: {
    title: "AAL2 — issued and re-authenticated at the issuer",
    body: "The document holder proved possession to the body that issued the document, in that body's own channel. This is the level that makes an assertion worth acting on, and the level CREAM treats as its baseline for anything involving money.",
  },
  AAL3: {
    title: "AAL3 — issued, re-authenticated and biometrically bound",
    body: "The issuer binds the assertion to a biometric reference collected at issuance. We never see the biometric — we only ever see the level it earned.",
  },
};

const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));

export default function IdentityFlow() {
  const [step, setStep] = React.useState(0);
  const [mode, setMode] = React.useState<"live" | "mock" | null>(null);
  const [env, setEnv] = React.useState<string | null>(null);
  const [flow, setFlow] = React.useState<DigilockerStep[]>([]);
  const [documents, setDocuments] = React.useState<IssuerDocument[]>([]);
  const [catalogueError, setCatalogueError] = React.useState(false);

  const [role, setRole] = React.useState<RoleId | null>(null);
  const [name, setName] = React.useState("");
  const [documentType, setDocumentType] = React.useState<string | null>(null);
  const [consent, setConsent] = React.useState<boolean | null>(null);
  const [digits, setDigits] = React.useState<string[]>(() => Array(6).fill(""));
  const [resendIn, setResendIn] = React.useState(RESEND_SECONDS);
  const [resends, setResends] = React.useState(0);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [assertion, setAssertion] = React.useState<DigilockerAssertion | null>(null);
  const [verification, setVerification] = React.useState<IdentityVerification | null>(null);

  const boxes = React.useRef<Array<HTMLInputElement | null>>([]);

  React.useEffect(() => {
    let cancelled = false;
    fetch("/api/identity/assertion")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("catalogue unavailable"))))
      .then((data: CatalogueResponse) => {
        if (cancelled) return;
        setMode(data.mode);
        setEnv(data.env ?? "sandbox");
        setFlow(Array.isArray(data.steps) ? data.steps : []);
        setDocuments(Array.isArray(data.documents) ? data.documents : []);
      })
      .catch(() => {
        if (cancelled) return;
        setMode("mock");
        setEnv("sandbox");
        setCatalogueError(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  React.useEffect(() => {
    if (step !== 4) return;
    if (resendIn <= 0) return;
    const t = setInterval(() => setResendIn((v) => Math.max(0, v - 1)), 1000);
    return () => clearInterval(t);
  }, [step, resendIn]);

  const otpComplete = digits.every((d) => /[0-9]/.test(d));
  const selectedDoc = documents.find((d) => d.documentType === documentType) ?? null;
  const live = mode === "live";

  function setDigit(i: number, value: string) {
    setDigits((prev) => {
      const next = [...prev];
      next[i] = value;
      return next;
    });
  }

  function onOtpChange(i: number, raw: string) {
    const clean = raw.replace(/\D/g, "");
    if (!clean) {
      setDigit(i, "");
      return;
    }
    setDigits((prev) => {
      const next = [...prev];
      if (clean.length === 1) {
        next[i] = clean;
      } else {
        clean
          .slice(0, 6 - i)
          .split("")
          .forEach((c, k) => {
            next[i + k] = c;
          });
      }
      return next;
    });
    const jump = Math.min(5, i + (clean.length > 1 ? clean.length : 1));
    boxes.current[jump]?.focus();
  }

  function onOtpKeyDown(i: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace") {
      e.preventDefault();
      if (digits[i]) setDigit(i, "");
      else if (i > 0) {
        setDigit(i - 1, "");
        boxes.current[i - 1]?.focus();
      }
      return;
    }
    if (e.key === "ArrowLeft" && i > 0) boxes.current[i - 1]?.focus();
    if (e.key === "ArrowRight" && i < 5) boxes.current[i + 1]?.focus();
  }

  function onOtpPaste(e: React.ClipboardEvent<HTMLInputElement>) {
    const clean = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (!clean) return;
    e.preventDefault();
    setDigits(clean.padEnd(6, "").split("").slice(0, 6));
    boxes.current[Math.min(5, clean.length)]?.focus();
  }

  function go(next: number) {
    setError(null);
    setStep(next);
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function runAssertion() {
    setBusy(true);
    setError(null);
    try {
      await pause(700);
      const res = await fetch("/api/identity/assertion", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ documentType, displayName: name.trim(), maskedIdentifier: "" }),
      });
      const data = (await res.json()) as AssertionResponse & { error?: string };
      if (!res.ok || !data?.assertion) {
        throw new Error(data?.error ?? "The issuer did not return an assertion. Nothing was stored.");
      }
      setAssertion(data.assertion);
      setVerification(data.verification);
      go(5);
    } catch (e) {
      setError(e instanceof Error ? e.message : "The pull failed. Nothing was stored.");
    } finally {
      setBusy(false);
    }
  }

  const railIndex = step === 6 ? 6 : step;

  return (
    <div className="pb-8">
      <div className="container-x pt-14 md:pt-20">
        <Reveal>
          <div className="flex flex-wrap items-center gap-3">
            <span className="label-xs">Onboarding</span>
            <span className="h-px w-8 bg-line-strong" aria-hidden />
            <span className="label-xs text-caramel">Identity</span>
          </div>
          <h1 className="display-lg mt-6 max-w-3xl">
            Prove who you are <span className="serif-italic text-cream-gradient">without handing over</span>{" "}
            the document.
          </h1>
          <p className="mt-6 max-w-xl text-balance-pretty text-[16px] leading-relaxed text-ink-2">
            CREAM has no upload box for identity, and it is not a missing feature. Identity is asserted
            by the issuer over a consented DigiLocker pull; the artefact stays in your own locker and
            remains downloadable by you at any time.
          </p>
        </Reveal>
      </div>

      <div className="container-x mt-14 grid gap-10 lg:grid-cols-[248px_minmax(0,1fr)] lg:gap-14">
        {/* ── rail ─────────────────────────────────────────────────────── */}
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <ol className="flex gap-1.5 overflow-x-auto pb-1 lg:flex-col lg:gap-0 lg:overflow-visible lg:pb-0">
            {STEPS.map((s, i) => {
              const done = railIndex > i;
              const current = railIndex === i;
              return (
                <li key={s.key} className="shrink-0 lg:shrink">
                  <div className="flex items-center gap-2.5 lg:gap-3">
                    <span
                      className={cn(
                        "grid size-6 shrink-0 place-items-center rounded-full border font-mono text-[9.5px] transition-colors duration-300",
                        done && "border-mint/50 bg-mint/12 text-mint",
                        current && "border-caramel bg-caramel/14 text-caramel",
                        !done && !current && "border-line bg-surface text-ink-faint",
                      )}
                    >
                      {done ? <Check className="size-3" /> : String(i + 1).padStart(2, "0")}
                    </span>
                    <span className="hidden h-5 w-px bg-line lg:block" aria-hidden />
                  </div>
                  <div className="mt-1.5 hidden lg:block lg:pl-9">
                    <div
                      className={cn(
                        "text-[13px] leading-tight",
                        current ? "text-ink" : done ? "text-ink-2" : "text-ink-faint",
                      )}
                    >
                      {s.label}
                    </div>
                    <div className="mt-1 text-[11px] leading-snug text-ink-faint">{s.hint}</div>
                  </div>
                </li>
              );
            })}
          </ol>

          <div className="mt-8 hidden rounded-lg border border-line bg-surface/60 p-4 lg:block">
            <div className="label-xs">Current step</div>
            <div className="mt-2 font-display text-[15px] tracking-[-0.01em] text-ink">
              {step === 6 ? "Complete" : STEPS[step]?.label}
            </div>
            <div className="mt-3 h-px w-full bg-line">
              <div
                className="h-px bg-caramel transition-[width] duration-500"
                style={{ width: `${(railIndex / STEPS.length) * 100}%` }}
              />
            </div>
          </div>
        </aside>

        {/* ── flow ─────────────────────────────────────────────────────── */}
        <div className="min-w-0">
          {catalogueError && (
            <Panel className="mb-6 flex items-start gap-3 border-rose/35 p-5">
              <ShieldOff className="mt-0.5 size-4 shrink-0 text-rose" />
              <p className="text-[13px] leading-relaxed text-ink-2">
                The issuer catalogue could not be loaded, so the document step is unavailable. Nothing
                was sent anywhere. Reload the page to try again.
              </p>
            </Panel>
          )}

          {/* ── 0 · intro ─────────────────────────────────────────────── */}
          {step === 0 && (
            <Reveal key="intro">
              <div className="space-y-6">
                <Panel className="relative overflow-hidden p-7 md:p-9">
                  <div
                    aria-hidden
                    className="pointer-events-none absolute inset-0 opacity-70"
                    style={{
                      backgroundImage:
                        "radial-gradient(90% 120% at 88% 0%, color-mix(in oklab, var(--mint) 12%, transparent) 0%, transparent 60%)",
                    }}
                  />
                  <div className="relative">
                    <div className="flex items-center gap-2.5">
                      <span className="grid size-9 place-items-center rounded-xl border border-mint/40 bg-mint/10 text-mint">
                        <ShieldCheck className="size-4" />
                      </span>
                      <Label className="text-mint">We never receive your document</Label>
                    </div>
                    <p className="mt-6 max-w-xl font-display text-[clamp(1.5rem,2.4vw,2rem)] leading-[1.08] tracking-[-0.022em] text-ink">
                      The issuer answers a question about you. We receive the answer.
                    </p>
                    <p className="mt-4 max-w-xl text-[14px] leading-relaxed text-ink-2">
                      DigiLocker asks UIDAI, the Income Tax Department, the Ministry of External Affairs
                      or your state transport authority to confirm a document you already hold. What
                      comes back is a signed assertion: a masked identifier, an assurance level, and a
                      timestamp. There is no field in that envelope for a scan.
                    </p>
                    <div className="mt-7 grid gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-3">
                      {[
                        { k: "We send", v: "A consent request naming one issuer and one document type." },
                        { k: "We receive", v: "An assertion envelope, roughly 300 bytes of signed text." },
                        { k: "We never hold", v: "The image, the pages, the signature, the biometric." },
                      ].map((c) => (
                        <div key={c.k} className="bg-surface p-5">
                          <div className="label-xs">{c.k}</div>
                          <p className="mt-2.5 text-[13px] leading-relaxed text-ink-2">{c.v}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </Panel>

                <div className="grid gap-4 md:grid-cols-2">
                  <Panel className="p-6">
                    <div className="flex items-center gap-2">
                      <Fingerprint className="size-3.5 text-caramel" />
                      <Label>What this actually requires</Label>
                    </div>
                    <ul className="mt-4 space-y-3">
                      {[
                        "One document issued to you by a government authority, reachable through DigiLocker.",
                        "A one-time code sent by the issuer — not by DigiLocker, and not by CREAM.",
                        "Consent to a single stated purpose. It is revocable, and refusing costs you nothing.",
                      ].map((t) => (
                        <li key={t} className="flex gap-2.5 text-[13px] leading-relaxed text-ink-2">
                          <span className="mt-[7px] block size-1 shrink-0 rounded-full bg-caramel" />
                          {t}
                        </li>
                      ))}
                    </ul>
                  </Panel>

                  <Panel className="p-6">
                    <div className="flex items-center gap-2">
                      <Lock className="size-3.5 text-rose" />
                      <Label>What we are structurally unable to do</Label>
                    </div>
                    <ul className="mt-4 space-y-3">
                      {[
                        "There is no CREAM endpoint that accepts a document upload, so there is nothing to breach.",
                        "We cannot re-request a document without a fresh consent from you, every time.",
                        "Your artefact stays downloadable from your own DigiLocker, forever, without us.",
                      ].map((t) => (
                        <li key={t} className="flex gap-2.5 text-[13px] leading-relaxed text-ink-2">
                          <span className="mt-[7px] block size-1 shrink-0 rounded-full bg-rose/70" />
                          {t}
                        </li>
                      ))}
                    </ul>
                  </Panel>
                </div>

                <div className="flex flex-wrap items-center gap-3 pt-2">
                  <Button size="lg" variant="primary" onClick={() => go(1)}>
                    Begin
                    <ArrowRight className="size-4" />
                  </Button>
                  <Link
                    href="/trust#digilocker"
                    className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.12em] text-ink-faint transition-colors hover:text-caramel"
                  >
                    read the architecture first
                    <ArrowRight className="size-3" />
                  </Link>
                </div>
              </div>
            </Reveal>
          )}

          {/* ── 1 · role ──────────────────────────────────────────────── */}
          {step === 1 && (
            <Reveal key="role">
              <div className="space-y-7">
                <header>
                  <Label>Step two</Label>
                  <h2 className="display-md mt-3">Who is this account for?</h2>
                  <p className="mt-3 max-w-xl text-[14px] leading-relaxed text-ink-muted">
                    Verification is not one question, it is three. Which document we ask for, and what
                    an unverified account can still do, both depend on which side of the marketplace
                    you are on.
                  </p>
                </header>

                <StaggerRoleGrid role={role} onPick={setRole} />

                <Panel className="p-6">
                  <div className="flex flex-wrap items-baseline justify-between gap-3">
                    <label htmlFor="holder" className="label-xs">
                      Name as printed on the document
                    </label>
                    <span className="text-[11px] text-ink-faint">
                      Used to request the assertion. Never compared against the artefact.
                    </span>
                  </div>
                  <Input
                    id="holder"
                    className="mt-2"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Aarav Mehta"
                    autoComplete="off"
                    spellCheck={false}
                  />
                  {role && (
                    <p className="mt-4 flex items-start gap-2 text-[12.5px] leading-relaxed text-ink-muted">
                      <span className="mt-[3px] block size-1 shrink-0 rounded-full bg-caramel" />
                      <span>
                        For a <span className="text-ink">{role === "brand" ? "brand or agency" : role}</span>{" "}
                        account we will recommend{" "}
                        <span className="text-ink">{ROLES.find((r) => r.id === role)?.recommends}</span> next.
                      </span>
                    </p>
                  )}
                </Panel>

                <div className="flex flex-wrap items-center gap-3">
                  <Button size="lg" variant="primary" onClick={() => go(2)}>
                    Continue
                    <ArrowRight className="size-4" />
                  </Button>
                  <Button size="lg" variant="ghost" onClick={() => go(0)}>
                    <ArrowLeft className="size-4" />
                    Back
                  </Button>
                  {name.trim().length < 2 && (
                    <span className="text-[11.5px] text-ink-faint">
                      A name is required before an issuer pull can be requested.
                    </span>
                  )}
                </div>
              </div>
            </Reveal>
          )}

          {/* ── 2 · document ──────────────────────────────────────────── */}
          {step === 2 && (
            <Reveal key="document">
              <div className="space-y-7">
                <header>
                  <Label>Step three</Label>
                  <h2 className="display-md mt-3">Choose one document from your locker.</h2>
                  <p className="mt-3 max-w-xl text-[14px] leading-relaxed text-ink-muted">
                    These are the issuers DigiLocker can reach. Choosing here only tells the issuer
                    which document you are willing to assert — nothing is fetched until you consent on
                    the next screen.
                  </p>
                </header>

                {documents.length === 0 ? (
                  <div className="space-y-3">
                    {[0, 1, 2].map((i) => (
                      <div
                        key={i}
                        className="h-28 animate-shimmer rounded-xl border border-line bg-[linear-gradient(90deg,var(--surface)_0%,var(--surface-2)_40%,var(--surface)_80%)] bg-[length:220%_100%]"
                      />
                    ))}
                  </div>
                ) : (
                  <div className="grid gap-3">
                    {documents.map((d) => {
                      const active = documentType === d.documentType;
                      const required = role === "brand" && d.issuerId === "GSTN";
                      return (
                        <button
                          key={d.issuerId}
                          type="button"
                          onClick={() => setDocumentType(d.documentType)}
                          aria-pressed={active}
                          className={cn(
                            "group flex w-full flex-col gap-3 rounded-xl border p-5 text-left transition-all duration-200 sm:flex-row sm:items-start sm:justify-between",
                            active
                              ? "border-caramel/60 bg-caramel/[0.07]"
                              : "border-line bg-surface hover:border-line-strong hover:bg-surface-2/40",
                          )}
                        >
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-display text-[17px] tracking-[-0.01em] text-ink">
                                {d.documentType}
                              </span>
                              <Badge tone={d.assuranceLevel === "AAL2" ? "mint" : "neutral"}>
                                {d.assuranceLevel}
                              </Badge>
                              {required && <Badge tone="caramel">Required for agencies</Badge>}
                            </div>
                            <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink-muted">
                              {d.description}
                            </p>
                            <p className="mt-1.5 font-mono text-[10.5px] uppercase tracking-[0.12em] text-ink-faint">
                              {d.issuer}
                            </p>
                          </div>
                          <span
                            className={cn(
                              "mt-1 grid size-5 shrink-0 place-items-center rounded-full border transition-colors",
                              active ? "border-caramel bg-caramel text-[oklch(0.18_0.02_60)]" : "border-line-strong",
                            )}
                            aria-hidden
                          >
                            {active && <Check className="size-3" />}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-3">
                  <Button size="lg" variant="primary" onClick={() => go(3)} disabled={!documentType}>
                    Continue
                    <ArrowRight className="size-4" />
                  </Button>
                  <Button size="lg" variant="ghost" onClick={() => go(1)}>
                    <ArrowLeft className="size-4" />
                    Back
                  </Button>
                </div>
              </div>
            </Reveal>
          )}

          {/* ── 3 · consent ──────────────────────────────────────────── */}
          {step === 3 && (
            <Reveal key="consent">
              <div className="space-y-6">
                {consent === false ? (
                  <Panel className="overflow-hidden p-7 md:p-9">
                    <div className="flex items-center gap-2.5">
                      <span className="grid size-9 place-items-center rounded-xl border border-line bg-surface-2 text-ink-muted">
                        <ShieldOff className="size-4" />
                      </span>
                      <Label>Consent refused</Label>
                    </div>
                    <h2 className="display-md mt-6 max-w-lg">
                      That is a complete answer, and it costs you nothing.
                    </h2>
                    <p className="mt-4 max-w-xl text-[14px] leading-relaxed text-ink-2">
                      Nothing was sent to any issuer. No code was requested, no session was opened,
                      and no record was written against your account. Refusing is an outcome the flow
                      was built to handle, not an error it failed on.
                    </p>
                    <div className="mt-7 grid gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-2">
                      <div className="bg-surface p-5">
                        <Label className="text-mint">Still available unverified</Label>
                        <ul className="mt-3 space-y-2">
                          {[
                            "Browse the pool and read every published workflow",
                            "Build a brief and publish a portfolio",
                            "Open conversations and negotiate an offer",
                            "Sign an engagement-start contract",
                          ].map((t) => (
                            <li key={t} className="flex gap-2 text-[12.5px] leading-relaxed text-ink-2">
                              <Check className="mt-0.5 size-3 shrink-0 text-mint" />
                              {t}
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div className="bg-surface p-5">
                        <Label className="text-rose">Requires verification</Label>
                        <ul className="mt-3 space-y-2">
                          {[
                            "Funding an escrow or receiving a milestone release",
                            "Appearing under the verified filter in discovery",
                            "The identity signal, which carries the heaviest weight",
                            "Withholding tax deducted at source on payouts",
                          ].map((t) => (
                            <li key={t} className="flex gap-2 text-[12.5px] leading-relaxed text-ink-2">
                              <span className="mt-[5px] block size-1 shrink-0 rounded-full bg-rose/70" />
                              {t}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                    <div className="mt-8 flex flex-wrap items-center gap-3">
                      <Button asChild size="lg" variant="primary">
                        <Link href="/discover">
                          Continue unverified
                          <ArrowRight className="size-4" />
                        </Link>
                      </Button>
                      <Button size="lg" variant="outline" onClick={() => setConsent(null)}>
                        Change my mind
                      </Button>
                    </div>
                  </Panel>
                ) : (
                  <>
                    <header>
                      <Label>Step four</Label>
                      <h2 className="display-md mt-3">Purpose-bound consent.</h2>
                      <p className="mt-3 max-w-xl text-[14px] leading-relaxed text-ink-muted">
                        This is the screen the issuer would show you. We reproduce it verbatim because
                        a consent you cannot read is not consent.
                      </p>
                    </header>

                    <Panel className="overflow-hidden">
                      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-6 py-4">
                        <div className="flex items-center gap-2.5">
                          <KeyRound className="size-3.5 text-caramel" />
                          <Label className="text-ink-2">Consent request</Label>
                        </div>
                        <span className="chip font-mono text-[10px]">
                          {selectedDoc?.issuerId ?? "—"} · {selectedDoc?.assuranceLevel ?? "—"}
                        </span>
                      </div>

                      <dl className="divide-y divide-line">
                        {[
                          { k: "Requesting entity", v: "CREAM Marketplace Pvt. Ltd." },
                          { k: "Document", v: `${selectedDoc?.documentType ?? "—"} · ${selectedDoc?.issuer ?? "—"}` },
                          { k: "Purpose", v: CONSENT_PURPOSE },
                          {
                            k: "Scope",
                            v: "Identity verification only. No contact details, no address, no document number.",
                          },
                          {
                            k: "Duration",
                            v: "Until you revoke it. Revoking from your DigiLocker account expires this record within 24 hours; the audit trail is marked expired rather than deleted.",
                          },
                        ].map((row) => (
                          <div key={row.k} className="grid gap-1.5 px-6 py-4 sm:grid-cols-[150px_minmax(0,1fr)] sm:gap-6">
                            <dt className="label-xs pt-0.5">{row.k}</dt>
                            <dd
                              className={cn(
                                "text-[13px] leading-relaxed",
                                row.k === "Purpose" ? "text-ink" : "text-ink-2",
                              )}
                            >
                              {row.v}
                            </dd>
                          </div>
                        ))}
                      </dl>

                      <div className="flex flex-wrap items-center gap-3 border-t border-line bg-surface-2/40 px-6 py-5">
                        <Button size="lg" variant="primary" onClick={() => { setConsent(true); go(4); }}>
                          Allow
                          <ArrowRight className="size-4" />
                        </Button>
                        <Button size="lg" variant="outline" onClick={() => setConsent(false)}>
                          Refuse
                        </Button>
                        <span className="text-[11.5px] text-ink-faint">
                          Refusing leaves your account usable. It is not a dead end.
                        </span>
                      </div>
                    </Panel>

                    <div className="flex flex-wrap items-center gap-3">
                      <Button size="lg" variant="ghost" onClick={() => go(2)}>
                        <ArrowLeft className="size-4" />
                        Change document
                      </Button>
                    </div>
                  </>
                )}
              </div>
            </Reveal>
          )}

          {/* ── 4 · issuer otp ───────────────────────────────────────── */}
          {step === 4 && (
            <Reveal key="otp">
              <div className="space-y-6">
                <header>
                  <Label>Step five</Label>
                  <h2 className="display-md mt-3">The issuer checks you, not us.</h2>
                  <p className="mt-3 max-w-xl text-[14px] leading-relaxed text-ink-muted">
                    A six-digit code is on its way to the number registered with{" "}
                    <span className="text-ink">{selectedDoc?.issuer ?? "the issuer"}</span>. This is the
                    step that makes the assertion worth something: you proved possession to the body
                    that issued the document, in that body&apos;s own channel.
                  </p>
                </header>

                <Panel className="overflow-hidden">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-6 py-4">
                    <div className="flex items-center gap-2.5">
                      <Fingerprint className="size-3.5 text-caramel" />
                      <Label className="text-ink-2">
                        {selectedDoc?.issuer ?? "Issuer"} · one-time passcode
                      </Label>
                    </div>
                    <Badge tone="neutral">Sandbox code — any six digits</Badge>
                  </div>

                  <div className="px-6 py-7">
                    <div className="flex flex-wrap gap-2.5 sm:gap-3">
                      {digits.map((d, i) => (
                        <input
                          key={i}
                          ref={(el) => {
                            boxes.current[i] = el;
                          }}
                          value={d}
                          onChange={(e) => onOtpChange(i, e.target.value)}
                          onKeyDown={(e) => onOtpKeyDown(i, e)}
                          onPaste={onOtpPaste}
                          onFocus={(e) => e.currentTarget.select()}
                          disabled={busy}
                          inputMode="numeric"
                          autoComplete={i === 0 ? "one-time-code" : "off"}
                          aria-label={`Digit ${i + 1}`}
                          className={cn(
                            inputClasses,
                            "h-14 w-full max-w-16 text-center font-mono text-[22px] tracking-[0.2em]",
                            d ? "text-ink" : "text-ink-faint",
                          )}
                        />
                      ))}
                    </div>

                    <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2">
                      <button
                        type="button"
                        onClick={() => {
                          if (resendIn > 0) return;
                          setResends((n) => n + 1);
                          setResendIn(RESEND_SECONDS);
                          setDigits(Array(6).fill(""));
                          setError(null);
                        }}
                        disabled={resendIn > 0 || busy}
                        className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.12em] text-caramel transition-opacity hover:underline disabled:cursor-not-allowed disabled:text-ink-faint disabled:no-underline"
                      >
                        <RefreshCw className={cn("size-3", resendIn > 0 && "animate-spin")} />
                        {resendIn > 0 ? `Resend in ${resendIn}s` : "Resend code"}
                      </button>
                      <span className="text-[11.5px] text-ink-faint">
                        {digits.filter((d) => /\d/.test(d)).length} of 6 digits entered
                        {resends > 0 ? ` · resent ${resends}×` : ""}
                      </span>
                    </div>

                    <p className="mt-6 flex items-start gap-2.5 rounded-lg border border-dashed border-line bg-surface-2/40 px-4 py-3.5 text-[12.5px] leading-relaxed text-ink-muted">
                      <Lock className="mt-0.5 size-3.5 shrink-0 text-ink-faint" />
                      <span>
                        This code was sent by the issuer. Not by DigiLocker, and not by CREAM — we never
                        see it, cannot replay it, and have no field to store it in.
                      </span>
                    </p>

                    {error && (
                      <p className="mt-4 rounded-lg border border-rose/40 bg-rose/[0.08] px-4 py-3 text-[12.5px] text-rose">
                        {error}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-3 border-t border-line bg-surface-2/40 px-6 py-5">
                    {busy ? (
                      <span className="inline-flex items-center gap-2.5 text-[13px] text-ink-2">
                        <Loader2 className="size-4 animate-spin text-caramel" />
                        Pulling the assertion from the issuer…
                      </span>
                    ) : (
                      <>
                        <Button size="lg" variant="primary" onClick={runAssertion} disabled={!otpComplete}>
                          Pull assertion
                          <ArrowRight className="size-4" />
                        </Button>
                        <Button size="lg" variant="ghost" onClick={() => go(3)} disabled={busy}>
                          <ArrowLeft className="size-4" />
                          Back to consent
                        </Button>
                      </>
                    )}
                  </div>
                </Panel>
              </div>
            </Reveal>
          )}

          {/* ── 5 · assertion receipt ────────────────────────────────── */}
          {step === 5 && assertion && (
            <Reveal key="assertion">
              <div className="space-y-6">
                <header>
                  <Label>Step six</Label>
                  <h2 className="display-md mt-3">The receipt, in full.</h2>
                  <p className="mt-3 max-w-xl text-[14px] leading-relaxed text-ink-muted">
                    This is the complete object that crossed the boundary. Nothing else was sent, and
                    nothing was truncated for presentation.
                  </p>
                </header>

                <Panel className="overflow-hidden">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-6 py-4">
                    <div className="flex items-center gap-2.5">
                      <FileSignature className="size-3.5 text-mint" />
                      <Label className="text-ink-2">DigiLocker assertion</Label>
                    </div>
                    <Badge tone="mint">{assertion.assuranceLevel} · issuer signed</Badge>
                  </div>

                  <dl className="divide-y divide-line">
                    {[
                      { k: "requestId", v: assertion.requestId },
                      { k: "maskedIdentifier", v: assertion.maskedIdentifier },
                      { k: "issuerId", v: assertion.issuerId },
                      { k: "documentType", v: assertion.documentType },
                      { k: "assuranceLevel", v: assertion.assuranceLevel },
                      { k: "consentedAt", v: formatDateTime(assertion.consentedAt) },
                      { k: "issuedAt", v: formatDateTime(assertion.issuedAt) },
                      { k: "signatureAlgorithm", v: assertion.signatureAlgorithm },
                      { k: "purpose", v: assertion.purpose },
                    ].map((row) => (
                      <div
                        key={row.k}
                        className="grid gap-1 px-6 py-3.5 sm:grid-cols-[170px_minmax(0,1fr)] sm:items-baseline sm:gap-6"
                      >
                        <dt className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-ink-faint">
                          {row.k}
                        </dt>
                        <dd className="font-mono text-[12.5px] break-all text-ink">{row.v}</dd>
                      </div>
                    ))}
                  </dl>

                  <div className="border-t border-line bg-surface-2/40 px-6 py-5">
                    <Label className="text-rose">Withheld from this response</Label>
                    <ul className="mt-3.5 flex flex-wrap gap-2">
                      {assertion.withheld.map((w) => (
                        <li
                          key={w}
                          className="inline-flex items-center gap-2 rounded-full border border-rose/35 bg-rose/[0.07] px-3 py-1.5 text-[12px] text-rose line-through decoration-rose/70 decoration-[1.5px]"
                        >
                          {w}
                        </li>
                      ))}
                    </ul>
                    <p className="mt-4 max-w-lg text-[12px] leading-relaxed text-ink-muted">
                      Four items the issuer explicitly did not send. This list is produced by the
                      adapter, not written by hand — it is the same array the receipt renders on every
                      assertion.
                    </p>
                  </div>
                </Panel>

                {verification && (
                  <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                    <Panel className="p-6">
                      <div className="flex items-center gap-2">
                        <Lock className="size-3.5 text-caramel" />
                        <Label>Exactly three fields survive</Label>
                      </div>
                      <ul className="mt-4 space-y-3">
                        {[
                          { k: "issuerRef", v: verification.issuerRef ?? "—", n: "A hashed pointer back to the issuer. Resolvable only by the issuer." },
                          { k: "assuranceLevel", v: verification.assuranceLevel ?? "—", n: "How strongly the issuer vouched for the holder." },
                          { k: "verifiedAt", v: verification.verifiedAt ? formatDateTime(verification.verifiedAt) : "—", n: "When consent was given. Everything else is a timestamp." },
                        ].map((f) => (
                          <li key={f.k} className="border-l border-line pl-4">
                            <div className="font-mono text-[11.5px] text-ink">{f.v}</div>
                            <div className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-ink-faint">
                              {f.k}
                            </div>
                            <p className="mt-1 text-[12px] leading-relaxed text-ink-muted">{f.n}</p>
                          </li>
                        ))}
                      </ul>
                      <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-mint/40 bg-mint/10 px-3 py-1.5 font-mono text-[10.5px] uppercase tracking-[0.1em] text-mint">
                        artefactRetained: false
                      </div>
                    </Panel>

                    <Panel className="p-6">
                      <div className="flex items-center gap-2">
                        <Fingerprint className="size-3.5 text-caramel" />
                        <Label>Stored verification record</Label>
                      </div>
                      <dl className="mt-4 space-y-2 font-mono text-[11.5px]">
                        {[
                          "status",
                          "method",
                          "issuer",
                          "documentType",
                          "expiresAt",
                          "artefactRetained",
                        ].map((k) => (
                          <div key={k} className="flex items-baseline justify-between gap-4">
                            <dt className="text-ink-faint">{k}</dt>
                            <dd className="text-right text-ink-2">
                              {String(
                                (verification as unknown as Record<string, unknown>)[k] ?? "—",
                              )}
                            </dd>
                          </div>
                        ))}
                      </dl>
                      <p className="mt-5 text-[12px] leading-relaxed text-ink-muted">
                        This object, not a document, is what makes a fraud claim investigable two years
                        from now — and what makes a data breach this morning merely embarrassing.
                      </p>
                    </Panel>
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-3">
                  <Button size="lg" variant="primary" onClick={() => go(6)}>
                    Finish
                    <ArrowRight className="size-4" />
                  </Button>
                  <Button size="lg" variant="ghost" onClick={() => go(0)}>
                    <ArrowLeft className="size-4" />
                    Start over
                  </Button>
                </div>
              </div>
            </Reveal>
          )}

          {/* ── 6 · done ─────────────────────────────────────────────── */}
          {step === 6 && assertion && verification && (
            <Reveal key="done">
              <div className="space-y-7">
                <Panel className="overflow-hidden p-7 md:p-10">
                  <div
                    aria-hidden
                    className="pointer-events-none absolute inset-x-0 top-0 h-px"
                    style={{
                      background:
                        "linear-gradient(90deg, transparent, var(--mint), transparent)",
                    }}
                  />
                  <div className="flex flex-col gap-9 sm:flex-row sm:items-center">
                    <TrustRing
                      value={AAL_SCORE[assertion.assuranceLevel]}
                      caption={assertion.assuranceLevel}
                      sub="assurance"
                    />
                    <div className="min-w-0 flex-1">
                      <Badge tone="mint">
                        <CircleCheck className="size-3" />
                        Identity verified
                      </Badge>
                      <h2 className="display-md mt-4">
                        You are asserted, not documented.
                      </h2>
                      <p className="mt-4 max-w-xl text-[14px] leading-relaxed text-ink-2">
                        Your profile now carries the heaviest-weighted trust signal on the platform, and
                        the assertion is attached to every contract you sign from here. The artefact is
                        still sitting in your own DigiLocker, exactly where it was.
                      </p>
                      <div className="mt-6 flex flex-wrap gap-2">
                        <span className="chip font-mono text-[10.5px]">{assertion.requestId}</span>
                        <span className="chip font-mono text-[10.5px]">{assertion.maskedIdentifier}</span>
                        <span className="chip font-mono text-[10.5px]">
                          {verification.issuer ?? assertion.issuerId}
                        </span>
                      </div>
                    </div>
                  </div>
                </Panel>

                <div className="grid gap-4 md:grid-cols-2">
                  <Panel className="p-6">
                    <Label>What {assertion.assuranceLevel} buys you</Label>
                    <p className="mt-3.5 font-display text-[19px] leading-snug tracking-[-0.015em] text-caramel">
                      {AAL_COPY[assertion.assuranceLevel].title}
                    </p>
                    <p className="mt-3 text-[13px] leading-relaxed text-ink-muted">
                      {AAL_COPY[assertion.assuranceLevel].body}
                    </p>
                  </Panel>
                  <Panel className="p-6">
                    <Label>Assurance levels, ranked</Label>
                    <ul className="mt-3.5 space-y-2.5">
                      {(["AAL1", "AAL2", "AAL3"] as const).map((lvl) => (
                        <li key={lvl} className="flex items-center gap-3">
                          <span
                            className={cn(
                              "font-mono text-[11px]",
                              assertion.assuranceLevel === lvl ? "text-mint" : "text-ink-faint",
                            )}
                          >
                            {lvl}
                          </span>
                          <Meter
                            value={AAL_SCORE[lvl]}
                            tone={lvl === "AAL3" ? "mint" : lvl === "AAL2" ? "caramel" : "rose"}
                            className="flex-1"
                          />
                          <span className="w-8 text-right font-mono text-[10.5px] tabular-nums text-ink-faint">
                            {AAL_SCORE[lvl]}
                          </span>
                        </li>
                      ))}
                    </ul>
                    <p className="mt-4 text-[12px] leading-relaxed text-ink-muted">
                      AAL2 outranks AAL1 regardless of which document produced it. CREAM baselines
                      everything that touches money at AAL2.
                    </p>
                  </Panel>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <Button asChild size="lg" variant="primary">
                    <Link href="/discover">
                      Browse the pool
                      <ArrowRight className="size-4" />
                    </Link>
                  </Button>
                  <Button asChild size="lg" variant="outline">
                    <Link href="/trust#digilocker">How this works, in detail</Link>
                  </Button>
                  <Button size="lg" variant="ghost" onClick={() => go(0)}>
                    Run the flow again
                  </Button>
                </div>

                {flow.length > 0 && (
                  <Panel className="p-6">
                    <Label>Reference · the adapter&apos;s own step list</Label>
                    <ol className="mt-4 grid gap-2 sm:grid-cols-2">
                      {flow.map((f, i) => (
                        <li key={f.id} className="flex gap-3 text-[12.5px] leading-relaxed text-ink-muted">
                          <span className="font-mono text-[10.5px] tabular-nums text-ink-faint">
                            {String(i + 1).padStart(2, "0")}
                          </span>
                          <span>
                            <span className="text-ink-2">{f.title}</span> · {f.actor}
                          </span>
                        </li>
                      ))}
                    </ol>
                  </Panel>
                )}
              </div>
            </Reveal>
          )}
        </div>
      </div>

      {/* persistent adapter note */}
      <div className="pointer-events-none fixed bottom-5 right-5 z-40 hidden lg:block">
        <div className="pointer-events-auto flex items-center gap-2.5 rounded-full border border-line bg-surface/90 py-2 pl-3 pr-4 shadow-e2 backdrop-blur">
          <span className={cn("size-1.5 rounded-full", live ? "bg-mint" : "bg-caramel")} />
          <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-faint">
            DigiLocker
          </span>
          <span className="font-mono text-[10px] text-ink-2">{mode ?? "…"}</span>
          <span className="h-3 w-px bg-line" aria-hidden />
          <span className="font-mono text-[10px] text-ink-faint">{env ?? "sandbox"}</span>
        </div>
      </div>
    </div>
  );
}

/* ── role selector ─────────────────────────────────────────────────────── */

function StaggerRoleGrid({
  role,
  onPick,
}: {
  role: RoleId | null;
  onPick: (r: RoleId) => void;
}) {
  return (
    <div className="grid gap-3">
      {ROLES.map((r) => {
        const active = role === r.id;
        return (
          <button
            key={r.id}
            type="button"
            onClick={() => onPick(r.id)}
            aria-pressed={active}
            className={cn(
              "group rounded-xl border p-6 text-left transition-all duration-200",
              active
                ? "border-caramel/60 bg-caramel/[0.07]"
                : "border-line bg-surface hover:border-line-strong hover:bg-surface-2/40",
            )}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <span
                  className={cn(
                    "grid size-9 shrink-0 place-items-center rounded-xl border transition-colors",
                    active
                      ? "border-caramel/50 bg-caramel/12 text-caramel"
                      : "border-line bg-surface-2 text-ink-muted",
                  )}
                >
                  <r.icon className="size-4" />
                </span>
                <div>
                  <div className="font-display text-[18px] leading-tight tracking-[-0.015em] text-ink">
                    {r.title}
                  </div>
                  <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.13em] text-ink-faint">
                    recommends · {r.recommends}
                  </div>
                </div>
              </div>
              <span
                className={cn(
                  "mt-1 grid size-5 shrink-0 place-items-center rounded-full border transition-colors",
                  active ? "border-caramel bg-caramel text-[oklch(0.18_0.02_60)]" : "border-line-strong",
                )}
                aria-hidden
              >
                {active && <Check className="size-3" />}
              </span>
            </div>
            <p className="mt-4 text-[13.5px] leading-relaxed text-ink-2">{r.line}</p>
            <p className="mt-2.5 text-[13px] leading-relaxed text-ink-muted">{r.body}</p>
            <p className="mt-3.5 border-t border-line pt-3.5 text-[12.5px] leading-relaxed text-ink-faint">
              {r.extra}
            </p>
          </button>
        );
      })}
    </div>
  );
}

/* ── assurance ring ─────────────────────────────────────────────────────── */

function TrustRing({
  value,
  caption,
  sub,
  size = 132,
}: {
  value: number;
  caption: string;
  sub: string;
  size?: number;
}) {
  const r = size / 2 - 8;
  const c = 2 * Math.PI * r;
  const tone = value >= 88 ? "var(--mint)" : value >= 68 ? "var(--caramel)" : "var(--rose)";

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-3)" strokeWidth={6} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={tone}
          strokeWidth={6}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c - (c * value) / 100}
          style={{ transition: "stroke-dashoffset 1.1s cubic-bezier(0.16,1,0.3,1)" }}
        />
      </svg>
      <div className="absolute inset-0 grid place-content-center text-center">
        <div
          className="font-display text-[32px] leading-none tracking-[-0.03em] tabular-nums"
          style={{ color: tone }}
        >
          {caption}
        </div>
        <div className="mt-1.5 font-mono text-[9px] uppercase tracking-[0.14em] text-ink-faint">
          {sub}
        </div>
      </div>
    </div>
  );
}
