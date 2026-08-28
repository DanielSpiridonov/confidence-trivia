"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DAILY_REWARD_MAX_STREAK_DAY = exports.DAILY_STAR_REWARDS = void 0;
exports.getDailyStarReward = getDailyStarReward;
exports.DAILY_STAR_REWARDS = [10, 20, 30, 50, 75];
exports.DAILY_REWARD_MAX_STREAK_DAY = exports.DAILY_STAR_REWARDS.length;
function getDailyStarReward(streakDay) {
    const index = Math.min(exports.DAILY_REWARD_MAX_STREAK_DAY, Math.max(1, Math.floor(streakDay))) - 1;
    return exports.DAILY_STAR_REWARDS[index];
}
