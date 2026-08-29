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
