# CREAM

**An AI-native marketplace connecting AI filmmakers, animators and generative
content creators with brands and creative agencies.**

CREAM exists because the two hardest problems in generative creative work are
not generation problems.

The first is **verification**. A brand cannot tell which creator actually uses
the tools they claim, and cannot tell a published pipeline from a mood board. So
every creator on CREAM publishes a workflow with named human decision points,
carries vendor-credentialed tool claims, and has a trust score computed only
from claims that were independently substantiated.

The second is **the brief**. A brand knows what it wants and cannot say it. So
an assistant converses with them — one question at a time — and turns badly
worded intent into a brief specific enough for a creator to quote against. The
transcript is preserved and re-hydrated on the creator's side, which is the part
no other marketplace does.

Everything sensitive is delegated to a third party we do not control:
Supabase for auth, DigiLocker for identity, Razorpay for held payments,
SynthID/C2PA for provenance. CREAM keeps the orchestration, the contracts and
the trail.

---

## Run it

**Windows** — double-click:

```
START-CREAM.bat
```

It installs dependencies on first run, copies `.env.example` to `.env.local`
if it is missing, builds for production, starts the server, waits for it to
answer, and opens `http://localhost:3000` in your browser.

Other modes:

| Command | What it does |
| --- | --- |
| `START-CREAM.bat` | Production build, serve, open browser |
| `START-CREAM.bat dev` | Development server with hot reload |
| `START-CREAM.bat build` | Production build only |
| `START-CREAM.bat check` | `typecheck` + `lint` + production build |
| `START-CREAM.bat clean` | Wipe `.next` and reinstall dependencies |

**Any platform** — use the same launcher directly:

```bash
npm run launch            # build + serve + open
npm run launch -- --dev   # development server
npm run launch -- --no-build
```

Node 18+ required. **No API key is required to run anything.**

---

## Configuration

Full walkthrough with screenshots-level detail: **[`SETUP.md`](SETUP.md)**.

Copy `.env.example` to `.env.local` and fill in what you need. No key is
required to run anything.

| Key | Unlocks | Real call? |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` / `_ANON_KEY` | Federated SSO, row-level security, Postgres as the datastore | Yes |
| `SUPABASE_SERVICE_ROLE_KEY` | Seeding only. Bypasses RLS — server only | Yes |
| `GEMINI_API_KEY` | Live brief extraction, model picker at runtime | Yes |
| `NEXT_PUBLIC_RAZORPAY_KEY_ID` / `_KEY_SECRET` | — *sandbox adapter* | **No** |
| `NEXT_PUBLIC_DIGILOCKER_CLIENT_ID` | — *sandbox adapter* | **No** |
| `NEXT_PUBLIC_SYNTHID_API_KEY` | — *local stamper* | **No** |

The distinction is enforced at runtime, not just documented. `@/lib/env`
returns `configured`, `wired` and `live` as separate booleans, and the header's
`n/5 live` counter reads `live`. Supplying a Razorpay key therefore does **not**
flip Razorpay to live, because no network call is wired behind it. A prototype
that reports a capability it does not have is exactly the failure this product
is arguing against.

### The model is not in your config

There is no `GEMINI_MODEL` variable. The app calls `models.list()` with your
key and the UI offers only what that key can actually call. A new Gemini
release appears with no code change, and a model you have not been granted
cannot be selected. The chosen id is validated server-side against that same
list before any request is made.

### Four run modes

| Supabase | Gemini | Behaviour |
| --- | --- | --- |
| absent | absent | Seed dataset + deterministic reasoner. Zero credentials. |
| set | absent | Real Postgres and real auth, deterministic brief builder. |
| absent | set | Seed dataset, real model with the runtime picker. |
| set | set | Everything live. |

---

## What to look at first

| Route | Why |
| --- | --- |
| `/` | The thesis: why the AI never queries the creator database |
| `/discover` | Faceted search with explainable ranking and a recovery-aware empty state |
| `/creators/aarav.mehta` | The AI portfolio: tools, models, workflows with human checkpoints, trust signals |
| `/briefs/new` | The AI brief builder — say it badly, get a quotable brief |
| `/briefs/BRF-2026-0141` | Brief definition: deliverables, formats, and the commercial-use struct |
| `/engagements/ENG-2026-0311` | Gated lifecycle: contracts, escrow arithmetic, watermarked rounds, provenance |
| `/trust` | The four objections answered from the adapters themselves |
| `/onboarding/identity` | The DigiLocker consent flow, including a supported refusal path |
| `/model` | **Deliverable 2** — the data model note |
| `/deck` | **Deliverable 3** — the demo deck (`←`/`→` to navigate, `P` to print) |

---

## Architecture

```
scripts/launch.mjs              one-command launcher (build, serve, health-check, open)
scripts/seed.ts                 idempotent loader: bundled dataset → Postgres
supabase/migrations/
  0001_schema.sql               50 tables, 34 enums, RLS, triggers, 2 views

