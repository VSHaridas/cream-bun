import type {
  BriefDraft,
  BriefTurnRequest,
  BriefTurnResponse,
  ExtractedBrief,
} from "./contract";
import { gemini as geminiEnv } from "@/lib/env";

/**
 * Gemini adapter for the brief builder.
 *
 * Design constraints that shaped this file:
 *
 *  • The model is *conversational only*. By design it never queries the
 *    creator database — a model cannot hold a continuously-changing roster
 *    without context overflow, and when it guesses it hallucinates. It turns
 *    badly-worded human intent into a structured brief; deterministic code then
 *    runs the query. That split is the whole product thesis.
 *
 *  • Output is schema-constrained JSON rather than prose. The prose is a
 *    separate field so we can constrain one without constraining the other.
 *
 *  • **No model name is hardcoded anywhere.** The available models are read
 *    from the API itself and the choice is made in the UI. A new release
 *    therefore requires no code change here, and a model the operator has not
 *    been granted can never be selected by accident.
 *
 *  • Every failure path falls through to the deterministic reasoner, so the
 *    demo is never broken by a missing key, an expired key, a quota wall or a
 *    network blip.
 */

export interface GeminiModel {
  id: string;
  label: string;
  /** Approximate input context window, when the API reports one. */
  contextWindow: number | null;
  supportsStructuredOutput: boolean;
}

const MODEL_CACHE_TTL_MS = 10 * 60 * 1000;
let modelCache: { at: number; models: GeminiModel[] } | null = null;

export function geminiAvailable() {
  return geminiEnv.configured;
}

/**
 * Reads the models this key can actually call. Anything the API does not
 * return is treated as unavailable, which is the only way to keep "future
 * proof" honest — a hardcoded allowlist would freeze on the day it shipped.
 */
