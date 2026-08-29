export const DAMAGE_WAGER_OPTIONS = [5, 15, 40, 60, 75, 100, 150, 300, 500] as const;
export const DEFAULT_DAMAGE_WAGER = DAMAGE_WAGER_OPTIONS[0];

export function isDamageWager(value: unknown): value is number {
  return typeof value === "number" && DAMAGE_WAGER_OPTIONS.includes(value as typeof DAMAGE_WAGER_OPTIONS[number]);
}
