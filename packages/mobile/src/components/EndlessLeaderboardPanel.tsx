import React from "react";
import { ActivityIndicator, FlatList, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { Ionicons } from "@expo/vector-icons";
import type { EndlessLeaderboard, EndlessLeaderboardEntry } from "@confidence-trivia/shared";
import { getEndlessLeaderboard } from "../network/client";
import { menuTap } from "./menuHaptics";

const CHALK = Platform.OS === "ios" ? "ChalkboardSE-Regular" : "casual";
function Crown({ color = "#E9C779", size = 30 }: { color?: string; size?: number }) {
  return <Svg accessible={false} width={size} height={size} viewBox="0 0 40 40"><Path d="m7 29-3-18 10 8 6-14 7 14 10-8-4 18Z" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" /><Path d="m8 33 24-1M7 27l25-1" stroke={color} strokeWidth="1.5" strokeLinecap="round" /></Svg>;
}
function Place({ position }: { position: number }) {
  const metal = ["#EFCA79", "#C5BAD8", "#D89F87"][position - 1];
  return <View style={s.place}>{metal ? <Crown color={metal} size={27} /> : null}<Text style={[s.position, metal && { color: metal }]}>{position}</Text></View>;
}
function LeaderboardRow({ entry, playerId }: { entry: EndlessLeaderboardEntry; playerId: string }) {
  const mine = entry.playerId === playerId;
  return <View accessibilityLabel={`Rank ${entry.position}, ${mine ? "You, " : ""}${entry.displayName}, ${entry.score} correct answers`} style={[s.row, mine && s.mine]}>
    <Place position={entry.position} /><Text numberOfLines={1} style={[s.name, mine && s.myName]}>{mine ? "You" : entry.displayName}</Text>
    {mine ? <Text numberOfLines={1} style={s.myDisplayName}>{entry.displayName}</Text> : null}<Text style={s.score}>{entry.score}</Text>
  </View>;
}
export function EndlessLeaderboardPanel({ playerId }: { playerId: string }) {
  const [board, setBoard] = React.useState<EndlessLeaderboard | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [revision, setRevision] = React.useState(0);
  React.useEffect(() => {
    let alive = true; setLoading(true); setError(null); setBoard(null);
    void getEndlessLeaderboard(playerId).then((result) => { if (alive) setBoard(result); }).catch((e) => { if (alive) setError(e instanceof Error ? e.message : "Leaderboard unavailable."); }).finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [playerId, revision]);
  const current = board?.currentPlayer;
  const outsideTop = current && !board?.top.some((entry) => entry.playerId === playerId);
  return <View style={s.container}>
    <View style={s.card}>
      <Crown size={39} /><Text style={s.cardTitle}>Your best score</Text>
      <Text style={s.bigScore}>{current?.score ?? (board ? 0 : "—")}</Text><Text style={s.points}>correct answers</Text>
      <View style={s.chalkRule} /><Text style={s.rankLabel}>Global rank</Text><Text style={s.globalRank}>{current ? `#${current.position}` : "—"}</Text>
      <Text style={s.hint}>{current ? "One run. Your highest climb." : "Set your first score to join the board."}</Text>
    </View>
    <View style={s.board}>
      <View style={s.titleRow}><Ionicons name="podium-outline" size={22} color="#BF97E6" /><Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={s.title}>Endless leaderboard</Text><Text style={s.allTime}>All-time</Text></View>
      <View style={s.header}><Text style={s.rankHeader}>Rank</Text><Text style={s.playerHeader}>Player</Text><Text style={s.scoreHeader}>Best score</Text></View>
      {loading ? <View style={s.message}><ActivityIndicator color="#C6A5E6" /><Text style={s.messageText}>Finding the highest climbs…</Text></View> : error ? <View style={s.message}><Text style={s.messageText}>{error}</Text><Pressable accessibilityRole="button" onPress={() => { menuTap(); setRevision((n) => n + 1); }} style={s.retry}><Text style={s.retryText}>Try again</Text></Pressable></View> : <>
        <FlatList style={s.list} data={board?.top ?? []} keyExtractor={(entry) => entry.playerId} renderItem={({ item }) => <LeaderboardRow entry={item} playerId={playerId} />} ListEmptyComponent={<View style={s.message}><Crown size={36} /><Text style={s.emptyTitle}>The summit is waiting.</Text><Text style={s.messageText}>Be the first to set a score.</Text></View>} contentContainerStyle={board?.top.length ? s.rows : s.emptyList} />
        {outsideTop ? <View style={s.currentWrap}><LeaderboardRow entry={current} playerId={playerId} /></View> : null}
      </>}
    </View>
  </View>;
}
const s = StyleSheet.create({
  container: { flex: 1, minHeight: 0, flexDirection: "row", gap: 16, marginTop: 8 },
  card: { width: 190, backgroundColor: "rgba(24,17,36,0.82)", borderWidth: 1.5, borderColor: "#665078", borderRadius: 20, alignItems: "center", justifyContent: "center", paddingHorizontal: 15, paddingVertical: 10 },
  cardTitle: { color: "#F4E8FC", fontFamily: CHALK, fontSize: 19, marginTop: 1 }, bigScore: { color: "#F4E8FC", fontFamily: CHALK, fontSize: 58, lineHeight: 67 }, points: { color: "#BFAACD", fontFamily: CHALK, fontSize: 13, marginTop: -4 },
  chalkRule: { width: "76%", borderTopWidth: 1, borderColor: "#69517E", transform: [{ rotate: "-2deg" }], marginVertical: 11 }, rankLabel: { color: "#BFAACD", fontFamily: CHALK, fontSize: 14 }, globalRank: { color: "#DEC3F4", fontFamily: CHALK, fontSize: 28, lineHeight: 34 },
  hint: { color: "#A995BB", fontFamily: CHALK, fontSize: 11, lineHeight: 15, textAlign: "center", marginTop: 8 },
  board: { flex: 1, minWidth: 0, minHeight: 0, borderRadius: 21, backgroundColor: "rgba(24,17,36,0.85)", borderWidth: 1.5, borderColor: "#665078", paddingHorizontal: 15, paddingTop: 10, paddingBottom: 8 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 9, paddingBottom: 8, flexShrink: 0 }, title: { flex: 1, color: "#F4E8FC", fontFamily: CHALK, fontSize: 22 }, allTime: { color: "#BBA2D0", fontFamily: CHALK, fontSize: 13 },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 7, paddingBottom: 7, borderBottomWidth: 1, borderColor: "rgba(176,139,204,0.24)", flexShrink: 0 }, rankHeader: { width: 56, color: "#A992BD", fontFamily: CHALK, fontSize: 12 }, playerHeader: { flex: 1, color: "#A992BD", fontFamily: CHALK, fontSize: 12 }, scoreHeader: { color: "#A992BD", fontFamily: CHALK, fontSize: 12 },
  list: { flex: 1, minHeight: 0 }, rows: { paddingTop: 5, paddingBottom: 5 }, emptyList: { flexGrow: 1 },
  row: { flexDirection: "row", alignItems: "center", minHeight: 41, gap: 8, borderRadius: 11, paddingHorizontal: 7, marginVertical: 2, borderWidth: 1, borderColor: "transparent" }, mine: { backgroundColor: "rgba(112,75,150,0.27)", borderColor: "rgba(187,147,222,0.25)" }, place: { width: 47, flexDirection: "row", alignItems: "center", gap: 3 }, position: { color: "#B7A1C7", fontFamily: CHALK, fontSize: 15 },
  name: { flex: 1, minWidth: 0, color: "#D1BCDF", fontFamily: CHALK, fontSize: 17 }, myName: { color: "#F5E7FF" }, myDisplayName: { color: "#A992BD", fontFamily: CHALK, fontSize: 11, maxWidth: "30%" }, score: { minWidth: 44, color: "#F5E7FF", fontFamily: CHALK, fontSize: 20, textAlign: "right", fontVariant: ["tabular-nums"] },
  currentWrap: { paddingTop: 4, borderTopWidth: 1, borderColor: "rgba(176,139,204,0.24)" }, message: { flex: 1, minHeight: 80, alignItems: "center", justifyContent: "center", gap: 10, padding: 14 }, messageText: { color: "#BBA6CC", fontFamily: CHALK, fontSize: 14, textAlign: "center" }, emptyTitle: { color: "#E4CCF4", fontFamily: CHALK, fontSize: 21 },
  retry: { paddingHorizontal: 18, paddingVertical: 7, borderWidth: 1, borderColor: "#9171AD", borderRadius: 11, backgroundColor: "#39244D" }, retryText: { color: "#E9D3FB", fontFamily: CHALK, fontSize: 16 },
});
