import React from "react";
import { View, Text, StyleSheet, FlatList } from "react-native";
import { useTranslation } from "react-i18next";
import { Room } from "colyseus.js";
import { ANDROID_GAME_UI_SCALE, Screen, Title, Subtitle, BigButton, theme } from "../components/ui";
import { useRoomState } from "../network/client";

export function FinalResultsScreen({ room, onExit }: { room: Room; onExit: () => void }) {
  const { t } = useTranslation();
  const state = useRoomState<any>(room);
  if (!state) return null;

  const players = [...state.players.values()].map((p: any) => ({
    id: p.id,
    name: p.name,
    score: p.score,
    lifetimePoints: p.lifetimePoints,
    streak: p.streak,
  })).sort((a, b) => b.score - a.score);
  const winner = players[0];

  return (
    <Screen style={styles.screen} androidScale={ANDROID_GAME_UI_SCALE}>
      <Subtitle>{t("final.winner")}</Subtitle>
      <Title>🏆 {winner?.name ?? "—"}</Title>

      <FlatList
        style={styles.list}
        data={players}
        keyExtractor={(player) => player.id}
        contentContainerStyle={styles.listContent}
        nestedScrollEnabled
        showsVerticalScrollIndicator={players.length > 4}
        renderItem={({ item, index }) => (
          <View style={[styles.row, item.id === room.sessionId && styles.myRow]}>
            <Text style={styles.rank}>#{index + 1}</Text>
            <View style={styles.playerBlock}>
              <Text style={styles.name}>{item.name}{item.id === room.sessionId ? " (You)" : ""}</Text>
              {item.streak > 0 ? <Text style={styles.streak}>🔥 {item.streak}</Text> : null}
            </View>
            <View style={styles.pointsBlock}>
              <Text style={styles.score}>{item.score}</Text>
              <Text style={styles.lifetimePoints}>{t("final.lifetimePoints", { count: item.lifetimePoints })}</Text>
            </View>
          </View>
        )}
      />

      <BigButton label={t("final.backToHome")} onPress={onExit} variant="secondary" />
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: {
    justifyContent: "flex-start",
    paddingTop: 12,
  },
  list: {
    flex: 1,
    minHeight: 0,
    width: "100%",
    marginTop: 12,
  },
  listContent: {
    paddingBottom: 12,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.surface,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 8,
  },
  myRow: {
    borderWidth: 2,
    borderColor: theme.primary,
  },
  rank: {
    color: theme.textDim,
    width: 34,
    fontSize: 15,
    fontWeight: "800",
  },
  playerBlock: {
    flex: 1,
    paddingRight: 12,
    flexDirection: "row",
    alignItems: "center",
  },
  name: {
    color: theme.text,
    fontSize: 16,
    fontWeight: "700",
  },
  streak: {
    color: "#FFB84D",
    marginLeft: 10,
    fontSize: 12,
    fontWeight: "700",
  },
  score: {
    color: theme.primary,
    fontSize: 20,
    fontWeight: "900",
    minWidth: 48,
    textAlign: "right",
  },
  pointsBlock: {
    alignItems: "flex-end",
  },
  lifetimePoints: {
    color: theme.textDim,
    fontSize: 11,
    fontWeight: "600",
  },
});
