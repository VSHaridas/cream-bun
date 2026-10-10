import type { Brief, BriefSession, ConversationTurn, CommercialUse } from "@/lib/domain/types";

/**
 * Briefs and their originating conversations. The transcript is stored beside
 * the structured brief and re-hydrated verbatim for the creator — this is the
 * mechanism that lets a brand describe a campaign badly and a creator still
 * receive the full intent.
 */

const BASE_COMMERCIAL: CommercialUse = {
  licenseType: "non-exclusive",
  territory: "india",
  durationMonths: 24,
  perpetual: false,
  channels: ["Paid social", "Organic social", "Web & app"],
  paidMediaAllowed: true,
  modelTrainingAllowed: false,
  derivativeWorksAllowed: true,
  sublicensingAllowed: false,
  resaleAllowed: false,
  competitorUseBlocked: true,
  disclosurePolicy: "platform-disclosure",
};

export const BRIEFS: Brief[] = [
  {
    id: "br-monsoon",
    code: "BRF-2026-0141",
    title: "Monsoon Reveal — Autumn/Winter 2026",
    brandId: "bd-nirvani",
    brandName: "Nirvani Atelier",
    campaignObjective:
      "Open the AW26 collection with a monsoon film that makes handwoven sari feel like weather, not garment. Sell to an existing customer base and to press.",
    rawIdea:
      "something monsoon-ish, we shoot in the rain usually but its too slow to schedule everyone, want it to feel like the first rain of the season",
    refinedSummary:
      "A 50–60 second hero film plus vertical cutdowns, opening on the first monsoon shower over stone. Handwoven sari is the subject; the model is present but secondary. The emotional target is relief, not glamour — the moment the season turns.",
    audience:
      "Women 26–40, urban and tier-2, already buying occasion wear. Secondary: fashion press and stylists who set the AW narrative.",
    tone: ["quiet-luxury", "warm", "aspirational"],
    styleTags: ["cinematic", "analog film", "70s grain", "botanical organic"],
    referenceNotes: [
      "Shot the FY25 monsoon campaign in Camera B — grade matches better than any LUT we own.",
      "No visible logos other than the house mark in the end card.",
      "Weather must feel real: wet stone specular, moving fabric, no rain-on-glass cliché.",
    ],
    excludedStyles: ["high-gloss beauty lighting", "neon", "over-saturated colour", "stock-smile casting"],
    deliverables: [
      {
        id: "d1",
        contentType: "cinematic-video",
        aspectRatio: "21:9",
        quantity: 1,
        durationSeconds: 55,
        notes: "Hero film. Master plus ProRes 4444 and H.264 review.",
      },
      {
        id: "d2",
        contentType: "short-form-video",
        aspectRatio: "9:16",
        quantity: 5,
        durationSeconds: 18,
        notes: "Cutdowns, each opening on a distinct beat. Sound-off legible.",
      },
      {
        id: "d3",
        contentType: "social-static",
        aspectRatio: "4:5",
        quantity: 8,
        notes: "Pull-frames from the hero plus four bespoke stills.",
      },
    ],
    commercialUse: {
      ...BASE_COMMERCIAL,
      territory: "india",
      durationMonths: 36,
      channels: ["Paid social", "Organic social", "Web & app", "Print", "Events & experiential"],
      paidMediaAllowed: true,
      derivativeWorksAllowed: true,
      competitorUseBlocked: true,
      modelTrainingAllowed: false,
      disclosurePolicy: "platform-disclosure",
    },
    budget: { minInr: 380000, maxInr: 520000, model: "milestone", releasedToRazorpay: true },
    timeline: {
      kickoffWithinDays: 5,
      firstSamplesWithinDays: 9,
      finalDeliveryWithinDays: 26,
      revisionsIncluded: 2,
      conceptRoundsIncluded: 2,
    },
    contentTypes: ["cinematic-video", "short-form-video", "social-static"],
    aspectRatios: ["21:9", "9:16", "4:5"],
    mustHaveSignals: ["identity", "tools", "workflow", "portfolio"],
    status: "in-negotiation",
    createdAt: "2026-09-02T10:14:00Z",
    updatedAt: "2026-09-19T07:41:00Z",
    sessionId: "bs-monsoon",
    embeddingNote:
      "Cinematic monsoon sari hero film, quiet luxury, analog grain, stone and water, 55s anamorphic, vertical cutdowns, India 36 months paid social and print.",
    shortlistedCreatorIds: ["cr-aarav", "cr-diya", "cr-samar"],
    offerIds: ["of-aarav-monsoon", "of-diya-monsoon"],
  },
  {
    id: "br-ignition",
    code: "BRF-2026-0163",
    title: "Ignition — EV launch film",
    brandId: "bd-vayu",
    brandName: "Vayu Motors",
    campaignObjective:
      "Launch film for the Ignition platform. Must survive a sound-off autoplay on a phone before it survives a cinema.",
    rawIdea: "launch film for the new ev, short, punchy, mostly vertical, we need it next week",
    refinedSummary:
      "A 30 second launch film cut vertical-first. The product must be geometrically exact; the world around it can be generous. One clear idea, no narration, no claims on screen.",
    audience: "Urban male 28–45, current ICE owner considering an EV, high-intent.",
    tone: ["confident", "urgent", "clinical"],
    styleTags: ["industrial", "clinical minimal", "chromatic"],
    referenceNotes: [
      "CAD files for the Ignition body will be supplied — nothing about the vehicle silhouette may be generated.",
      "One claim on screen: the certified range figure, taken from the homologation certificate.",
    ],
    excludedStyles: ["handheld shakiness", "lens flare", "people's faces as hero"],
    deliverables: [
      {
        id: "d1",
        contentType: "short-form-video",
        aspectRatio: "9:16",
        quantity: 3,
        durationSeconds: 30,
        notes: "Vertical-first master with two length variants.",
      },
      {
        id: "d2",
        contentType: "cinematic-video",
        aspectRatio: "16:9",
        quantity: 1,
        durationSeconds: 30,
        notes: "Horizontal recut of the same edit.",
      },
    ],
    commercialUse: {
      ...BASE_COMMERCIAL,
      territory: "worldwide",
      durationMonths: 24,
      channels: ["YouTube", "Paid social", "Organic social", "Retail / POS", "Events & experiential"],
      paidMediaAllowed: true,
      competitorUseBlocked: true,
      disclosurePolicy: "client-disclosure",
    },
    budget: { minInr: 600000, maxInr: 750000, model: "fixed", releasedToRazorpay: true },
    timeline: {
      kickoffWithinDays: 3,
      firstSamplesWithinDays: 6,
      finalDeliveryWithinDays: 18,
      revisionsIncluded: 2,
      conceptRoundsIncluded: 1,
    },
    contentTypes: ["short-form-video", "cinematic-video"],
    aspectRatios: ["9:16", "16:9"],
    mustHaveSignals: ["identity", "tools", "portfolio", "delivery"],
    status: "open",
    createdAt: "2026-09-15T08:02:00Z",
    updatedAt: "2026-09-15T08:02:00Z",
    sessionId: "bs-ignition",
    embeddingNote:
      "EV launch film vertical-first, CAD-accurate vehicle, industrial clinical, one homologated range claim, worldwide 24 months paid and retail.",
    shortlistedCreatorIds: [],
    offerIds: [],
  },
  {
    id: "br-undertone",
    code: "BRF-2026-0158",
    title: "Undertone — Serum launch stills",
    brandId: "bd-halcyon",
    brandName: "Halcyon",
    campaignObjective:
      "Launch stills for a serum positioned entirely on undertone accuracy across six skin tones.",
    rawIdea: "we need the serum shot on six different skin tones, no tokenism, and the bottle must not change between shots",
    refinedSummary:
      "Six stills, one product, six calibrated skin tones. Lighting, background and framing held constant so the undertone is the only variable a viewer can perceive.",
    audience: "Women 22–38, ingredient-led buyers who already read the INCI list.",
    tone: ["reassuring", "clinical", "quiet-luxury"],
    styleTags: ["clinical minimal", "hyperreal", "monochrome"],
    referenceNotes: [
      "Same bottle render across all six. We will reject any set where the packaging differs.",
      "No global skin lightening. Undertone must match the identity sheet per subject.",
    ],
    excludedStyles: ["airbrushing", "porcelain retouch", "colour temperature drift between frames"],
    deliverables: [
      {
        id: "d1",
        contentType: "photography",
        aspectRatio: "4:5",
        quantity: 6,
        notes: "Hero stills, one per undertone, matched lighting.",
      },
      {
        id: "d2",
        contentType: "social-static",
        aspectRatio: "1:1",
        quantity: 6,
        notes: "Square crops for feed.",
      },
    ],
    commercialUse: {
      ...BASE_COMMERCIAL,
      territory: "worldwide",
      durationMonths: 36,
      channels: ["Paid social", "Organic social", "Web & app", "Retail / POS", "Packaging"],
      paidMediaAllowed: true,
      competitorUseBlocked: true,
      disclosurePolicy: "client-disclosure",
    },
    budget: { minInr: 240000, maxInr: 320000, model: "fixed", releasedToRazorpay: true },
    timeline: {
      kickoffWithinDays: 7,
      firstSamplesWithinDays: 8,
      finalDeliveryWithinDays: 15,
      revisionsIncluded: 2,
      conceptRoundsIncluded: 1,
    },
    contentTypes: ["photography", "social-static"],
    aspectRatios: ["4:5", "1:1"],
    mustHaveSignals: ["identity", "portfolio", "client"],
    status: "shortlisted",
    createdAt: "2026-09-11T13:37:00Z",
    updatedAt: "2026-09-16T09:20:00Z",
    sessionId: "bs-undertone",
    embeddingNote:
      "Serum launch stills, six calibrated skin tones, constant lighting, packaging locked, no skin lightening, worldwide 36 months paid and packaging.",
    shortlistedCreatorIds: ["cr-ishita", "cr-priya"],
    offerIds: [],
  },
];

