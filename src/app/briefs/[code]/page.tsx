export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Info } from "lucide-react";
import {
  getBriefByCode,
  getCreators,
  getOffers,
  getPortfolio,
  getSessions,
  getWorkflows,
} from "@/lib/data";
import { createTrustEngine } from "@/lib/domain/trust";
import {
  BriefHeader,
  BudgetTimeline,
  DeliverablesTable,
  IntentComparison,
  RequiredSignals,
  RightsCard,
  StyleGuardrails,
} from "@/components/brief/brief-definition";
import { BriefTranscript, OfferCard, Shortlist } from "@/components/brief/brief-origin";
import { BriefMatchPanel } from "@/components/brief/brief-match-panel";
import { Button } from "@/components/ui/primitives";
import { Reveal } from "@/components/shared/motion";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ code: string }>;
}): Promise<Metadata> {
  const { code } = await params;
  const brief = await getBriefByCode(code);
  if (!brief) return { title: "Brief not found" };
  return {
    title: `${brief.title} — ${brief.code}`,
    description: brief.campaignObjective,
  };
}

const SECTIONS = [
  { id: "intent", n: "01", k: "The intent, both ways" },
  { id: "deliverables", n: "02", k: "Deliverables" },
  { id: "rights", n: "03", k: "Commercial use" },
  { id: "style", n: "04", k: "Style guardrails" },
  { id: "budget", n: "05", k: "Budget & timeline" },
  { id: "transcript", n: "06", k: "Originating conversation" },
  { id: "offers", n: "07", k: "Shortlist & offers" },
  { id: "match", n: "08", k: "Match against the pool" },
];

export default async function BriefDetailPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const brief = await getBriefByCode(code);
  if (!brief) notFound();

  const [sessions, offers, creators, portfolio, workflows] = await Promise.all([
    getSessions(),
    getOffers(),
    getCreators(),
    getPortfolio(),
    getWorkflows(),
  ]);

  const session = sessions.find((s) => s.id === brief.sessionId) ?? sessions[0];
  const briefOffers = offers.filter((o) => brief.offerIds.includes(o.id));
  const creatorById = new Map(creators.map((c) => [c.id, c]));
  const shortlisted = brief.shortlistedCreatorIds
    .map((id) => creatorById.get(id))
    .filter((c): c is NonNullable<typeof c> => Boolean(c));
  const trust = createTrustEngine({
    portfolio,
    workflows: new Map(workflows.map((w) => [w.id, w])),
  });

  return (
    <div className="pb-24">
      <BriefHeader brief={brief} />

      <div className="container-x grid gap-10 pt-12 lg:grid-cols-[1fr_196px] lg:gap-14">
        <div className="min-w-0 space-y-14">
          <Section id="intent" n="01" title="The intent, both ways" lede="One column is the source. The other is the extraction. Nothing in the right-hand column exists that is not in the left-hand column.">
            <IntentComparison brief={brief} />
          </Section>

          <Section id="deliverables" n="02" title="Deliverables" lede="Content type, format, aspect ratio and quantity — the four fields that decide what arrives and what it costs.">
            <DeliverablesTable brief={brief} />
          </Section>

          <Section id="rights" n="03" title="Commercial use" lede="Rights are a struct, not a checkbox. Territory, term, channel and the training question each move the price independently.">
            <RightsCard brief={brief} />
          </Section>

          <Section id="style" n="04" title="Style guardrails" lede="What the work must feel like, and what it must never feel like. The second list carries more weight in a dispute.">
            <StyleGuardrails brief={brief} />
          </Section>

          <Section id="budget" n="05" title="Budget & timeline" lede="Three gated deadlines and a set of included allowances. Each gate names the condition that has to be true before the next one opens.">
            <BudgetTimeline brief={brief} />
            <div className="mt-4">
              <RequiredSignals brief={brief} />
            </div>
          </Section>

          <Section id="transcript" n="06" title="The originating conversation" lede="Stored beside the brief, not derived from it. This is the artefact that gets re-hydrated for the creator.">
            <BriefTranscript session={session} />
          </Section>

          <Section
            id="offers"
            n="07"
            title="Shortlist & offers"
            lede="Who is on the list, what they quoted, and the version of this brief they actually read."
          >
            <div className="space-y-4">
              <Shortlist brief={brief} creators={shortlisted} assessTrust={trust.assess} />
              {briefOffers.length > 0 ? (
                briefOffers.map((o) => (
                  <OfferCard key={o.id} offer={o} creator={creatorById.get(o.creatorId)} />
                ))
              ) : (
                <div className="flex items-start gap-3 rounded-xl border border-dashed border-line bg-surface/40 px-5 py-5">
                  <Info className="mt-0.5 size-3.5 shrink-0 text-ink-faint" />
                  <p className="text-[13px] leading-relaxed text-ink-muted">
                    No offers have been issued against this brief. CREAM will not let an offer leave
                    without a scope, a budget and a licence written down on this page first.
                  </p>
                </div>
              )}
            </div>
          </Section>

          <Section
            id="match"
            n="08"
            title="Match against the pool"
            lede="The same structured fields, executed as a query. No model is involved, so nothing here can be invented."
          >
            <BriefMatchPanel
              brief={brief}
              creators={creators}
              portfolio={portfolio}
              workflows={workflows}
            />
          </Section>
        </div>

        <aside className="hidden lg:block">
          <div className="sticky top-24">
            <div className="label-xs mb-4">On this page</div>
            <ol className="space-y-0 border-l border-line">
              {SECTIONS.map((s) => (
                <li key={s.id}>
                  <a
                    href={`#${s.id}`}
                    className="group flex items-baseline gap-2.5 py-2 pl-4 text-[12.5px] text-ink-faint transition-colors hover:text-ink"
                  >
                    <span className="font-mono text-[9.5px] tabular-nums opacity-70">{s.n}</span>
                    <span className="border-l border-transparent pl-0 group-hover:text-caramel">
                      {s.k}
                    </span>
                  </a>
                </li>
              ))}
            </ol>

            <div className="mt-7 space-y-2.5">
              <Button asChild variant="outline" size="sm" className="w-full">
                <Link href="/briefs/new">
                  Start a new brief
                  <ArrowRight className="size-3.5" />
                </Link>
              </Button>
              <Button asChild variant="ghost" size="sm" className="w-full">
                <Link href="/engagements">Open workspaces</Link>
              </Button>
            </div>

            <p className="mt-6 border-t border-line pt-4 text-[11px] leading-relaxed text-ink-faint">
              This page renders every field the assistant wrote, including the ones the brand never
              saw summarised. If a field is missing, it was missing from the conversation.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}

function Section({
  id,
  n,
  title,
  lede,
  children,
}: {
  id: string;
  n: string;
  title: string;
  lede: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24">
      <Reveal>
        <div className="mb-6 flex gap-5">
          <span className="mt-2.5 font-mono text-[11px] tabular-nums text-caramel">{n}</span>
          <div className="max-w-2xl">
            <h2 className="display-md">{title}</h2>
            <p className="mt-3 text-[14px] leading-relaxed text-ink-muted">{lede}</p>
          </div>
        </div>
      </Reveal>
      <Reveal delay={0.05}>{children}</Reveal>
    </section>
  );
}
