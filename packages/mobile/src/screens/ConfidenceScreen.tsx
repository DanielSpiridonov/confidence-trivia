import React, { useEffect, useState } from "react";
import { View, Text, Platform, Pressable, StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";
import { Room } from "colyseus.js";
import { CONFIDENCE_SCORING, ConfidenceValue } from "@confidence-trivia/shared";
import { ANDROID_GAME_UI_SCALE, Screen, Title, theme } from "../components/ui";
import { useRoomState } from "../network/client";
import { PhaseTimer, usePhaseSecondsLeft } from "../components/PhaseTimer";
import { playSound } from "../audio/sounds";

const CHOICES: ConfidenceValue[] = ["none", 1, 3, 5, 6];
const CHOICE_COLORS: Record<string, string> = {
  none: "#A9A1BD",
  1: "#65DFA1",
  3: "#FFD166",
  5: "#FF9A62",
  6: "#FF5C7A",
};

export function ConfidenceScreen({ room }: { room: Room }) {
  const { t } = useTranslation();
  const state = useRoomState<any>(room);
  const [selected, setSelected] = useState<ConfidenceValue | null>(null);
  const secondsLeft = usePhaseSecondsLeft(state?.phaseEndsAt ?? 0);

  useEffect(() => {
    setSelected(null);
  }, [state?.currentQuestion?.id]);

  if (!state) return null;

  function choose(value: ConfidenceValue) {
    if (selected !== null && secondsLeft <= 5) return;
    playSound("confidence");
    setSelected(value);
    room.send("submitConfidence", { value });
  }

  return (
    <Screen style={styles.screen} androidScale={ANDROID_GAME_UI_SCALE}>
      <PhaseTimer phaseEndsAt={state.phaseEndsAt} />
      <Title>{t("confidence.title")}</Title>
      <Text style={styles.subtitle}>{t("confidence.subtitle")}</Text>

      <View style={styles.grid}>
        {CHOICES.map((value) => {
          const outcome = CONFIDENCE_SCORING[value];
          const accent = CHOICE_COLORS[String(value)];
          const isSelected = selected === value;
          const isFinalized = selected !== null && secondsLeft <= 5;
          return (
            <Pressable
              key={String(value)}
              onPress={() => choose(value)}
              disabled={isFinalized}
              style={({ pressed }) => [
                styles.card,
                { borderColor: isSelected ? accent : `${accent}55` },
                isSelected && { backgroundColor: `${accent}22` },
                pressed && !isFinalized && styles.cardPressed,
                isFinalized && !isSelected && styles.cardDimmed,
              ]}
            >
              <View style={[styles.riskMarker, { backgroundColor: accent }]} />
              {isSelected ? (
                <View style={[styles.selectedMark, { backgroundColor: accent }]}>
                  {Platform.OS === "android"
                    ? <View style={styles.androidCheckMark} />
                    : <Text style={styles.selectedMarkText}>✓</Text>}
                </View>
              ) : null}
              <Text style={[styles.cardLabel, value === "none" && styles.noneCardLabel, { color: accent }]}>
                {value === "none" ? t("confidence.none").replace(" ", "\n") : value}
              </Text>
              <View style={styles.outcomes}>
                <View style={styles.outcomeRow}>
                  <Text style={styles.correctSymbol}>✓</Text>
                  <Text style={styles.outcomeCaption}>{t("confidence.correct")}</Text>
                  <Text style={styles.correctValue}>+{outcome.correct}</Text>
                </View>
                <View style={styles.outcomeDivider} />
                <View style={styles.outcomeRow}>
                  <Text style={styles.wrongSymbol}>×</Text>
                  <Text style={styles.outcomeCaption}>{t("confidence.wrong")}</Text>
                  <Text style={styles.wrongValue}>{outcome.wrong === 0 ? "-0" : outcome.wrong}</Text>
                </View>
              </View>
            </Pressable>
          );
        })}
      </View>

      {selected !== null && secondsLeft <= 5 && (
        <Text style={styles.lockedText}>
          {selected === "none"
            ? t("confidence.lockedNone")
            : t("confidence.lockedValue", { value: selected })}
        </Text>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: Platform.OS === "android" ? { maxWidth: 820, paddingHorizontal: 10 } : {},
  grid: {
    flexDirection: "row",
    justifyContent: "center",
    gap: Platform.OS === "android" ? 9 : 12,
    alignItems: "stretch",
    marginTop: 22,
    width: "100%",
  },
  subtitle: {
    color: theme.textDim,
    fontSize: 14,
    lineHeight: 19,
    fontWeight: "600",
    textAlign: "center",
    marginTop: 7,
  },
  card: {
    width: Platform.OS === "android" ? "18.3%" : "17%",
    minHeight: Platform.OS === "android" ? 142 : 156,
    backgroundColor: "rgba(31, 26, 51, 0.9)",
    borderRadius: 18,
    paddingVertical: Platform.OS === "android" ? 14 : 17,
    paddingHorizontal: 9,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    overflow: "hidden",
  },
  cardPressed: { transform: [{ scale: 0.97 }], opacity: 0.9 },
  cardDimmed: { opacity: 0.35 },
  riskMarker: { position: "absolute", top: 0, left: 0, right: 0, height: 5 },
  selectedMark: {
    position: "absolute",
    top: 10,
    right: 10,
    width: Platform.OS === "android" ? 20 : 22,
    height: Platform.OS === "android" ? 20 : 22,
    borderRadius: Platform.OS === "android" ? 10 : 11,
    alignItems: "center",
    justifyContent: "center",
  },
  selectedMarkText: {
    color: "#171220",
    fontSize: Platform.OS === "android" ? 11 : 14,
    lineHeight: Platform.OS === "android" ? 13 : 17,
    fontWeight: "900",
    textAlign: "center",
    ...(Platform.OS === "android" ? { transform: [{ translateY: -1 }] } : {}),
  },
  androidCheckMark: {
    width: 6,
    height: 10,
    borderRightWidth: 2,
    borderBottomWidth: 2,
    borderColor: "#171220",
    transform: [{ rotate: "45deg" }, { translateY: -1 }],
  },
  cardLabel: { fontSize: 27, lineHeight: 32, fontWeight: "900", textAlign: "center", width: "100%" },
  noneCardLabel: {
    fontSize: Platform.OS === "android" ? 12 : 15,
    lineHeight: Platform.OS === "android" ? 15 : 19,
    paddingHorizontal: Platform.OS === "android" ? 0 : 2,
  },
  outcomes: {
    width: "100%",
    marginTop: 15,
    paddingHorizontal: 4,
  },
  outcomeRow: { flexDirection: "row", alignItems: "center", minHeight: 24 },
  outcomeCaption: { color: theme.textDim, fontSize: 10, fontWeight: "700", flex: 1, marginLeft: 4 },
  correctSymbol: { color: "#65DFA1", fontSize: 15, fontWeight: "900" },
  wrongSymbol: { color: theme.danger, fontSize: 17, fontWeight: "900" },
  correctValue: { color: "#65DFA1", fontSize: 15, fontWeight: "900" },
  wrongValue: { color: theme.danger, fontSize: 15, fontWeight: "900" },
  outcomeDivider: { height: 1, backgroundColor: "rgba(255, 255, 255, 0.08)", marginVertical: 3 },
  lockedText: { color: theme.textDim, textAlign: "center", marginTop: 14, fontWeight: "700" },
});
