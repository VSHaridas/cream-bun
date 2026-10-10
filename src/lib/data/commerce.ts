import type {
  Contract,
  Engagement,
  Escrow,
  Offer,
  ProvenanceRecord,
  Review,
} from "@/lib/domain/types";

/* ── offers ───────────────────────────────────────────────────────────────── */

const BRIEF_RESTATEMENT: Record<string, string> = {
  "of-aarav-monsoon": `You asked for a film that opens on the first monsoon shower over stone, in a flat warm grade on a long lens, with the sari as the subject and the model present but secondary. Fifty-five seconds, 21:9. The rain is not scheduled — it is created, so no one's availability is at risk.

Two hard constraints from the brand: no visible logos other than the house end card, and no rain-on-glass cliché. Also excluded: high-gloss beauty lighting, neon, over-saturated colour.

Five vertical cutdowns at eighteen seconds, each opening on a different beat, and eight 4:5 stills.

Rights: India, thirty-six months, paid social, organic, web, the December print issues and the Delhi store launch. Paid media is allowed and the brand will not license anyone else in this category. Model training on the output is explicitly refused. They have paid into escrow already.`,
  "of-diya-monsoon": `A monsoon sari film. Warm, flat, long lens — the brand specifically does not want blue rain.

The reason they are talking to you is a line in their brief: the hero must hold on weave and drape against wet stone, at a magnification where a normal stills brief would not look. That is your lane, not a cinematographer's.

They need the eleven physical saris photographed as texture reference first. They will courier them. Fifty-five seconds, 21:9, plus five vertical cutdowns and eight 4:5 stills.

India, thirty-six months, including print. Paid media allowed, competing work barred, model training refused.`,
};

export const OFFERS: Offer[] = [
  {
    id: "of-aarav-monsoon",
    code: "OFR-2026-0442",
    briefId: "br-monsoon",
    creatorId: "cr-aarav",
    brandId: "bd-nirvani",
    amountInr: 465000,
    deliveryDays: 24,
    revisionsIncluded: 2,
    conceptRounds: 2,
    exclusivity: "exclusive-category",
    milestones: [
      { label: "Previz and shot list", pct: 20, dueDay: 5 },
      { label: "First samples", pct: 30, dueDay: 9 },
      { label: "Cutdown set", pct: 30, dueDay: 17 },
      { label: "Final masters", pct: 20, dueDay: 24 },
    ],
    status: "accepted",
    translatedBrief: BRIEF_RESTATEMENT["of-aarav-monsoon"],
    translationTurns: [
      {
        id: "tt1",
        sessionId: "of-aarav-monsoon",
        role: "assistant",
        at: "2026-09-05T06:12:00Z",
        text: "I have read the full brief and their conversation with me. Here is what they actually asked for, in order of how much it matters.",
        extractedFields: [],
      },
    ],
    createdAt: "2026-09-03T11:02:00Z",
    respondedAt: "2026-09-05T06:40:00Z",
    note: "Given the CAD-free nature of this, I would block the camera path in Unreal and generate against it — same discipline as the Greybox piece. Priced to include the eight stills as pull-frames.",
  },
  {
    id: "of-diya-monsoon",
    code: "OFR-2026-0447",
    briefId: "br-monsoon",
    creatorId: "cr-diya",
    brandId: "bd-nirvani",
    amountInr: 415000,
    deliveryDays: 27,
    revisionsIncluded: 2,
    conceptRounds: 2,
    exclusivity: "exclusive-category",
    milestones: [
      { label: "Material reference pass", pct: 25, dueDay: 7 },
      { label: "First samples", pct: 30, dueDay: 10 },
      { label: "Cutdown set", pct: 25, dueDay: 19 },
      { label: "Final masters", pct: 20, dueDay: 27 },
    ],
    status: "negotiating",
    translatedBrief: BRIEF_RESTATEMENT["of-diya-monsoon"],
    translationTurns: [],
    createdAt: "2026-09-04T09:30:00Z",
    respondedAt: null,
    note: "Can we split this — I take the hero film and the eight 4:5 stills, someone else takes the cutdowns? Would come down to about two lakh eighty.",
  },
];

export const OFFER_BY_ID = new Map(OFFERS.map((o) => [o.id, o]));

/* ── contracts ────────────────────────────────────────────────────────────── */

