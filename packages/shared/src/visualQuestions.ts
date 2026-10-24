export type VisualPresentation = { format: "map_shapes" | "image_reveal"; assetId: string; geography?: { kind: "country" | "continent"; id: string } };
export interface VectorArtwork { viewBox: string; paths: ReadonlyArray<{ d: string; fill?: string; stroke?: string; strokeWidth?: number }> }
export interface RasterArtwork { kind: "raster"; width: number; height: number; storagePath?: string }
export type VisualAsset = VectorArtwork | RasterArtwork;
export const VISUAL_READY_TIMEOUT_MS = 8000;
export const IMAGE_REVEAL_BLUR = [12, 5, 0] as const;

/** Exact thirds, with the boundary belonging to the later stage. */
export function imageRevealStage(startedAt: number, durationMs: number, now: number): 1 | 2 | 3 {
  if (!(durationMs > 0) || !Number.isFinite(now)) return 3;
  const elapsed = Math.max(0, now - startedAt);
  return elapsed < durationMs / 3 ? 1 : elapsed < durationMs * 2 / 3 ? 2 : 3;
}
export function imageRevealPoints(startedAt: number, durationMs: number, submittedAt: number): number {
  return 4 - imageRevealStage(startedAt, durationMs, submittedAt);
}
export function normalizeGeographyAnswer(value: unknown): string {
  return String(value ?? "").normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
}
export function isValidAnswerValue(type: string, value: unknown, optionCount: number): boolean {
  if (type === "word") return typeof value === "string" && value.trim().length > 0 && value.length <= 64;
  if (type === "estimate" || type === "closest_answer") return typeof value === "number" && Number.isFinite(value);
  if (type === "ordering") return Array.isArray(value) && value.length === optionCount && new Set(value).size === optionCount && value.every((i) => Number.isInteger(i) && i >= 0 && i < optionCount);
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value < optionCount;
}
