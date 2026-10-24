"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IMAGE_REVEAL_BLUR = exports.VISUAL_READY_TIMEOUT_MS = void 0;
exports.imageRevealStage = imageRevealStage;
exports.imageRevealPoints = imageRevealPoints;
exports.normalizeGeographyAnswer = normalizeGeographyAnswer;
exports.isValidAnswerValue = isValidAnswerValue;
exports.VISUAL_READY_TIMEOUT_MS = 8000;
exports.IMAGE_REVEAL_BLUR = [12, 5, 0];
/** Exact thirds, with the boundary belonging to the later stage. */
function imageRevealStage(startedAt, durationMs, now) {
    if (!(durationMs > 0) || !Number.isFinite(now))
        return 3;
    const elapsed = Math.max(0, now - startedAt);
    return elapsed < durationMs / 3 ? 1 : elapsed < durationMs * 2 / 3 ? 2 : 3;
}
function imageRevealPoints(startedAt, durationMs, submittedAt) {
    return 4 - imageRevealStage(startedAt, durationMs, submittedAt);
}
function normalizeGeographyAnswer(value) {
    return String(value ?? "").normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
}
function isValidAnswerValue(type, value, optionCount) {
    if (type === "word")
        return typeof value === "string" && value.trim().length > 0 && value.length <= 64;
    if (type === "estimate" || type === "closest_answer")
        return typeof value === "number" && Number.isFinite(value);
    if (type === "ordering")
        return Array.isArray(value) && value.length === optionCount && new Set(value).size === optionCount && value.every((i) => Number.isInteger(i) && i >= 0 && i < optionCount);
    return typeof value === "number" && Number.isInteger(value) && value >= 0 && value < optionCount;
}
