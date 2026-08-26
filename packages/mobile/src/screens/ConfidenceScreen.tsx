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

      <View style={styles.grid}>
        {CHOICES.map((value) => {
          const outcome = CONFIDENCE_SCORING[value];
          const isSelected = selected === value;
          const isFinalized = selected !== null && secondsLeft <= 5;
          return (
            <Pressable
              key={String(value)}
              onPress={() => choose(value)}
              disabled={isFinalized}
              style={[
                styles.card,
                isSelected && styles.cardSelected,
                isFinalized && !isSelected && styles.cardDimmed,
              ]}
            >
              <Text style={styles.cardLabel}>
                {value === "none" ? t("confidence.none") : value}
              </Text>
              <Text style={styles.cardOutcome}>
                +{outcome.correct} / {outcome.wrong}
              </Text>
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
    flexWrap:"wrap",
    justifyContent: "center",
    gap: Platform.OS === "android" ? 12 : 16,
    alignItems: "stretch",
    marginTop: 40,
    width: "100%",
  },
  card: {
    width: Platform.OS === "android" ? "30%" : "24%",
    backgroundColor: theme.surface,
    borderRadius: 14,
    paddingVertical: Platform.OS === "android" ? 12 : 18,
    paddingHorizontal: Platform.OS === "android" ? 8 : 0,
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: "0.5%",
    borderWidth: 2,
    borderColor: "transparent",
  },
  cardSelected: { borderColor: theme.primary },
  cardDimmed: { opacity: 0.35 },
  cardLabel: { color: theme.text, fontSize: 20, fontWeight: "800", textAlign: "center", width: "100%" },
  cardOutcome: { color: theme.textDim, marginTop: 4, textAlign: "center", fontSize: 13, width: "100%" },
  lockedText: { color: theme.textDim, textAlign: "center", marginTop: 8 },
});