export const BRIEF_BY_ID = new Map(BRIEFS.map((b) => [b.id, b]));

export function briefById(id: string) {
  return BRIEF_BY_ID.get(id);
}

/* ── transcripts ──────────────────────────────────────────────────────────── */

function t(
  id: string,
  sessionId: string,
  role: ConversationTurn["role"],
  text: string,
  at: string,
  extractedFields: string[] = [],
): ConversationTurn {
  return { id, sessionId, role, text, at, extractedFields };
}

export const BRIEF_SESSIONS: BriefSession[] = [
  {
    id: "bs-monsoon",
    briefId: "br-monsoon",
    brandId: "bd-nirvani",
    status: "submitted",
    createdAt: "2026-09-02T10:14:00Z",
    updatedAt: "2026-09-02T10:26:00Z",
    turns: [
      t("t1", "bs-monsoon", "assistant", "Let's start with what already exists. What did the FY25 monsoon campaign look like, and what worked about it?", "2026-09-02T10:14:02Z"),
      t("t2", "bs-monsoon", "brand", "We shot it in Camera B with a long lens. The grade was flat and warm, which is why it worked. Everyone else was doing blue rain and it looked like a detergent ad.", "2026-09-02T10:15:10Z", ["referenceNotes"]),
      t("t3", "bs-monsoon", "assistant", "Noted — warm, flat, long lens. Is the camera going to a real set, or should the creator build it?", "2026-09-02T10:15:30Z"),
      t("t4", "bs-monsoon", "brand", "It should not look like a set. We have eleven saris and four models and three days of everyone's availability, and rain scheduling in September is a joke.", "2026-09-02T10:16:20Z", ["rawIdea"]),
      t("t5", "bs-monsoon", "assistant", "Understood. That means the weather is created, not captured. Three questions left: where does it run, for how long may the film be used commercially, and how long can we take?", "2026-09-02T10:16:48Z"),
      t("t6", "bs-monsoon", "brand", "India only, three years. Paid social, the site, print in the two December issues, and it plays at the store launch in Delhi. Four weeks end to end, and we need to see something in week one or the stylists will go elsewhere.", "2026-09-02T10:18:05Z", ["commercialUse", "budget", "timeline"]),
      t("t7", "bs-monsoon", "assistant", "I have enough. Drafting the structured brief now — you will get a version you can edit field by field before anything is published.", "2026-09-02T10:19:11Z"),
    ],
    draft: {},
  },
  {
    id: "bs-ignition",
    briefId: "br-ignition",
    brandId: "bd-vayu",
    status: "submitted",
    createdAt: "2026-09-15T08:02:00Z",
    updatedAt: "2026-09-15T08:09:00Z",
    turns: [
      t("t1", "bs-ignition", "brand", "something monsoon-ish, we shoot in the rain usually but its too slow to schedule everyone", "2026-09-15T08:02:01Z"),
      t("t2", "bs-ignition", "assistant", "I can help with that. Who is the audience, and what should they feel in the first three seconds?", "2026-09-15T08:02:30Z"),
      t("t3", "bs-ignition", "brand", "launch film for the new ev, short, punchy, mostly vertical, we need it next week", "2026-09-15T08:03:10Z"),
      t("t4", "bs-ignition", "assistant", "A week is tight but workable if the vehicle geometry comes from CAD rather than from a camera. Do you have the CAD, and is there a claim that has to appear on screen?", "2026-09-15T08:03:44Z"),
      t("t5", "bs-ignition", "brand", "yes we have cad. range is 412 certified so that can go on screen. worldwide, 2 years, everything.", "2026-09-15T08:06:02Z", ["commercialUse", "referenceNotes"]),
    ],
    draft: {},
  },
  {
    id: "bs-undertone",
    briefId: "br-undertone",
    brandId: "bd-halcyon",
    status: "submitted",
    createdAt: "2026-09-11T13:37:00Z",
    updatedAt: "2026-09-11T13:45:00Z",
    turns: [
      t("t1", "bs-undertone", "brand", "we need the serum shot on six different skin tones, no tokenism", "2026-09-11T13:37:02Z"),
      t("t2", "bs-undertone", "assistant", "Six tones is a strong constraint. Should lighting and background be held identical across all six so undertone is the only variable?", "2026-09-11T13:37:40Z"),
      t("t3", "bs-undertone", "brand", "yes. and the bottle must not change between shots. we got burned by an agency last year that regenerated the cap.", "2026-09-11T13:38:55Z", ["referenceNotes", "excludedStyles"]),
      t("t4", "bs-undertone", "assistant", "That is a packaging-locked render requirement, not a retouching preference — it changes which kind of creator you need. Anything we must never do to skin?", "2026-09-11T13:39:30Z"),
      t("t5", "bs-undertone", "brand", "no global lightening. ever. we will reject the set.", "2026-09-11T13:41:10Z", ["excludedStyles"]),
    ],
    draft: {},
  },
];

export const SESSION_BY_ID = new Map(BRIEF_SESSIONS.map((s) => [s.id, s]));