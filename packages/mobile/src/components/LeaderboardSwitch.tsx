import React from "react";
import { AccessibilityInfo, Animated, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { menuTap } from "./menuHaptics";

export type LeaderboardTab = "ranked" | "endless";
export function LeaderboardSwitch({ value, rankedLabel, onChange }: { value: LeaderboardTab; rankedLabel: string; onChange: (value: LeaderboardTab) => void }) {
  const [width, setWidth] = React.useState(280);
  const [reduceMotion, setReduceMotion] = React.useState(false);
  const progress = React.useRef(new Animated.Value(value === "endless" ? 1 : 0)).current;
  const endless = value === "endless";
  React.useEffect(() => {
    let alive = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => { if (alive) setReduceMotion(enabled); });
    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduceMotion);
    return () => { alive = false; subscription.remove(); };
  }, []);
  React.useEffect(() => {
    const target = endless ? 1 : 0;
    if (reduceMotion) { progress.stopAnimation(); progress.setValue(target); return; }
    const animation = Animated.spring(progress, { toValue: target, speed: 22, bounciness: 0, useNativeDriver: true });
    animation.start(); return () => animation.stop();
  }, [endless, progress, reduceMotion]);
  const half = Math.max(0, (width - 8) / 2);
  return <View accessibilityRole="tablist" onLayout={(event) => setWidth(event.nativeEvent.layout.width)} style={[s.track, endless && s.endlessTrack]}>
    <Animated.View pointerEvents="none" style={[s.thumb, { width: half, transform: [{ translateX: progress.interpolate({ inputRange: [0, 1], outputRange: [0, half] }) }] }, endless && s.endlessThumb]} />
    {(["ranked", "endless"] as const).map((tab) => {
      const selected = value === tab;
      return <Pressable key={tab} accessibilityRole="tab" accessibilityLabel={tab === "ranked" ? rankedLabel : "Endless"} accessibilityState={{ selected }} onPress={() => { if (!selected) { menuTap(); onChange(tab); } }} style={s.option}>
        <Ionicons name={tab === "ranked" ? "trophy-outline" : "infinite"} size={17} color={selected ? "#FFF2DB" : "#AE9FBA"} />
        <Text numberOfLines={1} maxFontSizeMultiplier={1.2} style={[s.label, selected && s.selected]}>{tab === "ranked" ? rankedLabel : "Endless"}</Text>
      </Pressable>;
    })}
  </View>;
}
const s = StyleSheet.create({
  track: { width: 280, height: 44, padding: 3, alignSelf: "center", flexDirection: "row", flexShrink: 0, borderRadius: 17, backgroundColor: "#181C1C", borderWidth: 1, borderColor: "#81705B" },
  endlessTrack: { backgroundColor: "#1B1427", borderColor: "#6C537F" },
  thumb: { position: "absolute", top: 3, bottom: 3, left: 3, borderRadius: 12, backgroundColor: "#454238", borderWidth: 1, borderColor: "#C6AD79" },
  endlessThumb: { backgroundColor: "#4A3068", borderColor: "#C49BE9" },
  option: { flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7 },
  label: { color: "#AE9FBA", fontFamily: Platform.OS === "ios" ? "ChalkboardSE-Regular" : "casual", fontSize: 16 }, selected: { color: "#FFF2DB" },
});