src/lib/env.ts                  the configured / wired / live distinction
src/lib/supabase/
  client.ts                     browser client (cookie storage — not localStorage)
  server.ts                     user-scoped client, and the service-role admin
  middleware.ts                 session refresh; runs on Edge

src/lib/domain/                 the model, with the reasoning attached
  types.ts                      every entity the marketplace reasons about
  taxonomy.ts                   tools, models, skills, formats, channels
  trust.ts                      verification signals, derived — never hand-authored

src/lib/data/                   the provider boundary
  provider.ts                   DataProvider + DataSnapshot, the contract
  seed-provider.ts              bundled dataset
  supabase-provider.ts          39 tables → domain types
  index.ts                      request-scoped (React cache) accessors

src/lib/search/engine.ts        faceted search, explainable ranking, empty-state blockers

src/lib/integrations/
  registry.ts                   live vs mock, and why
  digilocker.ts                 six-step issuer consent → signed assertion, no artefact
  razorpay.ts                   order → authorise → capture → milestone release → refund
  provenance.ts                 C2PA manifest + keyed watermark + visible burn-in + extraction

src/lib/llm/
  contract.ts                   the assistant's output schema
  gemini.ts                     live path + runtime model discovery
  reasoner.ts                   deterministic extractor used when no key is present
  index.ts                      one entry point; identical contract either way

src/app/api/                    route handlers for every third-party seam
src/components/                 design system, media engine and feature surfaces
```

### Four decisions worth knowing

**The model never searches the database.** A model cannot hold a continuously
changing creator pool without overflowing, and when it guesses it hallucinates.
So the model converses, deterministic code queries, the model explains. The
brief page at `/briefs/BRF-2026-0141` runs the real search engine against the
real pool to prove the brief is executable as a query.

**Trust signals are derived, not declared.** `signalsFor()` builds them from the
same records that power search — remove a tool from a profile and the "verified
tools" signal disappears with it. Only `verified` signals score.

**The datastore is behind a boundary, not under the app.** Twenty-odd files read
data, and none of them import an array. They call `getCreators()`,
`getBriefByCode()`, `getEngineContext()` and so on; those resolve through a
`DataProvider` to either the bundled seed or Postgres. Client components never
touch either — the server passes domain objects down as props, so a private
record is never serialised into a page a different user requested.

**Commercial use is a struct, not a boolean.** `licenseType`, `territory`,
`duration`, `channels`, `paidMediaAllowed`, `modelTrainingAllowed`,
`competitorUseBlocked` — each one moves the price by a different amount, and
collapsing them into "commercial use: yes" is how disputes start.

**Accessors are request-scoped via React `cache()`.** A module-level snapshot
would be shared across concurrent requests, which under row-level security means
one user's readable rows leaking into another's response.

---

## Commands

```bash
npm run dev         # development server
npm run build       # production build
npm start           # serve the production build
npm run typecheck   # tsc --noEmit
npm run lint        # eslint
npm run verify      # all three
npm run launch      # full launcher
npm run db:seed     # load the bundled dataset into Postgres
```

---

## Notes

This is a working prototype. Payments, identity and watermarking run against
sandbox adapters unless keys are supplied. Contract content, dispute resolution
and refunds are explicitly human-reviewed in the product design and are not
automated here. All portfolio artwork is generated procedurally from each
piece's own seed and palette — the same piece always renders the same frame,
which is the reproducibility guarantee a real generative pipeline gives you.