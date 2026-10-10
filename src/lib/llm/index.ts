import { EMPTY_DRAFT, type BriefTurnRequest, type BriefTurnResponse } from "./contract";
import {
  discoverModels,
  geminiAvailable,
  resolveModel,
  runGeminiTurn,
  translateBriefForCreator,
  type GeminiModel,
} from "./gemini";
import { runDeterministicTurn } from "./reasoner";

export * from "./contract";
export {
  runDeterministicTurn,
  SUGGESTION_POOL,
  draftReadout,
  missingFields,
  progressOf,
} from "./reasoner";
export { geminiAvailable, discoverModels };
export type { GeminiModel };

/**
 * Single entry point for the conversational engine. Live when a key exists,
 * deterministic otherwise, identical contract either way.
 */
export async function runBriefTurn(input: BriefTurnRequest): Promise<BriefTurnResponse> {
  const normalised: BriefTurnRequest = {
    ...input,
    draft: { ...EMPTY_DRAFT, ...input.draft },
  };
  if (geminiAvailable()) {
    const live = await runGeminiTurn(normalised);
    if (live) return live;
  }
  return runDeterministicTurn(normalised);
}

export async function listModels(): Promise<{
  models: GeminiModel[];
  source: "api" | "unavailable";
  reason: string | null;
}> {
  if (!geminiAvailable()) {
    return {
      models: [],
      source: "unavailable",
      reason: "No GEMINI_API_KEY, so there is nothing to enumerate. The brief builder is running on the deterministic extractor.",
    };
  }
  try {
    const models = await discoverModels();
    return {
      models,
      source: "api",
      reason: models.length
        ? null
        : "The API returned no model this key can call with generateContent.",
    };
  } catch (error) {
    return {
      models: [],
      source: "unavailable",
      reason:
        error instanceof Error
          ? `The model catalogue could not be read: ${error.message}`
          : "The model catalogue could not be read.",
    };
  }
}

export async function translateForCreator(input: {
  briefText: string;
  creatorName: string;
  brandName: string;
  conversation: { role: string; text: string }[];
  model?: string | null;
}) {
  const live = await translateBriefForCreator(input);
  if (live) return live;
  return { text: fallbackTranslation(input), simulated: true, model: await resolveModel(input.model).then((m) => m?.id ?? null) };
}

/** Preserves every constraint when the model is unavailable. */
function fallbackTranslation(input: {
  briefText: string;
  creatorName: string;
  brandName: string;
}): string {
  const first = input.creatorName.split(" ")[0];
  return [
    `${first} — here is what ${input.brandName} actually asked for, with the parts they were vague about called out.`,
    "",
    input.briefText.trim(),
    "",
    "What they did not specify, and where I have assumed: review count is unstated, so the revision cap in the contract governs. Delivery format is unstated, so masters plus review proxies is assumed. Talent, location and casting are unstated — send us a reference and we will price against it rather than guess.",
  ].join("\n");
}