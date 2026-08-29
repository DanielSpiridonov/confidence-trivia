import React from "react";
import { View, Text, StyleSheet, FlatList, Platform, Animated } from "react-native";
import { useTranslation } from "react-i18next";
import { Room } from "colyseus.js";
import { ANDROID_GAME_UI_SCALE, Screen, Title, Subtitle, BigButton, theme } from "../components/ui";
import { useRoomState } from "../network/client";
import { PointsIcon } from "../components/PointsIcon";

export function FinalResultsScreen({ room, onExit }: { room: Room; onExit: () => void }) {
  const { t } = useTranslation();
  const state = useRoomState<any>(room);
  const currentPlayer = state?.players?.get(room.sessionId) as any;
  const starsEarned = currentPlayer?.starsEarnedThisGame ?? 0;
  const rewardedGamesToday = currentPlayer?.rewardedGamesToday ?? 0;
  const rewardScale = React.useRef(new Animated.Value(0)).current;
  const rewardOpacity = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    if (rewardedGamesToday <= 0) return;
    rewardScale.setValue(0);
    rewardOpacity.setValue(0);
    Animated.parallel([
      Animated.spring(rewardScale, {
        toValue: 1,
        speed: 28,
        bounciness: 7,
        useNativeDriver: true,
      }),
      Animated.timing(rewardOpacity, {
        toValue: 1,
        duration: 110,
        useNativeDriver: true,
      }),
    ]).start();
  }, [rewardOpacity, rewardScale, rewardedGamesToday]);

  if (!state) return null;

  const players = [...state.players.values()].map((p: any) => ({
    id: p.id,
    name: p.name,
    score: p.score,
    health: p.health,
    streak: p.streak,
    nameColor: p.nameColor,
  })).sort((a, b) => state.gameMode === "damage" ? b.health - a.health : b.score - a.score);
  const winner = players[0];
  const isDamageDraw = state.gameMode === "damage" && players.every((player) => player.health <= 0);
  const wonDamagePot = state.gameMode === "damage" && !isDamageDraw && winner?.id === room.sessionId;

  return (
    <Screen style={styles.screen} androidScale={ANDROID_GAME_UI_SCALE}>
      <Subtitle>{isDamageDraw ? t("final.draw") : t("final.winner")}</Subtitle>
      <Title>{isDamageDraw ? t("final.bothDefeated") : `🏆 ${winner?.name ?? "—"}`}</Title>

      {state.gameMode === "damage" ? (
        <View style={styles.wagerResult}>
          <PointsIcon size={18} />
          <Text style={styles.wagerResultText}>
            {isDamageDraw
              ? t("final.wagerRefunded", { count: state.damageWager })
              : wonDamagePot
                ? t("final.wagerWon", { count: state.damagePot })
                : t("final.wagerLost", { count: state.damageWager })}
          </Text>
        </View>
      ) : null}

      {rewardedGamesToday > 0 ? (
        <Animated.View
          style={[
            styles.rewardBanner,
            { opacity: rewardOpacity, transform: [{ scale: rewardScale }] },
          ]}
        >
          <PointsIcon size={Platform.OS === "android" ? 29 : 22} />
          <View style={styles.rewardTextBlock}>
            <Text style={styles.rewardTitle}>
              {starsEarned > 0
                ? t("final.starsEarned", { count: starsEarned })
                : t("final.dailyStarLimit")}
            </Text>
            <Text style={styles.rewardSubtitle}>
              {t("final.rewardedGamesToday", { count: rewardedGamesToday })}
            </Text>
          </View>
        </Animated.View>
      ) : null}

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
              <Text style={[styles.name, { color: item.nameColor || theme.text }]}>{item.name}{item.id === room.sessionId ? " (You)" : ""}</Text>
              {item.streak > 0 ? <Text style={styles.streak}>🔥 {item.streak}</Text> : null}
            </View>
            <Text style={styles.score}>{state.gameMode === "damage" ? `${item.health} HP` : item.score}</Text>
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
  wagerResult: { alignSelf: "center", flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 10, backgroundColor: "rgba(247, 216, 91, 0.12)", borderWidth: 1, borderColor: "rgba(247, 216, 91, 0.45)" },
  wagerResultText: { color: "#F7D85B", fontSize: 12, fontWeight: "900" },
  list: {
    flex: 1,
    minHeight: 0,
    width: "100%",
    marginTop: 12,
  },
  rewardBanner: {
    position: "absolute",
    top: 10,
    left: 10,
    zIndex: 3,
    ...(Platform.OS === "android" ? { width: 285, maxWidth: 285 } : { maxWidth: 230 }),
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 184, 77, 0.14)",
    borderColor: "#FFB84D",
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  rewardTextBlock: {
    marginLeft: 9,
    flexShrink: 1,
  },
  rewardTitle: {
    color: "#FFCF75",
    fontSize: Platform.OS === "android" ? 10 : 13,
    fontWeight: "900",
  },
  rewardSubtitle: {
    color: theme.textDim,
    fontSize: Platform.OS === "android" ? 8 : 10,
    fontWeight: "700",
    marginTop: 1,
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
});
