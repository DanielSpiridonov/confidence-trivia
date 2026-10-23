import React from "react";
import { ActivityIndicator, FlatList, Image, Pressable, StyleSheet, Text, View } from "react-native";
import type { EndlessLeaderboard, EndlessLeaderboardEntry } from "@confidence-trivia/shared";
import { getEndlessLeaderboard } from "../network/client";
import { theme } from "./ui";

const AVATARS: Record<string, number> = {
  smart_owl: require("../../assets/avatar-heads/smart-owl.png"),
  clever_fox: require("../../assets/avatar-heads/fox.png"),
  quiz_bot: require("../../assets/avatar-heads/quiz-bot.png"),
  omniscient_avatar: require("../../assets/avatar-heads/omniscient.png"),
  trivia_wizard: require("../../assets/avatar-heads/trivia-wizard.png"),
  detective_avatar: require("../../assets/avatar-heads/detective.png"),
  living_globe: require("../../assets/avatar-heads/globe.png"),
};
export function EndlessLeaderboardPanel({ playerId }: { playerId: string }) {
  const [board, setBoard] = React.useState<EndlessLeaderboard | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [revision, setRevision] = React.useState(0);
  React.useEffect(() => {
    let alive = true; setLoading(true); setError(null);
    void getEndlessLeaderboard(playerId).then((result) => { if (alive) setBoard(result); }).catch((e) => { if (alive) setError(e instanceof Error ? e.message : "Leaderboard unavailable."); }).finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [playerId, revision]);
  const current = board?.currentPlayer;
  function row(entry: EndlessLeaderboardEntry) {
    const mine = entry.playerId === playerId;
    return <View style={[s.row, mine && s.mine]}>
      <Text style={s.position}>#{entry.position}</Text><Image source={AVATARS[entry.avatarId] ?? AVATARS.smart_owl} style={s.avatar} resizeMode="contain" />
      <Text numberOfLines={1} style={s.name}>{entry.displayName}{mine ? " (You)" : ""}</Text><Text style={s.score}>{entry.score}</Text>
    </View>;
  }
  return <View style={s.container}>
    <View style={s.card}><Text style={s.eyebrow}>ENDLESS · ALL TIME</Text><Text style={s.bigScore}>{current?.score ?? (board ? 0 : "—")}</Text><Text style={s.label}>Your personal best</Text><Text style={s.hint}>{current ? `Global position #${current.position}` : "Answer a question correctly to enter the board."}</Text><Text style={s.hint}>Every score is one verified run.</Text></View>
    <View style={s.board}><View style={s.header}><Text style={s.label}>PLAYER</Text><Text style={s.label}>BEST SCORE</Text></View>
      {loading ? <ActivityIndicator color="#C6A5FF" style={{ margin: 24 }} /> : error ? <View style={s.message}><Text style={s.label}>{error}</Text><Pressable accessibilityRole="button" accessibilityLabel="Retry leaderboard" onPress={() => setRevision((n) => n + 1)}><Text style={s.retry}>Retry</Text></Pressable></View> : <>
        <FlatList data={board?.top ?? []} keyExtractor={(item) => item.playerId} renderItem={({ item }) => row(item)} ListEmptyComponent={<Text style={s.empty}>The road is open. Be the first to set a record!</Text>} />
        {current && !board?.top.some((e) => e.playerId === playerId) ? row(current) : null}
      </>}
    </View>
  </View>;
}
const s = StyleSheet.create({
  container: { flex: 1, minHeight: 0, flexDirection: "row", gap: 12, marginTop: 6 }, card: { width: 170, backgroundColor: "rgba(31,26,51,0.96)", borderWidth: 1, borderColor: "#A479CB", borderRadius: 14, alignItems: "center", justifyContent: "center", padding: 12, gap: 8 },
  eyebrow: { color: "#D8B9F8", fontSize: 10, fontWeight: "900", letterSpacing: 1 }, bigScore: { color: "#FFE398", fontSize: 58, fontWeight: "900" }, label: { color: theme.text, fontSize: 11, fontWeight: "800" }, hint: { color: theme.textDim, fontSize: 10, textAlign: "center" },
  board: { flex: 1, minHeight: 0, borderRadius: 12, backgroundColor: "rgba(31,22,44,0.97)", borderWidth: 2, borderColor: "#71518E", padding: 10 }, header: { flexDirection: "row", justifyContent: "space-between", borderBottomWidth: 1, borderColor: "#71518E", paddingBottom: 8 }, row: { flexDirection: "row", alignItems: "center", minHeight: 36, gap: 8, borderRadius: 6, paddingHorizontal: 6 },
  mine: { backgroundColor: "#584071", borderWidth: 1, borderColor: "#CFA4FA" }, position: { width: 35, color: theme.textDim, fontSize: 11, fontWeight: "700" }, avatar: { width: 29, height: 29 }, name: { flex: 1, color: theme.text, fontSize: 12, fontWeight: "700" }, score: { color: "#FFE398", fontSize: 16, fontWeight: "900" }, message: { padding: 20, gap: 12 }, retry: { color: "#D8B9F8", fontSize: 14, fontWeight: "800" }, empty: { color: theme.textDim, textAlign: "center", padding: 28, fontSize: 12 },
});
