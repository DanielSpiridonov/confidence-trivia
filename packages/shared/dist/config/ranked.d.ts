export declare const RANKED_PLAYER_COUNT = 4;
export declare const RANKED_PLACEMENT_MATCHES = 3;
export declare const RANKED_FIXED_ROUND_COUNT = 10;
export declare const RANKED_LP_BY_PLACEMENT: Record<number, number>;
export declare const RANKED_PLACEMENT_POINTS: Record<number, number>;
export interface RankedDivision {
    key: string;
    tier: string;
    division?: "III" | "II" | "I";
    minLp: number;
    color: string;
}
export declare const RANKED_DIVISIONS: RankedDivision[];
export declare function getRankedDivision(lp: number): RankedDivision;
export declare function getPlacementStartingLp(points: number): number;
