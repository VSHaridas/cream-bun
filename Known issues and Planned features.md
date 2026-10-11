# Cream — Known Issues & Planned Features

Compiled from the Vercel logs and the reported application testing results on October 11, 2026.

## 1. Known issues

### P0 — Critical: Core functionality is broken

- [ ]Homepage crashes with a 500 error.
  - Error: `Cannot read properties of undefined (reading 'artSeed')`
  - Digest: `863226965`
  - Reproduced across two deployments.
  - Likely cause: missing or undefined data required by the homepage.

- [ ]Trust page crashes during rendering.
  - Error: `Cannot read properties of undefined (reading 'amountInr')`
  - Digest: `3992182164`
  - Likely cause: missing financial or trust-related data.

- [ ]Data Model page crashes during rendering.
  - Error: `Cannot read properties of undefined (reading 'rounds')`
  - Digest: `3390742834`
  - Likely cause: missing or undefined model configuration data.

- [ ]Brief creation and persistence are not working.
  - Google sign-in successfully creates the user in Supabase.
  - The `brief_sessions` table contains no rows after attempting to create a brief.
  - No new brief appears in Briefs or Workspaces.
  - The brief count remains at zero.
  - The brief cannot be previewed or exported.

- [ ]Google sign-in does not lead into onboarding.
  - Authentication completes successfully.
  - The expected onboarding flow does not appear afterward.
  - The post-authentication redirect and onboarding state need investigation.

### P1 — High: Performance and usability

- [ ]Slow initial page load.
  - The site takes too long to load initially.
  - Investigate server rendering, data fetching, database latency, and client-side hydration.

- [ ]Navigation is excessively slow.
  - Discover, Briefs, Workspaces, and other sections reportedly take over eight seconds to load.
  - Investigate repeated queries, blocking requests, server-side rendering, and caching.

- [ ]Trust, Data Model, and Deck display generic error messages.
  - Users see: “Something broke on our side.”
  - The application claims no entered data was lost, but that has not been verified for the failed brief workflow.
  - Fix the underlying rendering/data errors and verify that error boundaries provide accurate recovery messaging.

- [ ]Session lookup repeatedly reports missing authentication sessions.
  - Log message: `Auth session missing!`
  - Requests to routes such as `/discover`, `/briefs`, `/deck`, `/model`, `/trust`, and `/onboarding/identity` are treated as anonymous.
  - The logs show HTTP 200 for these requests, so this is not necessarily a route failure.
  - Determine whether these are expected anonymous visits or a session-cookie, middleware, or authentication-persistence issue.

### P2 — Product completeness and experience

- [ ]No creator-facing experience.
  - The application currently serves the client side of the product.
  - Creator workflows, creator dashboards, and creator-specific functionality are missing.

- [ ]AI chat feels rigid and templated.
  - Gemini API integration works.
  - Chat is functional, but the conversation feels constrained.
  - This is a lower priority than fixing persistence, preview, and export.

- [ ]Seed data is not visible with PostgreSQL connected.
  - This may be intentional for production.
  - A separate demo mode is needed to make seeded content available without compromising production data.

- [ ]No landing page.
  - A public-facing landing page is missing.
  - Explicitly deferred until the core product is stable.

## 2. Planned features

### P0 — Make the core brief workflow functional

- [ ]End-to-end brief persistence
  - Save brief sessions to Supabase.
  - Verify that authenticated users can create and retrieve sessions.
  - Confirm that session records are associated with the correct user.
  - Ensure failed requests produce actionable errors rather than silently leaving the brief unsaved.

- [ ]Brief preview
  - Allow users to preview the generated brief before finalizing or exporting it.
  - Preserve the brief content and transcript throughout the workflow.

- [ ]Brief export
  - Implement a way to export the generated brief.
  - Ensure exported content matches the saved and previewed brief.

- [ ]Briefs and Workspaces synchronization
  - Newly created briefs should appear in the relevant sections.
  - Counts, lists, and saved records should reflect actual database state.

- [ ]Complete the Google authentication-to-onboarding flow
  - Redirect new users into identity onboarding.
  - Distinguish new users from returning users.
  - Persist onboarding completion and route users appropriately afterward.

### P1 — Reliability and performance

