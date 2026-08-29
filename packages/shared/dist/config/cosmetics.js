"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_NAME_COLOR = exports.DEFAULT_NAME_COLOR_ID = exports.NAME_COLOR_COSMETICS = void 0;
exports.getNameColorCosmetic = getNameColorCosmetic;
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
function getNameColorCosmetic(id) {
    return exports.NAME_COLOR_COSMETICS.find((item) => item.id === id) ?? null;
}
