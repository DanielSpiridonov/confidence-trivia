export const DAILY_STAR_REWARDS = [10, 20, 30, 50, 75] as const;
export const DAILY_REWARD_MAX_STREAK_DAY = DAILY_STAR_REWARDS.length;

export function getDailyStarReward(streakDay: number): number {
  const index = Math.min(DAILY_REWARD_MAX_STREAK_DAY, Math.max(1, Math.floor(streakDay))) - 1;
  return DAILY_STAR_REWARDS[index];
}
