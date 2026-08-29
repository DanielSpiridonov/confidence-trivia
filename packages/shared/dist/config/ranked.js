"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RANKED_DIVISIONS = exports.RANKED_PLACEMENT_POINTS = exports.RANKED_LP_BY_PLACEMENT = exports.RANKED_FIXED_ROUND_COUNT = exports.RANKED_PLACEMENT_MATCHES = exports.RANKED_PLAYER_COUNT = void 0;
exports.getRankedDivision = getRankedDivision;
exports.getPlacementStartingLp = getPlacementStartingLp;
exports.RANKED_PLAYER_COUNT = 4;
exports.RANKED_PLACEMENT_MATCHES = 3;
exports.RANKED_FIXED_ROUND_COUNT = 10;
exports.RANKED_LP_BY_PLACEMENT = {
    1: 30,
    2: 15,
    3: 0,
    4: -15,
};
exports.RANKED_PLACEMENT_POINTS = {
    1: 3,
    2: 2,
    3: 1,
    4: 0,
};
exports.RANKED_DIVISIONS = [
    { key: "bronze_iii", tier: "Bronze", division: "III", minLp: 0, color: "#B97850" },
    { key: "bronze_ii", tier: "Bronze", division: "II", minLp: 100, color: "#B97850" },
    { key: "bronze_i", tier: "Bronze", division: "I", minLp: 200, color: "#B97850" },
    { key: "silver_iii", tier: "Silver", division: "III", minLp: 300, color: "#BFC7D5" },
    { key: "silver_ii", tier: "Silver", division: "II", minLp: 400, color: "#BFC7D5" },
    { key: "silver_i", tier: "Silver", division: "I", minLp: 500, color: "#BFC7D5" },
    { key: "gold_iii", tier: "Gold", division: "III", minLp: 600, color: "#F2C94C" },
    { key: "gold_ii", tier: "Gold", division: "II", minLp: 700, color: "#F2C94C" },
    { key: "gold_i", tier: "Gold", division: "I", minLp: 800, color: "#F2C94C" },
    { key: "platinum_iii", tier: "Platinum", division: "III", minLp: 900, color: "#66D7D1" },
    { key: "platinum_ii", tier: "Platinum", division: "II", minLp: 1000, color: "#66D7D1" },
    { key: "platinum_i", tier: "Platinum", division: "I", minLp: 1100, color: "#66D7D1" },
    { key: "diamond_iii", tier: "Diamond", division: "III", minLp: 1200, color: "#72B7FF" },
    { key: "diamond_ii", tier: "Diamond", division: "II", minLp: 1300, color: "#72B7FF" },
    { key: "diamond_i", tier: "Diamond", division: "I", minLp: 1400, color: "#72B7FF" },
    { key: "master", tier: "Master", minLp: 1500, color: "#B88CFF" },
    { key: "omniscient", tier: "Omniscient", minLp: 2000, color: "#FF72D2" },
];
function getRankedDivision(lp) {
    const safeLp = Math.max(0, Math.floor(lp));
    return [...exports.RANKED_DIVISIONS].reverse().find((rank) => safeLp >= rank.minLp) ?? exports.RANKED_DIVISIONS[0];
}
function getPlacementStartingLp(points) {
    if (points >= 9)
        return 700;
    if (points === 8)
        return 600;
    if (points === 7)
        return 500;
    if (points === 6)
        return 400;
    if (points === 5)
        return 300;
    if (points === 4)
        return 200;
    if (points === 3)
        return 100;
    return 0;
}
