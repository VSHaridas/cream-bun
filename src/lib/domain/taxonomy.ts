import type { ModelRef, SkillCategory, Tool, ToolCategory } from "./types";

/**
 * The CREAM taxonomy. Every value here is vendor-neutral and category-aware so
 * that the discovery layer can build faceted counts without string-matching on
 * free text. Adding a tool is a one-line change and flows through search,
 * filtering, briefs and verification automatically.
 */

export const TOOLS: Tool[] = [
  { id: "runway-gen4", name: "Runway Gen-4", vendor: "Runway", category: "generation", verified: true, verifiedVia: "vendor-credential", hoursLogged: 940, accent: "#7c6cff" },
  { id: "runway-aleph", name: "Runway Aleph", vendor: "Runway", category: "motion", verified: true, verifiedVia: "vendor-credential", hoursLogged: 310, accent: "#8f7dff" },
  { id: "veo-3", name: "Veo 3", vendor: "Google DeepMind", category: "generation", verified: true, verifiedVia: "vendor-credential", hoursLogged: 420, accent: "#5fa8ff" },
  { id: "sora-2", name: "Sora 2", vendor: "OpenAI", category: "generation", verified: true, verifiedVia: "telemetry", hoursLogged: 260, accent: "#59d3b0" },
  { id: "kling-2", name: "Kling 2.0", vendor: "Kuaishou", category: "generation", verified: true, verifiedVia: "telemetry", hoursLogged: 610, accent: "#ff8f5e" },
  { id: "hailuo-director", name: "Hailuo Director", vendor: "MiniMax", category: "motion", verified: true, verifiedVia: "vendor-credential", hoursLogged: 180, accent: "#ff6f91" },
  { id: "luma-ray2", name: "Luma Ray2", vendor: "Luma AI", category: "generation", verified: true, verifiedVia: "telemetry", hoursLogged: 145, accent: "#ffd166" },
  { id: "midjourney-v7", name: "Midjourney v7", vendor: "Midjourney", category: "generation", verified: true, verifiedVia: "vendor-credential", hoursLogged: 1320, accent: "#c98cff" },
  { id: "flux-1-pro", name: "FLUX 1.1 Pro", vendor: "Black Forest Labs", category: "generation", verified: true, verifiedVia: "telemetry", hoursLogged: 880, accent: "#9ad1ff" },
  { id: "imagen-4", name: "Imagen 4", vendor: "Google DeepMind", category: "generation", verified: true, verifiedVia: "vendor-credential", hoursLogged: 390, accent: "#7ad9c0" },
  { id: "sd4", name: "Stable Diffusion 4", vendor: "Stability AI", category: "generation", verified: false, verifiedVia: "usage-attestation", hoursLogged: 760, accent: "#ff9ec7" },
  { id: "recraft-v3", name: "Recraft V3", vendor: "Recraft", category: "generation", verified: true, verifiedVia: "vendor-credential", hoursLogged: 240, accent: "#ff6f4e" },
  { id: "topaz-video", name: "Topaz Video AI", vendor: "Topaz Labs", category: "upscale", verified: true, verifiedVia: "vendor-credential", hoursLogged: 520, accent: "#b9c6ff" },
  { id: "magnific-upscaler", name: "Magnific Upscaler", vendor: "Magnific", category: "upscale", verified: true, verifiedVia: "telemetry", hoursLogged: 165, accent: "#ffd6a1" },
  { id: "comfyui", name: "ComfyUI", vendor: "Open source", category: "orchestration", verified: true, verifiedVia: "telemetry", hoursLogged: 1090, accent: "#8de0c8" },
  { id: "davinci-resolve", name: "DaVinci Resolve 20", vendor: "Blackmagic", category: "editing", verified: true, verifiedVia: "vendor-credential", hoursLogged: 1450, accent: "#7ab8ff" },
  { id: "premiere-pro", name: "Premiere Pro 2026", vendor: "Adobe", category: "editing", verified: true, verifiedVia: "vendor-credential", hoursLogged: 1180, accent: "#a78bfa" },
  { id: "after-effects", name: "After Effects 2026", vendor: "Adobe", category: "motion", verified: true, verifiedVia: "vendor-credential", hoursLogged: 1620, accent: "#ff9f6f" },
  { id: "nuke", name: "Nuke 16", vendor: "Foundry", category: "compositing", verified: true, verifiedVia: "vendor-credential", hoursLogged: 210, accent: "#e0d3a8" },
  { id: "unreal-engine", name: "Unreal Engine 5.6", vendor: "Epic", category: "3d", verified: true, verifiedVia: "vendor-credential", hoursLogged: 690, accent: "#8ea2ff" },
  { id: "blender", name: "Blender 4.4", vendor: "Blender Foundation", category: "3d", verified: true, verifiedVia: "telemetry", hoursLogged: 830, accent: "#f0a35e" },
  { id: "houdini", name: "Houdini 21", vendor: "SideFX", category: "3d", verified: true, verifiedVia: "vendor-credential", hoursLogged: 275, accent: "#c78bff" },
  { id: "civitai-models", name: "CivitAI custom checkpoints", vendor: "CivitAI", category: "generation", verified: false, verifiedVia: "usage-attestation", hoursLogged: 340, accent: "#ff8fa8" },
  { id: "suno-v5", name: "Suno v5", vendor: "Suno", category: "audio", verified: true, verifiedVia: "vendor-credential", hoursLogged: 95, accent: "#ffb36b" },
  { id: "udio", name: "Udio", vendor: "Uncharted Labs", category: "audio", verified: true, verifiedVia: "vendor-credential", hoursLogged: 60, accent: "#8bd6ff" },
  { id: "elevenlabs", name: "ElevenLabs v3", vendor: "ElevenLabs", category: "audio", verified: true, verifiedVia: "vendor-credential", hoursLogged: 190, accent: "#c6b6ff" },
  { id: "cavalry", name: "Cavalry", vendor: "cavalry.ai", category: "orchestration", verified: false, verifiedVia: "usage-attestation", hoursLogged: 75, accent: "#9ee8c8" },
  { id: "domoai", name: "DomoAI", vendor: "DomoAI", category: "orchestration", verified: true, verifiedVia: "vendor-credential", hoursLogged: 130, accent: "#ffc48a" },
  { id: "fable", name: "Fable Studio", vendor: "Fable", category: "motion", verified: true, verifiedVia: "vendor-credential", hoursLogged: 105, accent: "#d0a6ff" },
];

