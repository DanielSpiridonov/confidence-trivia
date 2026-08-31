import React from "react";
import { View, Text, FlatList, Platform, StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";
import { theme } from "../components/ui";
import { FRAME_COSMETIC_COLORS } from "@confidence-trivia/shared";
import { PlayerFrameEffect } from "../components/PlayerFrameEffect";

interface PlayerRow {
  id: string;
  name: string;
  score: number;
  streak: number;
  nameColor?: string;
  frameId?: string;
}

/** Compact leaderboard embedded in the between-round reveal screen. */
export function LeaderboardStrip({
  players,
  myPlayerId,
}: {
  players: PlayerRow[];
  myPlayerId?: string;
}) {
  const { t } = useTranslation();
  const ranked = [...players].sort((a, b) => b.score - a.score);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t("leaderboard.title")}</Text>
      <FlatList
        style={styles.playerList}
        data={ranked}
        keyExtractor={(player) => player.id}
        nestedScrollEnabled
        scrollEnabled
        contentContainerStyle={styles.playerListContent}
        showsVerticalScrollIndicator={ranked.length > 4}
        renderItem={({ item: player, index }) => (
          <View style={[styles.row, player.frameId ? { borderWidth: 2, borderColor: FRAME_COSMETIC_COLORS[player.frameId as keyof typeof FRAME_COSMETIC_COLORS] } : null]}>
            <PlayerFrameEffect frameId={player.frameId} />
            <Text style={styles.rank}>#{index + 1}</Text>
            <Text
              numberOfLines={1}
              ellipsizeMode="tail"
              adjustsFontSizeToFit
              minimumFontScale={0.75}
              style={[styles.name, { color: player.nameColor || theme.text }]}
            >
              {player.name}{player.id === myPlayerId ? " (You)" : ""}
            </Text>
            {player.streak > 0 ? <Text numberOfLines={1} style={styles.streak}>🔥{player.streak}</Text> : null}
            <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75} style={styles.score}>{player.score}</Text>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    minHeight: 0,
    backgroundColor: theme.surface,
    borderRadius: 12,
    padding: 12,
    marginTop: 12,
    overflow: "hidden",
  },
  title: { color: theme.textDim, fontWeight: "700", marginBottom: 8, fontSize: Platform.OS === "android" ? 11 : 13 },
  playerList: { flex: 1, minHeight: 0 },
  playerListContent: { paddingBottom: 8 },
  row: { flexDirection: "row", alignItems: "center", paddingHorizontal: 6, paddingVertical: 6, borderRadius: 8, marginBottom: 3 },
  rank: { color: theme.textDim, width: 26, fontSize: Platform.OS === "android" ? 11 : 14, fontWeight: "700" },
  name: { color: theme.text, flex: 1, flexShrink: 1, fontSize: Platform.OS === "android" ? 11 : 14, fontWeight: "600", paddingRight: 6 },
  streak: { color: "#FFB84D", marginRight: 6, flexShrink: 0, fontSize: Platform.OS === "android" ? 11 : 14, fontWeight: "700" },
  score: { color: theme.primary, fontSize: Platform.OS === "android" ? 12 : 14, fontWeight: "800", width: 48, flexShrink: 0, textAlign: "right" },
});
