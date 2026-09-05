import React, { useState } from "react";
import { Alert, StyleSheet, Text, ScrollView, Pressable, View, Platform } from "react-native";
import { useTranslation } from "react-i18next";
import { ANDROID_COMPACT_MENU_UI_SCALE, BackIconButton, Screen, Title, BigButton, theme } from "../components/ui";
import { DAMAGE_WAGER_OPTIONS, DEFAULT_DAMAGE_WAGER, DEFAULT_ROUND_COUNT, getRankedDivision, RANKED_PLACEMENT_MATCHES } from "@confidence-trivia/shared";
import { getRankedLeaderboard, RankedLeaderboardEntry } from "../network/client";

const ROUND_OPTIONS = [3, 5, 7, 9, 11, 13, 15];
const DEFAULT_ROUNDS = ROUND_OPTIONS.reduce((closest, value) => {
  const valueDistance = Math.abs(value - DEFAULT_ROUND_COUNT);
  const closestDistance = Math.abs(closest - DEFAULT_ROUND_COUNT);
  return valueDistance < closestDistance ? value : closest;
}, ROUND_OPTIONS[0]);

export function CreateGameScreen({
  onCreate,
  locale,
  deviceId,
  stars,
  registered,
  onSignInRequired,
  initialName,
  onBack,
}: {
  onCreate: (name: string, rounds: number, gameMode: "classic" | "ranked" | "damage", visibility: "private" | "public", damageWager: number) => Promise<void>;
  locale: "en" | "bg";
  deviceId: string;
  stars: number;
  registered: boolean;
  onSignInRequired: () => void;
  initialName: string;
  onBack: () => void;
}) {
  const { t } = useTranslation();
  const [gameMode, setGameMode] = useState<"classic" | "ranked" | "damage">("classic");
  const [visibility, setVisibility] = useState<"private" | "public">("private");
  const [rounds, setRounds] = useState(DEFAULT_ROUNDS);
  const [damageWager, setDamageWager] = useState<number>(DEFAULT_DAMAGE_WAGER);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rankedProfile, setRankedProfile] = useState<RankedLeaderboardEntry | null>(null);
  const [rankedLoading, setRankedLoading] = useState(false);
  const trimmedName = initialName.trim();

  React.useEffect(() => {
    if (gameMode !== "ranked") return;
    let cancelled = false;
    setRankedLoading(true);
    void getRankedLeaderboard(deviceId).then((leaderboard) => {
      if (!cancelled) {
        setRankedProfile(leaderboard?.currentPlayer ?? null);
        setRankedLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, [deviceId, gameMode]);

  async function handleSubmit() {
    if (submitting || !trimmedName) return;
    if (gameMode === "damage" && damageWager > stars) {
      Alert.alert(t("shop.notEnoughStars"));
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      await onCreate(trimmedName, rounds, gameMode, visibility, damageWager);
    } catch (err) {
      const message = err instanceof Error ? err.message : t("network.unknownError");
      setError(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Screen androidScale={ANDROID_COMPACT_MENU_UI_SCALE}>
      <BackIconButton label={t("common.back")} onPress={onBack} disabled={submitting} />
      <Title>{t("home.createGame")}</Title>
      <View style={styles.titleGap} />
      <View style={styles.body}>
        <View style={styles.formColumn}>
          <View style={styles.input}><Text numberOfLines={1} style={styles.playerNameText}>{initialName}</Text></View>
          <View style={styles.modeSection}>
            <Text style={styles.roundsLabel}>{t("create.mode")}</Text>
            <View style={styles.modeRow}>
              <Pressable
                onPress={() => setGameMode("classic")}
                style={[styles.modeCard, gameMode === "classic" && styles.modeCardSelected]}
              >
                <Text style={styles.modeTitle}>{t("create.classic")}</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  if (!registered) {
                    Alert.alert(t("account.signInRequired"), t("account.rankedRequiresAccount"), [
                      { text: t("validation.cancel"), style: "cancel" },
                      { text: t("account.signIn"), onPress: onSignInRequired },
                    ]);
                    return;
                  }
                  setGameMode("ranked");
                }}
                style={[styles.modeCard, gameMode === "ranked" && styles.modeCardSelected]}
              >
                <Text style={styles.modeTitle}>{t("create.ranked")}</Text>
                <Text style={styles.modeComingSoon}>{t("create.rankedPlayers")}</Text>
              </Pressable>
              <Pressable
                onPress={() => setGameMode("damage")}
                style={[styles.modeCard, gameMode === "damage" && styles.modeCardSelected]}
              >
                <Text style={styles.modeTitle}>{t("create.damage")}</Text>
                <Text style={styles.modeComingSoon}>{t("create.damageHealth")}</Text>
              </Pressable>
            </View>
          </View>
          <View style={styles.settingsRow}>
            {gameMode === "classic" ? <View style={styles.roundsSection}>
              <Text style={styles.roundsLabel}>{t("create.rounds")}</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.roundsScroller}
              >
                {ROUND_OPTIONS.map((value) => {
                  const isSelected = rounds === value;
                  return (
                    <Pressable
                      key={value}
                      onPress={() => setRounds(value)}
                      style={[styles.roundChip, isSelected && styles.roundChipSelected]}
                    >
                      <Text style={[styles.roundChipText, isSelected && styles.roundChipTextSelected]}>{value}</Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View> : null}
            {gameMode === "damage" ? <View style={styles.roundsSection}>
              <Text style={styles.roundsLabel}>{t("create.starWager")}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.roundsScroller}>
                {DAMAGE_WAGER_OPTIONS.map((value) => {
                  const isSelected = damageWager === value;
                  return (
                    <Pressable key={value} onPress={() => {
                      if (value > stars) {
                        Alert.alert(t("shop.notEnoughStars"));
                        return;
                      }
                      setDamageWager(value);
                    }} style={[styles.wagerChip, isSelected && styles.wagerChipSelected]}>
                      <Text style={[styles.wagerChipText, isSelected && styles.wagerChipTextSelected]}>★ {value}</Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View> : null}
            {gameMode !== "ranked" ? <View style={styles.visibilitySection}>
              <Text style={styles.roundsLabel}>{t("create.visibility")}</Text>
              <View style={styles.modeRow}>
                {(["private", "public"] as const).map((value) => (
                  <Pressable
                    key={value}
                    onPress={() => setVisibility(value)}
                    style={[styles.modeCard, styles.visibilityCard, visibility === value && styles.modeCardSelected]}
                  >
                    <Text style={styles.modeTitle}>{t(`create.${value}`)}</Text>
                  </Pressable>
                ))}
              </View>
            </View> : null}
          </View>
          {gameMode === "ranked" ? (
            <View style={styles.rankedSummary}>
              {rankedLoading ? <Text style={styles.rankedLoading}>{t("ranked.loading")}</Text> : rankedProfile ? (
                <>
                  <View style={styles.rankedSummaryBlock}>
                    <Text style={styles.rankedSummaryLabel}>{t("ranked.yourRank")}</Text>
                    <Text style={[styles.rankedSummaryRank, { color: rankedProfile.placementMatches >= RANKED_PLACEMENT_MATCHES ? getRankedDivision(rankedProfile.lp).color : theme.textDim }]}>
                      {t(`ranked.ranks.${rankedProfile.rankKey}`)}
                    </Text>
                  </View>
                  <View style={styles.rankedDivider} />
                  <View style={styles.rankedSummaryBlock}>
                    <Text style={styles.rankedSummaryLabel}>{t("ranked.lp")}</Text>
                    <Text style={styles.rankedSummaryLp}>{rankedProfile.placementMatches >= RANKED_PLACEMENT_MATCHES ? rankedProfile.lp : "—"}</Text>
                  </View>
                  {rankedProfile.placementMatches < RANKED_PLACEMENT_MATCHES ? <Text style={styles.rankedPlacements}>{t("ranked.placements", { current: rankedProfile.placementMatches, total: RANKED_PLACEMENT_MATCHES })}</Text> : null}
                </>
              ) : <Text style={styles.rankedLoading}>{t("ranked.noProfile")}</Text>}
            </View>
          ) : null}
        </View>
        <View style={styles.actionsColumn}>
          {error && <Text style={styles.error}>{t("network.createFailed", { message: error })}</Text>}
          <BigButton
            label={gameMode === "ranked" ? (submitting ? t("create.queueing") : t("create.queue")) : (submitting ? t("create.creating") : t("create.create"))}
            onPress={handleSubmit}
            disabled={!trimmedName || submitting}
            style={styles.actionButton}
          />
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: {
    flex: 1,
    minHeight: 0,
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 28,
  },
  titleGap: { height: Platform.OS === "android" ? 44 : 0 },
  formColumn: { width: "62%", maxWidth: 560 },
  actionsColumn: { width: "30%", maxWidth: 300, justifyContent: "center" },
  settingsRow: { width: "100%", flexDirection: "row", gap: 10 },
  rankedSummary: { width: "100%", minHeight: 50, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 14, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 7, backgroundColor: "rgba(31, 26, 51, 0.88)", borderWidth: 1, borderColor: "rgba(184, 140, 255, 0.42)" },
  rankedSummaryBlock: { minWidth: 75, alignItems: "center" },
  rankedSummaryLabel: { color: theme.textDim, fontSize: 9, fontWeight: "900", textTransform: "uppercase" },
  rankedSummaryRank: { color: theme.text, fontSize: 15, fontWeight: "900", marginTop: 1 },
  rankedSummaryLp: { color: "#F7D85B", fontSize: 16, fontWeight: "900", marginTop: 1 },
  rankedDivider: { width: 1, height: 30, backgroundColor: "rgba(255,255,255,0.14)" },
  rankedPlacements: { color: theme.textDim, fontSize: 9, fontWeight: "700", textAlign: "center" },
  rankedLoading: { color: theme.textDim, fontSize: 11, fontWeight: "700" },
  visibilitySection: { flex: 1, minWidth: 0, marginBottom: 12 },
  visibilityCard: { minHeight: 44 },
  input: {
    backgroundColor: theme.surface,
    color: theme.text,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    marginBottom: 12,
    width: "100%",
    minHeight: 50,
    justifyContent: "center",
  },
  playerNameText: { color: theme.text, fontSize: 16, fontWeight: "800" },
  roundsSection: {
    flex: 1,
    minWidth: 0,
    marginBottom: 12,
  },
  modeSection: {
    width: "100%",
    marginBottom: 10,
  },
  modeRow: { flexDirection: "row", gap: 10 },
  modeCard: {
    flex: 1,
    minHeight: 52,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.surface,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "transparent",
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  modeCardSelected: { borderColor: theme.primary },
  modeCardDisabled: { opacity: 0.42 },
  modeTitle: { color: theme.text, fontSize: 14, fontWeight: "800" },
  modeComingSoon: { color: theme.textDim, fontSize: 10, fontWeight: "700", marginTop: 2 },
  actionButton: {
    width: "100%",
  },
  roundsLabel: {
    color: theme.textDim,
    marginBottom: 8,
    fontSize: 14,
    fontWeight: "600",
  },
  roundsScroller: {
    paddingRight: 8,
  },
  roundChip: {
    backgroundColor: theme.surface,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginRight: 8,
    borderWidth: 2,
    borderColor: "transparent",
  },
  roundChipSelected: {
    borderColor: theme.primary,
    backgroundColor: "#2A2245",
  },
  roundChipText: {
    color: theme.text,
    fontSize: 16,
    fontWeight: "700",
  },
  roundChipTextSelected: {
    color: theme.primary,
  },
  wagerChip: { backgroundColor: theme.surface, borderRadius: 10, paddingHorizontal: 11, paddingVertical: 10, marginRight: 6, borderWidth: 2, borderColor: "transparent" },
  wagerChipSelected: { borderColor: "#F7D85B", backgroundColor: "#342D20" },
  wagerChipText: { color: theme.text, fontSize: 13, fontWeight: "800" },
  wagerChipTextSelected: { color: "#F7D85B" },
  error: {
    color: theme.danger,
    marginBottom: 8,
    textAlign: "center",
  },
});
