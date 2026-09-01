export const NAME_COLOR_COSMETICS = [
  { id: "name_white", color: "#FFFFFF" },
  { id: "name_sky", color: "#72B7FF" },
  { id: "name_mint", color: "#7CFFA0" },
  { id: "name_gold", color: "#F7D85B" },
  { id: "name_coral", color: "#FF7D7D" },
  { id: "name_lilac", color: "#C9A7FF" },
] as const;

export const DEFAULT_NAME_COLOR_ID = NAME_COLOR_COSMETICS[0].id;
export const DEFAULT_NAME_COLOR = NAME_COLOR_COSMETICS[0].color;

export const AVATAR_COSMETIC_IDS = [
  "smart_owl",
  "clever_fox",
  "quiz_bot",
  "omniscient_avatar",
  "trivia_wizard",
  "detective_avatar",
  "living_globe",
] as const;

export const DEFAULT_AVATAR_ID = AVATAR_COSMETIC_IDS[0];

export const FRAME_COSMETIC_IDS = ["", "plain_crimson", "plain_ocean", "plain_emerald", "plain_violet", "plain_gold", "flame", "water", "leaves", "frost", "lightning", "ice"] as const;
export const DEFAULT_FRAME_ID = "";
export const FRAME_COSMETIC_COLORS: Record<typeof FRAME_COSMETIC_IDS[number], string> = {
  "": "transparent",
  plain_crimson: "#FF647C",
  plain_ocean: "#4DBBFF",
  plain_emerald: "#59DA87",
  plain_violet: "#A77BFF",
  plain_gold: "#F7D85B",
  flame: "#FF6542",
  water: "#55D9FF",
  leaves: "#73D85B",
  frost: "#C9F5FF",
  lightning: "#FFE75C",
  ice: "#65D9FF",
};

export type CosmeticType = "name_color" | "avatar" | "frame";

export const COSMETIC_STAR_PRICES: Record<CosmeticType, Record<string, number | null>> = {
  name_color: {
    name_white: 0,
    name_sky: 100,
    name_mint: 150,
    name_gold: 250,
    name_coral: 150,
    name_lilac: 200,
  },
  avatar: {
    smart_owl: 0,
    clever_fox: 300,
    quiz_bot: 350,
    omniscient_avatar: null,
    trivia_wizard: 500,
    detective_avatar: 400,
    living_globe: 450,
  },
  frame: {
    "": 0,
    plain_crimson: 100,
    plain_ocean: 100,
    plain_emerald: 100,
    plain_violet: 125,
    plain_gold: 150,
    water: 450,
    leaves: 450,
    frost: 500,
    lightning: 550,
    flame: 450,
    ice: 450,
  },
};

export function getCosmeticStarPrice(type: CosmeticType, id: string): number | null | undefined {
  return COSMETIC_STAR_PRICES[type][id];
}

export function getNameColorCosmetic(id: unknown) {
  return NAME_COLOR_COSMETICS.find((item) => item.id === id) ?? null;
}

export function isAvatarCosmeticId(id: unknown): id is typeof AVATAR_COSMETIC_IDS[number] {
  return typeof id === "string" && AVATAR_COSMETIC_IDS.includes(id as typeof AVATAR_COSMETIC_IDS[number]);
}

export function isFrameCosmeticId(id: unknown): id is typeof FRAME_COSMETIC_IDS[number] {
  return typeof id === "string" && FRAME_COSMETIC_IDS.includes(id as typeof FRAME_COSMETIC_IDS[number]);
}
