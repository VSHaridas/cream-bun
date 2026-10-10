import type { AspectRatioId, BriefDeliverable, ContentType } from "@/lib/domain/types";
import { ASPECT_RATIOS } from "@/lib/domain/types";
import { CHANNELS, STYLE_TAGS, TONE_TAGS } from "@/lib/domain/taxonomy";
import {
  EMPTY_DRAFT,
  MISSING_META,
  type BriefDraft,
  type BriefTurnResponse,
  type ExtractedBrief,
  type MissingField,
} from "./contract";

/* ═══════════════════════════════════════════════════════════════════════════
   Deterministic brief reasoner.

   This is what runs when GEMINI_API_KEY is absent. It is not a stub that
   echoes back canned text: it is a genuine rule-based extractor that reads the
   brand's own words, pulls structured fields out of them, decides what is
   still missing, and asks the next most valuable question.

   It shares the exact output contract with the live Gemini path, so the UI,
   the API route and the downstream brief are identical either way. Swapping in
   the model is a one-line change in `src/lib/llm/index.ts`.
   ═══════════════════════════════════════════════════════════════════════════ */

const CONTENT_RULES: { re: RegExp; type: ContentType }[] = [
  { re: /\b(film|video|ad|advert|commercial|spot|reel|trailer|cut)\b/, type: "cinematic-video" },
  { re: /\b(reel|short|tiktok|vertical|9:16|thumb|stop-scroll)\b/, type: "short-form-video" },
  { re: /\b(still|static|photo|photograph|post|carousel|feed|image|shot)\b/, type: "social-static" },
  { re: /\b(motion|animation|kinetic|title|typograph|logo anim|gif)\b/, type: "motion-graphics" },
  { re: /\b(3d|render|cg|product shot|packshot|turnaround|environment)\b/, type: "product-render" },
  { re: /\b(character|mascot|persona|design sheet)\b/, type: "character-design" },
  { re: /\b(music|song|soundtrack|audio|bed|track|jingle)\b/, type: "music-bed" },
  { re: /\b(voice ?over|vo|voiceover|narration|dub)\b/, type: "voiceover" },
  { re: /\b(illustration|illustrate|drawn|poster)\b/, type: "illustration" },
  { re: /\b(concept art|previz|previs|concept|worldbuild|board)\b/, type: "concept-art" },
];

const ASPECT_RULES: { re: RegExp; id: AspectRatioId }[] = [
  { re: /\b16\s*:\s*9\b|\b(widescreen|landscape|horizontal|youtube|ctv)\b/, id: "16:9" },
  { re: /\b9\s*:\s*16\b|\b(vertical|reels?|shorts?|tiktok|story|stories)\b/, id: "9:16" },
  { re: /\b1\s*:\s*1\b|\bsquare\b/, id: "1:1" },
  { re: /\b4\s*:\s*5\b|\b(portrait)\b/, id: "4:5" },
  { re: /\b2\s*:\s*3\b|\b(poster|ooh|out of home|print)\b/, id: "2:3" },
  { re: /\b3\s*:\s*2\b/, id: "3:2" },
  { re: /\b21\s*:\s*9\b|\b(anamorphic|cinema|scope)\b/, id: "21:9" },
  { re: /\b4\s*:\s*3\b/, id: "4:3" },
];

const TONE_RULES: { re: RegExp; id: string }[] = [
  { re: /\b(confident|assertive|strong|bolder)\b/, id: "confident" },
  { re: /\b(playful|fun|quirky|humou?rous)\b/, id: "playful" },
  { re: /\b(reassur|calm|gentle|trust|safe|warm)\b/, id: "reassuring" },
  { re: /\b(aspirational|ambitious|premium|luxur|dream)\b/, id: "aspirational" },
  { re: /\b(urgent|now|immediate|fast|deadline|asap)\b/, id: "urgent" },
  { re: /\b(edgy|sharp|provocative|disruptive|rebellious)\b/, id: "edgy" },
  { re: /\b(quiet luxur|understated|minimal luxe)\b/, id: "quiet-luxury" },
  { re: /\b(clinical|precise|technical|data|fact)\b/, id: "clinical" },
];