export const TOOL_CATEGORY_LABEL: Record<ToolCategory, string> = {
  generation: "Generation",
  editing: "Editing",
  motion: "Motion",
  "3d": "3D",
  audio: "Audio",
  orchestration: "Orchestration",
  upscale: "Upscale / finish",
  compositing: "Compositing",
};

export const MODELS: ModelRef[] = [
  { id: "veo-3", name: "Veo 3", vendor: "Google DeepMind", kind: "video", verified: true },
  { id: "gen-4", name: "Gen-4 Aleph", vendor: "Runway", kind: "video", verified: true },
  { id: "sora-2", name: "Sora 2", vendor: "OpenAI", kind: "video", verified: true },
  { id: "kling-2", name: "Kling 2.0", vendor: "Kuaishou", kind: "video", verified: true },
  { id: "seedance", name: "Seedance 1.0 Pro", vendor: "ByteDance", kind: "video", verified: true },
  { id: "luma-ray2", name: "Ray2", vendor: "Luma AI", kind: "video", verified: true },
  { id: "midjourney", name: "Midjourney v7", vendor: "Midjourney", kind: "image", verified: true },
  { id: "flux", name: "FLUX 1.1 Pro", vendor: "BFL", kind: "image", verified: true },
  { id: "imagen", name: "Imagen 4", vendor: "Google", kind: "image", verified: true },
  { id: "recraft", name: "Recraft V3", vendor: "Recraft", kind: "image", verified: true },
  { id: "gemini-25", name: "Gemini 2.5 Pro", vendor: "Google", kind: "text", verified: true },
  { id: "sdxl-ft", name: "SDXL fine-tunes", vendor: "Community", kind: "image", verified: false },
];

