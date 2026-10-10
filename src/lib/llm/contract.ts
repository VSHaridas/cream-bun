import type {
  AspectRatioId,
  BriefDeliverable,
  ContentType,
  CommercialUse,
} from "@/lib/domain/types";

/* ── the assistant's structured output contract ───────────────────────────── */

export interface ExtractedBrief {
  campaignObjective: string | null;
  rawIdea: string | null;
  audience: string | null;
  tone: string[];
  styleTags: string[];
  referenceNotes: string[];
  excludedStyles: string[];
  contentTypes: ContentType[];
  aspectRatios: AspectRatioId[];
  deliverables: BriefDeliverable[];
  commercialUse: Partial<CommercialUse> | null;
  budgetMinInr: number | null;
  budgetMaxInr: number | null;
  budgetModel: "fixed" | "day-rate" | "milestone" | null;
  turnaroundDays: number | null;
  revisionsIncluded: number | null;
  conceptRoundsIncluded: number | null;
  targetChannels: string[];
  /** Fields the assistant believes are still unknown, most important first. */
  missing: MissingField[];
}

export type MissingField =
  | "objective"
  | "audience"
  | "contentType"
  | "format"
  | "style"
  | "rights"
  | "budget"
  | "timeline"
  | "deliverables";

export const MISSING_META: Record<MissingField, { label: string; ask: string; why: string }> = {
  objective: {
    label: "Campaign objective",
    ask: "What has to be true after someone sees this? A launch, a recall lift, a sell-through — whichever one you are actually measuring.",
    why: "Without an objective the assistant cannot tell you whether a beautiful result is a useful result.",
  },
  audience: {
    label: "Audience",
    ask: "Who is watching, and what do they already believe about you?",
    why: "Audience decides format and tone far more reliably than any style adjective.",
  },
  contentType: {
    label: "Content type",
    ask: "What are we making — a film, stills, a motion set, audio?",
    why: "This is the single largest determinant of which creators can even quote.",
  },
  format: {
    label: "Format",
    ask: "Where does this live? That decides the aspect ratio.",
    why: "A creator pricing a 16:9 film is quoting a different job to one pricing a 9:16 cutdown.",
  },
  style: {
    label: "Style",
    ask: "Show me a reference. A campaign you liked, a film you remember, even a mood. Anything except an adjective.",
    why: "Adjectives resolve differently in every model's head. References do not.",
  },
  rights: {
    label: "Commercial rights",
    ask: "Where does this run, for how long, and can you pay to promote it?",
    why: "Rights are the difference between a ₹1L job and a ₹4L job. Leaving this vague is how disputes start.",
  },
  budget: {
    label: "Budget",
    ask: "What range is workable? Even a rough band helps — it stops creators wasting your time.",
    why: "A brief with no budget surfaces only the creators desperate for work.",
  },
  timeline: {
    label: "Timeline",
    ask: "When does it need to exist, and when do you need to first see something?",
    why: "Deadlines are where brief quality usually collapses. A date is a hard constraint.",
  },
  deliverables: {
    label: "Deliverables",
    ask: "How many, in which formats, and how long?",
    why: "Quantity drives cost more than any other single variable.",
  },
};

export interface BriefTurnRequest {
  messages: { role: "user" | "assistant"; text: string }[];
  draft: Partial<BriefDraft>;
  brandName: string;
  brandIndustry: string;
  /**
   * Chosen in the UI from the model's own catalogue. There is no default
   * compiled into the adapter — an id the API does not offer is refused.
   */
  model?: string | null;
}

export interface BriefTurnResponse {
  reply: string;
  /** Structured fields the assistant wrote during this turn. */
  extracted: ExtractedBrief;
  /** Merged draft to hand back to the client. */
  draft: BriefDraft;
  fieldsFilledThisTurn: string[];
  progress: number;
  simulated: boolean;
  model: string;
}

export interface BriefDraft {
  campaignObjective: string;
  audience: string;
  tone: string[];
  styleTags: string[];
  referenceNotes: string[];
  excludedStyles: string[];
  contentTypes: ContentType[];
  aspectRatios: AspectRatioId[];
  deliverables: BriefDeliverable[];
  /**
   * Territory is deliberately nullable at draft time. Pre-filling a default
   * would show the brand a rights position they never agreed to, which is
   * exactly the class of quiet assumption this product exists to eliminate.
   */
  commercialUse: Omit<CommercialUse, "territory"> & {
    territory: CommercialUse["territory"] | "";
  };
  budgetMinInr: number;
  budgetMaxInr: number;
  turnaroundDays: number;
  revisionsIncluded: number;
  conceptRoundsIncluded: number;
  targetChannels: string[];
  rawIdea: string;
}

export const EMPTY_DRAFT: BriefDraft = {
  campaignObjective: "",
  audience: "",
  tone: [],
  styleTags: [],
  referenceNotes: [],
  excludedStyles: [],
  contentTypes: [],
  aspectRatios: [],
  deliverables: [],
  commercialUse: {
    licenseType: "non-exclusive",
    territory: "",
    durationMonths: null,
    perpetual: false,
    channels: [],
    paidMediaAllowed: false,
    modelTrainingAllowed: false,
    derivativeWorksAllowed: true,
    sublicensingAllowed: false,
    resaleAllowed: false,
    competitorUseBlocked: false,
    disclosurePolicy: "platform-disclosure",
  },
  budgetMinInr: 0,
  budgetMaxInr: 0,
  turnaroundDays: 0,
  revisionsIncluded: 0,
  conceptRoundsIncluded: 0,
  targetChannels: [],
  rawIdea: "",
};