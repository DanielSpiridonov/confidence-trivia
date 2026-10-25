import React from "react";
import { View, Text, StyleSheet, FlatList, Animated } from "react-native";
import { useTranslation } from "react-i18next";
import { Room } from "colyseus.js";
import { ANDROID_GAME_UI_SCALE, Screen, BigButton, theme } from "../components/ui";
import { FontAwesome5 } from "@expo/vector-icons";
import { PointsIcon } from "../components/PointsIcon";
import { FRAME_COSMETIC_COLORS } from "@confidence-trivia/shared";
import { PlayerFrameEffect } from "../components/PlayerFrameEffect";

export function FinalResultsScreen({ room, state, onExit }: { room: Room; state: any; onExit: () => void }) {
  const { t } = useTranslation();
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
    frameId: p.frameId,
    team: p.team,
    forfeited: Boolean(p.forfeited || (state.gameMode === "ranked" && !p.connected)),
  })).sort((a, b) => Number(a.forfeited) - Number(b.forfeited) || (state.gameMode === "damage" ? b.health - a.health : b.score - a.score));
  const isFriendsDuos = state.gameMode === "friends" && state.friendsTeamMode === "duos";
  const teamRows = isFriendsDuos ? ["A", "B"].map((team) => {
    const members = players.filter((player) => player.team === team);
    return { id: `team-${team}`, name: t("lobby.team", { team }), score: members.reduce((total, player) => total + player.score, 0), health: 0, streak: 0, nameColor: team === "A" ? "#BFB2FF" : "#AEECD1", frameId: "", team, members: members.map((player) => player.name).join(" · "), isMine: members.some((player) => player.id === room.sessionId), forfeited: members.every(player => player.forfeited) };
  }).sort((left, right) => Number(left.forfeited) - Number(right.forfeited) || right.score - left.score) : null;
  const resultRows: Array<any> = teamRows ?? players;
  const winner = resultRows[0];
  const isDamageDraw = state.gameMode === "damage" && players.every((player) => player.health <= 0);
  const wonDamagePot = state.gameMode === "damage" && !isDamageDraw && winner?.id === room.sessionId;

  const metric = (row: any) => row.forfeited ? -Infinity : state.gameMode === "damage" ? row.health : row.score;
  const rankedRows = resultRows.map((row, index) => ({ ...row, rank: resultRows.findIndex(other => metric(other) === metric(row)) + 1 }));
  const mine = rankedRows.find(row => row.id === room.sessionId || row.isMine);
  const leaders = rankedRows.filter(row => row.rank === 1);
  const tied = !isDamageDraw && leaders.length > 1;

  function renderRow(item: any, pinned = false) {
    const isMine = item.id === room.sessionId || item.isMine;
    const frameColor = FRAME_COSMETIC_COLORS[item.frameId as keyof typeof FRAME_COSMETIC_COLORS];
    return <View style={[styles.row, isMine && styles.myRow, pinned && styles.pinnedRow, frameColor && state.gameMode !== "damage" ? { borderColor: frameColor } : null]}>
      {state.gameMode !== "damage" && item.frameId ? <PlayerFrameEffect frameId={item.frameId} /> : null}
      <View style={[styles.rankBadge, item.rank === 1 && styles.firstBadge]}>
        <Text style={[styles.rank, item.rank === 1 && styles.firstRank]}>#{item.rank}</Text>
      </View>
      <View style={styles.playerBlock}>
        <View style={styles.nameLine}>
          <Text numberOfLines={1} style={[styles.name, { color: item.nameColor || theme.text }]}>{item.name}</Text>
          {isMine ? <Text style={styles.you}>{t("common.you")}</Text> : null}
        </View>
        {item.members ? <Text numberOfLines={1} style={styles.teamMembers}>{item.members}</Text> : null}
      </View>
      <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.65} style={styles.score}>{state.gameMode === "damage" ? `${item.health} HP` : item.score}</Text>
    </View>;
  }

  return <Screen style={styles.screen} androidScale={ANDROID_GAME_UI_SCALE}>
    <View style={styles.layout}>
      <View style={styles.summary}>
        <Text style={styles.eyebrow}>{t("final.title")}</Text>
        <View style={styles.winnerBlock}>
          <View style={styles.crown}><FontAwesome5 name={isDamageDraw || tied ? "flag-checkered" : "crown"} size={29} color="#F7D887" /></View>
          <Text style={styles.winnerLabel}>{isDamageDraw || tied ? t("final.draw") : t("final.winner")}</Text>
          <Text numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.7} style={styles.winnerName}>{isDamageDraw ? t("final.bothDefeated") : tied ? t("final.sharedFirst", { count: leaders.length }) : winner?.name ?? "—"}</Text>
          <View style={styles.underline} />
        </View>
        {state.gameMode === "damage" ? <View style={styles.wagerResult}>
          <PointsIcon size={19} />
          <Text style={styles.wagerResultText}>{isDamageDraw ? t("final.wagerRefunded", { count: state.damageWager }) : wonDamagePot ? t("final.wagerWon", { count: state.damagePot }) : t("final.wagerLost", { count: state.damageWager })}</Text>
        </View> : null}
        {rewardedGamesToday > 0 ? <Animated.View style={[styles.rewardBanner, { opacity: rewardOpacity, transform: [{ scale: rewardScale }] }]}>
          <PointsIcon size={24} />
          <View style={styles.rewardTextBlock}>
            <Text style={styles.rewardTitle}>{starsEarned > 0 ? t("final.starsEarned", { count: starsEarned }) : t("final.dailyStarLimit")}</Text>
            <Text style={styles.rewardSubtitle}>{t("final.rewardedGamesToday", { count: rewardedGamesToday })}</Text>
          </View>
        </Animated.View> : null}
        <View style={styles.exit}><BigButton label={t("final.backToHome")} onPress={onExit} style={styles.exitButton} textStyle={styles.exitText} /></View>
      </View>
      <View style={styles.standings}>
        <View style={styles.standingsHeader}>
          <Text style={styles.standingsTitle}>{t("final.standings")}</Text>
          <Text style={styles.playerCount}>{t("final.playerCount", { count: players.length })}</Text>
        </View>
        <View style={styles.columnLabels}><Text style={styles.columnLabel}>{t("leaderboard.player")}</Text><Text style={styles.columnLabel}>{state.gameMode === "damage" ? "HP" : t("final.points")}</Text></View>
        <FlatList style={styles.list} data={rankedRows} keyExtractor={item => item.id} contentContainerStyle={styles.listContent} showsVerticalScrollIndicator persistentScrollbar initialNumToRender={8} renderItem={({ item }) => renderRow(item)} />
        {mine ? <View style={styles.personalResult}><Text style={styles.personalLabel}>{t("final.yourResult")}</Text>{renderRow(mine, true)}</View> : null}
      </View>
    </View>
  </Screen>;
}

