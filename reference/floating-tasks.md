# Floating tasks — CREAM

Durable tracker. Todos come and go; this file is the record of why.
Last updated: 2026-10-11, after second review round.

---

## Status legend

`TODO` `WIP` `DONE` `BLOCKED` `DEFERRED` `WONTFIX`

---

## 0. Critical — live breakage found in deployment review

### P0-1 · Pages 500 on an empty or unseeded datastore — `DONE`
**Found:** `/` → `artSeed`, `/trust` → `amountInr`, `/model` → `rounds`, and
`/deck` (same bug, not yet reported). Commit `14daf1f`.

All four indexed straight into the dataset and assumed rows existed:
`escrows[0].amountInr`, `briefs[0]`, `engagements[0].rounds[1]`,
`portfolio.find(...)!`. A non-null assertion is not a runtime check.

Each page now declares the rows it needs and renders a named empty state that
says which tables are empty and the command that fills them. Two index
assumptions were fixed rather than guarded: `d3` is a seeded literal a
user-created brief will never have, and `rounds[1]` presumes a second revision.

**Verified:** `npm run check:empty` — all seven data pages 200 with the guard
firing under `CREAM_FORCE_DATASET=empty`; all eight render real content under
the seed.

---

### P0-2 · `persist.createBrief` declared, never implemented, never called — `DONE`
Commit `ea415fe`. Briefs now write to `brief_sessions` + `briefs` +
`conversation_turns`, and the publish button reports what the server returned
rather than asserting success.

Ownership resolves from the session, not the request body — `briefs.brand_id`
is an RLS boundary and a client-supplied owner would undermine it.

**Accept when:** creating a brief writes a row, it appears in `/briefs`, and it
survives a reload. Export works from that row.
**Still to verify against a live project:** the write itself. Locally verified
by type and by render, not by round trip.

---

### P0-3 · Every page load makes 30 queries, not 15 — `DONE`
`getDatastoreStatus` and `getSnapshot` each called `provider.load()`. React
`cache()` memoises per function, not per underlying call, so the shell's status
check and the page's data read each fired the full fifteen-table `Promise.all` —
serially, because the shell awaits first. Commit `14daf1f`.

Both now share one memoised `loadOnce`. **Needs a production measurement to
confirm** the 8s is gone.

---

### P1-1 · Double datastore read — `DONE` (merged into P0-3)
### P1-4 · `Auth session missing!` logged as an error on every anonymous request — `DONE`
Correct behaviour, wrong log level. Commit `19aa361`.

---

### P2-1 · No onboarding after first sign-in — `DONE`
Commit `19aa361`.

`handle_new_user()` writes a usable-looking profile on first sign-in, so nothing
that checked for *existence* saw an unfinished account. `getOnboardingState()`
reads the *shape* instead: a creator needs a headline, bio, philosophy, day
rate, a portfolio piece and a verification; a brand needs a legal entity name.
Incomplete accounts land on `/onboarding`, configured ones go home. An explicit
`next` still wins, and the state query degrades rather than failing the sign-in.

---

## 1. Supabase / infra

### P1-1 · Double datastore read — `OPEN` (same as P0-3)
### P1-2 · Demo mode: seed rows *inside* Supabase + runtime switch — `OPEN`
User's requirement: seed data must live in Postgres, not in the bundle, so the
dynamics and interactions are real. Demo = seed rows, production = real rows.
Must be modular and removable later.

Current state: `seedProvider` is a bundle-level read-only shim. `npm run db:seed`
does load seed into Postgres, but with no way to scope or switch it.

**Plan:** add a `dataset` discriminator to marketplace tables
(`production` | `demo`), seed with `demo`, and a session-scoped mode toggle that
filters every read. Remove by dropping the column and the filter.

**Accept when:** toggling the switch changes the dataset without a redeploy;
deleting demo rows is one script; removing the feature is one filter removal.
### P1-3 · Verify migration actually applied to production — `UNVERIFIED`
The `/rest/v1` 404s proved nothing about table existence. Still unconfirmed.
### P1-4 · `Auth session missing!` logged as an error on every anonymous request — `OPEN`
Correct behaviour (anonymous users are legitimate), wrong log level. Every
request writes a scary line. Should be debug-level, not `console.error`.

