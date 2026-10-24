export type VisualPresentation = {
    format: "map_shapes" | "image_reveal";
    assetId: string;
    geography?: {
        kind: "country" | "continent";
        id: string;
    };
};
export interface VectorArtwork {
    viewBox: string;
    paths: ReadonlyArray<{
        d: string;
        fill?: string;
        stroke?: string;
        strokeWidth?: number;
    }>;
}
export interface RasterArtwork {
    kind: "raster";
    width: number;
    height: number;
    storagePath?: string;
}
export type VisualAsset = VectorArtwork | RasterArtwork;
export declare const VISUAL_READY_TIMEOUT_MS = 8000;
export declare const IMAGE_REVEAL_BLUR: readonly [12, 5, 0];
/** Exact thirds, with the boundary belonging to the later stage. */
export declare function imageRevealStage(startedAt: number, durationMs: number, now: number): 1 | 2 | 3;
export declare function imageRevealPoints(startedAt: number, durationMs: number, submittedAt: number): number;
export declare function normalizeGeographyAnswer(value: unknown): string;
export declare function isValidAnswerValue(type: string, value: unknown, optionCount: number): boolean;
