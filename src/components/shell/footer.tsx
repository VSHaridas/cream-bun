import Link from "next/link";
import type { IntegrationStatus } from "./header";
import { Wordmark } from "./wordmark";

const COLUMNS = [
  {
    title: "Marketplace",
    links: [
      { href: "/discover", label: "Discover creators" },
      { href: "/discover?f=tools", label: "Browse by tool" },
      { href: "/discover?f=verification", label: "Verified only" },
      { href: "/briefs/new", label: "AI brief builder" },
      { href: "/briefs", label: "Your briefs" },
    ],
  },
  {
    title: "Trust layer",
    links: [
      { href: "/trust", label: "How we are verified" },
      { href: "/trust#digilocker", label: "DigiLocker identity" },
      { href: "/trust#razorpay", label: "Held payments" },
      { href: "/trust#provenance", label: "Provenance & watermark" },
      { href: "/onboarding/identity", label: "Verify your account" },
    ],
  },
  {
    title: "Product",
    links: [
      { href: "/model", label: "Data model note" },
      { href: "/deck", label: "Demo deck" },
      { href: "/engagements", label: "Engagements" },
      { href: "/api-docs", label: "Architecture & adapters" },
    ],
  },
];

export function Footer({ integrations }: { integrations: IntegrationStatus[] }) {
  const live = integrations.filter((i) => i.mode === "live");

  return (
    <footer className="mt-24 border-t border-line bg-bg-deep/40">
      <div className="container-x py-14">
        <div className="grid gap-10 lg:grid-cols-[1.4fr_repeat(3,1fr)]">
          <div className="space-y-4">
            <Wordmark />
            <p className="max-w-xs text-balance-pretty text-[13px] leading-relaxed text-ink-muted">
              A marketplace for AI-native creative work — built so a brand can trust a creator
              it has never met, and a creator can trust a payment it has not yet received.
            </p>
            <div className="flex flex-wrap gap-1.5 pt-1">
              {integrations.map((i) => (
                <span
                  key={i.id}
                  title={`${i.name} — ${i.mode} adapter`}
                  className="chip px-2 py-1 text-[10px]"
                >
                  <span
                    className={`size-1.5 rounded-full ${i.mode === "live" ? "bg-mint" : "bg-ink-faint"}`}
                  />
                  {i.vendor}
                </span>
              ))}
            </div>
          </div>

          {COLUMNS.map((col) => (
            <div key={col.title}>
              <h3 className="label-xs mb-3.5">{col.title}</h3>
              <ul className="space-y-2">
                {col.links.map((l) => (
                  <li key={l.href}>
                    <Link
                      href={l.href}
                      className="text-[13px] text-ink-muted transition-colors hover:text-ink"
                    >
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col gap-3 border-t border-line pt-6 text-[11.5px] text-ink-faint sm:flex-row sm:items-center sm:justify-between">
          <p>
            Built as a working prototype. Payments, identity and watermarking run against
            sandbox adapters unless keys are supplied in{" "}
            <code className="font-mono text-ink-muted">.env.local</code>.
          </p>
          <p className="font-mono">
            {live.length}/{integrations.length} integrations live · {integrations.length - live.length}{" "}
            sandboxed
          </p>
        </div>
      </div>
    </footer>
  );
}