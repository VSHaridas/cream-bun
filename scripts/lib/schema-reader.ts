/**
 * Minimal SQL schema reader.
 *
 * Enough of the migration to answer two questions the seed generator cannot
 * guess at: does a column exist, and is there a unique constraint over these
 * columns?
 *
 * Deliberately not a SQL parser. Splitting on `;` requires tracking paren depth
 * correctly, and `numeric(9, 1)` — a comma inside the type — is enough to
 * unbalance a naive counter and collapse a whole table into one statement.
 * Every declaration this needs is one-per-line, so scanning lines is both
 * simpler and more robust than tokenising.
 */

export interface SchemaTable {
  table: string;
  body: string;
  columns: Set<string>;
  /** Unique column groups, from inline keys, table-level constraints and indexes. */
  uniqueGroups: Set<string[]>;
  /** Partial unique indexes, as `(<cols>) where <predicate>`. */
  partials: string[];
}

export interface ForeignKey {
  column: string;
  parent: string;
  parentColumn: string;
}

/**
 * Extracts every `create table` body by balancing parentheses.
 *
 * A non-greedy match to the first `\n);` truncates any table whose last column
 * carries a `check (...)` constraint, because the `);` inside the check ends
 * the match early and the rest of the table is never read.
 */
function createTables(sql: string): { table: string; body: string }[] {
  const out: { table: string; body: string }[] = [];
  const re = /create table if not exists public\.(\w+) \(/g;
  let m: RegExpExecArray | null;

  while ((m = re.exec(sql))) {
    let depth = 1;
    let i = re.lastIndex;
    while (i < sql.length && depth > 0) {
      if (sql[i] === "(") depth++;
      else if (sql[i] === ")") depth--;
      i++;
    }
    out.push({ table: m[1], body: sql.slice(re.lastIndex, i - 1) });
    re.lastIndex = i;
  }
  return out;
}

/** Unique column groups declared inside a create-table body. */
export function uniqueGroups(body: string): Set<string[]> {
  const groups = new Set<string[]>();
  let inBlockComment = false;

  for (const raw of body.replace(/\r/g, "").split("\n")) {
    let line = raw;

    if (inBlockComment) {
      const end = line.indexOf("*/");
      if (end === -1) continue;
      line = line.slice(end + 2);
      inBlockComment = false;
    }

    line = line.replace(/\/\*[\s\S]*?\*\//g, "");
    if (line.includes("/*")) inBlockComment = true;
    line = line.replace(/--.*$/, "").trim();
    if (!line) continue;

    // Table-level: `primary key (a, b)` or `constraint name unique (a, b)`
    const tableLevel = line.match(
      /^(?:constraint\s+\w+\s+)?(?:primary key|unique)\s*\(([^)]+)\)/i,
    );
    if (tableLevel) {
      groups.add(tableLevel[1].split(",").map((c) => c.trim()));
      continue;
    }

    // Column-level: `id text primary key`, `id public.content_type primary key`,
    // and `creator_id text primary key references public.creators (id) …`
    // where the key is followed by a whole FK clause. The constraint keyword is
    // located and the column is the first identifier, because the type varies —
    // text, an enum name, a numeric with a precision.
    const inline = line.match(
      /^(?:constraint\s+\w+\s+)?(\w+)\s+.*\b(?:primary key|unique)\b/,
    );
    if (inline) groups.add([inline[1]]);
  }

  return groups;
}

/** Every column name declared inside a create-table body. */
export function columnsOf(body: string): Set<string> {
  const columns = new Set<string>();
  for (const raw of body.replace(/\r/g, "").split("\n")) {
    const line = raw.replace(/--.*$/, "").trim();
    if (!line || line.startsWith("constraint") || line.startsWith("primary key")) continue;
    const m = line.match(
      /^(\w+)\s+(?:text|bigint|smallint|integer|numeric|boolean|uuid|jsonb|timestamptz|date|timestamp|vector\(\d+\)|tsvector|\w+(?:\[\])?)\b/,
    );
    if (m) columns.add(m[1]);
  }
  return columns;
}

/** Foreign keys declared inside a create-table body. */
export function foreignKeysOf(body: string): ForeignKey[] {
  const out: ForeignKey[] = [];
  for (const raw of body.replace(/\r/g, "").split("\n")) {
    const line = raw.replace(/--.*$/, "");
    const m = line.match(
      /^\s+(\w+)\s+[\w\s(),]+\s+references\s+public\.(\w+)\s*\(\s*(\w+)\s*\)/i,
    );
    if (m) out.push({ column: m[1], parent: m[2], parentColumn: m[3] });
  }
  return out;
}

/** Reads the whole migration into a lookup. */
export function readSchema(sql: string): Map<string, SchemaTable> {
  const tables = new Map<string, SchemaTable>();

  for (const { table, body } of createTables(sql)) {
    tables.set(table, {
      table,
      body,
      columns: columnsOf(body),
      uniqueGroups: uniqueGroups(body),
      partials: [],
    });
  }

  // Unique indexes declared separately from the table. These matter as much as
  // inline keys — `shortlists` has no usable PK beyond its uuid and carries its
  // uniqueness entirely in two partial indexes.
  const partials = new Map<string, string[]>();
  for (const match of sql.matchAll(
    /create unique index(?: if not exists)?\s+(\w+)[\s\S]*?on public\.(\w+) \(([^)]+)\)(?:\s*where\s+([^;]+?))?\s*;/gi,
  )) {
    const [, , table, cols, predicate] = match;
    const entry = tables.get(table);
    if (!entry) continue;
    entry.uniqueGroups.add(cols.split(",").map((c) => c.trim()));
    if (predicate) {
      const list = partials.get(table) ?? [];
      list.push(`(${cols}) where ${predicate.trim()}`);
      partials.set(table, list);
    }
  }

  for (const [table, list] of partials) {
    tables.get(table)!.partials = list;
  }

  return tables;
}