- [ ]Fix undefined-data rendering crashes
  - Resolve the `artSeed`, `amountInr`, and `rounds` errors.
  - Validate required data before rendering.
  - Add sensible defaults or empty states where appropriate.
  - Add regression tests for the homepage, Trust, and Data Model pages.

- [ ]Reduce navigation latency
  - Establish a performance baseline for initial load and route transitions.
  - Identify the slowest queries and rendering paths.
  - Optimize data fetching, caching, and loading states.
  - Target a substantial reduction from the reported eight-plus-second route loads.

- [ ]Audit authentication and session handling
  - Verify session persistence after Google sign-in.
  - Confirm protected-route behavior and redirects.
  - Distinguish expected anonymous requests from genuine session failures.

- [ ]Improve error handling and recovery
  - Replace generic errors with context-appropriate messages.
  - Preserve drafts and transcripts where possible.
  - Add retry or recovery paths when data fetching or saving fails.

### P1 — Modular demo mode

- [ ]Add a site-level Demo / Production mode switch.
  - Demo mode uses seeded data.
  - Production mode uses real application data.
  - The selected mode should be clear to the user.

- [ ]Store seed data in Supabase.
  - Seed records should live in the database rather than exist only as frontend mock data.
  - Demo interactions should exercise real application logic, including queries, mutations, and workflows.

- [ ]Create seed-data management operations.
  - Provide repeatable operations to create and remove demo data in Supabase.
  - Ensure removal affects only designated seed records.
  - Make setup and cleanup safe to run repeatedly.

- [ ]Keep demo functionality modular and removable.
  - Separate demo-mode selection, seed-data management, and database access from core product logic.
  - Avoid contaminating production data with demo records.
  - Make it possible to remove demo mode later without rewriting the application.

### P1 — Creator experience

- [ ]Build the creator-facing side of Cream.
  - Define creator-specific user journeys and permissions.
  - Add creator-facing dashboards and workflows.
  - Connect creator functionality to the existing brief and engagement concepts.
  - Ensure client and creator views reflect the same underlying product data where appropriate.

### P2 — Product discoverability and refinement

- [ ]Add an in-app sitemap.
  - Explain each section and its purpose.
  - Provide links to the relevant routes.
  - Clarify how users move through onboarding, discovery, briefs, engagements, trust, the data model, and the deck.

- [ ]Improve AI conversation flexibility.
  - Make Gemini-powered chat feel less rigid and templated.
  - Preserve the existing working integration while improving conversational flow.

- [ ]Build a public landing page.
  - Introduce Cream and its value proposition.
  - Explain the client and creator sides of the platform.
  - Add clear entry points for signing in and getting started.
  - Keep this deferred until the core workflows are reliable.

## 3. Recommended implementation order

| Priority | Workstream | Completion criteria |
| --- | --- | --- |
| 1 | Rendering stability | Homepage, Trust, and Data Model render without exceptions. |
| 2 | Authentication and onboarding | Google sign-in routes users to the correct next step. |
| 3 | Brief persistence | A new brief creates a database record and can be retrieved. |
| 4 | Preview and export | Saved briefs can be previewed and exported. |
| 5 | Performance | Initial load and route transitions are measurably faster. |
| 6 | Demo mode | Demo data works through Supabase and can be safely created and removed. |
| 7 | Creator experience | Creators have functional workflows alongside clients. |
| 8 | Sitemap and chat refinement | Navigation is documented and AI chat feels more natural. |
| 9 | Landing page | Public-facing introduction is built after core functionality stabilizes. |

## 4. Task tracking requirement

- [ ]Create `reference/floating tasks` as the persistent source of truth for this work.
- [ ]Record each task with its priority, status, relevant routes or components, and acceptance criteria.
- [ ]Track dependencies and blockers.
- [ ]Use the development TODO list as a supplementary execution tracker, not as a replacement for the floating tasks file.
- [ ]Update the persistent file as issues are investigated, fixes are implemented, and acceptance criteria are verified.

Important distinction: The logs establish the three undefined-property exceptions and repeated missing-session messages. The remaining issues are based on the reported testing observations. Root causes—especially the missing brief persistence, slow navigation, and absent onboarding redirect—still need to be confirmed through code and database investigation.