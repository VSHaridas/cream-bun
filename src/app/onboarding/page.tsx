import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, Check, CircleDashed, Fingerprint, FolderOpen, Gauge, UserRound } from "lucide-react";
import { getOnboardingState } from "@/lib/identity/onboarding-state";
import { Button } from "@/components/ui/primitives";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Set up your account",
  description: "Finish your CREAM profile so brands and creators can work with you.",
};

/**
 * Where every new account lands.
 *
 * Sign-in used to return to `/` unconditionally, which meant a brand that had
 * just created its account saw an empty-feeling site with no indication of what
 * to do next. This page states what the account is missing and links to the one
 * step that resolves it, so the first session after OAuth is not a dead end.
 */

const STEPS = [
  {
    icon: UserRound,
    role: "creator" as const,
    title: "Shape your creator profile",
    body: "Headline, bio, philosophy and day rate. This is what the discovery engine reads when a brand filters by specialisation.",
    href: "/onboarding/identity",
    cta: "Open profile setup",
  },
  {
    icon: FolderOpen,
    role: "creator" as const,
    title: "Upload your first piece",
    body: "A portfolio piece carries the tools, models, aspect ratio and skills that the trust engine scores. One real piece beats a long description.",
    href: "/discover",
    cta: "See what a strong piece looks like",
  },
  {
    icon: Fingerprint,
    role: "creator" as const,
    title: "Verify your identity",
    body: "DigiLocker asserts who you are. CREAM receives the assertion and never the document, and verification raises your trust score.",
    href: "/onboarding/identity",
    cta: "Walk the identity flow",
  },
  {
    icon: Gauge,
    role: "brand" as const,
    title: "Confirm your legal entity",
    body: "Held payments need a named entity to settle against. This is what Razorpay routes the payout through.",
    href: "/onboarding/identity",
    cta: "Confirm entity details",
  },
  {
    icon: Check,
    role: "brand" as const,
    title: "Write your first brief",
    body: "Gemini turns a free-form requirement into a structured brief you can send to creators and compare offers against.",
    href: "/briefs/new",
    cta: "Open the brief builder",
  },
];

export default async function OnboardingPage() {
  const state = await getOnboardingState();

  if (!state.signedIn) redirect("/auth/signin?next=/onboarding");
  if (!state.needsOnboarding) redirect("/");

  const steps = STEPS.filter((s) => s.role === state.role);
  const name = state.displayName?.split(" ")[0];

  return (
    <div className="container-x py-20 sm:py-28">
      <div className="max-w-3xl">
        <span className="label-xs">Almost there</span>

        <h1 className="display-lg mt-4">
          Welcome{state.role === "creator" ? "" : " to the client side"}
          {name ? <>, {name}</> : ""}.
        </h1>

        <p className="mt-6 max-w-2xl text-balance-pretty text-[17px] leading-relaxed text-ink-2">
          Your account exists and you are signed in. What is missing is the part other people
          see — {state.missing.length} item{state.missing.length === 1 ? "" : "s"} that{" "}
          {state.missing.length === 1 ? "a brand" : "brands"} would use to judge whether to work
          with you.
        </p>

        <ul className="mt-8 flex flex-wrap gap-1.5">
          {state.missing.map((item) => (
            <li key={item} className="chip px-2.5 py-1 font-mono text-[11px]">
              {item}
            </li>
          ))}
        </ul>

        <div className="mt-12 space-y-3">
          {steps.map((step, i) => {
            const Icon = step.icon;
            return (
              <RevealRow key={step.title} delay={0.06 * i}>
                <div className="flex flex-col gap-4 rounded-2xl border border-line bg-surface p-6 sm:flex-row sm:items-start">
                  <span className="grid size-9 shrink-0 place-items-center rounded-full border border-line bg-surface-2">
                    <Icon className="size-4 text-ink-muted" aria-hidden />
                  </span>

                  <div className="min-w-0 flex-1">
                    <h2 className="font-display text-[17px] tracking-[-0.01em] text-ink">
                      {step.title}
                    </h2>
                    <p className="mt-1.5 text-[13.5px] leading-relaxed text-ink-muted">
                      {step.body}
                    </p>
                    <Button asChild variant="link" size="sm" className="mt-3 -ml-3">
                      <Link href={step.href}>
                        {step.cta}
                        <ArrowRight className="size-3.5" />
                      </Link>
                    </Button>
                  </div>

                  <CircleDashed
                    className="hidden size-4 shrink-0 text-ink-faint sm:block"
                    aria-hidden
                  />
                </div>
              </RevealRow>
            );
          })}
        </div>

        <p className="mt-10 text-[12.5px] text-ink-faint">
          Not ready to finish now?{" "}
          <Link href="/" className="text-caramel underline-offset-4 hover:underline">
            Skip for now
          </Link>{" "}
          — you will be offered this again next time you sign in.
        </p>
      </div>
    </div>
  );
}

function RevealRow({ delay, children }: { delay: number; children: React.ReactNode }) {
  return (
    <div
      style={{ animationDelay: `${delay}s` }}
      className="motion-safe:animate-[fade-up_0.5s_ease-out_both]"
    >
      {children}
    </div>
  );
}