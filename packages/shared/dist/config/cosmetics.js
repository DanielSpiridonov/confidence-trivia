"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FRAME_COSMETIC_COLORS = exports.DEFAULT_FRAME_ID = exports.FRAME_COSMETIC_IDS = exports.DEFAULT_AVATAR_ID = exports.AVATAR_COSMETIC_IDS = exports.DEFAULT_NAME_COLOR = exports.DEFAULT_NAME_COLOR_ID = exports.NAME_COLOR_COSMETICS = void 0;
exports.getNameColorCosmetic = getNameColorCosmetic;
exports.isAvatarCosmeticId = isAvatarCosmeticId;
exports.isFrameCosmeticId = isFrameCosmeticId;
exports.NAME_COLOR_COSMETICS = [
    { id: "name_white", color: "#FFFFFF" },
    { id: "name_sky", color: "#72B7FF" },
    { id: "name_mint", color: "#7CFFA0" },
    { id: "name_gold", color: "#F7D85B" },
    { id: "name_coral", color: "#FF7D7D" },
    { id: "name_lilac", color: "#C9A7FF" },
];
exports.DEFAULT_NAME_COLOR_ID = exports.NAME_COLOR_COSMETICS[0].id;
exports.DEFAULT_NAME_COLOR = exports.NAME_COLOR_COSMETICS[0].color;
exports.AVATAR_COSMETIC_IDS = [
    "smart_owl",
    "clever_fox",
    "quiz_bot",
    "omniscient_avatar",
    "trivia_wizard",
    "detective_avatar",
    "living_globe",
];
exports.DEFAULT_AVATAR_ID = exports.AVATAR_COSMETIC_IDS[0];
exports.FRAME_COSMETIC_IDS = ["bronze", "silver", "gold", "flame", "ice", "royal"];
exports.DEFAULT_FRAME_ID = "";
exports.FRAME_COSMETIC_COLORS = {
    bronze: "#CD7F32",
    silver: "#C7D0DA",
    gold: "#F7D85B",
    flame: "#FF6542",
    ice: "#65D9FF",
    royal: "#B887FF",
};
function getNameColorCosmetic(id) {
    return exports.NAME_COLOR_COSMETICS.find((item) => item.id === id) ?? null;
}
function isAvatarCosmeticId(id) {
    return typeof id === "string" && exports.AVATAR_COSMETIC_IDS.includes(id);
}
function isFrameCosmeticId(id) {
    return typeof id === "string" && exports.FRAME_COSMETIC_IDS.includes(id);
}
