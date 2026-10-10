"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, Loader2, LogIn, Mail } from "lucide-react";
import { Button, inputClasses } from "@/components/ui/primitives";
import { getSupabaseBrowser } from "@/lib/supabase/client";

const PROVIDERS = [
  { id: "google", label: "Continue with Google" },
  { id: "apple", label: "Continue with Apple" },
] as const;

export function SignInFallbackNotice({ behaviour }: { behaviour: string }) {
  return (
    <div className="rounded-lg border border-caramel/35 bg-caramel/[0.06] p-4">
      <div className="flex items-start gap-2.5">
        <Mail className="mt-0.5 size-3.5 shrink-0 text-caramel" />
        <div>
          <div className="text-[12.5px] font-medium text-ink">Sign-in is not configured</div>
          <p className="mt-1.5 text-[11.5px] leading-relaxed text-ink-muted">{behaviour}</p>
          <Button asChild size="sm" variant="outline" className="mt-3">
            <Link href="/discover">
              Continue to discovery
              <ArrowRight className="size-3" />
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

export function SignInPanel({
  configured,
  behaviour,
  next,
}: {
  configured: boolean;
  behaviour: string;
  next?: string;
}) {
  const [busy, setBusy] = React.useState<string | null>(null);
  const [email, setEmail] = React.useState("");
  const [sent, setSent] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  if (!configured) {
    return <SignInFallbackNotice behaviour={behaviour} />;
  }

  async function signInWith(provider: "google" | "apple") {
    const supabase = getSupabaseBrowser();
    if (!supabase) {
      setError("The browser session could not be initialised.");
      return;
    }
    setBusy(provider);
    setError(null);
    const origin = window.location.origin;
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${origin}/auth/callback${next ? `?next=${encodeURIComponent(next)}` : ""}`,
      },
    });
    if (oauthError) {
      setError(oauthError.message);
      setBusy(null);
    }
  }

  async function sendMagicLink(event: React.FormEvent) {
    event.preventDefault();
    const supabase = getSupabaseBrowser();
    if (!supabase) {
      setError("The browser session could not be initialised.");
      return;
    }
    setBusy("email");
    setError(null);
    const origin = window.location.origin;
    const { error: linkError } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${origin}/auth/callback${next ? `?next=${encodeURIComponent(next)}` : ""}`,
      },
    });
    setBusy(null);
    if (linkError) setError(linkError.message);
    else setSent(true);
  }

  return (
    <div className="space-y-5">
      <div className="space-y-2.5">
        {PROVIDERS.map((p) => (
          <Button
            key={p.id}
            variant="outline"
            className="w-full justify-center"
            disabled={busy !== null}
            onClick={() => void signInWith(p.id)}
          >
            {busy === p.id ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <LogIn className="size-3.5" />
            )}
            {p.label}
          </Button>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <span className="h-px flex-1 bg-line" />
        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-faint">or</span>
        <span className="h-px flex-1 bg-line" />
      </div>

      {sent ? (
        <p className="rounded-lg border border-mint/35 bg-mint/[0.07] px-4 py-3.5 text-[12.5px] leading-relaxed text-mint">
          Check {email}. The link signs you in once and then expires — it is not a password, and it
          is not something we could read even if we wanted to.
        </p>
      ) : (
        <form onSubmit={sendMagicLink} className="space-y-3">
          <div>
            <label htmlFor="email" className="label-xs">
              Email a one-time link
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@brand.com"
              className={`${inputClasses} mt-2 h-10`}
              disabled={busy !== null}
            />
          </div>
          <Button type="submit" variant="subtle" className="w-full" disabled={busy !== null}>
            {busy === "email" && <Loader2 className="size-3.5 animate-spin" />}
            Send the link
          </Button>
        </form>
      )}

      {error && (
        <p className="rounded-lg border border-rose/40 bg-rose/[0.08] px-4 py-3 text-[12px] leading-relaxed text-rose">
          {error}
        </p>
      )}
    </div>
  );
}