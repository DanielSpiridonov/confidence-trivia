"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ENDLESS_MILESTONES = exports.ENDLESS_FEEDBACK_MS = exports.ENDLESS_TIMERS = void 0;
exports.ENDLESS_TIMERS = { easy: 30, medium: 25, hard: 20, expert: 15 };
exports.ENDLESS_FEEDBACK_MS = 1600;
// A finite, deliberately modest road: 280 Stars total, below four max-streak daily rewards.
// Threshold is a permanent identity. Never reuse one for a different reward.
exports.ENDLESS_MILESTONES = [
    { score: 10, stars: 10 }, { score: 25, stars: 15 }, { score: 50, stars: 20 },
    { score: 75, stars: 25 }, { score: 100, stars: 30 }, { score: 150, stars: 35 },
    { score: 200, stars: 40 }, { score: 250, stars: 50 }, { score: 300, stars: 55 },
];
