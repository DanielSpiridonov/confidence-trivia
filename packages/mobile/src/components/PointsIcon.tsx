import React from "react";
import { Image } from "react-native";

const STAR_CURRENCY_IMAGE = require("../../assets/star-currency-icon.png");

export function PointsIcon({ size = 22 }: { size?: number; color?: string }) {
  return (
    <Image
      accessible={false}
      source={STAR_CURRENCY_IMAGE}
      defaultSource={STAR_CURRENCY_IMAGE}
      fadeDuration={0}
      resizeMode="contain"
      style={{ width: size, height: size }}
    />
  );
}
