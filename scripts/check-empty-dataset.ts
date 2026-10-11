/**
 * Asserts that no page crashes when the datastore is connected but empty.
 *
 * The three 500s found in deployment review — `artSeed` on `/`, `amountInr` on
 * `/trust`, `rounds` on `/model` — were all the same bug: pages index into the
 * dataset and assume rows exist. That holds under the bundled seed and fails
 * against a connected but unseeded Postgres, which is what a fresh project
 * looks like after the migration and before `npm run db:seed`.
 *
 * Runs a real server with CREAM_FORCE_DATASET=empty rather than importing the
 * pages, because importing a server component outside Next does not reproduce
 * the module graph that actually fails.
 *
 *   npm run check:empty
 */
import { spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";

const PORT = Number(process.env.PORT ?? 3210);
const BASE = `http://127.0.0.1:${PORT}`;

const PAGES = ["/", "/trust", "/model", "/discover", "/briefs", "/engagements", "/deck"];

type Result = { path: string; code: number; ms: number; empty: boolean };

async function waitForServer(timeoutMs = 60_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      await fetch(BASE, { signal: AbortSignal.timeout(5_000) });
      return true;
    } catch {
      await sleep(700);
    }
  }
  return false;
}

async function main() {
  const child = spawn(
    process.execPath,
    ["node_modules/next/dist/bin/next", "start", "-p", String(PORT)],
    {
      env: { ...process.env, CREAM_FORCE_DATASET: "empty" },
      stdio: "ignore",
    },
  );

  let failed = 0;
  const results: Result[] = [];

  try {
    if (!(await waitForServer())) {
      console.error("  server did not come up; run `npm run build` first");
      process.exit(1);
    }

    for (const path of PAGES) {
      const started = Date.now();
      const res = await fetch(`${BASE}${path}`, { redirect: "manual" });
      const body = await res.text();
      const ms = Date.now() - started;
      // The guard renders a page that names the empty tables. If that copy is
      // present the guard fired, which is the behaviour we want.
      const empty = body.includes("Empty tables") || body.includes("Nothing to show yet");
      results.push({ path, code: res.status, ms, empty });
      if (res.status >= 500) failed++;
    }

    console.log("  page          status   guard fired   time");
    console.log("  ------------------------------------------------------");
    for (const r of results) {
      const ok = r.code < 500 ? "yes" : "NO  <-- 500";
      console.log(
        `  ${r.path.padEnd(13)} ${String(r.code).padEnd(8)} ${ok.padEnd(14)} ${r.ms}ms`,
      );
    }

    // Pages that need rows should be showing the guard. `/discover` and
    // `/briefs` have their own empty states and are allowed not to.
    const expectedGuards = ["/", "/trust", "/model"];
    const missed = expectedGuards.filter((p) => !results.find((r) => r.path === p)?.empty);
    if (missed.length) {
      console.log(`\n  guard did not fire on: ${missed.join(", ")}`);
      failed += missed.length;
    }

    console.log(
      failed === 0
        ? "\n  no page crashes on an empty datastore"
        : `\n  ${failed} failure(s)`,
    );
  } finally {
    child.kill();
  }

  process.exit(failed === 0 ? 0 : 1);
}

main();