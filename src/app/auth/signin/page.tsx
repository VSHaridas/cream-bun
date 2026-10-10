import Link from "next/link";
import type { Metadata } from "next";
import { KeyRound, ShieldCheck, Sparkles } from "lucide-react";
import { Reveal } from "@/components/shared/motion";
import { supabaseCapability } from "@/lib/env";
import { SignInPanel } from "./sign-in-panel";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to CREAM with a federated identity provider.",
};

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const { error, next } = await searchParams;
  const capability = supabaseCapability();
  const configured = capability.live;

  return (
    <div className="container-x flex min-h-[calc(100dvh-16rem)] items-center justify-center py-16">
      <div className="grid w-full max-w-4xl gap-10 lg:grid-cols-[1fr_400px] lg:items-center">
        <Reveal>
          <div className="label-xs mb-5">Identity</div>
          <h1 className="display-md">
            We never see your <span className="serif-italic text-cream-gradient">password</span>.
          </h1>
          <p className="mt-5 max-w-md text-balance-pretty text-[14.5px] leading-relaxed text-ink-muted">
            CREAM authenticates through a federated provider. There is no credential stored on our
            side to leak, phish or sell, and no password-reset flow because there is no password.
          </p>

          <ul className="mt-9 space-y-4">
            {[
              {
                icon: ShieldCheck,
                t: "The provider holds the credential",
                d: "Google or Apple authenticates you. We receive a signed token and a profile, nothing more.",
              },
              {
                icon: KeyRound,
                t: "Government ID stays with the issuer",
                d: "Onboarding runs through DigiLocker, where the issuer validates the document and we retain an assertion, never an artefact.",
              },
              {
                icon: Sparkles,
                t: "Briefs are yours, not ours",
                d: "Row-level security means your brief is invisible to other users at the database, not filtered in application code.",
              },
            ].map((row) => (
              <li key={row.t} className="flex gap-3.5">
                <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg border border-line bg-surface-2 text-caramel">
                  <row.icon className="size-3.5" />
                </span>
                <div>
                  <div className="text-[13.5px] font-medium text-ink">{row.t}</div>
                  <p className="mt-1 text-[12.5px] leading-relaxed text-ink-muted">{row.d}</p>
                </div>
              </li>
            ))}
          </ul>
        </Reveal>

        <Reveal delay={0.08}>
          <div className="rounded-xl border border-line bg-surface p-6">
            {error && (
              <p className="mb-5 rounded-lg border border-rose/40 bg-rose/[0.08] px-4 py-3 text-[12.5px] leading-relaxed text-rose">
                {error}
              </p>
            )}
            <SignInPanel configured={configured} behaviour={capability.behaviour} next={next} />
          </div>

          <p className="mt-5 text-center text-[12px] text-ink-faint">
            <Link href="/" className="underline-offset-4 hover:text-ink-muted hover:underline">
              Browse the pool without signing in
            </Link>
          </p>
        </Reveal>
      </div>
    </div>
  );
}