const NCLAUSES_COMMON = [
  {
    id: "c-watermark",
    heading: "Pre-release watermarking",
    body: "Every sample released before final approval carries a visible dual-branded burn-in (CREAM and the creator) and an imperceptible watermark envelope. The brand may not remove, crop past, or obscure either mark. Sample assets are licensed for review only and carry no distribution right.",
    requiresExplicitAcknowledgement: true,
  },
  {
    id: "c-scope",
    heading: "Scope and change control",
    body: "Deliverables, formats, revisions and concept rounds are fixed by the attached brief. A change to any of these requires a written scope amendment countersigned by both parties and, where the change increases cost, a supplementary escrow release.",
    requiresExplicitAcknowledgement: true,
  },
  {
    id: "c-reject",
    heading: "Rejection grounds",
    body: "A brief may be rejected only where the final output materially departs from a sample the brand approved in writing during the agreed sample round. Aesthetic preference alone is not a rejection ground. Where a claim of departure is upheld, remedy is partial or full refund as determined jointly by CREAM's review specialist and the parties.",
    requiresExplicitAcknowledgement: true,
  },
  {
    id: "c-rights",
    heading: "Rights granted",
    body: "On final approval and settlement of the engagement close agreement, the brand receives the licence described in the brief's commercial-use terms, for the stated territory, duration, channels and media. No right not expressly granted is granted, including resale, sublicensing and use as a model-training input.",
    requiresExplicitAcknowledgement: true,
  },
];

export const CONTRACTS: Contract[] = [
  {
    id: "ct-monsoon-start",
    code: "CTR-2026-0912",
    kind: "engagement-start",
    offerId: "of-aarav-monsoon",
    brandId: "bd-nirvani",
    creatorId: "cr-aarav",
    briefId: "br-monsoon",
    clauses: [
      {
        id: "c-parties",
        heading: "Parties and identity",
        body: "Nirvani Atelier LLP, identity asserted through DigiLocker as GSTIN 27AAGCN••••, and Frame Latitude, operated by Aarav Mehta, identity asserted through DigiLocker at AAL2. CREAM holds the assertions only. Neither party has produced a government identity document to CREAM at any point.",
        requiresExplicitAcknowledgement: false,
      },
      ...NCLAUSES_COMMON,
      {
        id: "c-escrow",
        heading: "Escrow and settlement",
        body: "₹4,65,000 has been authorised with Razorpay and held by CREAM's sub-account. Funds release against the four milestones in the offer. Settlement is net-15 from milestone acceptance. A dispute freezes the disputed tranche only.",
        requiresExplicitAcknowledgement: true,
      },
    ],
    signatures: [
      { party: "brand", partyName: "Nirvani Atelier LLP", status: "signed", signedAt: "2026-09-06T04:41:00Z", ipAddress: "49.36.182.14", digest: "9f4c1ab2e7d3" },
      { party: "creator", partyName: "Aarav Mehta", status: "signed", signedAt: "2026-09-06T05:02:00Z", ipAddress: "182.71.44.9", digest: "1c88de074ab5" },
    ],
    contentDigest: "sha256:4a91f0c8e7b23d59a6c1104f8be29d7c3a15b0e6d2f9c8471b3e5a09d6c2147fb",
    status: "signed",
    createdAt: "2026-09-06T04:12:00Z",
    effectiveAt: "2026-09-06T05:02:00Z",
    humanReviewed: true,
  },
  {
    id: "ct-monsoon-nda",
    code: "CTR-2026-0908",
    kind: "nda",
    offerId: "of-aarav-monsoon",
    brandId: "bd-nirvani",
    creatorId: "cr-aarav",
    briefId: "br-monsoon",
    clauses: [
      {
        id: "c-nda",
        heading: "Mutual confidentiality",
        body: "The unreleased campaign, the sari reference photography, and the brand's AW26 assortment are confidential until the agreed announcement date. Either party may disclose to a professional adviser under equivalent duty.",
        requiresExplicitAcknowledgement: true,
      },
    ],
    signatures: [
      { party: "brand", partyName: "Nirvani Atelier LLP", status: "signed", signedAt: "2026-09-05T06:55:00Z", ipAddress: "49.36.182.14", digest: "77a0ce19b4f2" },
      { party: "creator", partyName: "Aarav Mehta", status: "signed", signedAt: "2026-09-05T07:04:00Z", ipAddress: "182.71.44.9", digest: "b31f9d2a76ce" },
    ],
    contentDigest: "sha256:c04e17b93a5d268f41e7b9c305a1d84f2670bea5c193f804db62e7a15c903f8d2",
    status: "signed",
    createdAt: "2026-09-05T06:40:00Z",
    effectiveAt: "2026-09-05T07:04:00Z",
    humanReviewed: true,
  },
];

/* ── escrow ───────────────────────────────────────────────────────────────── */

