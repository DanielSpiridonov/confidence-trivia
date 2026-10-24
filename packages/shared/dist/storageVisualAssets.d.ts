import type { RasterArtwork } from "./visualQuestions";
export interface ImageCredit {
    assetId: string;
    sourceUrl?: string;
    photographer?: string;
    license: string;
    licenseUrl?: string;
}
export declare const STORAGE_VISUAL_ASSETS: Record<string, RasterArtwork>;
export declare const IMAGE_CREDITS: ImageCredit[];
export declare function triviaImageUrl(baseUrl: string | undefined, path: string): string | undefined;
