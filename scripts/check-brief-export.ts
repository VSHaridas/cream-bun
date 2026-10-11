/**
 * Sanity check on the brief exporters.
 *
 * Export is the last hop before a brief leaves the product, and it runs in the
 * browser against component state — so a bad field name produces a silently
 * empty document rather than an error. Rendering a real draft and asserting the
 * output has substance catches that.
 *
 *   npx tsx scripts/check-brief-export.ts
 */
import { renderBriefMarkdown, briefAsText } from "../src/lib/brief/export";
import { EMPTY_DRAFT, type BriefDraft } from "../src/lib/llm/contract";

const draft: BriefDraft = {
  ...EMPTY_DRAFT,
  campaignObjective: "Launch a 30-second hero film for the Q4 device refresh.",
  audience: "Urban commuters, 25-34, metro India",
  tone: ["confident", "warm"],
  styleTags: ["photoreal", "golden hour"],
  excludedStyles: ["stock-photo handshake"],
  referenceNotes: ["Ref: Apple product film 2025"],
  contentTypes: ["film"],
  aspectRatios: ["16:9"],
  targetChannels: ["instagram", "youtube"],
  budgetMinInr: 350000,
  budgetMaxInr: 600000,
  turnaroundDays: 21,
  revisionsIncluded: 2,
  conceptRoundsIncluded: 1,
  rawIdea: "We want something that feels like the product is alive in your hand.",
};

const turns = [
  { role: "user", text: "We want a hero film for the new device." },
  { role: "assistant", text: "Drafting the objective and the audience." },
];

const md = renderBriefMarkdown("BRF-2026-0001", draft, turns);
const text = briefAsText("BRF-2026-0001", draft);

const mustAppear: [string, string][] = [
  ["BRF-2026-0001", md],
  ["Launch a 30-second hero film", md],
  ["Urban commuters", md],
  ["photoreal", md],
  ["stock-photo handshake", md],
  // `inr()` is the project's currency formatter — Indian digit grouping, and no
// symbol, because the export is read inside documents that already say INR.
["3,50,000 — 6,00,000", md],
  ["21 days", md],
  ["Conversation", md],
  ["We want a hero film for the new device.", md],
  // Plain-text variant must have lost its Markdown syntax but kept the content.
  ["Urban commuters", text],
  ["photoreal", text],
];

let failed = 0;
for (const [needle, haystack] of mustAppear) {
  const ok = haystack.includes(needle);
  if (!ok) failed++;
  console.log(`  ${ok ? "PASS" : "FAIL"}  contains ${JSON.stringify(needle)}`);
}

// An empty draft must still render a document, not throw or emit "undefined".
const empty = renderBriefMarkdown("", EMPTY_DRAFT, []);
const clean = !/undefined|\[object|NaN/.test(empty);
if (!clean) failed++;
console.log(`  ${clean ? "PASS" : "FAIL"}  empty draft has no undefined/NaN leakage`);

console.log("\n" + "─".repeat(60));
console.log(md.slice(0, 620));
console.log("─".repeat(60));
console.log(failed === 0 ? "\n  all checks pass" : `\n  ${failed} FAILED`);

process.exit(failed === 0 ? 0 : 1);