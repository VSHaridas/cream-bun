# Floating tasks — CREAM

Durable tracker. Todos come and go; this file is the record of why.
Last updated: 2026-10-11, after first live Vercel deployment review.

---

## Status legend

`TODO` `WIP` `DONE` `BLOCKED` `DEFERRED` `WONTFIX`

---

## 0. Critical — live breakage found in deployment review

### P0-1 · Pages 500 on an empty or unseeded datastore — `OPEN`
**Found:** `/` → `artSeed`, `/trust` → `amountInr`, `/model` → `rounds`.

All three are the same bug. Pages index straight into the dataset and assume
rows exist:

- `src/app/page.tsx:40` — `portfolio.find(...)!`
- `src/app/model/page.tsx:270-277` — `briefs[0]`, `creators[0]`, `engagements[0].rounds[1]`
- `src/app/trust/page.tsx:541` — reads `amountInr` off a looked-up row

A non-null assertion is not a runtime check. With Supabase connected but empty
(migration applied, not seeded) every one of these dereferences `undefined`.

**Accept when:** no page can 500 on an empty dataset. Either the pages render an
explicit empty state, or the dataset is guaranteed populated. Both, ideally.

---

### P0-2 · `persist.createBrief` declared, never implemented, never called — `OPEN`
**Found:** brief count stays 0; `brief_sessions` has no rows in Supabase.

`src/lib/data/provider.ts:47` declares `persist.createBrief`. Nothing implements
it. Nothing calls it. The brief builder is read-only — it renders a preview that
goes nowhere.

This also explains "the brief isn't being exported anywhere".

**Accept when:** creating a brief writes a row, it appears in `/briefs`, and it
survives a reload. Export (PDF/Markdown/copy) works from that row.

---

### P0-3 · Every page load makes 30 queries, not 15 — `OPEN`
**Found:** user reports 8s+ on every section.

`getDatastoreStatus()` calls `provider.load()`. `getSnapshot()` calls
`provider.load()` again. React `cache()` memoises each function separately, so
they do not share a result — the full 15-table `Promise.all` runs twice per
request. `AppShell` calls the first, every page calls the second.

**Accept when:** one load per request, verified by query count. Measured page
load under 1s warm.

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

### P4-1 · No export, no shareable preview — `OPEN`
Depends on P0-2.
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