import React from "react";
import { Ionicons } from "@expo/vector-icons";

export function LeaveIcon({ size = 22 }: { size?: number }) {
  return <Ionicons name="exit-outline" size={size} color="white" />;
}