export const ESCROWS: Escrow[] = [
  {
    id: "es-monsoon",
    code: "RZP-ES-2026-1183",
    engagementId: "en-aarav-1",
    amountInr: 465000,
    releasedInr: 155000,
    currency: "INR",
    status: "partially-released",
    gateway: "razorpay",
    gatewayOrderId: "order_LpQ8fR2Kd9xYzA",
    gatewayPaymentId: "pay_LpQ9aG7Nv4BcdE",
    capturedAt: "2026-09-06T05:04:00Z",
    releasedAt: null,
    payoutRoute: "Razorpay Route · sub-account frame-latitude",
    protectedBy: "Held by CREAM against milestone acceptance. The creator is paid, the brand is protected, and neither depends on the other's goodwill.",
  },
];

/* ── provenance ───────────────────────────────────────────────────────────── */

export const PROVENANCE: ProvenanceRecord[] = [
  {
    id: "pv-monsoon-r1",
    engagementId: "en-aarav-1",
    roundId: "gn-monsoon-1",
    assetName: "monsoon-hero-samples-v1",
    c2pa: {
      version: "1.3",
      claimGenerator: "CREAM Provenance Stamper 2.1",
      certificateIssuer: "CREAM Content Credentials (demo CA)",
      assertions: [
        "c2pa.created — Frame Latitude, 2026-09-11T09:22Z",
        "c2pa.contentAuthenticity — AI-generated, declared",
        "cream.assertion.humanCheckpoints — 3 stages with named human decision points",
        "cream.assertion.toolChain — Veo 3, Kling 2.0, Gen-4, FLUX 1.1 Pro, Nuke 16, Resolve 20",
        "cream.assertion.brandTerms — Nirvani Atelier AW26, contract CTR-2026-0912",
      ],
      manifestHash: "sha256:9e21b7c40d8a6f5312c0b7e94d2a6f8013bc5d47e209a6b1c843d7e05f219a6b",
      signedAt: "2026-09-11T09:22:41Z",
    },
    synthid: {
      provider: "mock-synthid",
      embedded: true,
      strength: 0.6,
      payloadId: "syid_7f2a91c4e08b",
      extractable: true,
      lastDetection: { matched: true, confidence: 0.97, at: "2026-09-11T09:23:02Z" },
    },
    visible: {
      platformWatermark: "CREAM",
      creatorWatermark: "Aarav Mehta · Frame Latitude",
      position: "centre-tile",
      opacity: 0.82,
    },
    chainOfCustody: [
      { at: "2026-09-11T09:22:41Z", event: "Generated", actor: "Frame Latitude pipeline" },
      { at: "2026-09-11T09:22:52Z", event: "Human checkpoint signed", actor: "Aarav Mehta" },
      { at: "2026-09-11T09:23:02Z", event: "Watermark embedded and verified", actor: "CREAM Provenance" },
      { at: "2026-09-11T09:24:10Z", event: "Released to brand sandbox", actor: "CREAM" },
    ],
  },
];

/* ── engagements ──────────────────────────────────────────────────────────── */

