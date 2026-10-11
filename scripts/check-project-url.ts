import { normaliseProjectUrl } from "../src/lib/env";

const cases: [string, string][] = [
  ["https://abcdefgh.supabase.co", "https://abcdefgh.supabase.co"],
  ["https://abcdefgh.supabase.co/rest/v1", "https://abcdefgh.supabase.co"],
  ["https://abcdefgh.supabase.co/rest/v1/", "https://abcdefgh.supabase.co"],
  ["https://abcdefgh.supabase.co/", "https://abcdefgh.supabase.co"],
  ["https://abcdefgh.supabase.co/postgrest", "https://abcdefgh.supabase.co"],
  ["https://abcdefgh.supabase.co/auth/v1", "https://abcdefgh.supabase.co"],
  ["", ""],
];

let failed = 0;
for (const [input, expected] of cases) {
  const r = normaliseProjectUrl(input);
  const ok = r.url === expected;
  if (!ok) failed++;
  console.log(
    `${ok ? "  PASS " : "  FAIL "}${JSON.stringify(input).padEnd(48)} -> ${JSON.stringify(r.url)}${
      r.corrected ? "  [corrected]" : ""
    }`,
  );
}

console.log(failed === 0 ? "\n  all cases pass" : `\n  ${failed} FAILED`);
process.exit(failed === 0 ? 0 : 1);