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

export const FRAME_COSMETIC_IDS = ["flame", "water", "leaves", "frost", "lightning", "ice"] as const;
export const DEFAULT_FRAME_ID = "";
export const FRAME_COSMETIC_COLORS: Record<typeof FRAME_COSMETIC_IDS[number], string> = {
  flame: "#FF6542",
  water: "#55D9FF",
  leaves: "#73D85B",
  frost: "#C9F5FF",
  lightning: "#FFE75C",
  ice: "#65D9FF",
};

export function getNameColorCosmetic(id: unknown) {
  return NAME_COLOR_COSMETICS.find((item) => item.id === id) ?? null;
}

export function isAvatarCosmeticId(id: unknown): id is typeof AVATAR_COSMETIC_IDS[number] {
  return typeof id === "string" && AVATAR_COSMETIC_IDS.includes(id as typeof AVATAR_COSMETIC_IDS[number]);
}

export function isFrameCosmeticId(id: unknown): id is typeof FRAME_COSMETIC_IDS[number] {
  return typeof id === "string" && FRAME_COSMETIC_IDS.includes(id as typeof FRAME_COSMETIC_IDS[number]);
}