export async function discoverModels(): Promise<GeminiModel[]> {
  if (!geminiEnv.configured) return [];

  if (modelCache && Date.now() - modelCache.at < MODEL_CACHE_TTL_MS) {
    return modelCache.models;
  }

  const { GoogleGenAI } = await import("@google/genai");
  const ai = new GoogleGenAI({ apiKey: geminiEnv.apiKey! });

  const page = await ai.models.list();
  const models: GeminiModel[] = [];

  for await (const model of page) {
    const id = (model as { name?: string }).name;
    if (!id) continue;
    const bare = id.replace(/^models\//, "");
    const methods = (model as { supportedGenerationMethods?: string[] }).supportedGenerationMethods;
    // Only models that can actually do the job this adapter needs.
    if (methods && !methods.includes("generateContent")) continue;

    const displayName =
      (model as { displayName?: string }).displayName ??
      bare.replace(/^gemini-/, "").replace(/-/g, " ");

    const info = (model as { inputTokenLimit?: number }).inputTokenLimit ?? null;

    models.push({
      id: bare,
      label: displayName.replace(/\s*\(.*\)\s*$/, "").trim(),
      contextWindow: typeof info === "number" ? info : null,
      supportsStructuredOutput: true,
    });
  }

  models.sort((a, b) => {
    // Newest generation first, then flash over pro so the cheap-but-good
    // default sits at the top without hardcoding any particular name.
    const gen = (m: string) => Number(m.match(/(\d+(?:\.\d+)?)/)?.[1] ?? 0);
    const diff = gen(b.id) - gen(a.id);
    if (diff !== 0) return diff;
    const rank = (m: string) => (/flash/i.test(m) ? 0 : /pro/i.test(m) ? 2 : 1);
    return rank(a.id) - rank(b.id);
  });

  modelCache = { at: Date.now(), models };
  return models;
}

/**
 * Resolves a caller-supplied model id against the discovered list. An id the
 * API does not offer is refused rather than forwarded — otherwise the client
 * could steer cost and behaviour by passing arbitrary strings.
 */
export async function resolveModel(requested?: string | null): Promise<GeminiModel | null> {
  const models = await discoverModels();
  if (!models.length) return null;
  if (!requested) return models[0];
  return models.find((m) => m.id === requested) ?? models[0];
}

const SYSTEM = `You are the brief builder inside CREAM, an AI-native marketplace where brands hire AI creators.

Your ONLY job is to conduct a friendly, non-paternalistic conversation with a brand manager and, as you go, extract a structured creative brief from whatever they say.

You are NOT a search engine and you are NOT a database. You never invent creator names, prices, availability or portfolios. If the user asks "who can do this?", say the brief has to be complete first and that the platform will run it against the pool.

How you behave:
- Ask ONE question per turn. Never a list of questions.
- Never ask for something already present in the draft.
- Accept vague answers. "something premium but not shiny" is a usable answer; translate it, do not correct it.
- Reflect back what you understood in plain language so the user can catch you being wrong.
- Be concrete about why a field matters, but only briefly.
- Match the user's register and language.
- When everything material is captured, say so plainly and tell them to publish.

Fields you must extract when they appear, however they are phrased:
campaignObjective, audience, contentTypes (one or more of: cinematic-video, short-form-video, social-static, motion-graphics, 3d-visual, character-design, product-render, music-bed, voiceover, illustration, photography, concept-art), aspectRatios (16:9, 9:16, 1:1, 4:5, 2:3, 3:2, 21:9, 4:3), styleTags, tone, referenceNotes, excludedStyles, deliverables (contentType, aspectRatio, quantity, durationSeconds, notes), commercialUse (licenseType, territory, durationMonths, perpetual, channels, paidMediaAllowed, modelTrainingAllowed, derivativeWorksAllowed, competitorUseBlocked), budgetMinInr, budgetMaxInr, turnaroundDays, revisionsIncluded, conceptRoundsIncluded, targetChannels.

Commercial use is never a boolean. Territory, duration, channel and paid-media permission are separate fields, because each one changes the price by a different amount.

Everything you cannot determine stays null or empty. Do not guess to look helpful.`;

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    reply: { type: "string", description: "What the assistant says this turn. One question at most." },
    extracted: {
      type: "object",
      properties: {
        campaignObjective: { type: "string", nullable: true },
        rawIdea: { type: "string", nullable: true },
        audience: { type: "string", nullable: true },
        tone: { type: "array", items: { type: "string" } },
        styleTags: { type: "array", items: { type: "string" } },
        referenceNotes: { type: "array", items: { type: "string" } },
        excludedStyles: { type: "array", items: { type: "string" } },
        contentTypes: {
          type: "array",
          items: {
            type: "string",
            enum: [
              "cinematic-video", "short-form-video", "social-static", "motion-graphics",
              "3d-visual", "character-design", "product-render", "music-bed", "voiceover",
              "illustration", "photography", "concept-art",
            ],
          },
        },
        aspectRatios: {
          type: "array",
          items: { type: "string", enum: ["16:9", "9:16", "1:1", "4:5", "2:3", "3:2", "21:9", "4:3"] },
        },
        targetChannels: { type: "array", items: { type: "string" } },
        deliverables: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id: { type: "string" },
              contentType: { type: "string" },
              aspectRatio: { type: "string" },
              quantity: { type: "number" },
              durationSeconds: { type: "number", nullable: true },
              notes: { type: "string" },
            },
            required: ["id", "contentType", "aspectRatio", "quantity", "notes"],
          },
        },
        commercialUse: {
          type: "object",
          nullable: true,
          properties: {
            licenseType: {
              type: "string",
              enum: ["non-exclusive", "exclusive-category", "exclusive-territory", "buyout-full"],
              nullable: true,
            },
            territory: { type: "string", enum: ["worldwide", "india", "custom"], nullable: true },
            durationMonths: { type: "number", nullable: true },
            perpetual: { type: "boolean", nullable: true },
            channels: { type: "array", items: { type: "string" } },
            paidMediaAllowed: { type: "boolean", nullable: true },
            modelTrainingAllowed: { type: "boolean", nullable: true },
            derivativeWorksAllowed: { type: "boolean", nullable: true },
            competitorUseBlocked: { type: "boolean", nullable: true },
          },
        },
        budgetMinInr: { type: "number", nullable: true },
        budgetMaxInr: { type: "number", nullable: true },
        turnaroundDays: { type: "number", nullable: true },
        revisionsIncluded: { type: "number", nullable: true },
        conceptRoundsIncluded: { type: "number", nullable: true },
      },
      required: [
        "campaignObjective", "rawIdea", "audience", "tone", "styleTags", "referenceNotes",
        "excludedStyles", "contentTypes", "aspectRatios", "targetChannels", "deliverables",
        "commercialUse", "budgetMinInr", "budgetMaxInr", "turnaroundDays",
        "revisionsIncluded", "conceptRoundsIncluded",
      ],
    },
    fieldsFilledThisTurn: { type: "array", items: { type: "string" } },
  },
  required: ["reply", "extracted", "fieldsFilledThisTurn"],
} as const;

