import React from "react";
import { Image, ImageSourcePropType, StyleProp, ImageStyle } from "react-native";

export const RANK_IMAGES: Record<string, ImageSourcePropType> = {
  bronze_iii: require("../../assets/ranks/bronze-3.png"),
  bronze_ii: require("../../assets/ranks/bronze-2.png"),
  bronze_i: require("../../assets/ranks/bronze-1.png"),
  silver_iii: require("../../assets/ranks/silver-3.png"),
  silver_ii: require("../../assets/ranks/silver-2.png"),
  silver_i: require("../../assets/ranks/silver-1.png"),
  gold_iii: require("../../assets/ranks/gold-3.png"),
  gold_ii: require("../../assets/ranks/gold-2.png"),
  gold_i: require("../../assets/ranks/gold-1.png"),
  platinum_iii: require("../../assets/ranks/plat-3.png"),
  platinum_ii: require("../../assets/ranks/plat-2.png"),
  platinum_i: require("../../assets/ranks/plat-1.png"),
  diamond_iii: require("../../assets/ranks/dia-3.png"),
  diamond_ii: require("../../assets/ranks/dia-2.png"),
  diamond_i: require("../../assets/ranks/dia-1.png"),
  master: require("../../assets/ranks/master-rank.png"),
  omniscient: require("../../assets/ranks/omniscient-rank.png"),
};

export const RANK_IMAGE_SOURCES = Object.values(RANK_IMAGES);

export function RankIcon({ rankKey, size, style }: { rankKey: string; size: number; style?: StyleProp<ImageStyle> }) {
  const source = RANK_IMAGES[rankKey];
  if (!source) return null;
  return <Image source={source} fadeDuration={0} resizeMode="contain" style={[{ width: size, height: size }, style]} />;
}
