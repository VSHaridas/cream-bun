# CREAM — setup, credentials and deployment

Everything you need to hand to collect. Nothing here is required to *run* the
app; all of it is required to run it against real infrastructure.

---

## 1. Supabase — auth and the full datastore

### 1.1 Create the project

1. Go to <https://supabase.com/dashboard> → **New project**.
2. Pick a region close to your users (Singapore or Mumbai for an India-first
   marketplace).
3. Save the generated database password somewhere safe — you will need it for
   the CLI link step.

### 1.2 The three keys

**Dashboard → Project Settings → Data API**

| Field | Copy to |
| --- | --- |
| Project URL | `NEXT_PUBLIC_SUPABASE_URL` |
| `anon` / `publishable` key | `NEXT_PUBLIC_SUPABASE_ANON_KEY` |

**Dashboard → Project Settings → API Keys**

| Field | Copy to |
| --- | --- |
| `service_role` key | `SUPABASE_SERVICE_ROLE_KEY` |

> The service-role key bypasses row-level security. It must **never** be
> prefixed `NEXT_PUBLIC_` and must only ever be read by `scripts/seed.ts` and
> server-only modules. If you ever paste it into a client component, rotate it.

### 1.3 Enable pgvector (needed for the embedding columns)

**Dashboard → Database → Extensions** → search `vector` → Enable.

The schema has `vector(768)` columns on `briefs` and `creators` plus vector
indexes. Without this extension the migration fails.

### 1.4 Apply the schema

**Dashboard → SQL Editor → New query**, then paste the whole of
[`supabase/migrations/0001_schema.sql`](supabase/migrations/0001_schema.sql)
and run it.

It creates 50 tables, 34 enums, ~100 indexes, 13 functions, 2 views, enables
RLS on every table and attaches 106 policies. It is written to be re-runnable.

Alternatively, with the Supabase CLI linked:

```bash
supabase link --project-ref <your-ref>
supabase db push
```

### 1.5 Load the seed data

```bash
# needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local
npm run db:seed
```

Idempotent — every write is an upsert keyed on the domain slug, so running it
twice is a no-op. Use `npm run db:seed -- --truncate` to wipe first, which
requires this helper function (the script prints it for you if it is missing):

```sql
create or replace function public.exec_sql(sql text) returns void
language sql security definer as $$ begin execute sql; end; $$;
revoke all on function public.exec_sql(text) from public, anon, authenticated;
```

### 1.6 Auth configuration

**Dashboard → Authentication → URL Configuration**

| Field | Value (local) | Value (production) |
| --- | --- | --- |
| Site URL | `http://localhost:3000` | `https://your-domain.com` |
| Redirect URLs | `http://localhost:3000/auth/callback` | `https://your-domain.com/auth/callback` |

Add the local one first, click **Save**, then add production. Supabase matches
redirect URLs exactly, including the port.

### 1.7 Enable a sign-in provider

**Dashboard → Authentication → Providers**

**Google (do this one):**

1. Google Cloud Console → **APIs & Services → Credentials → Create credentials → OAuth client ID**.
2. Application type: **Web application**.
3. **Authorized redirect URI** — this exact string, no port:
   ```
   https://<YOUR-PROJECT-REF>.supabase.co/auth/v1/callback
   ```
4. **Authorized JavaScript origin**: `https://<YOUR-PROJECT-REF>.supabase.co`
5. Copy the **Client ID** and **Client Secret** back into the Supabase provider
   form and enable it.

> This is the single most commonly missed step. The redirect URI you paste into
> Google must be the Supabase callback, not your app's `/auth/callback`.

**Apple (optional, needs a paid developer account):**

1. Apple Developer → Certificates, Identifiers & Profiles → **Identifiers →
   Services IDs → "+"** → enable **Sign in with Apple**.
2. Add your domain and a return URL: `https://<YOUR-PROJECT-REF>.supabase.co/auth/v1/callback`.
3. Create a **Sign in with Apple** key, download the `.p8`.
4. Paste **App ID**, **Team ID**, **Key ID** and the full `.p8` contents into the
   Supabase Apple provider form.

