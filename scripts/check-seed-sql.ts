/**
 * Validates the generated seed SQL without needing a database.
 *
 * The seed file is 1250 rows of hand-rolled INSERT pasted into a web editor by
 * a human, so a syntax error surfaces as an opaque Postgres message halfway
 * through a paste. This catches the mechanical failures first: unbalanced
 * parentheses, unescaped quotes, a missing transaction wrapper, a statement
 * count that does not match the plan.
 *
 * It cannot check semantics — that only a real Postgres can do. What it does is
 * make sure the file is well-formed before it ever reaches one.
 *
 *   npx tsx scripts/check-seed-sql.ts
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join } from "node:path";

const ROOT = process.cwd();
const SEED = join(ROOT, "supabase", "seed.sql");
const UNSEED = join(ROOT, "supabase", "unseed.sql");

let failed = 0;
const fail = (msg: string) => {
  failed++;
  console.log(`  FAIL  ${msg}`);
};
const pass = (msg: string) => console.log(`  PASS  ${msg}`);

for (const file of [SEED, UNSEED]) {
  if (!existsSync(file)) {
    fail(`${file} does not exist — run \`npm run db:seed:sql\``);
  }
}
if (failed) {
  console.log("\n  nothing to check yet");
  process.exit(1);
}

const seed = readFileSync(SEED, "utf8");
const unseed = readFileSync(UNSEED, "utf8");

/**
 * Shared vocabulary, excluded from unseed on purpose.
 *
 * A real creator's portfolio references `tools`, `models` and the rest by id.
 * Deleting them to "clean up" would break rows belonging to real users.
 */
const TAXONOMY = new Set([
  "tools",
  "models",
  "skills",
  "content_types",
  "aspect_ratios",
  "specializations",
  "industries",
  "channels",
  "regions",
]);

/* ── transaction wrapper ─────────────────────────────────────────────────── */

const begins = (seed.match(/^begin;$/gm) ?? []).length;
const commits = (seed.match(/^commit;$/gm) ?? []).length;
if (begins === 1 && commits === 1) pass("seed is wrapped in exactly one transaction");
else fail(`seed has ${begins} begin / ${commits} commit — expected 1 each`);

const uBegins = (unseed.match(/^begin;$/gm) ?? []).length;
const uCommits = (unseed.match(/^commit;$/gm) ?? []).length;
if (uBegins === 1 && uCommits === 1) pass("unseed is wrapped in exactly one transaction");
else fail(`unseed has ${uBegins} begin / ${uCommits} commit`);

/* ── statement shapes ────────────────────────────────────────────────────── */

/** Split on semicolons that are not inside a string literal or a comment. */
function splitStatements(sql: string): string[] {
  const out: string[] = [];
  let current = "";
  let inString = false;
  let line = "";

  for (let i = 0; i < sql.length; i++) {
    const ch = sql[i];

    if (inString) {
      current += ch;
      if (ch === line) inString = false;
      continue;
    }
    if (ch === "'") {
      inString = true;
      line = "'";
      current += ch;
      continue;
    }
    if (ch === "-" && sql[i + 1] === "-") {
      while (i < sql.length && sql[i] !== "\n") i++;
      current += "\n";
      continue;
    }
    if (ch === ";") {
      out.push(current);
      current = "";
      continue;
    }
    current += ch;
  }
  out.push(current);
  return out.filter((s) => s.trim().length > 0);
}

const statements = splitStatements(seed);
const unbalanced = statements.filter(
  (s) => (s.match(/\(/g)?.length ?? 0) !== (s.match(/\)/g)?.length ?? 0),
);
if (unbalanced.length === 0) pass(`all ${statements.length} statements have balanced parentheses`);
else fail(`${unbalanced.length} statement(s) have unbalanced parentheses`);

/* ── stray unescaped quotes ──────────────────────────────────────────────── */