export const SKILL_TAXONOMY: { id: string; name: string; category: SkillCategory }[] = [
  { id: "art-direction", name: "Art direction", category: "direction" },
  { id: "look-dev", name: "Look development", category: "direction" },
  { id: "visual-language", name: "Visual language systems", category: "direction" },
  { id: "prompt-craft", name: "Prompt craft", category: "prompt-engineering" },
  { id: "model-orchestration", name: "Multi-model orchestration", category: "prompt-engineering" },
  { id: "character-consistency", name: "Character consistency", category: "prompt-engineering" },
  { id: "seed-reproducibility", name: "Reproducible generation", category: "prompt-engineering" },
  { id: "compositing", name: "Compositing", category: "compositing" },
  { id: "rotoscoping", name: "Roto & cleanup", category: "compositing" },
  { id: "nuke-grading", name: "Nuke look development", category: "compositing" },
  { id: "conform", name: "Conform & versioning", category: "editing" },
  { id: "sound-design", name: "Sound design", category: "sound" },
  { id: "music-supervision", name: "Music supervision", category: "sound" },
  { id: "voice-direction", name: "Voice direction", category: "sound" },
  { id: "colour-grading", name: "Colour grading", category: "colour" },
  { id: "skin-tone-realism", name: "Skin-tone & texture realism", category: "colour" },
  { id: "brand-colour-systems", name: "Brand colour systems", category: "colour" },
  { id: "script-structure", name: "Script structure", category: "story" },
  { id: "narrative-design", name: "Narrative design", category: "story" },
  { id: "concept-development", name: "Concept development", category: "story" },
  { id: "shot-planning", name: "Shot planning & previz", category: "production" },
  { id: "virtual-production", name: "Virtual production", category: "production" },
  { id: "deliverable-qc", name: "Deliverable QC", category: "production" },
];

export const SKILL_NAME_BY_ID = new Map(SKILL_TAXONOMY.map((s) => [s.id, s.name]));

export const SPECIALIZATIONS = [
  "Fashion & apparel",
  "Beauty & skincare",
  "Automotive",
  "FMCG & food",
  "Real estate & interiors",
  "Travel & hospitality",
  "Fitness & wellness",
  "Finance & fintech",
  "Healthcare",
  "Gaming & esports",
  "Entertainment & streaming",
  "Luxury & spirits",
  "Consumer electronics",
  "Sustainability & energy",
  "Education & edtech",
  "Retail & e-commerce",
  "Sportswear",
  "Jewellery & watches",
] as const;

export const INDUSTRIES = [
  "Fashion",
  "Beauty",
  "Automotive",
  "FMCG",
  "Real estate",
  "Travel",
  "Fitness",
  "Fintech",
  "Healthcare",
  "Gaming",
  "Entertainment",
  "Luxury",
  "Electronics",
  "Energy",
  "Education",
  "E-commerce",
] as const;

export const REGIONS = [
  { id: "in-metro", label: "Indian metros", countries: ["India"] },
  { id: "in-tier2", label: "Tier-2 India", countries: ["India"] },
  { id: "sea", label: "Southeast Asia", countries: ["Singapore", "Indonesia", "Vietnam"] },
  { id: "mena", label: "MENA", countries: ["UAE", "Saudi Arabia"] },
  { id: "uk-eu", label: "UK & Europe", countries: ["United Kingdom", "Germany", "France"] },
  { id: "na", label: "North America", countries: ["United States", "Canada"] },
] as const;

export const STYLE_TAGS = [
  "cinematic",
  "editorial",
  "raw documentary",
  "hyperreal",
  "surreal",
  "analog film",
  "70s grain",
  "neo-noir",
  "pastel dream",
  "brutalist graphic",
  "chromatic",
  "monochrome",
  "luxury product",
  "clinical minimal",
  "streetwear energy",
  "retro-futurist",
  "botanical organic",
  "handcrafted",
  "Y2K nostalgia",
  "biophilic",
  "solarpunk",
  "industrial",
] as const;

export const TONE_TAGS = [
  "confident",
  "playful",
  "reassuring",
  "aspirational",
  "urgent",
  "warm",
  "edgy",
  "quiet-luxury",
  "humorous",
  "clinical",
] as const;

export const CHANNELS = [
  "Paid social",
  "Organic social",
  "CTV / pre-roll",
  "YouTube",
  "Web & app",
  "Retail / POS",
  "OOH",
  "Print",
  "Packaging",
  "Influencer seeding",
  "Internal comms",
  "Events & experiential",
] as const;

export function toolById(id: string) {
  return TOOLS.find((t) => t.id === id);
}

export function toolsByIds(ids: string[]): Tool[] {
  return ids.map(toolById).filter((t): t is Tool => Boolean(t));
}