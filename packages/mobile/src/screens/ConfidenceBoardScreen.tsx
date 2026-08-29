import React, { useEffect, useState } from "react";
import { View, Text, Pressable, FlatList, StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";
import { Room } from "colyseus.js";
import { ANDROID_GAME_UI_SCALE, Screen, Title, Subtitle, BigButton, theme } from "../components/ui";
import { useRoomState } from "../network/client";
import { PhaseTimer, usePhaseSecondsLeft } from "../components/PhaseTimer";

export function ConfidenceBoardScreen({ room, mySessionId }: { room: Room; mySessionId: string }) {
  const { t } = useTranslation();
  const state = useRoomState<any>(room);
  const [selectedTarget, setSelectedTarget] = useState<string | null>(null);
  const [selectedPrediction, setSelectedPrediction] = useState<"correct" | "wrong" | "skip" | null>(null);
  const secondsLeft = usePhaseSecondsLeft(state?.phaseEndsAt ?? 0);

  useEffect(() => {
    setSelectedTarget(null);
    setSelectedPrediction(null);
  }, [state?.currentQuestion?.id]);

  if (!state) return null;

  const board = [...state.confidenceBoard].filter((e: any) => e.playerId !== mySessionId);
  const nameFor = (id: string) => state.players.get(id)?.name ?? "?";
  const isFinalized = selectedPrediction !== null && secondsLeft <= 5;

  function placeBet(prediction: "correct" | "wrong") {
    if (!selectedTarget || isFinalized) return;
    setSelectedPrediction(prediction);
    room.send("submitSideBet", { targetId: selectedTarget, prediction });
  }

  function skipBet() {
    if (isFinalized) return;
    setSelectedTarget(null);
    setSelectedPrediction("skip");
    room.send("skipSideBet");
  }

  return (
    <Screen androidScale={ANDROID_GAME_UI_SCALE}>
      <PhaseTimer phaseEndsAt={state.phaseEndsAt} />
      <Title>{t("board.title")}</Title>

      <FlatList
        style={styles.list}
        data={board}
        keyExtractor={(e: any) => e.playerId}
        renderItem={({ item }: any) => (
          <Pressable
            onPress={() => !isFinalized && setSelectedTarget((current) => current === item.playerId ? null : item.playerId)}
            style={[styles.row, selectedTarget === item.playerId && styles.rowSelected]}
          >
            <Text style={[styles.name, { color: state.players.get(item.playerId)?.nameColor || theme.text }]}>{nameFor(item.playerId)}</Text>
            <Text style={styles.confidence}>
              {item.confidence === "none" ? "—" : item.confidence}
            </Text>
          </Pressable>
        )}
      />

      {selectedTarget && !isFinalized && (
        <>
          <Subtitle>{t("board.sideBetPrompt")}</Subtitle>
          <View style={styles.betRow}>
            <View style={styles.betButton}>
              <BigButton label={t("board.correct")} onPress={() => placeBet("correct")} />
            </View>
            <View style={styles.betButton}>
              <BigButton label={t("board.wrong")} onPress={() => placeBet("wrong")} variant="danger" />
            </View>
          </View>
        </>
      )}
      {!isFinalized && (
        <BigButton label={t("board.skip")} onPress={skipBet} variant="secondary" />
      )}
      {isFinalized && <Subtitle>{t("board.waitingReveal")}</Subtitle>}
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { flexGrow: 0, maxHeight: 300, marginVertical: 12, width: "100%" },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: theme.surface,
    padding: 14,
    borderRadius: 10,
    marginBottom: 8,
    borderWidth: 2,
    borderColor: "transparent",
  },
  rowSelected: { borderColor: theme.primary },
  name: { color: theme.text, fontSize: 16, fontWeight: "600", flex: 1, flexShrink: 1, paddingRight: 12 },
  confidence: { color: theme.primary, fontWeight: "800", fontSize: 16 },
  betRow: { flexDirection: "row", justifyContent: "space-between", width: "100%" },
  betButton: { width: "48%" },
});
