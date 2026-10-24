import type { ImageSourcePropType } from "react-native";

import { VISUAL_ASSETS, hasVisualAsset, triviaImageUrl } from "@confidence-trivia/shared";
// Only bundled or reviewed catalog paths, never question-supplied URLs.
export const VISUAL_IMAGE_SOURCES: Record<string, ImageSourcePropType> = {
  scene_01: require("../../assets/visual/scene_01.png"),
  scene_02: require("../../assets/visual/scene_02.png"),
  scene_03: require("../../assets/visual/scene_03.png"),
};

export function visualImageSource(assetId: string): ImageSourcePropType | undefined {
  if (!hasVisualAsset(assetId)) return undefined;
  const asset = VISUAL_ASSETS[assetId];
  if ("kind" in asset && asset.storagePath) {
    const uri = triviaImageUrl(process.env.EXPO_PUBLIC_SUPABASE_URL, asset.storagePath);
    return uri ? { uri } : undefined;
  }
  return VISUAL_IMAGE_SOURCES[assetId];
}