const STYLE_RULES: { re: RegExp; id: string }[] = [
  { re: /\b(cinematic|filmic|cinema)\b/, id: "cinematic" },
  { re: /\b(editorial|magazine|fashion week|lookbook)\b/, id: "editorial" },
  { re: /\b(documentary|real|authentic|raw|street)\b/, id: "raw documentary" },
  { re: /\b(hyperreal|photoreal|indistinguishable)\b/, id: "hyperreal" },
  { re: /\b(surreal|dreamlike|abstract|odd)\b/, id: "surreal" },
  { re: /\b(analog|film grain|grainy|35mm|16mm|70s)\b/, id: "analog film" },
  { re: /\b(noir|dark|moody|shadow)\b/, id: "neo-noir" },
  { re: /\b(pastel|soft|gentle colour)\b/, id: "pastel dream" },
  { re: /\b(brutalist|graphic|poster|heavy type)\b/, id: "brutalist graphic" },
  { re: /\b(luxur|premium product|beauty shot)\b/, id: "luxury product" },
  { re: /\b(minimal|clean|clinical minimal|white space)\b/, id: "clinical minimal" },
  { re: /\b(streetwear|street|urban|gen z)\b/, id: "streetwear energy" },
  { re: /\b(retro|90s|2000s|y2k|nostalg)\b/, id: "Y2K nostalgia" },
  { re: /\b(nature|botanical|organic|plant|green)\b/, id: "botanical organic" },
  { re: /\b(handmade|hand ?craft|craft|studio made)\b/, id: "handcrafted" },
  { re: /\b(industrial|raw concrete|metal|engineer)\b/, id: "industrial" },
];