const styles = StyleSheet.create({
  screen: { justifyContent: "flex-start", paddingTop: 12, paddingBottom: 12 },
  layout: { flex: 1, minHeight: 0, width: "100%", flexDirection: "row", gap: 18 },
  summary: { width: "32%", padding: 16 },
  eyebrow: { color: "#BBA6D6", fontSize: 11, fontWeight: "900", letterSpacing: 1.4, textTransform: "uppercase", textAlign: "center" },
  winnerBlock: { flex: 1, minHeight: 90, alignItems: "center", justifyContent: "center", paddingVertical: 6 },
  crown: { marginBottom: 5 },
  winnerLabel: { color: "#C2B3D3", fontSize: 11, fontWeight: "700" },
  winnerName: { color: "#FFF1CF", fontSize: 26, lineHeight: 31, fontWeight: "900", textAlign: "center", width: "100%", marginTop: 3 },
  underline: { width: "48%", height: 3, borderRadius: 2, backgroundColor: "#AF7BE2", marginTop: 9, transform: [{ rotate: "-3deg" }] },
  wagerResult: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 7 },
  wagerResultText: { flex: 1, color: "#F7D887", fontSize: 11, fontWeight: "800" },
  rewardBanner: { flexDirection: "row", alignItems: "center", gap: 8, padding: 9, borderRadius: 10, borderWidth: 1, borderColor: "#715535", backgroundColor: "#352A31" },
  rewardTextBlock: { flex: 1, minWidth: 0 },
  rewardTitle: { color: "#F7D887", fontSize: 12, fontWeight: "900" },
  rewardSubtitle: { color: "#C1B3CF", fontSize: 9, marginTop: 3 },
  exit: { paddingTop: 10 },
  exitButton: { minHeight: 40, paddingVertical: 9, paddingHorizontal: 8, backgroundColor: "#503598", borderRadius: 11 },
  exitText: { fontSize: 13 },
  standings: { flex: 1, minWidth: 0, minHeight: 0, borderRadius: 18, borderWidth: 1, borderColor: "#58436E", backgroundColor: "rgba(23,17,34,0.92)", padding: 12 },
  standingsHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 9 },
  standingsTitle: { color: "#F5EBDC", fontSize: 21, fontWeight: "900" },
  playerCount: { color: "#C0ACD5", fontSize: 11, fontWeight: "700" },
  columnLabels: { flexDirection: "row", justifyContent: "space-between", paddingLeft: 48, paddingRight: 10, paddingBottom: 6 },
  columnLabel: { color: "#A997BD", fontSize: 9, fontWeight: "800", textTransform: "uppercase", letterSpacing: 1 },
  list: { flex: 1, minHeight: 0, width: "100%" },
  listContent: { paddingBottom: 2 },
  row: { minHeight: 43, flexDirection: "row", alignItems: "center", paddingHorizontal: 9, paddingVertical: 7, marginBottom: 5, borderRadius: 10, backgroundColor: "#261E34", borderWidth: 1, borderColor: "#3E324F", overflow: "hidden", gap: 9 },
  myRow: { backgroundColor: "#39264F", borderColor: "#AE7AE1" },
  pinnedRow: { marginBottom: 0 },
  rankBadge: { width: 29, height: 27, borderRadius: 8, alignItems: "center", justifyContent: "center", backgroundColor: "#352A45" },
  firstBadge: { backgroundColor: "#584328" },
  rank: { color: "#C8B4DF", fontSize: 12, fontWeight: "900" },
  firstRank: { color: "#F7D887" },
  playerBlock: { flex: 1, minWidth: 0 },
  nameLine: { flexDirection: "row", alignItems: "center", gap: 6 },
  name: { flexShrink: 1, color: theme.text, fontSize: 13, fontWeight: "800" },
  you: { color: "#C8A9ED", fontSize: 9, fontWeight: "800" },
  teamMembers: { color: "#BCAFCA", fontSize: 10, marginTop: 3 },
  score: { maxWidth: "30%", minWidth: 42, color: "#F5EBDC", fontSize: 18, fontWeight: "900", textAlign: "right" },
  personalResult: { borderTopWidth: 1, borderTopColor: "#493658", paddingTop: 7, marginTop: 5 },
  personalLabel: { color: "#BCA4D4", fontSize: 9, fontWeight: "900", textTransform: "uppercase", letterSpacing: 1, marginBottom: 5 },
});