// A string literal must close before the statement does. Count quote runs: an
// odd number means something opened and never closed.
const oddQuotes = statements.filter((s) => {
  const body = s.replace(/--[^\n]*/g, "");
  return (body.match(/'/g)?.length ?? 0) % 2 !== 0;
});
if (oddQuotes.length === 0) pass("every string literal is closed");
else fail(`${oddQuotes.length} statement(s) have an unclosed string literal`);

/* ── structural expectations ─────────────────────────────────────────────── */

const inserts = statements.filter((s) => /^\s*insert into/i.test(s));
const deletes = statements.filter((s) => /^\s*delete from/i.test(s));
if (inserts.length > 0) pass(`${inserts.length} insert statements`);
else fail("no insert statements found");

if (deletes.length > 0) pass(`${deletes.length} scoped delete statements (child tables without a key)`);
else fail("no scoped deletes — child tables without keys would duplicate on re-run");

// Each scoped delete immediately precedes the insert it clears rows for, so
// the unseed only needs one statement per table — not one per seed statement.
const unseedDeletes = splitStatements(unseed).filter((s) => /^\s*delete from/i.test(s));
const seededTables = new Set(
  inserts
    .map((s) => s.match(/insert into\s+public\.(\w+)/i)?.[1])
    .filter((t): t is string => Boolean(t) && !TAXONOMY.has(t!)),
);
const unseedTables = new Set(
  unseedDeletes.map((s) => s.match(/delete from\s+public\.(\w+)/i)?.[1]),
);
const notReversed = [...seededTables].filter((t) => !unseedTables.has(t));
if (notReversed.length === 0) {
  pass(`unseed reverses all ${seededTables.size} seeded non-taxonomy tables`);
} else {
  fail(`unseed is missing: ${notReversed.join(", ")}`);
}

/* ── unseed must be scoped, not destructive ──────────────────────────────── */

// Every delete names specific identifiers. A bare `delete from public.x cascade`
// would wipe real accounts along with the demo data.
const bareDeletes = unseedDeletes.filter((s) => !/where/i.test(s));
if (bareDeletes.length === 0) {
  pass("every unseed delete is scoped by identifier");
} else {
  fail(
    `${bareDeletes.length} unseed delete(s) have no WHERE clause — these would remove real rows: ` +
      bareDeletes
        .map((s) => s.match(/delete from\s+public\.(\w+)/i)?.[1])
        .filter(Boolean)
        .join(", "),
  );
}

// The discriminator: `handle_new_user()` appends six hex characters of the
// user's uuid to their handle. No identifier in a delete may end that way, or
// it could match a real account.
const realLooking = unseedDeletes.filter((s) => /'-[0-9a-f]{6}'/.test(s));
if (realLooking.length === 0) {
  pass("no delete targets an identifier shaped like a real account handle");
} else {
  fail(
    `${realLooking.length} delete(s) reference an identifier with a uuid suffix — that is the real-account shape`,
  );
}

// Taxonomy is shared with real users. Deleting it breaks real portfolios.
const deletedTaxonomy = unseedDeletes.filter((s) =>
  [...TAXONOMY].some((t) => new RegExp(`delete from\\s+public\\.${t}\\b`, "i").test(s)),
);
if (deletedTaxonomy.length === 0) {
  pass("taxonomy tables are preserved — real portfolios reference them by id");
} else {
  fail("unseed deletes shared taxonomy, which real rows reference by id");
}

/* ── the hazards this generator exists to avoid ─────────────────────────── */

// `ARRAY[]` with no cast is invalid SQL. Postgres cannot infer the element
// type inside a VALUES clause, so it must be spelled out.
const bareArrays = (seed.match(/ARRAY\[\](?!::)/g) ?? []).length;
if (bareArrays === 0) pass("no uncasted ARRAY[] literals");
else fail(`${bareArrays} uncasted ARRAY[] literal(s)`);

// A table with no key of its own cannot be upserted, so it is cleared with a
// scoped delete first. Anything that is neither must be a bug — it would
// duplicate on every re-run.
const clearedTables = new Set(
  deletes.map((s) => s.match(/delete from\s+public\.(\w+)/i)?.[1]),
);
const insertsNoConflict = inserts.filter(
  (s) =>
    !/on conflict/i.test(s) &&
    !clearedTables.has(s.match(/insert into\s+public\.(\w+)/i)?.[1]),
);
if (insertsNoConflict.length === 0) pass("every insert is either an upsert or preceded by a scoped delete");
else fail(
      `${insertsNoConflict.length} insert(s) have neither an on-conflict nor a preceding delete — they will duplicate on re-run: ` +
        insertsNoConflict
          .map((s) => s.match(/insert into\s+public\.(\w+)/i)?.[1])
          .join(", "),
    );

// Every insert should name public.<table> so the search_path cannot change it.
const unqualified = inserts.filter((s) => /insert into\s+(?!public\.)/i.test(s));
if (unqualified.length === 0) pass("every insert is schema-qualified");
else fail(`${unqualified.length} insert(s) are not schema-qualified`);

/* ── values count matches columns count ──────────────────────────────────── */

/**
 * Counts top-level tuples and commas in a VALUES clause.
 *
 * A doubled quote inside a string literal (`'it''s'`) is an escaped quote, not
 * a terminator, so string tracking has to step over both characters. Getting
 * that wrong desynchronises the paren counting and produces nonsense for every
 * tuple after the first apostrophe.
 */
function scanValues(body: string) {
  let tuples = 0;
  let commas = 0;
  let depth = 0;
  let bracket = 0;
  let inStr = false;

  for (let i = 0; i < body.length; i++) {
    const ch = body[i];

    if (inStr) {
      if (ch === "'") {
        if (body[i + 1] === "'") {
          i++;
        } else {
          inStr = false;
        }
      }
      continue;
    }
    if (ch === "'") {
      inStr = true;
      continue;
    }
    // `ARRAY['a', 'b']` is one value, so its commas and its brackets must not
    // affect the top-level count. Same for a parenthesised subquery, which
    // would nest rather than start a tuple.
    if (ch === "[") bracket++;
    else if (ch === "]") bracket--;
    else if (bracket === 0 && ch === "(") {
      if (depth === 0) tuples++;
      depth++;
    } else if (bracket === 0 && ch === ")") {
      depth--;
    } else if (bracket === 0 && depth === 1 && ch === ",") {
      commas++;
    }
  }
  return { tuples, commas, unterminatedString: inStr };
}

const mismatched: string[] = [];
for (const s of inserts) {
  const m = s.match(/insert into\s+public\.(\w+)\s*\(([^)]+)\)\s*values\s*([\s\S]*)$/i);
  if (!m) {
    mismatched.push("could not parse an insert statement");
    continue;
  }
  const [, table, colList, body] = m;
  const columns = colList.split(",").length;

  // Strip a trailing on-conflict clause; it is not part of the values.
  const valuesOnly = body.replace(/\n?\s*on conflict[\s\S]*$/i, "");
  const { tuples, commas } = scanValues(valuesOnly);

  if (tuples === 0) {
    mismatched.push(`${table}: no tuples found`);
  } else if (commas !== tuples * columns - tuples) {
    // N tuples of C columns contain C-1 commas each, plus N-1 separators
    // between tuples: C*N - 1.
    mismatched.push(
      `${table}: ${columns} columns x ${tuples} tuples should be ${tuples * columns - 1} commas, found ${commas}`,
    );
  }
}
if (mismatched.length === 0) pass("every insert has as many values as columns");
else fail(`column/value mismatch: ${mismatched.slice(0, 6).join("; ")}`);

/* ── the generator's own guards must actually fire ───────────────────────── */

// A check that cannot fail is not a check. `brands.industry` was the real bug
// this run was written to prevent, so temporarily reintroduce it and confirm
// the generator rejects the seed rather than emitting SQL that 23503s at the
// database.
const SEEDER = join(ROOT, "scripts", "seed.ts");
const TSX_CLI = join(ROOT, "node_modules", "tsx", "dist", "cli.mjs");

function generationFails(mutate: (src: string) => string, needle: string): boolean {
  const original = readFileSync(SEEDER, "utf8");
  const mutated = mutate(original);
  if (mutated === original) {
    fail(`could not apply the mutation used to test the generator's guard: ${needle}`);
    return false;
  }

  writeFileSync(SEEDER, mutated, "utf8");
  try {
    // `npx` on Windows is a .cmd shim and does not forward stdio the way a
    // direct exec does, so invoke tsx through node and take both streams.
    execFileSync(process.execPath, [TSX_CLI, SEEDER, "--sql"], {
      cwd: ROOT,
      stdio: "pipe",
      encoding: "utf8",
    });
    return false;
  } catch (error) {
    const result = error as { stdout?: string; stderr?: string };
    const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;
    if (!output.includes(needle)) {
      console.error(
        `        generator said:\n${output.split("\n").slice(0, 6).map((l) => `          ${l}`).join("\n")}`,
      );
    }
    return output.includes(needle);
  } finally {
    writeFileSync(SEEDER, original, "utf8");
  }
}

const caughtBrandIndustry = generationFails(
  (src) => src.replace("industry: slugify(b.industry)", "industry: String(b.industry)"),
  "brands.industry references industries.id",
);
if (caughtBrandIndustry) {
  pass("the foreign-key check catches a label written where a slug belongs");
} else {
  fail(
    "the foreign-key check did not fire when brands.industry was reverted to the label",
  );
}

const caughtPhantomColumn = generationFails(
  (src) => src.replace("      w: a.w,", "      width: a.w,"),
  "aspect_ratios: width",
);
if (caughtPhantomColumn) {
  pass("the column check catches a field that is not in the schema");
} else {
  fail("the column check did not fire when aspect_ratios.width was restored");
}

console.log(
  failed === 0
    ? "\n  seed.sql is well-formed"
    : `\n  ${failed} problem(s) — do not paste this into the SQL editor yet`,
);
process.exit(failed === 0 ? 0 : 1);