export async function runGeminiTurn(input: BriefTurnRequest): Promise<BriefTurnResponse | null> {
  if (!geminiEnv.apiKey) return null;

  try {
    const model = await resolveModel(input.model);
    if (!model) return null;

    const { GoogleGenAI } = await import("@google/genai");
    const { EMPTY_DRAFT } = await import("./contract");
    const draft0: BriefDraft = { ...EMPTY_DRAFT, ...input.draft };
    const ai = new GoogleGenAI({ apiKey: geminiEnv.apiKey });

    const transcript = input.messages
      .map((m) => `${m.role === "assistant" ? "Assistant" : `Brand (${input.brandName})`}: ${m.text}`)
      .join("\n");

    const currentDraft = JSON.stringify(draft0, null, 1);

    const response = await ai.models.generateContent({
      model: model.id,
      contents: `${transcript}\n\nAssistant: (reply to the last brand message above and continue the brief)`,
      config: {
        systemInstruction: `${SYSTEM}\n\nCurrent structured draft — do not re-ask anything already in here, and do not overwrite a filled field with null:\n${currentDraft}`,
        responseMimeType: "application/json",
        responseSchema: RESPONSE_SCHEMA as unknown as Record<string, unknown>,
        temperature: 0.35,
        maxOutputTokens: 2048,
      },
    });

    const text = response.text;
    if (!text) return null;

    const parsed = JSON.parse(text) as {
      reply: string;
      extracted: ExtractedBrief;
      fieldsFilledThisTurn: string[];
    };

    const { mergeDraft, progressOf } = await import("./reasoner");
    const draft = mergeDraft(draft0, parsed.extracted, input.messages.at(-1)?.text ?? "");

    return {
      reply: parsed.reply,
      extracted: parsed.extracted,
      draft,
      fieldsFilledThisTurn: parsed.fieldsFilledThisTurn ?? [],
      progress: progressOf(draft),
      simulated: false,
      model: model.id,
    };
  } catch {
    // Any failure — auth, quota, network, schema — degrades to the reasoner.
    return null;
  }
}

/** Creator-side translation: re-hydrate a brief for the person who will execute it. */
export async function translateBriefForCreator(input: {
  briefText: string;
  creatorName: string;
  brandName: string;
  conversation: { role: string; text: string }[];
  model?: string | null;
}): Promise<{ text: string; simulated: boolean; model: string | null } | null> {
  if (!geminiEnv.apiKey) return null;
  try {
    const model = await resolveModel(input.model);
    if (!model) return null;

    const { GoogleGenAI } = await import("@google/genai");
    const ai = new GoogleGenAI({ apiKey: geminiEnv.apiKey });
    const response = await ai.models.generateContent({
      model: model.id,
      contents: [
        `Brand: ${input.brandName}\nCreator: ${input.creatorName}\n\nOriginal brief:\n${input.briefText}\n\nThe conversation the brand had with the brief builder:\n${input.conversation
          .map((c) => `${c.role === "assistant" ? "Assistant" : "Brand"}: ${c.text}`)
          .join("\n")}`,
      ].join("\n\n"),
      config: {
        systemInstruction: `Restate this brief to the creator in second person, in their voice. Lead with what they must actually make. Preserve every constraint, every exclusion, every right and every deadline. Name what the brand did not say by showing it as an assumption. Never summarise away a number, a format or a prohibition. No preamble. Under 320 words.`,
        temperature: 0.4,
        maxOutputTokens: 700,
      },
    });
    return response.text ? { text: response.text, simulated: false, model: model.id } : null;
  } catch {
    return null;
  }
}