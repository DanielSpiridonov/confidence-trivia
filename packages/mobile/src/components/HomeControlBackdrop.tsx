import React from "react";
import { Platform, StyleSheet, View } from "react-native";
import { requireOptionalNativeModule } from "expo";
import type { BlurViewProps } from "expo-blur";

// Keep existing development clients usable until their next native build.
// Importing expo-blur eagerly would register a view they do not yet contain.
const NativeBlur: React.ComponentType<BlurViewProps> | null =
  Platform.OS === "web" || requireOptionalNativeModule("ExpoBlurView")
    ? require("expo-blur").BlurView : null;

export const HomeControlBackdrop = React.memo(function HomeControlBackdrop({ compact = false }: { compact?: boolean }) {
  return <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
    style={[styles.backdrop, compact && styles.compact, !NativeBlur && styles.fallback]}>
    {NativeBlur ? <NativeBlur tint="dark" intensity={10} experimentalBlurMethod="dimezisBlurView" style={[StyleSheet.absoluteFillObject, styles.blur]} /> : null}
    <View style={styles.shade} />
  </View>;
});

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, borderRadius: 22, overflow: "hidden" },
  compact: { borderRadius: 12 },
  blur: { opacity: 0.4 },
  fallback: { backgroundColor: "rgba(19, 15, 30, 0.12)" },
  shade: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(15, 12, 25, 0.04)" },
});
