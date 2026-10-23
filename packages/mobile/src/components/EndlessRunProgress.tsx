import React from "react";
import { AccessibilityInfo, Animated, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { EndlessRun } from "@confidence-trivia/shared";
import { RewardRoad } from "./RewardRoad";
import { theme } from "./ui";

/** A run-end sequence. Never mounted during a live question or its feedback. */
export function EndlessRunProgress({ run, best, claimed, active, onComplete }: {
  run: EndlessRun;
  best: number;
  claimed: number[];
  active: boolean;
  onComplete: (runId: string) => void;
}) {
  const opacity = React.useRef(new Animated.Value(0)).current;
  const [reduceMotion, setReduceMotion] = React.useState(false);
  const stars = run.rewards.reduce((sum, reward) => sum + reward.stars, 0);
  React.useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((value) => { if (mounted) setReduceMotion(value); });
    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduceMotion);
    return () => { mounted = false; subscription.remove(); };
  }, []);
  React.useEffect(() => {
    if (!active) return;
    opacity.setValue(0);
    const sequence = Animated.sequence([
      Animated.timing(opacity, { toValue: 1, duration: reduceMotion ? 0 : 350, useNativeDriver: true }),
      Animated.delay(3000),
      Animated.timing(opacity, { toValue: 0, duration: reduceMotion ? 0 : 300, useNativeDriver: true }),
    ]);
    sequence.start(({ finished }) => { if (finished) onComplete(run.id); });
    return () => sequence.stop();
  }, [run.id, active, onComplete, opacity, reduceMotion]);

  return <Animated.View style={[s.screen, { opacity }]} accessibilityLiveRegion="polite">
    <View style={s.summary}>
      <Ionicons name={run.score > run.previousBest ? "trophy-outline" : "flag-outline"} size={35} color="#FFE398" />
      <Text style={s.eyebrow}>{run.score > run.previousBest ? "NEW PERSONAL BEST" : "RUN COMPLETE"}</Text>
      <Text style={s.title}>{run.score} correct answers</Text>
      <Text style={s.caption}>{run.score > run.previousBest ? `Your best moves from ${run.previousBest} to ${best}.` : `Your personal best stays at ${best}.`}</Text>
    </View>
    <RewardRoad best={best} claimed={claimed} initialBest={Math.min(run.previousBest, best)} />
    <Text style={s.reward}>{stars > 0 ? `+${stars} Stars earned this run` : "Every earned milestone is yours to keep."}</Text>
  </Animated.View>;
}
const s = StyleSheet.create({
  screen: { flex: 1, justifyContent: "center", alignItems: "center", gap: 18, paddingHorizontal: 22 },
  summary: { alignItems: "center", gap: 6 },
  eyebrow: { color: "#DDC3FF", fontSize: 11, letterSpacing: 2, fontWeight: "900" },
  title: { color: theme.text, fontSize: 30, fontWeight: "900" },
  caption: { color: theme.textDim, fontSize: 12 },
  reward: { color: "#FFE398", fontWeight: "800", fontSize: 13 },
});
