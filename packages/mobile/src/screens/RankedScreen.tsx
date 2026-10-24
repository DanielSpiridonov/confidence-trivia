import React from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { getRankedDivision, RANKED_PLACEMENT_MATCHES } from "@confidence-trivia/shared";
import { ANDROID_MENU_UI_SCALE, BackIconButton, Screen, theme } from "../components/ui";
import { getRankedLeaderboard, RankedLeaderboardEntry, RankedLeaderboardResponse } from "../network/client";
import { RankIcon } from "../components/RankIcon";
import { EndlessLeaderboardPanel } from "../components/EndlessLeaderboardPanel";
import { LeaderboardSwitch, type LeaderboardTab } from "../components/LeaderboardSwitch";

export function RankedScreen({
  deviceId,
  onBack,
  initialTab = "ranked",
}: {
  deviceId: string;
  onBack: () => void;
  initialTab?: "ranked" | "endless";
}) {
  const { t } = useTranslation();
  const [tab, setTab] = React.useState(initialTab);
  const [visited, setVisited] = React.useState({ ranked: initialTab === "ranked", endless: initialTab === "endless" });
  const [leaderboard, setLeaderboard] = React.useState<RankedLeaderboardResponse | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(false);
  const [revision, setRevision] = React.useState(0);

  function selectTab(value: LeaderboardTab) {
    setVisited((previous) => ({ ...previous, [value]: true }));
    setTab(value);
  }

  React.useEffect(() => {
    if (!visited.ranked) return;
    let cancelled = false;
    setLoading(true); setError(false); setLeaderboard(null);
    void getRankedLeaderboard(deviceId).then((response) => {
      if (cancelled) return;
      setLeaderboard(response);
    }).catch(() => { if (!cancelled) setError(true); }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [deviceId, visited.ranked, revision]);

  const current = leaderboard?.currentPlayer ?? null;
  const currentIsInTop = Boolean(current && leaderboard?.top.some((entry) => entry.playerId === current.playerId));

  return (
    <Screen style={styles.screen} androidScale={ANDROID_MENU_UI_SCALE * 0.9}>
      <BackIconButton label={t("common.back")} onPress={onBack} />
      <LeaderboardSwitch value={tab} rankedLabel={t("create.ranked")} onChange={selectTab} />

      {visited.endless ? <View style={[styles.tabPanel, tab !== "endless" && styles.hidden]}><EndlessLeaderboardPanel key={deviceId} playerId={deviceId} /></View> : null}
      {visited.ranked ? <View style={[styles.content, tab !== "ranked" && styles.hidden]}>
        {current ? <PlayerRankCard entry={current} t={t} /> : null}
        <View style={[styles.boardFrame, styles.leaderboardPanel]}>
          <BoardPins />
          <View style={styles.headerRow}>
            <Text style={[styles.header, styles.position]}>{t("ranked.spot")}</Text>
            <Text style={[styles.header, styles.player]}>{t("ranked.player")}</Text>
            <Text style={[styles.header, styles.lp]}>{t("ranked.lp")}</Text>
            <Text style={[styles.header, styles.rank]}>{t("ranked.rank")}</Text>
            <Text style={[styles.header, styles.wins]}>{t("ranked.wins")}</Text>
          </View>
          {loading ? <Text style={styles.message}>{t("ranked.loading")}</Text> : null}
          {error ? <Pressable accessibilityRole="button" accessibilityLabel="Retry ranked leaderboard" onPress={() => setRevision((n) => n + 1)} style={styles.errorRetry}><Text style={styles.retryText}>Couldn’t load rankings · Try again</Text></Pressable> : null}
          {!loading && !error && leaderboard?.top.length === 0 ? <Text style={styles.message}>{t("ranked.empty")}</Text> : null}
          <FlatList
            style={styles.list}
            data={leaderboard?.top ?? []}
            keyExtractor={(entry) => entry.playerId}
            renderItem={({ item }) => <LeaderboardRow entry={item} isCurrent={item.playerId === current?.playerId} t={t} />}
          />
          {current && !currentIsInTop ? (
            <View style={styles.currentWrap}>
              <LeaderboardRow entry={current} isCurrent t={t} />
            </View>
          ) : null}
        </View>

      </View> : null}
    </Screen>
  );
}

function LeaderboardRow({ entry, isCurrent, t }: { entry: RankedLeaderboardEntry; isCurrent: boolean; t: (key: string, options?: any) => string }) {
  const rank = entry.rankKey === "novice" ? null : getRankedDivision(entry.lp);
  const rankLabel = t(`ranked.ranks.${entry.rankKey}`);
  return (
    <View style={[styles.row, isCurrent && styles.currentRow]}>
      <Text numberOfLines={1} style={[styles.cell, styles.position]}>{entry.position ? `#${entry.position}` : "—"}</Text>
      <Text numberOfLines={1} ellipsizeMode="tail" style={[styles.cell, styles.player]}>{entry.displayName}{isCurrent ? ` (${t("common.you")})` : ""}</Text>
      <Text numberOfLines={1} style={[styles.cell, styles.lp]}>{entry.placementMatches < RANKED_PLACEMENT_MATCHES ? "—" : entry.lp}</Text>
      <View style={[styles.rank, styles.rankCell]}>
        <RankIcon rankKey={entry.rankKey} size={20} />
        <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.65} style={[styles.cell, styles.rankLabel, { color: rank?.color ?? theme.textDim }]}>{rankLabel}</Text>
      </View>
      <Text numberOfLines={1} style={[styles.cell, styles.wins]}>{entry.wins}</Text>
    </View>
  );
}

function BoardPins() {
  return <>
    <View pointerEvents="none" style={[styles.framePin, styles.framePinTopLeft]} />
    <View pointerEvents="none" style={[styles.framePin, styles.framePinTopRight]} />
    <View pointerEvents="none" style={[styles.framePin, styles.framePinBottomLeft]} />
    <View pointerEvents="none" style={[styles.framePin, styles.framePinBottomRight]} />
  </>;
}

function PlayerRankCard({ entry, t }: { entry: RankedLeaderboardEntry; t: (key: string, options?: any) => string }) {
  const isPlaced = entry.placementMatches >= RANKED_PLACEMENT_MATCHES;
  const division = isPlaced ? getRankedDivision(entry.lp) : null;
  const matchesPlayed = Math.min(entry.placementMatches, RANKED_PLACEMENT_MATCHES);

  return (
    <View style={[styles.boardFrame, styles.rankCard]}>
      <BoardPins />
      <Text style={styles.rankCardEyebrow}>{t("ranked.yourRank")}</Text>
      {isPlaced ? <RankIcon rankKey={entry.rankKey} size={76} style={styles.rankCardIcon} /> : null}
      <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={[styles.rankCardName, division && { color: division.color }]}>
        {isPlaced ? t(`ranked.ranks.${entry.rankKey}`) : t("ranked.ranks.novice")}
      </Text>
      <View style={styles.rankCardDivider} />
      {isPlaced ? (
        <>
          <Text style={styles.rankCardLp}>{t("ranked.lpValue", { value: entry.lp })}</Text>
          <Text style={styles.rankCardPosition}>{entry.position ? t("ranked.globalPosition", { position: entry.position }) : ""}</Text>
        </>
      ) : (
        <>
          <Text style={styles.rankCardProgressLabel}>{t("ranked.placementMatchesLabel")}</Text>
          <Text style={styles.rankCardProgress}>{matchesPlayed}/{RANKED_PLACEMENT_MATCHES}</Text>
          <Text style={styles.rankCardHint}>{t("ranked.placementHint", { count: RANKED_PLACEMENT_MATCHES - matchesPlayed })}</Text>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { justifyContent: "flex-start", paddingTop: 12 },
  tabPanel: { flex: 1, minHeight: 0, width: "100%" }, hidden: { display: "none" },
  errorRetry: { padding: 15, alignItems: "center" }, retryText: { color: "#E8DFC8", fontSize: 13 },
  content: { flex: 1, minHeight: 0, width: "100%", flexDirection: "row", gap: 16, marginTop: 8 },
  rankCard: { width: 190, alignSelf: "stretch", alignItems: "center", justifyContent: "center", paddingHorizontal: 10 },
  rankCardEyebrow: { color: "#E8DFC8", fontSize: 10, fontWeight: "900", textTransform: "uppercase", letterSpacing: 0.8 },
  rankCardIcon: { marginTop: 3, marginBottom: -3 },
  rankCardName: { marginTop: 3, color: "#F1ECDD", fontSize: 20, fontWeight: "900", textAlign: "center" },
  rankCardDivider: { width: "85%", marginTop: 10, marginBottom: 5, borderTopWidth: 1, borderColor: "rgba(238,233,218,0.35)" },
  rankCardLp: { marginTop: 5, color: "#F1ECDD", fontSize: 14, fontWeight: "900" },
  rankCardPosition: { marginTop: 2, color: "#CFC7B4", fontSize: 10, fontWeight: "700" },
  rankCardProgressLabel: { marginTop: 7, color: "#CFC7B4", fontSize: 9, fontWeight: "800", textAlign: "center" },
  rankCardProgress: { marginTop: 1, color: "#F1ECDD", fontSize: 15, fontWeight: "900", textAlign: "center" },
  rankCardHint: { marginTop: 3, color: "#CFC7B4", fontSize: 9, fontWeight: "600", textAlign: "center" },
  boardFrame: { backgroundColor: "#17211D", borderRadius: 9, borderWidth: 7, borderColor: "#6F4226", shadowColor: "#000000", shadowOpacity: 0.5, shadowRadius: 7, shadowOffset: { width: 0, height: 4 }, elevation: 7 },
  leaderboardPanel: { flex: 1, minWidth: 0, padding: 8 },
  framePin: { position: "absolute", width: 5, height: 5, borderRadius: 3, backgroundColor: "#C29A62", borderWidth: 1, borderColor: "#3E2517", zIndex: 3 },
  framePinTopLeft: { left: -6, top: -6 },
  framePinTopRight: { right: -6, top: -6 },
  framePinBottomLeft: { left: -6, bottom: -6 },
  framePinBottomRight: { right: -6, bottom: -6 },
  headerRow: { flexDirection: "row", paddingHorizontal: 8, paddingBottom: 6, borderBottomWidth: 1, borderBottomColor: "rgba(238, 233, 218, 0.35)" },
  header: { color: "#E8DFC8", fontSize: 10, fontWeight: "900", textTransform: "uppercase", letterSpacing: 0.5 },
  list: { flex: 1, minHeight: 0 },
  row: { minHeight: 25, flexDirection: "row", alignItems: "center", paddingHorizontal: 8, borderBottomWidth: 1, borderBottomColor: "rgba(238, 233, 218, 0.12)" },
  currentRow: { backgroundColor: "rgba(224, 190, 100, 0.13)", borderColor: "#D8BE78", borderWidth: 1, borderRadius: 5 },
  currentWrap: { borderTopWidth: 1, borderTopColor: "rgba(238, 233, 218, 0.3)", paddingTop: 6, marginTop: 4 },
  cell: { color: "#F1ECDD", fontSize: 11, fontWeight: "700", textShadowColor: "rgba(255,255,255,0.08)", textShadowRadius: 1 },
  position: { width: "10%" },
  player: { width: "35%", paddingRight: 6 },
  lp: { width: "14%", textAlign: "right", paddingRight: 8 },
  rank: { width: "27%", textAlign: "center", fontWeight: "900" },
  rankCell: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 3, minWidth: 0 },
  rankLabel: { flex: 1, minWidth: 0, textAlign: "center", fontWeight: "900" },
  wins: { width: "14%", textAlign: "right" },
  message: { color: "#CFC7B4", textAlign: "center", marginTop: 32 },
});
