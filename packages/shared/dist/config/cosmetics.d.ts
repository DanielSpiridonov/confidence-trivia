export declare const NAME_COLOR_COSMETICS: readonly [{
    readonly id: "name_white";
    readonly color: "#FFFFFF";
}, {
    readonly id: "name_sky";
    readonly color: "#72B7FF";
}, {
    readonly id: "name_mint";
    readonly color: "#7CFFA0";
}, {
    readonly id: "name_gold";
    readonly color: "#F7D85B";
}, {
    readonly id: "name_coral";
    readonly color: "#FF7D7D";
}, {
    readonly id: "name_lilac";
    readonly color: "#C9A7FF";
}];
export declare const DEFAULT_NAME_COLOR_ID: "name_white";
export declare const DEFAULT_NAME_COLOR: "#FFFFFF";
export declare const AVATAR_COSMETIC_IDS: readonly ["smart_owl", "clever_fox", "quiz_bot", "omniscient_avatar", "trivia_wizard", "detective_avatar", "living_globe"];
export declare const DEFAULT_AVATAR_ID: "smart_owl";
export declare const FRAME_COSMETIC_IDS: readonly ["bronze", "silver", "gold", "flame", "ice", "royal"];
export declare const DEFAULT_FRAME_ID = "";
export declare const FRAME_COSMETIC_COLORS: Record<typeof FRAME_COSMETIC_IDS[number], string>;
export declare function getNameColorCosmetic(id: unknown): {
    readonly id: "name_white";
    readonly color: "#FFFFFF";
} | {
    readonly id: "name_sky";
    readonly color: "#72B7FF";
} | {
    readonly id: "name_mint";
    readonly color: "#7CFFA0";
} | {
    readonly id: "name_gold";
    readonly color: "#F7D85B";
} | {
    readonly id: "name_coral";
    readonly color: "#FF7D7D";
} | {
    readonly id: "name_lilac";
    readonly color: "#C9A7FF";
} | null;
export declare function isAvatarCosmeticId(id: unknown): id is typeof AVATAR_COSMETIC_IDS[number];
export declare function isFrameCosmeticId(id: unknown): id is typeof FRAME_COSMETIC_IDS[number];
