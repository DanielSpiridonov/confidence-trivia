"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VISUAL_ASSETS = exports.VECTOR_ARTWORKS = void 0;
exports.hasVisualAsset = hasVisualAsset;
const geographyAssets_1 = require("./geographyAssets");
// Original code-drawn sample illustrations. No network images or copied art.
const fruit = (x, y, color) => [
    { d: `M${x} ${y - 20}c-27-19-42 10-27 32 11 17 18 8 27 10 10-2 17 7 28-10 15-24-2-50-28-32Z`, fill: color },
    { d: `M${x} ${y - 20}l3-15m-1 8c7-16 18-12 18-12-1 13-11 15-18 12`, fill: "#629557", stroke: "#344B35", strokeWidth: 3 },
];
exports.VECTOR_ARTWORKS = {
    ...geographyAssets_1.GEOGRAPHY_ASSETS,
    scene_01: { viewBox: "0 0 300 220", paths: [
            { d: "M0 0h300v220H0Z", fill: "#CCDCE4" }, { d: "M0 150Q100 115 300 150v70H0Z", fill: "#D5B276" },
            { d: "M24 177 105 40 190 177Z", fill: "#BD8D4E" }, { d: "m105 40 85 137h-63Z", fill: "#8A683E" },
            { d: "m156 177 55-100 65 100Z", fill: "#D8AC65" }, { d: "m211 77 65 100h-45Z", fill: "#A77D43" },
            { d: "M242 35a17 17 0 1 0 34 0 17 17 0 1 0-34 0", fill: "#F5D188" },
        ] },
    scene_02: { viewBox: "0 0 300 220", paths: [
            { d: "M0 0h300v220H0Z", fill: "#233C42" }, { d: "M35 191h230", stroke: "#A48563", strokeWidth: 13 },
            { d: "M93 86 83 35l49 23q24-5 38 0l48-23-9 59q27 108-57 112-88-1-59-120Z", fill: "#BDA087" },
            { d: "M98 95a34 34 0 1 0 68 0 34 34 0 1 0-68 0m44 0a34 34 0 1 0 68 0 34 34 0 1 0-68 0", fill: "#EDDDC4" },
            { d: "M116 95a12 12 0 1 0 24 0 12 12 0 1 0-24 0m49 0a12 12 0 1 0 24 0 12 12 0 1 0-24 0", fill: "#25212D" },
            { d: "m141 121 12 21 12-21Z", fill: "#D2A253" }, { d: "m118 156 11 9 11-9m15 0 11 9 11-9", stroke: "#775F50", strokeWidth: 3 },
        ] },
    scene_03: { viewBox: "0 0 300 220", paths: [
            { d: "M0 0h300v220H0Z", fill: "#E6DDCA" }, { d: "M12 193h276", stroke: "#B6A58D", strokeWidth: 4 },
            ...fruit(61, 69, "#C94C52"), ...fruit(151, 69, "#C94C52"), ...fruit(241, 69, "#78A964"),
            ...fruit(61, 155, "#78A964"), ...fruit(151, 155, "#C94C52"), ...fruit(241, 155, "#C94C52"),
        ] },
};
// Raster files are statically bundled by the mobile source catalog. Retain
// original sample drawing paths above as reproducible authorship evidence.
const storageVisualAssets_1 = require("./storageVisualAssets");
exports.VISUAL_ASSETS = {
    ...storageVisualAssets_1.STORAGE_VISUAL_ASSETS,
    ...geographyAssets_1.GEOGRAPHY_ASSETS,
    scene_01: { kind: "raster", width: 600, height: 440 },
    scene_02: { kind: "raster", width: 600, height: 440 },
    scene_03: { kind: "raster", width: 600, height: 440 },
};
function hasVisualAsset(assetId) { return Object.prototype.hasOwnProperty.call(exports.VISUAL_ASSETS, assetId); }