export const ENGAGEMENTS: Engagement[] = [
  {
    id: "en-aarav-1",
    code: "ENG-2026-0311",
    briefId: "br-monsoon",
    offerId: "of-aarav-monsoon",
    brandId: "bd-nirvani",
    creatorId: "cr-aarav",
    status: "in-production",
    startedAt: "2026-09-06T05:02:00Z",
    dueAt: "2026-09-30T18:00:00Z",
    escrowId: "es-monsoon",
    contractIds: ["ct-monsoon-nda", "ct-monsoon-start"],
    provenance: [],
    rounds: [
      {
        id: "gn-monsoon-0",
        index: 0,
        briefId: "br-monsoon",
        label: "Concept board",
        createdAt: "2026-09-08T10:00:00Z",
        status: "approved",
        toolChain: ["fable", "unreal-engine"],
        promptLineage: [
          "first rain on stone, flat warm grade, 100mm equivalent",
          "handwoven sari in movement, wet specular on stone, no lens flare",
          "end card only: house mark, no partner logos",
        ],
        samples: [
          { id: "s1", title: "Board — opening frame", artSeed: "monsoon-board-open", palette: ["#1b2430", "#c07a45", "#e9d3ae"], aspectRatio: "21:9" },
          { id: "s2", title: "Board — drape study", artSeed: "monsoon-board-drape", palette: ["#20211f", "#b06a3a", "#e2c9a4"], aspectRatio: "4:5" },
          { id: "s3", title: "Board — end card", artSeed: "monsoon-board-end", palette: ["#141518", "#8d6a4a", "#efe3d0"], aspectRatio: "16:9" },
        ],
        feedback: "Board approved. Push warmer by half a stop and lose the blue in the shadows.",
        approvedAt: "2026-09-09T16:20:00Z",
      },
      {
        id: "gn-monsoon-1",
        index: 1,
        briefId: "br-monsoon",
        label: "Round 1 samples",
        createdAt: "2026-09-11T09:20:00Z",
        status: "in-review",
        toolChain: ["unreal-engine", "flux-1-pro", "veo-3", "kling-2", "nuke", "davinci-resolve"],
        promptLineage: [
          "camera path from blockout_cam_v3, 50mm, locked",
          "subject identity sheet nirvani_fw26_a",
          "weather: first monsoon shower, stone specular, no rain-on-glass",
          "excluded: high-gloss beauty lighting, neon, over-saturated",
        ],
        samples: [
          { id: "s1", title: "Sample 01 — first shower", artSeed: "monsoon-r1-01", palette: ["#1a2028", "#c97d43", "#ecd9b8"], aspectRatio: "21:9" },
          { id: "s2", title: "Sample 02 — drape", artSeed: "monsoon-r1-02", palette: ["#22201d", "#b87244", "#e8d2ae"], aspectRatio: "21:9" },
          { id: "s3", title: "Sample 03 — street level", artSeed: "monsoon-r1-03", palette: ["#161d22", "#2f6d7a", "#e0a15c"], aspectRatio: "21:9" },
          { id: "s4", title: "Sample 04 — end card", artSeed: "monsoon-r1-04", palette: ["#121316", "#8f6b4c", "#f1e6d4"], aspectRatio: "21:9" },
        ],
        feedback: null,
        approvedAt: null,
      },
    ],
  },
  {
    id: "en-rohan-1",
    code: "ENG-2026-0288",
    briefId: "br-undertone",
    offerId: "of-rohan-placeholder",
    brandId: "bd-halcyon",
    creatorId: "cr-rohan",
    status: "delivered",
    startedAt: "2026-08-14T06:00:00Z",
    dueAt: "2026-08-29T18:00:00Z",
    escrowId: null,
    contractIds: [],
    provenance: [],
    rounds: [
      {
        id: "gn-undertone-1",
        index: 1,
        briefId: "br-undertone",
        label: "Round 1 samples",
        createdAt: "2026-08-17T11:00:00Z",
        status: "approved",
        toolChain: ["flux-1-pro", "recraft-v3", "magnific-upscaler", "davinci-resolve"],
        promptLineage: ["constant 5600K softbox key, no drift", "bottle geometry locked from client packshot"],
        samples: [
          { id: "s1", title: "Hook matrix A", artSeed: "perf-hook-a", palette: ["#1b1d24", "#e08b5c", "#f2e2c8"], aspectRatio: "9:16" },
          { id: "s2", title: "Hook matrix B", artSeed: "perf-hook-b", palette: ["#191b21", "#7fb0e8", "#eef0f4"], aspectRatio: "9:16" },
          { id: "s3", title: "Hook matrix C", artSeed: "perf-hook-c", palette: ["#1e1a1c", "#c76b8a", "#f0dde4"], aspectRatio: "9:16" },
        ],
        feedback: "B won on CTR by 34%. Killed the rest, released as final.",
        approvedAt: "2026-08-26T11:30:00Z",
      },
    ],
  },
];

/* ── reviews ──────────────────────────────────────────────────────────────── */

