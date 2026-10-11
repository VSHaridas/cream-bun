import Link from "next/link";
import { Button } from "@/components/ui/primitives";

/**
 * Rendered instead of a page that needs rows the datastore does not have.
 *
 * Several pages index into the dataset — `escrows[0]`, `briefs[0]`,
 * `portfolio.find(...)!` — because with the bundled seed they are always
 * present. A non-null assertion is not a runtime check, though: with Supabase
 * connected but empty, every one of those dereferences `undefined` and the page
 * dies with a TypeError and an opaque digest.
 *
 * This component exists so that failure is a sentence a person can act on. It
 * names the tables that are empty and the command that fills them, rather than
 * rendering `Cannot read properties of undefined`.
 */
export function DatasetEmpty({
  missing,
  source,
}: {
  /** Table names, in the wording the operator will see in the SQL editor. */
  missing: string[];
  source: string;
}) {
  return (
    <div className="container-x py-24 sm:py-32">
      <div className="max-w-2xl">
        <span className="label-xs">Nothing to show yet</span>

        <h1 className="display-lg mt-4">
          This page is wired to the <span className="serif-italic">live datastore</span>, and the
          live datastore is empty.
        </h1>

        <p className="mt-6 text-balance-pretty text-[16.5px] leading-relaxed text-ink-2">
          Reading from <span className="font-mono text-ink">source: {source}</span>. The page below
          renders real rows rather than placeholders, so there is nothing to render until those
          tables are populated.
        </p>

        <div className="mt-9 rounded-2xl border border-line bg-surface p-6">
          <p className="text-[13px] font-medium text-ink">Empty tables</p>
          <ul className="mt-3 flex flex-wrap gap-1.5">
            {missing.map((table) => (
              <li key={table} className="chip px-2 py-1 font-mono text-[11px]">
                {table}
              </li>
            ))}
          </ul>

          <p className="mt-6 text-[13px] font-medium text-ink">To fill them</p>
          <ol className="mt-2 space-y-1.5 font-mono text-[12px] text-ink-muted">
            <li>
              <span className="text-ink-faint">1.</span> apply{" "}
              <code>supabase/migrations/0001_schema.sql</code>
            </li>
            <li>
              <span className="text-ink-faint">2.</span> then{" "}
              <code>npm run db:seed</code>
            </li>
          </ol>
        </div>

        <div className="mt-8 flex flex-wrap gap-2">
          <Button asChild variant="primary" size="md">
            <Link href="/api-docs">Architecture &amp; adapters</Link>
          </Button>
          <Button asChild variant="outline" size="md">
            <Link href="/discover">Back to discovery</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

/**
 * Returns the missing table names, or an empty array when every table has rows.
 *
 * Written as a guard rather than a per-page `if (!x) return null` so that each
 * page states what it needs in one line and the resulting error message is
 * generated rather than remembered.
 */
export function missingTables(requirements: Record<string, unknown[]>) {
  return Object.entries(requirements)
    .filter(([, rows]) => !Array.isArray(rows) || rows.length === 0)
    .map(([table]) => table);
}