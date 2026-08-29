"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_DAMAGE_WAGER = exports.DAMAGE_WAGER_OPTIONS = void 0;
exports.isDamageWager = isDamageWager;
exports.DAMAGE_WAGER_OPTIONS = [5, 15, 40, 60, 75, 100, 150, 300, 500];
exports.DEFAULT_DAMAGE_WAGER = exports.DAMAGE_WAGER_OPTIONS[0];
function isDamageWager(value) {
    return typeof value === "number" && exports.DAMAGE_WAGER_OPTIONS.includes(value);
}