export const REVIEWS: Review[] = [
  {
    id: "rv-1",
    creatorId: "cr-aarav",
    brandName: "Nirvani Atelier",
    rating: 5,
    body: "We had been burned twice by agencies who promised a rain shoot and delivered a blue filter. Aarav blocked the camera before anything was generated, and the result held up on a cinema screen, which none of ours had.",
    at: "2026-08-14",
    engagementCode: "ENG-2025-0244",
    verified: true,
  },
  {
    id: "rv-2",
    creatorId: "cr-aarav",
    brandName: "Vayu Motors",
    rating: 5,
    body: "Handed over CAD on day one, got a launch film on day nine. The vehicle never moved by a millimetre, which was the only thing we actually cared about.",
    at: "2026-06-02",
    engagementCode: "ENG-2026-0121",
    verified: true,
  },
  {
    id: "rv-3",
    creatorId: "cr-ishita",
    brandName: "Halcyon",
    rating: 5,
    body: "Six undertones, one lighting rig, zero bottle drift. She rejected more of her own work than we would have. That is why we came back.",
    at: "2026-09-16",
    engagementCode: "ENG-2026-0302",
    verified: true,
  },
  {
    id: "rv-4",
    creatorId: "cr-diya",
    brandName: "Mehra Jewellers",
    rating: 5,
    body: "The clasp detail at 200% is the only reason this brief is worth discussing. Nobody else sends work that survives being looked at properly.",
    at: "2026-07-22",
    engagementCode: "ENG-2026-0187",
    verified: true,
  },
  {
    id: "rv-5",
    creatorId: "cr-tara",
    brandName: "Chai Republic",
    rating: 5,
    body: "She built a motion grammar in week one and then produced forty assets in week two that all looked related. Our brand team has stopped reviewing assets individually.",
    at: "2026-08-30",
    engagementCode: "ENG-2026-0266",
    verified: true,
  },
  {
    id: "rv-6",
    creatorId: "cr-rehan",
    brandName: "Nova Studios",
    rating: 4,
    body: "Clearance paperwork is immaculate — I have never had to chase a rights document. One round took longer than quoted because of our own late script change, which was not on them.",
    at: "2026-05-19",
    engagementCode: "ENG-2026-0093",
    verified: true,
  },
  {
    id: "rv-7",
    creatorId: "cr-rohan",
    brandName: "Vayu Motors",
    rating: 5,
    body: "Sent a hook matrix, killed her own favourite on day four because the number said so. Refreshing to work with someone who will tell you the good idea is not working.",
    at: "2026-07-04",
    engagementCode: "ENG-2026-0158",
    verified: true,
  },
  {
    id: "rv-8",
    creatorId: "cr-nikhil",
    brandName: "Ironwood Interactive",
    rating: 4,
    body: "Camera paths came out of our own level and conformed back into the engine. Two sequences needed an extra up-res pass, but the design team approved everything we captured.",
    at: "2026-04-28",
    engagementCode: "ENG-2026-0044",
    verified: true,
  },
  {
    id: "rv-9",
    creatorId: "cr-priya",
    brandName: "Kettle & Co",
    rating: 5,
    body: "The first agency we spoke to offered to 'even out' skin tones. Priya wrote that into her terms as a rejection condition before we had even asked.",
    at: "2026-08-08",
    engagementCode: "ENG-2026-0240",
    verified: true,
  },
  {
    id: "rv-10",
    creatorId: "cr-ishita",
    brandName: "Aurum Fragrances",
    rating: 4,
    body: "Turnaround slipped two days when we changed the bottle, but the change was ours and she flagged it before starting rather than after.",
    at: "2026-03-11",
    engagementCode: "ENG-2026-0022",
    verified: true,
  },
  {
    id: "rv-11",
    creatorId: "cr-kabir",
    brandName: "Voltedge",
    rating: 5,
    body: "Housing, ports, tolerances — identical to the CAD across 41 renders. Our engineering team checked, which never happens.",
    at: "2026-06-30",
    engagementCode: "ENG-2026-0145",
    verified: true,
  },
  {
    id: "rv-12",
    creatorId: "cr-vikram",
    brandName: "Meridian Capital",
    rating: 4,
    body: "Compliance wrote this brief to be uncreative. He made it uncreative and legible at the same time, which is genuinely hard.",
    at: "2026-08-21",
    engagementCode: "ENG-2026-0273",
    verified: true,
  },
  {
    id: "rv-13",
    creatorId: "cr-yuki",
    brandName: "Lumen Learning",
    rating: 5,
    body: "Fourteen frames, one line weight, one ink. It looks screen-printed and it is entirely synthesised. Nobody in the studio could say how.",
    at: "2026-05-30",
    engagementCode: "ENG-2026-0110",
    verified: true,
  },
  {
    id: "rv-14",
    creatorId: "cr-samar",
    brandName: "Private client",
    rating: 5,
    body: "Two hundred and forty guests, none of whom knew a single pixel was synthetic. Delivered nine hours before the reception.",
    at: "2026-07-07",
    engagementCode: "ENG-2026-0132",
    verified: true,
  },
  {
    id: "rv-15",
    creatorId: "cr-ananya",
    brandName: "Foxglove Animation",
    rating: 4,
    body: "The character survived forty shots. We tested it with prompts she had never seen, which is the only test that counts.",
    at: "2026-06-14",
    engagementCode: "ENG-2026-0129",
    verified: true,
  },
  {
    id: "rv-16",
    creatorId: "cr-meera",
    brandName: "Chai Republic",
    rating: 5,
    body: "The steam is the whole thing. Our food photographer asked who shot it and could not believe the answer.",
    at: "2026-08-25",
    engagementCode: "ENG-2026-0259",
    verified: true,
  },
];

export function reviewsFor(creatorId: string) {
  return REVIEWS.filter((r) => r.creatorId === creatorId);
}