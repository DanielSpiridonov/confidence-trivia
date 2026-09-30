import React from "react";
import { Platform, Pressable as NativePressable } from "react-native";
import * as Haptics from "expo-haptics";

let enabled = true;
let menuActive = true;

export function configureMenuHaptics(isEnabled: boolean, isMenuActive: boolean) {
  enabled = isEnabled;
  menuActive = isMenuActive;
}

export function menuTap(force = false) {
  if (!enabled || (!menuActive && !force)) return;
  const feedback = Platform.OS === "android"
    ? Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Virtual_Key)
    : Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  void feedback.catch(() => undefined);
}

type Props = React.ComponentProps<typeof NativePressable>;

export function Pressable({ onPress, ...props }: Props) {
  return <NativePressable {...props} onPress={onPress ? (event) => { menuTap(true); onPress(event); } : undefined} />;
}
