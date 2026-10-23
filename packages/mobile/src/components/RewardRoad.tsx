import React from "react";
import { Animated, ScrollView, StyleSheet, Text, View } from "react-native";
import { ENDLESS_MILESTONES } from "@confidence-trivia/shared";
import { Ionicons } from "@expo/vector-icons";
import { PointsIcon } from "./PointsIcon";
import { theme } from "./ui";

const STEP = 112;
// Piecewise spacing leaves every reward legible on a phone; interpolation still
// places the best marker accurately between the surrounding score thresholds.
function roadPosition(score: number): number {
  const thresholds = [0, ...ENDLESS_MILESTONES.map((m) => m.score)];
  for (let i = 1; i < thresholds.length; i++) {
    if (score <= thresholds[i]) return ((i - 1) + (score - thresholds[i - 1]) / (thresholds[i] - thresholds[i - 1])) * STEP;
  }
  return ENDLESS_MILESTONES.length * STEP;
}
export function RewardRoad({ best, claimed, initialBest = best }: { best: number; claimed: number[]; initialBest?: number }) {
  const scroll = React.useRef<ScrollView>(null);
  const progress = React.useRef(new Animated.Value(roadPosition(initialBest))).current;
  const next = ENDLESS_MILESTONES.find((m) => m.score > best);
  React.useEffect(() => {
    Animated.timing(progress, { toValue: roadPosition(best), duration: 650, useNativeDriver: false }).start();
    const timer = setTimeout(() => scroll.current?.scrollTo({ x: Math.max(0, roadPosition(best) - 170), animated: true }), 180);
    return () => clearTimeout(timer);
  }, [best, progress]);
  return <View style={s.panel} accessibilityLabel={`Reward Road. Personal best ${best}. ${next ? `Next reward at ${next.score}: ${next.stars} Stars` : "All milestones unlocked"}`}>
    <View style={s.heading}><Text style={s.title}>REWARD ROAD <Text style={s.best}> · BEST {best}</Text></Text><Text style={s.hint}>{next ? `${next.score - best} to go · next +${next.stars} Stars` : "Every milestone unlocked!"}</Text></View>
    <ScrollView ref={scroll} horizontal showsHorizontalScrollIndicator contentContainerStyle={s.track}>
      <View style={[s.line, { width: STEP * ENDLESS_MILESTONES.length }]} />
      <Animated.View style={[s.line, s.fill, { width: progress }]} />
      <View style={s.origin}><Text style={s.originText}>0</Text></View>
      {ENDLESS_MILESTONES.map((m, i) => {
        const earned = claimed.includes(m.score);
        return <View key={m.score} style={[s.milestone, { left: (i + 1) * STEP - 38 }]} accessibilityLabel={`${m.score} correct: ${m.stars} Stars, ${earned ? "claimed" : "locked"}`}>
          <View style={[s.marker, earned && s.markerClaimed]}><PointsIcon size={22} /><Text style={[s.amount, earned && s.gold]}>+{m.stars}</Text></View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}><Text style={[s.threshold, earned && s.gold]}>{m.score} {earned ? "✓" : ""}</Text>{!earned ? <Ionicons name="lock-closed" size={9} color={theme.textDim} /> : null}</View>
        </View>;
      })}
      <Animated.View style={[s.pin, { left: progress }]}><Text style={s.pinText}>◆ BEST</Text></Animated.View>
    </ScrollView>
  </View>;
}
const s = StyleSheet.create({
  panel: { width: "100%", backgroundColor: "rgba(25,17,44,0.96)", borderRadius: 14, padding: 10, borderWidth: 1, borderColor: "#60448D" },
  heading: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 },
  title: { color: "#D9C9FF", fontSize: 10, fontWeight: "900", letterSpacing: 1 }, best: { color: "#FFE398", letterSpacing: 0 },
  hint: { color: theme.textDim, fontSize: 10 }, track: { width: STEP * ENDLESS_MILESTONES.length + 68, height: 72, paddingLeft: 0 },
  line: { position: "absolute", top: 34, left: 0, height: 4, borderRadius: 2, backgroundColor: "#46375F" }, fill: { backgroundColor: "#C4A0FF" },
  origin: { position: "absolute", top: 48, left: 4 }, originText: { color: theme.textDim, fontSize: 10 },
  milestone: { position: "absolute", top: 7, width: 76, alignItems: "center" },
  marker: { height: 36, borderRadius: 12, paddingHorizontal: 7, backgroundColor: "#2E2542", borderWidth: 2, borderColor: "#635079", flexDirection: "row", alignItems: "center", gap: 3 },
  markerClaimed: { backgroundColor: "#50346E", borderColor: "#F0CC77" },
  amount: { color: theme.textDim, fontWeight: "900", fontSize: 11 }, gold: { color: "#FFE398" },
  threshold: { marginTop: 3, color: theme.textDim, fontSize: 11, fontWeight: "800" },
  pin: { position: "absolute", top: 61, marginLeft: -3 }, pinText: { color: "#F3D48B", fontSize: 8, fontWeight: "900" },
});
