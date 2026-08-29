import React from "react";
import { FlatList, StyleSheet, Text, TextInput, View } from "react-native";
import { useTranslation } from "react-i18next";
import { getRankedDivision, RANKED_PLACEMENT_MATCHES } from "@confidence-trivia/shared";
import { ANDROID_MENU_UI_SCALE, BackIconButton, BigButton, Screen, Title, theme } from "../components/ui";
import { getRankedLeaderboard, RankedLeaderboardEntry, RankedLeaderboardResponse } from "../network/client";
import { isValidPlayerName } from "../utils/playerName";

export function RankedScreen({
  deviceId,
  initialName,
  onBack,
  onFindMatch,
}: {
  deviceId: string;
  initialName: string;
  onBack: () => void;
  onFindMatch: (name: string) => Promise<void>;
}) {
  const { t } = useTranslation();
  const [name, setName] = React.useState(initialName);
  const [leaderboard, setLeaderboard] = React.useState<RankedLeaderboardResponse | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [joining, setJoining] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    void getRankedLeaderboard(deviceId).then((response) => {
      if (cancelled) return;
      setLeaderboard(response);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [deviceId]);

  async function findMatch() {
    if (joining || !isValidPlayerName(name)) return;
    setJoining(true);
    setError(null);
    try {
      await onFindMatch(name.trim());
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t("network.unknownError"));
      setJoining(false);
    }
  }

  const current = leaderboard?.currentPlayer ?? null;
  const currentIsInTop = Boolean(current && leaderboard?.top.some((entry) => entry.playerId === current.playerId));

  return (
    <Screen style={styles.screen} androidScale={ANDROID_MENU_UI_SCALE}>
      <BackIconButton label={t("common.back")} onPress={onBack} disabled={joining} />
      <Title>{t("ranked.title")}</Title>

      <View style={styles.content}>
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

        <View style={styles.actionPanel}>
          {current && current.placementMatches < RANKED_PLACEMENT_MATCHES ? (
            <Text style={styles.placementText}>
              {t("ranked.placements", { current: current.placementMatches, total: RANKED_PLACEMENT_MATCHES })}
            </Text>
          ) : null}
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder={t("join.yourName") as string}
            placeholderTextColor={theme.textDim}
            maxLength={20}
            editable={!joining}
            style={styles.nameInput}
          />
          <BigButton
            label={joining ? t("ranked.finding") : t("ranked.findMatch")}
            onPress={findMatch}
            disabled={joining || !isValidPlayerName(name)}
            style={styles.findButton}
          />
          {error ? <Text numberOfLines={2} style={styles.error}>{error}</Text> : null}
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

const styles = StyleSheet.create({
  screen: { justifyContent: "flex-start", paddingTop: 12 },
  content: { flex: 1, minHeight: 0, width: "100%", flexDirection: "row", gap: 18, marginTop: 6 },
  leaderboardPanel: { flex: 1, minWidth: 0, backgroundColor: "rgba(31, 26, 51, 0.94)", borderRadius: 14, padding: 10 },
  actionPanel: { width: "30%", minWidth: 220, justifyContent: "center" },
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
  placementText: { color: "#B88CFF", fontSize: 14, fontWeight: "900", textAlign: "center", marginBottom: 10 },
  nameInput: { width: "100%", minHeight: 48, borderRadius: 10, backgroundColor: theme.surface, color: theme.text, paddingHorizontal: 14, fontSize: 15 },
  findButton: { width: "100%", minWidth: 0 },
  error: { color: theme.danger, fontSize: 11, textAlign: "center", marginTop: 7 },
});
