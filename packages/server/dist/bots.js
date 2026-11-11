"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BOT_IDENTITIES = exports.BOT_WAGER_TIERS = exports.BOT_ACCURACY = void 0;
exports.wagerBotSkill = wagerBotSkill;
exports.botRandom = botRandom;
exports.decideBot = decideBot;
const questions_1 = require("./content/questions");
exports.BOT_ACCURACY = {
    easy: { easy: 0.70, medium: 0.50, hard: 0.30 },
    normal: { easy: 0.85, medium: 0.70, hard: 0.50 },
    hard: { easy: 0.95, medium: 0.85, hard: 0.70 },
};
exports.BOT_WAGER_TIERS = [
    { maxWager: 40, skill: "easy" },
    { maxWager: 100, skill: "normal" },
    { maxWager: Infinity, skill: "hard" },
];
exports.BOT_IDENTITIES = [
    ["smart_owl", "Bot-Owl"], ["clever_fox", "Bot-Fox"],
    ["detective_avatar", "Bot-Detective"], ["quiz_bot", "Bot-Quiz"],
    ["trivia_wizard", "Bot-Wizard"], ["living_globe", "Bot-Globe"],
];
function wagerBotSkill(wager) {
    return exports.BOT_WAGER_TIERS.find(tier => wager <= tier.maxWager).skill;
}
/** Seed once per match; all decisions are reproducible without external APIs. */
function botRandom(seed) {
    let state = 2166136261;
    for (const char of seed)
        state = Math.imul(state ^ char.charCodeAt(0), 16777619);
    return () => { state += 0x6D2B79F5; let t = state; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
function decideBot(record, locale, skill, random) {
    const accuracy = exports.BOT_ACCURACY[skill][record.difficulty];
    const knows = random() < accuracy;
    const key = (0, questions_1.getLocalizedCorrectAnswer)(record, locale);
    let value;
    if (record.type === "ordering") {
        value = key.map(Number);
        if (!knows && value.length > 1)
            [value[0], value[1]] = [value[1], value[0]];
    }
    else if (record.type === "word") {
        value = knows ? String(Array.isArray(key) ? key[0] : key).slice(0, 64) : "I don't know";
    }
    else if (record.type === "estimate" || record.type === "closest_answer") {
        const target = Number(key);
        value = knows ? target : target + (random() < 0.5 ? -1 : 1) * Math.max(1, Math.abs(target) * (0.1 + random() * 0.5));
    }
    else {
        const count = record.translations[locale].options?.length ?? 2;
        value = knows ? Number(key) : (Number(key) + 1 + Math.floor(random() * Math.max(1, count - 1))) % count;
    }
    // Confidence is fallible, including occasional confident mistakes.
    const belief = Math.max(0, Math.min(1, accuracy + (knows ? 0.10 : -0.15) + (random() - 0.5) * 0.65));
    const confidence = belief > 0.9 ? 6 : belief > 0.75 ? 5 : belief > 0.5 ? 3 : belief > 0.3 ? 1 : "none";
    return { value, confidence, responseMs: 2500 + Math.floor(random() * 10500), confidenceMs: 800 + Math.floor(random() * 2200) };
}
