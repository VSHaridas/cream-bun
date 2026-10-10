import type { Metadata } from "next";
import IdentityFlow from "./identity-flow";

/**
 * Server wrapper around the client consent flow.
 *
 * Two reasons it exists rather than the page being a client component itself:
 *
 *  1. Route segment config such as `dynamic` can only be exported from a
 *     server module. Without it this route is prerendered at build time, and
 *     prerendering pulls a session lookup — and therefore a database call —
 *     into `next build`.
 *  2. Keeping metadata on the server is the only way to have both.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Verify your identity",
  description:
    "Verify your account through DigiLocker. The issuer validates your document; CREAM receives an assertion and never the artefact.",
};

export default function IdentityOnboardingPage() {
  return <IdentityFlow />;
}