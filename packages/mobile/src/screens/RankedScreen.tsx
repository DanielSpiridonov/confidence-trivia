import React from "react";
import { FlatList, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { getRankedDivision, RANKED_PLACEMENT_MATCHES } from "@confidence-trivia/shared";
import { ANDROID_MENU_UI_SCALE, BackIconButton, Screen, Title, theme } from "../components/ui";
import { getRankedLeaderboard, RankedLeaderboardEntry, RankedLeaderboardResponse } from "../network/client";

export function RankedScreen({
  deviceId,
  onBack,
}: {
  deviceId: string;
  onBack: () => void;
}) {
  const { t } = useTranslation();
  const [leaderboard, setLeaderboard] = React.useState<RankedLeaderboardResponse | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let cancelled = false;
    void getRankedLeaderboard(deviceId).then((response) => {
      if (cancelled) return;
      setLeaderboard(response);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [deviceId]);

  const current = leaderboard?.currentPlayer ?? null;
  const currentIsInTop = Boolean(current && leaderboard?.top.some((entry) => entry.playerId === current.playerId));

  return (
    <Screen style={styles.screen} androidScale={ANDROID_MENU_UI_SCALE}>
      <BackIconButton label={t("common.back")} onPress={onBack} />
      <Title>{t("ranked.title")}</Title>

      <View style={styles.content}>
        {current ? <PlayerRankCard entry={current} t={t} /> : null}
        <View style={styles.leaderboardPanel}>
          <View style={styles.headerRow}>
            <Text style={[styles.header, styles.position]}>{t("ranked.spot")}</Text>
            <Text style={[styles.header, styles.player]}>{t("ranked.player")}</Text>
            <Text style={[styles.header, styles.lp]}>{t("ranked.lp")}</Text>
            <Text style={[styles.header, styles.rank]}>{t("ranked.rank")}</Text>
            <Text style={[styles.header, styles.wins]}>{t("ranked.wins")}</Text>
          </View>
          {loading ? <Text style={styles.message}>{t("ranked.loading")}</Text> : null}
          {!loading && leaderboard?.top.length === 0 ? <Text style={styles.message}>{t("ranked.empty")}</Text> : null}
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

      </View>
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
      <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={[styles.cell, styles.rank, { color: rank?.color ?? theme.textDim }]}>{rankLabel}</Text>
      <Text numberOfLines={1} style={[styles.cell, styles.wins]}>{entry.wins}</Text>
    </View>
  );
}

function PlayerRankCard({ entry, t }: { entry: RankedLeaderboardEntry; t: (key: string, options?: any) => string }) {
  const isPlaced = entry.placementMatches >= RANKED_PLACEMENT_MATCHES;
  const division = isPlaced ? getRankedDivision(entry.lp) : null;
  const matchesPlayed = Math.min(entry.placementMatches, RANKED_PLACEMENT_MATCHES);

  return (
    <View style={[styles.rankCard, division && { borderColor: division.color }]}> 
      <Text style={styles.rankCardEyebrow}>{t("ranked.yourRank")}</Text>
      <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={[styles.rankCardName, { color: division?.color ?? theme.textDim }]}>
        {isPlaced ? t(`ranked.ranks.${entry.rankKey}`) : t("ranked.ranks.novice")}
      </Text>
      {isPlaced ? (
        <>
          <Text style={styles.rankCardLp}>{t("ranked.lpValue", { value: entry.lp })}</Text>
          <Text style={styles.rankCardPosition}>{entry.position ? t("ranked.globalPosition", { position: entry.position }) : ""}</Text>
        </>
      ) : (
        <>
          <Text style={styles.rankCardProgress}>{t("ranked.placements", { current: matchesPlayed, total: RANKED_PLACEMENT_MATCHES })}</Text>
          <Text style={styles.rankCardHint}>{t("ranked.placementHint", { count: RANKED_PLACEMENT_MATCHES - matchesPlayed })}</Text>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { justifyContent: "flex-start", paddingTop: 12 },
  content: { flex: 1, minHeight: 0, width: "100%", flexDirection: "row", gap: 12, marginTop: 6 },
  rankCard: { width: 150, alignSelf: "stretch", alignItems: "center", justifyContent: "center", backgroundColor: "rgba(31, 26, 51, 0.96)", borderRadius: 14, borderWidth: 2, borderColor: "rgba(184, 140, 255, 0.45)", paddingHorizontal: 10 },
  rankCardEyebrow: { color: theme.textDim, fontSize: 10, fontWeight: "900", textTransform: "uppercase", letterSpacing: 0.8 },
  rankCardName: { marginTop: 5, color: theme.text, fontSize: 23, fontWeight: "900", textAlign: "center" },
  rankCardLp: { marginTop: 5, color: theme.text, fontSize: 14, fontWeight: "900" },
  rankCardPosition: { marginTop: 2, color: theme.textDim, fontSize: 10, fontWeight: "700" },
  rankCardProgress: { marginTop: 7, color: theme.text, fontSize: 10, fontWeight: "800", textAlign: "center" },
  rankCardHint: { marginTop: 3, color: theme.textDim, fontSize: 9, fontWeight: "600", textAlign: "center" },
  leaderboardPanel: { flex: 1, minWidth: 0, backgroundColor: "rgba(31, 26, 51, 0.94)", borderRadius: 14, padding: 10 },
  headerRow: { flexDirection: "row", paddingHorizontal: 8, paddingBottom: 6, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.09)" },
  header: { color: theme.textDim, fontSize: 10, fontWeight: "900", textTransform: "uppercase" },
  list: { flex: 1, minHeight: 0 },
  row: { minHeight: 25, flexDirection: "row", alignItems: "center", paddingHorizontal: 8, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.05)" },
  currentRow: { backgroundColor: "rgba(124, 92, 255, 0.18)", borderColor: theme.primary, borderWidth: 1, borderRadius: 8 },
  currentWrap: { borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.16)", paddingTop: 6, marginTop: 4 },
  cell: { color: theme.text, fontSize: 11, fontWeight: "700" },
  position: { width: "10%" },
  player: { width: "35%", paddingRight: 6 },
  lp: { width: "14%", textAlign: "right", paddingRight: 8 },
  rank: { width: "27%", textAlign: "center", fontWeight: "900" },
  wins: { width: "14%", textAlign: "right" },
  message: { color: theme.textDim, textAlign: "center", marginTop: 32 },
});