const NEGATIVE_RULES: { re: RegExp; id: string }[] = [
  { re: /\b(no|not|avoid|without|dont|don't|never)\b[^.]*\b(neon)\b/, id: "neon" },
  { re: /\b(no|not|avoid|without|never)\b[^.]*\b(oversaturat|over-saturat)\b/, id: "over-saturated colour" },
  { re: /\b(no|not|avoid|without|never)\b[^.]*\b(gloss|glossy|shiny skin)\b/, id: "high-gloss beauty lighting" },
  { re: /\b(no|not|avoid|without|never)\b[^.]*\b(smile|smiling)\b/, id: "stock-smile casting" },
  { re: /\b(no|not|avoid|without|never)\b[^.]*\b(blue rain|teal)\b/, id: "blue rain cliché" },
  { re: /\b(no|not|avoid|without|never)\b[^.]*\b(lighten|lightening|porcelain|airbrush)\b/, id: "skin lightening" },
  { re: /\b(no|not|avoid|without|never)\b[^.]*\b(faces?|people)\b/, id: "faces as hero" },
  { re: /\b(no|not|avoid|without|never)\b[^.]*\b(text|words|typography)\b/, id: "on-frame text" },
];

const CHANNEL_RULES: { re: RegExp; id: string }[] = [
  { re: /\b(paid social|paid ads?|meta|instagram ads?|facebook)\b/, id: "Paid social" },
  { re: /\b(organic social|instagram feed|timeline post)\b/, id: "Organic social" },
  { re: /\b(ctv|pre-?roll|youtube|connected tv)\b/, id: "CTV / pre-roll" },
  { re: /\b(website|web|site|landing|app|landing page)\b/, id: "Web & app" },
  { re: /\b(store|retail|pos|point of sale|in-store)\b/, id: "Retail / POS" },
  { re: /\b(ooh|out of home|billboard|airport)\b/, id: "OOH" },
  { re: /\b(print|magazine|newspaper)\b/, id: "Print" },
  { re: /\b(packaging|pack|box|carton|label)\b/, id: "Packaging" },
  { re: /\b(seeding|influencer|creator seeding)\b/, id: "Influencer seeding" },
  { re: /\b(event|launch party|experience|activation)\b/, id: "Events & experiential" },
];

const REFERENCE_RULES: { re: RegExp; id: string }[] = [
  { re: /\b(cad|blueprint|dieline|spec sheet|model file|3d file)\b/, id: "asset" },
  { re: /\b(previous|last year|campaign|we did|same as|reference)\b/, id: "asset" },
  { re: /\b(government|regulat|claim|substantiat|compliance|disclos)\b/, id: "asset" },
];

/**
 * "4-5 lakhs", "3 to 4 lakh", "1.5-2 cr" are ranges, not two independent
 * numbers. Without this normalisation the number scanner reads the first
 * figure as a bare value (4k instead of ₹4L) and throws the range away.
 */
function normaliseMoneyRanges(text: string): string {
  return text.replace(
    /(\d+(?:\.\d+)?)\s*(?:[-–—]|to|or)\s*(\d+(?:\.\d+)?)\s*(k|l|lakh|lakhs|lac|lacs|cr|crore|crores)\b/gi,
    (_m, a: string, b: string, unit: string) => `${a}${unit}-${b}${unit}`,
  );
}

function rupees(text: string): { min: number; max: number; model: "fixed" | "milestone" | "day-rate" } | null {
  const UNIT: Record<string, number> = { k: 1_000, l: 100_000, lakh: 100_000, lakhs: 100_000, lac: 100_000, lacs: 100_000, cr: 10_000_000, crore: 10_000_000, crores: 10_000_000 };
  const re = /(\d+(?:\.\d+)?)\s*(k|l|lakh|lakhs|lac|lacs|cr|crore|crores)?/gi;
  const nums: number[] = [];
  for (const m of normaliseMoneyRanges(text).matchAll(re)) {
    const n = Number(m[1]);
    if (!Number.isFinite(n)) continue;
    const unit = (m[2] ?? "").toLowerCase();
    nums.push(Math.round(n * (UNIT[unit] ?? 1)));
  }
  const plausible = nums.filter((n) => n >= 20_000 && n <= 50_000_000);
  if (!plausible.length) return null;
  const model: "fixed" | "milestone" | "day-rate" = /milestone|per ?(stage|phase|deliverable)|staged/.test(text)
    ? "milestone"
    : /per day|day rate|dayrate/.test(text)
      ? "day-rate"
      : "fixed";
  const min = Math.min(...plausible);
  const max = Math.max(...plausible);
  return { min: min === max ? Math.round(min * 0.85) : min, max, model };
}

function days(text: string): number | null {
  const weeks = /(\d+)\s*(?:to\s*-?\s*\d+\s*)?week/.exec(text);
  if (weeks) return Number(weeks[1]) * 7;
  const d = /(\d+)\s*(?:working\s*)?days?/.exec(text);
  if (d) return Number(d[1]);
  const months = /(\d+)\s*(?:to\s*-?\s*\d+\s*)?months?/.exec(text);
  if (months) return Number(months[1]) * 30;
  return null;
}

function quantity(text: string): number | null {
  const q = /\b(\d{1,2})\s+(?:[a-z-]+\s+){0,2}?(?:x|variations?|assets?|stills?|videos?|cuts?|cutdowns?|frames?|shots?|pieces?|films?|deliverables?|images?|id(?:s|ents)?)\b/i.exec(text);
  if (q) return Number(q[1]);
  return null;
}

/* ── the extraction pass ──────────────────────────────────────────────────── */

export function extract(text: string): { extracted: ExtractedBrief; filled: string[] } {
  const t = text.toLowerCase();
  const filled: string[] = [];
  const fresh: ExtractedBrief = {
    campaignObjective: null,
    rawIdea: text.trim() || null,
    audience: null,
    tone: [],
    styleTags: [],
    referenceNotes: [],
    excludedStyles: [],
    contentTypes: [],
    aspectRatios: [],
    deliverables: [],
    commercialUse: null,
    budgetMinInr: null,
    budgetMaxInr: null,
    budgetModel: null,
    turnaroundDays: null,
    revisionsIncluded: null,
    conceptRoundsIncluded: null,
    targetChannels: [],
    missing: [],
  };

  /* content types */
  for (const r of CONTENT_RULES) {
    if (r.re.test(t) && !fresh.contentTypes.includes(r.type)) fresh.contentTypes.push(r.type);
  }
  if (fresh.contentTypes.length) filled.push("contentTypes");

  /* formats */
  for (const r of ASPECT_RULES) {
    if (r.re.test(t) && !fresh.aspectRatios.includes(r.id)) fresh.aspectRatios.push(r.id);
  }
  if (!fresh.aspectRatios.length) {
    // infer format from channel, since the two are almost never stated together
    const c = CHANNEL_RULES.find((r) => r.re.test(t));
    if (c) {
      if (c.id === "Paid social" || c.id === "Organic social" || c.id === "Influencer seeding") fresh.aspectRatios.push("9:16");
      if (c.id === "CTV / pre-roll" || c.id === "OOH" || c.id === "Print") fresh.aspectRatios.push("16:9");
      if (c.id === "Retail / POS") fresh.aspectRatios.push("1:1");
    }
  }
  if (fresh.aspectRatios.length) filled.push("aspectRatios");

  /* tone + style */
  fresh.tone = TONE_RULES.filter((r) => r.re.test(t)).map((r) => r.id);
  fresh.styleTags = STYLE_RULES.filter((r) => r.re.test(t)).map((r) => r.id);
  fresh.excludedStyles = NEGATIVE_RULES.filter((r) => r.re.test(t)).map((r) => r.id);
  fresh.targetChannels = CHANNEL_RULES.filter((r) => r.re.test(t)).map((r) => r.id);
  if (fresh.tone.length) filled.push("tone");
  if (fresh.styleTags.length) filled.push("styleTags");
  if (fresh.excludedStyles.length) filled.push("excludedStyles");
  if (fresh.targetChannels.length) filled.push("targetChannels");

  /* rights */
  const rights: Record<string, unknown> = {};
  if (/\b(worldwide|global|international|everywhere|all markets)\b/.test(t)) rights.territory = "worldwide";
  else if (/\b(india|indian market|domestic|only in india)\b/.test(t)) rights.territory = "india";
  if (/\b(perpetual|forever|in perpetuity|buy ?out)\b/.test(t)) {
    rights.perpetual = true;
    rights.durationMonths = null;
    rights.licenseType = "buyout-full";
  } else {
    const dur = /(\d{1,2})\s*(year|yr|years)/.exec(t);
    const mon = /(\d{1,2})\s*(month|months)/.exec(t);
    if (dur) rights.durationMonths = Number(dur[1]) * 12;
    if (mon && !dur) rights.durationMonths = Number(mon[1]);
    if (/\b(exclusive)\b/.test(t)) {
      rights.licenseType = /\b(territor)/.test(t) ? "exclusive-territory" : "exclusive-category";
    } else if (/\b(non-?exclusive)\b/.test(t)) {
      rights.licenseType = "non-exclusive";
    }
  }
  if (/\b(paid media|paid social|paid ads?|promote|boost|media spend|performance marketing|advertise)\b/.test(t))
    rights.paidMediaAllowed = true;
  if (/\b(train|training|fine-?tune|improve the model|model training)\b/.test(t))
    rights.modelTrainingAllowed = true;
  if (/\b(no competing|competitor|exclusive to us|nobody else)\b/.test(t)) rights.competitorUseBlocked = true;
  if (/\b(derivative|cut ?downs?|crop|re-?edit)\b/.test(t)) rights.derivativeWorksAllowed = true;
  if (/\b(sublicens|resell|on-?sell)\b/.test(t)) rights.sublicensingAllowed = true;
  if (Object.keys(rights).length) {
    fresh.commercialUse = rights as ExtractedBrief["commercialUse"];
    filled.push("commercialUse");
  }

  /* money */
  const money = rupees(text);
  if (money) {
    fresh.budgetMinInr = money.min;
    fresh.budgetMaxInr = money.max;
    fresh.budgetModel = money.model;
    filled.push("budget");
  }

  /* time */
  const d = days(text);
  if (d) {
    fresh.turnaroundDays = d;
    filled.push("timeline");
  }
  const rev = /(\d{1,2})\s*(?:revision|revision|rev)/i.exec(text);
  if (rev) {
    fresh.revisionsIncluded = Number(rev[1]);
    filled.push("revisionsIncluded");
  }
  const rounds = /(\d{1,2})\s*(?:concept|round)/i.exec(text);
  if (rounds) {
    fresh.conceptRoundsIncluded = Number(rounds[1]);
    filled.push("conceptRoundsIncluded");
  }

  /* objective + audience heuristics */
  const objective = /\b(launch|awareness|recall|consideration|sell|conversion|trial|download|install|festival|announce|teaser|reposition)\b/.test(t);
  const audience = /\b(audience|target|for (men|women|people|customers|users)|demographic|gen z|young|25-40|30-45|our customers)\b/.test(t);
  if (objective && text.length > 25) {
    fresh.campaignObjective = text.trim();
    filled.push("campaignObjective");
  }
  if (audience && text.length > 25) {
    fresh.audience = text.trim();
    filled.push("audience");
  }

  /* deliverables: quantity × inferred types × inferred formats */
  const q = quantity(text);
  if (q && fresh.contentTypes.length) {
    const formats = fresh.aspectRatios.length ? fresh.aspectRatios : (["1:1"] as AspectRatioId[]);
    const types = fresh.contentTypes.length > 1 ? fresh.contentTypes.slice(0, 2) : fresh.contentTypes;
    const per = Math.max(1, Math.round(q / (types.length * formats.length)));
    fresh.deliverables = types.flatMap((ct) =>
      formats.map< BriefDeliverable>((ar) => ({
        id: `d-${ct}-${ar}`,
        contentType: ct,
        aspectRatio: ar,
        quantity: per,
        durationSeconds: ct === "cinematic-video" || ct === "short-form-video" ? 30 : undefined,
        notes: "",
      })),
    );
    filled.push("deliverables");
  }

  /* reference notes */
  for (const r of REFERENCE_RULES) {
    if (r.re.test(t)) {
      fresh.referenceNotes.push(text.trim());
      filled.push("referenceNotes");
      break;
    }
  }

  return { extracted: fresh, filled };
}

/* ── merging into the running draft ───────────────────────────────────────── */

export function mergeDraft(draft: BriefDraft, e: ExtractedBrief, sourceText: string): BriefDraft {
  const next: BriefDraft = structuredClone(draft);
  if (e.campaignObjective) next.campaignObjective = e.campaignObjective;
  if (e.audience) next.audience = e.audience;
  if (e.rawIdea && !next.rawIdea) next.rawIdea = sourceText;
  next.tone = Array.from(new Set([...next.tone, ...e.tone]));
  next.styleTags = Array.from(new Set([...next.styleTags, ...e.styleTags]));
  next.referenceNotes = Array.from(new Set([...next.referenceNotes, ...e.referenceNotes]));
  next.excludedStyles = Array.from(new Set([...next.excludedStyles, ...e.excludedStyles]));
  next.targetChannels = Array.from(new Set([...next.targetChannels, ...e.targetChannels]));
  if (e.contentTypes.length) next.contentTypes = Array.from(new Set([...next.contentTypes, ...e.contentTypes]));
  if (e.aspectRatios.length) next.aspectRatios = Array.from(new Set([...next.aspectRatios, ...e.aspectRatios]));
  if (e.deliverables.length) next.deliverables = e.deliverables;
  if (e.commercialUse) next.commercialUse = { ...next.commercialUse, ...e.commercialUse };
  if (e.budgetMinInr) next.budgetMinInr = e.budgetMinInr;
  if (e.budgetMaxInr) next.budgetMaxInr = e.budgetMaxInr;
  if (e.turnaroundDays) next.turnaroundDays = e.turnaroundDays;
  if (e.revisionsIncluded !== null) next.revisionsIncluded = e.revisionsIncluded;
  if (e.conceptRoundsIncluded !== null) next.conceptRoundsIncluded = e.conceptRoundsIncluded;
  return next;
}

/* ── what's still missing, in the order that actually matters ─────────────── */

export function missingFields(draft: BriefDraft): MissingField[] {
  const m: MissingField[] = [];
  if (!draft.rawIdea) m.push("objective");
  if (!draft.audience) m.push("audience");
  if (!draft.contentTypes.length) m.push("contentType");
  if (!draft.aspectRatios.length) m.push("format");
  if (!draft.styleTags.length && !draft.referenceNotes.length) m.push("style");
  if (!draft.deliverables.length) m.push("deliverables");
  if (!draft.commercialUse.territory || !draft.commercialUse.durationMonths && !draft.commercialUse.perpetual)
    m.push("rights");
  if (!draft.budgetMaxInr) m.push("budget");
  if (!draft.turnaroundDays) m.push("timeline");
  return m;
}

const WEIGHT: Record<MissingField, number> = {
  objective: 10,
  audience: 9,
  contentType: 10,
  format: 7,
  style: 8,
  deliverables: 7,
  rights: 10,
  budget: 8,
  timeline: 7,
};

export function progressOf(draft: BriefDraft) {
  const total = Object.values(WEIGHT).reduce((a, b) => a + b, 0);
  let got = 0;
  if (draft.rawIdea) got += WEIGHT.objective;
  if (draft.audience) got += WEIGHT.audience;
  if (draft.contentTypes.length) got += WEIGHT.contentType;
  if (draft.aspectRatios.length) got += WEIGHT.format;
  if (draft.styleTags.length || draft.referenceNotes.length) got += WEIGHT.style;
  if (draft.deliverables.length) got += WEIGHT.deliverables;
  if (draft.commercialUse.territory && (draft.commercialUse.durationMonths || draft.commercialUse.perpetual)) got += WEIGHT.rights;
  if (draft.budgetMaxInr) got += WEIGHT.budget;
  if (draft.turnaroundDays) got += WEIGHT.timeline;
  return Math.round((got / total) * 100);
}

/* ── reply composition ────────────────────────────────────────────────────── */

function acknowledge(text: string, budgetMaxInr: number) {
  const t = text.toLowerCase();

  const got: string[] = [];
  if (/monsoon|rain|weather/.test(t)) got.push("the weather is created, not scheduled — which is the whole reason this is a fit here");
  if (/cad|geometry|silhouette/.test(t)) got.push("the geometry has to come from your file, not a model");
  if (/six|tone|undertone/.test(t)) got.push("six undertones with one lighting rig is a much harder constraint than six shots, and it is the right constraint");
  if (/budget/.test(t) && budgetMaxInr)
    got.push(`₹${(budgetMaxInr / 100_000).toFixed(1)}L gives us room for a proper previz stage rather than a fast one`);
  if (/cad\b/.test(t)) got.push("CAD-accurate is the only version of this that survives your engineering team checking it");
  if (/next week|urgent|asap|quick|fast/.test(t))
    got.push("a tight deadline is fine — it just means the previz stage gets compressed, so I would want to start there");
  if (/handover|handoff|new (?:)?team/.test(t)) got.push("a handover means the pipeline needs documenting anyway, so that lands naturally");
  if (/failed|burned|burnt|last time|previous agency|another agency/.test(t))
    got.push("that failure mode is the reason this platform exists");

  if (got.length) return `Got it. ${cap(got[0])}${got.length > 1 ? ` Also noted: ${got.slice(1).join("; ")}.` : "."}`;
  return "Noted.";
}

function cap(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function confirmationsOf(e: ExtractedBrief): string[] {
  const out: string[] = [];
  if (e.contentTypes.length) out.push(`${e.contentTypes.length} content type${e.contentTypes.length > 1 ? "s" : ""}`);
  if (e.aspectRatios.length) out.push(`formats ${e.aspectRatios.join(", ")}`);
  if (e.budgetMaxInr && e.budgetMinInr)
    out.push(`budget ₹${(e.budgetMinInr / 100_000).toFixed(1)}–${(e.budgetMaxInr / 100_000).toFixed(1)}L`);
  if (e.turnaroundDays) out.push(`${e.turnaroundDays} day turnaround`);
  if (e.commercialUse) {
    const parts: string[] = [];
    if (e.commercialUse.territory) parts.push(String(e.commercialUse.territory));
    if (e.commercialUse.perpetual) parts.push("perpetual");
    else if (e.commercialUse.durationMonths) parts.push(`${e.commercialUse.durationMonths} months`);
    if (e.commercialUse.paidMediaAllowed) parts.push("paid media");
    if (e.commercialUse.competitorUseBlocked) parts.push("no competing work");
    if (parts.length) out.push(`rights: ${parts.join(", ")}`);
  }
  if (e.targetChannels.length) out.push(`running in ${e.targetChannels.slice(0, 3).join(", ")}`);
  if (e.excludedStyles.length) out.push(`excluding ${e.excludedStyles.slice(0, 3).join(", ")}`);
  if (e.tone.length) out.push(`tone: ${e.tone.slice(0, 3).join(", ")}`);
  return out;
}

function askFor(field: MissingField) {
  return MISSING_META[field].ask;
}

export function runDeterministicTurn(input: {
  messages: { role: "user" | "assistant"; text: string }[];
  draft: Partial<BriefDraft>;
  brandName: string;
  brandIndustry: string;
}): BriefTurnResponse {
  const draft0: BriefDraft = { ...EMPTY_DRAFT, ...input.draft };
  const lastUser = [...input.messages].reverse().find((m) => m.role === "user");
  const text = lastUser?.text ?? "";
  const before = progressOf(draft0);
  const { extracted, filled } = extract(text);
  const draft = mergeDraft(draft0, extracted, text);
  const after = progressOf(draft);
  const missing = missingFields(draft);
  const confirmations = confirmationsOf(extracted);

  let reply = acknowledge(text, draft0.budgetMaxInr);

  if (confirmations.length) {
    reply += ` I have pulled ${confirmations.join(", ")} out of that and written it into the brief.`;
  }

  if (missing.length === 0) {
    reply += ` That is a complete brief — content, formats, style, rights, money and a deadline. Nothing here is guessing on your behalf. Publish it and I will run it against the creator pool.`;
  } else {
    const next = missing[0];
    reply += ` Next: ${askFor(next)}`;
    if (MISSING_META[next].why && before > 0) {
      reply += ` ${MISSING_META[next].why}`;
    }
    if (missing.length > 1) {
      reply += ` (${missing.length - 1} other${missing.length > 2 ? "s" : ""} still open${missing.length > 2 ? "" : ""}.)`;
    }
  }

  return {
    reply,
    extracted,
    draft,
    fieldsFilledThisTurn: filled,
    progress: after,
    simulated: true,
    model: "deterministic-reasoner-v1",
  };
}

export const SUGGESTION_POOL: { label: string; text: string }[] = [
  { label: "I don't know what I want", text: "Honestly I don't know. We have a product launch in six weeks and someone told me AI creators are cheaper and faster than a shoot. Where do we even start?" },
  { label: "We got burned last time", text: "Last agency regenerated the product between shots and it came back wrong. The product must be identical in every frame. India only, 2 years, paid social and our site." },
  { label: "Vertical first", text: "It needs to work on a phone with the sound off in the first three seconds, so vertical first. Four cuts at 20 seconds plus one horizontal version. Around 5 lakh, 4 weeks." },
  { label: "I have CAD", text: "We've got CAD for the product. It must not move by a millimetre. Nobody should be generating the product itself — just the world around it." },
  { label: "Audio only", text: "We need a music bed and a voiceover for a 45 second film. Nothing visual yet. English and Hindi, worldwide, one year." },
];

/** Formats present in the draft, for the live "readout" panel. */
export function draftReadout(draft: BriefDraft) {
  return {
    contentTypes: draft.contentTypes,
    formats: draft.aspectRatios.map((a) => ASPECT_RATIOS.find((x: { id: string }) => x.id === a)?.label ?? a),
    tone: draft.tone,
    style: draft.styleTags,
    channels: draft.targetChannels,
    rights: [
      draft.commercialUse.territory,
      draft.commercialUse.perpetual ? "perpetual" : draft.commercialUse.durationMonths ? `${draft.commercialUse.durationMonths} months` : null,
      draft.commercialUse.paidMediaAllowed ? "paid media" : null,
      draft.commercialUse.competitorUseBlocked ? "no competing work" : null,
    ].filter(Boolean) as string[],
    budget: draft.budgetMaxInr ? `₹${(draft.budgetMinInr / 100_000).toFixed(1)}–${(draft.budgetMaxInr / 100_000).toFixed(1)}L` : null,
    timeline: draft.turnaroundDays ? `${draft.turnaroundDays} days` : null,
    excluded: draft.excludedStyles,
  };
}

export const CHANNEL_LIST = CHANNELS;
export const STYLE_LIST = STYLE_TAGS;
export const TONE_LIST = TONE_TAGS;
export { EMPTY_DRAFT };