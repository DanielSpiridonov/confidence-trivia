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

export function getNameColorCosmetic(id: unknown) {
  return NAME_COLOR_COSMETICS.find((item) => item.id === id) ?? null;
}