Magic-link email works out of the box with no provider configuration.

---

## 2. Google Gemini — the brief builder

1. Go to <https://aistudio.google.com/apikey> → **Create API key**.
2. Copy it to `GEMINI_API_KEY`.

Server-only. Never prefix `NEXT_PUBLIC_`.

**No model name goes in your config.** The app calls `models.list()` with your
key and the UI offers only what that key can actually call, so a new release
needs no code change and a model you have not been granted cannot be selected.

Verify it engaged: open `/briefs/new` and check the header. It must read the
model name plus `live`. If it says `deterministic engine`, the live call
failed and fell back silently — check the key, the model list, and your quota.

---

## 3. Not wired — and the app says so

Razorpay, DigiLocker and SynthID stay on their sandbox adapters. Their keys are
templated in `.env.example`, but supplying them changes nothing, and the
integration registry reports `configured` and `wired` separately so the UI
cannot claim otherwise.

To wire them later:

| Adapter | What is missing |
| --- | --- |
| Razorpay | Implement the Orders/Capture/Refund calls in `src/lib/integrations/razorpay.ts`. Needs test keys from <https://dashboard.razorpay.com/app/keys>. |
| DigiLocker | Implement the consent flow in `src/lib/integrations/digilocker.ts`. Requires a registered client id, PKCE, registered redirect URIs and issuer partner access via <https://digilocker.gov.in/partners>. |
| SynthID | Replace the local stamper in `src/lib/integrations/provenance.ts` with a call to a SynthID endpoint. Access is not a simple API key. |

---

## 4. Environment variables

```bash
cp .env.example .env.local
```

| Variable | Where it goes | Exposure |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Data API → Project URL | Public |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Data API → anon key | Public |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → API Keys → service_role | **Server only** |
| `GEMINI_API_KEY` | Google AI Studio | **Server only** |
| `NEXT_PUBLIC_APP_URL` | Your deployed origin | Public |
| `APP_SECRET` | Anything random | **Server only** |

---

## 5. Cloud deployment

The app runs on Vercel, Cloudflare, Fly, or any Node host. Two things must be
set differently from local.

### 5.1 `NEXT_PUBLIC_APP_URL`

Must be the deployed origin, not localhost. It is what the OAuth redirect and
the session cookie origin are built from; leaving it as localhost sends
returning users to the wrong host after they sign in.

### 5.2 Session cookies

`src/lib/supabase/middleware.ts` sets `secure: process.env.NODE_ENV ===
"production"` automatically, so HTTPS is required in production.

If you serve from an apex domain and also want `www`, set
`NEXT_PUBLIC_SUPABASE_COOKIE_DOMAIN` to the shared parent. Otherwise leave it
unset and cookies bind to the exact host.

### 5.3 Environment variables in your host

Vercel: **Project → Settings → Environment Variables**, add all five, then
redeploy. Environment variables are build-time inlined for `NEXT_PUBLIC_*`, so
changing one requires a rebuild, not just a restart.

### 5.4 After deploying, check these

```bash
curl -s https://your-domain.com/api/integrations | jq
```

Expect `supabase` and `gemini` to report `mode: "live"` and the other three
`mode: "mock"`. If Supabase reports `mock` with `configured: true`, the URL is
probably a placeholder — the app rejects non-http(s) values on purpose.

Then sign in, and confirm a brief you create is invisible to a second browser
profile with a different account. If it is visible, row-level security is not
doing its job and that is a stop-ship bug.

---

## 6. What happens in each mode

| Supabase | Gemini | Behaviour |
| --- | --- | --- |
| absent | absent | Seed dataset, deterministic brief reasoner. Zero credentials. This is the default. |
| configured | absent | Real Postgres + real auth, deterministic brief builder. |
| absent | configured | Seed dataset, real model with the runtime model picker. |
| configured | configured | Everything live. This is production. |