---

## 2. Identity / onboarding

### P2-1 · No onboarding after first sign-in — `OPEN`
**Found:** Google sign-in completes, lands on `/`, no onboarding.

`src/app/auth/callback/route.ts:56` always redirects to `safeNext(next)` which
defaults to `/`. Nothing checks whether the account is new or has a profile.
`/onboarding/identity` is reachable only from the footer and the trust page.

**Accept when:** a first-time user lands on onboarding and is offered it; a
returning user with a profile does not.

---

## 3. Creator side — the bigger structural gap

### P3-1 · No creator-facing surface exists — `OPEN`
**Found:** the site is a client-side product only. A creator can be *viewed*
(`/creators/[handle]`) but cannot *act*.

Missing entirely:
- creator home / dashboard
- incoming briefs, and a way to submit an offer
- offer accept / decline
- portfolio management (upload, reorder, tag tools/models/skills)
- engagement execution: rounds, samples, submission, approval
- earnings and escrow view
- availability and rate settings
- verification status

There is no route, component, or nav entry for any of this.

**Accept when:** a signed-in creator can complete a full lifecycle — see a
brief, offer on it, get accepted, submit a round, be approved, see payment
state — without a developer in the loop.

This is the largest single item. It is a feature build, not a bug fix.

---

## 4. Brief experience

### P4-1 · No export, no shareable preview — `DONE` (export) / `OPEN` (shareable preview)
Markdown and plain-text renderers in `src/lib/brief/export.ts`, reachable from
the builder after a successful save, plus an "export anyway" path when the write
fails. `npm run check:export` asserts the rendered document has substance.
A shareable read-only preview URL is still open.
### P4-2 · Gemini output feels rigid and templated — `OPEN`
User's own words: "it works, but it feels rigid". Low priority per user, but
likely the system prompt over-constrains and normalises every answer. Needs
variation in structure, and fewer fixed sections.
### P4-3 · No way to preview a brief before creating it — `OPEN`

---

## 5. Content / navigation

### P5-1 · In-app sitemap explaining every section — `OPEN`
User's request: a page on the site itself that explains what each section is.
Should describe purpose, audience (client vs creator), and how the pieces
connect — not just list links.
### P5-2 · Landing page — `DEFERRED`
User said "we'll leave that for later". `/` currently serves as a landing page
and also crashes on empty data (P0-1).

---

## 6. Closed

- `DONE` · Doubled `/rest/v1` in `NEXT_PUBLIC_SUPABASE_URL` → 404 on every query. Fixed + normalised in `src/lib/env.ts`, guarded in middleware. Commit `334d597`.
- `DONE` · Middleware threw on a bad Supabase client, 500-ing every route at once. Now fails open.
- `DONE` · `/auth/signin` redirected to itself, nesting `?next=` unbounded. Routes now public + loop guard.
- `DONE` · `/api-docs` 404 (footer linked to a route that did not exist). Created.
- `DONE` · Next.js CVE → 15.5.27. Commit `a741ecc`.
- `DONE` · Build-time `cookies()` outside request scope. All data routes now `force-dynamic`.
- `DONE` · Repo hygiene: 1.1GB → ~290MB, `.gitignore` hardened, secrets purged from history.

---

## 7. Verification harness

Dependency-free, because adding a test runner wants `@types/node` ≥22 and this
project is on ^20. Each one fails the process on a bad result.

| Command | Asserts |
| --- | --- |
| `npm run check:url` | Project URL normalises to a bare origin; `/rest/v1` and friends are stripped |
| `npm run check:empty` | No page 500s under `CREAM_FORCE_DATASET=empty` |
| `npm run check:export` | Brief export renders a document with substance, no `undefined` leakage |
| `npm run build` + `npm run start` | Route table and static generation |
| `npm run db:seed` | Idempotent upsert of the seed graph |