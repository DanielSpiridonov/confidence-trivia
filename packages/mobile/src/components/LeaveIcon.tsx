import React from "react";
import { Image } from "react-native";

export function LeaveIcon({ size = 22 }: { size?: number }) {
  return (
    <Image
      source={require("../../assets/leaveicon.png")}
      resizeMode="contain"
      style={{ width: size, height: size }}
    />
  );
}
