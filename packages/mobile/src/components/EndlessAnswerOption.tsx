import React from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { EndlessOptionState } from "./endlessPresentation";

export function EndlessAnswerOption({ index, text, state, disabled, onPress }: {
  index: number;
  text: string;
  state: EndlessOptionState;
  disabled: boolean;
  onPress: () => void;
}) {
  const scale = React.useRef(new Animated.Value(1)).current;
  const selected = state === "pending" || state === "correct" || state === "wrong";
  const label = state === "pending" ? "LOCKED IN" : state === "wrong" ? "YOUR ANSWER · INCORRECT" : state === "correct" ? "YOUR ANSWER · CORRECT" : state === "revealed" ? "RIGHT ANSWER" : null;
  const spring = (toValue: number) => Animated.spring(scale, { toValue, speed: 35, bounciness: 2, useNativeDriver: true }).start();
  return <Animated.View style={[s.wrapper, { transform: [{ scale }] }]}>
    <Pressable accessibilityRole="button" accessibilityLabel={`${String.fromCharCode(65 + index)}. ${text}${label ? `. ${label}` : ""}`} accessibilityState={{ disabled, selected }} disabled={disabled}
      onPressIn={() => spring(0.97)} onPressOut={() => spring(1)} onPress={onPress}
      style={({ pressed }) => [s.option, pressed && s.pressed, state === "muted" && s.dimmed, state === "pending" && s.selected, state === "correct" && s.correct, state === "wrong" && s.wrong, state === "revealed" && s.revealed]}>
      <View style={[s.letterDisc, state === "wrong" && s.wrongDisc]}><Text style={s.letter}>{state === "correct" ? "✓" : state === "wrong" ? "×" : String.fromCharCode(65 + index)}</Text></View>
      <View style={s.copy}><Text numberOfLines={2} maxFontSizeMultiplier={1.15} adjustsFontSizeToFit minimumFontScale={0.7} style={s.text}>{text}</Text>{label ? <Text numberOfLines={1} maxFontSizeMultiplier={1.15} adjustsFontSizeToFit minimumFontScale={0.7} style={[s.label, state === "wrong" && { color: "#873440" }, state === "correct" && { color: "#275A42" }]}>{label}</Text> : null}</View>
      {state === "pending" ? <Ionicons name="lock-closed" size={15} color="#695126" /> : null}
    </Pressable>
  </Animated.View>;
}
const s = StyleSheet.create({
  wrapper: { flex: 1, minWidth: 0 },
  option: { flex: 1, backgroundColor: "#EAE2D5", borderRadius: 13, borderWidth: 1, borderColor: "#BDAF9D", flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 5, gap: 11, borderBottomWidth: 3 },
  pressed: { borderColor: "#E1C18D", backgroundColor: "#FFF1D6" },
  selected: { borderColor: "#BE9858", backgroundColor: "#EFD39F" }, dimmed: { opacity: 0.45 },
  correct: { borderColor: "#91B19A", backgroundColor: "#CEE2D2" }, wrong: { borderColor: "#BB7A87", backgroundColor: "#ECC8CF" },
  revealed: { borderColor: "#C1A46C", backgroundColor: "#F6E9CF" },
  letterDisc: { width: 29, height: 29, borderRadius: 8, backgroundColor: "rgba(69,47,88,0.09)", alignItems: "center", justifyContent: "center" }, wrongDisc: { backgroundColor: "rgba(149,56,74,0.14)" },
  letter: { color: "#5B426B", fontSize: 15, fontWeight: "900" }, copy: { flex: 1, minWidth: 0, gap: 3 }, text: { color: "#342B3D", fontSize: 16, lineHeight: 18, fontWeight: "700" }, label: { color: "#735F43", fontSize: 8, lineHeight: 10, fontWeight: "900", letterSpacing: 0.6 },
});
