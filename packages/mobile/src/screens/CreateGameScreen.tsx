import { Pressable } from "../components/menuHaptics";
import React, { useState } from "react";
import { Animated, Platform, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { DAMAGE_WAGER_OPTIONS, DEFAULT_DAMAGE_WAGER, DEFAULT_ROUND_COUNT, getRankedDivision, RANKED_PLACEMENT_MATCHES } from "@confidence-trivia/shared";
import { ANDROID_COMPACT_MENU_UI_SCALE, BackIconButton, BigButton, Screen, Title, theme } from "../components/ui";
import { getRankedLeaderboard, RankedLeaderboardEntry } from "../network/client";
import { RankIcon } from "../components/RankIcon";
import { FeedbackPopup, useFeedbackPopup } from "../components/FeedbackPopup";
import { GameDialog, useGameDialog } from "../components/GameDialog";

const ROUND_OPTIONS = [3, 5, 7, 9, 11, 13, 15];
const DEFAULT_ROUNDS = ROUND_OPTIONS.reduce((closest, value) => Math.abs(value - DEFAULT_ROUND_COUNT) < Math.abs(closest - DEFAULT_ROUND_COUNT) ? value : closest, ROUND_OPTIONS[0]);
type GameMode = "classic" | "friends" | "ranked" | "damage";
const FRIEND_CATEGORIES = ["general", "science", "geography", "history", "movies", "music", "sports", "animals", "technology", "food"];

export function CreateGameScreen({ onCreate, deviceId, stars, registered, onSignInRequired, initialName, onBack }: {
  onCreate: (name: string, rounds: number, gameMode: GameMode, visibility: "private" | "public", damageWager: number, friendsOptions?: { teamMode: "ffa" | "duos"; categories: string[]; customQuestions: Array<{ question: string; answer: string }> }) => Promise<void>;
  locale: "en" | "bg";
  deviceId: string;
  stars: number;
  registered: boolean;
  onSignInRequired: () => void;
  initialName: string;
  onBack: () => void;
}) {
  const { t } = useTranslation();
  const [gameMode, setGameMode] = useState<GameMode>("classic");
  const [visibility, setVisibility] = useState<"private" | "public">("private");
  const [rounds, setRounds] = useState(DEFAULT_ROUNDS);
  const [damageWager, setDamageWager] = useState<number>(DEFAULT_DAMAGE_WAGER);
  const [friendsTeamMode, setFriendsTeamMode] = useState<"ffa" | "duos">("ffa");
  const [friendCategories, setFriendCategories] = useState<string[]>([]);
  const [customQuestions, setCustomQuestions] = useState<Array<{ question: string; answer: string }>>([]);
  const [submitting, setSubmitting] = useState(false);
  const [rankedProfile, setRankedProfile] = useState<RankedLeaderboardEntry | null>(null);
  const [rankedLoading, setRankedLoading] = useState(false);
  const { notice, showFeedback, clearFeedback } = useFeedbackPopup();
  const { dialog, showDialog, dismissDialog, confirmDialog } = useGameDialog();
  const trimmedName = initialName.trim();
  const customScrollY = React.useRef(new Animated.Value(0)).current;
  const [customViewportHeight, setCustomViewportHeight] = React.useState(0);
  const [customContentHeight, setCustomContentHeight] = React.useState(0);
  const [customTrackHeight, setCustomTrackHeight] = React.useState(0);
  const customMaxScroll = Math.max(0, customContentHeight - customViewportHeight);
  const customThumbHeight = customContentHeight > 0
    ? Math.max(28, Math.min(customTrackHeight, customTrackHeight * customViewportHeight / customContentHeight))
    : 28;
  const customThumbTravel = Math.max(0, customTrackHeight - customThumbHeight);
  const customThumbTranslate = customScrollY.interpolate({
    inputRange: [0, Math.max(1, customMaxScroll)],
    outputRange: [0, customThumbTravel],
    extrapolate: "clamp",
  });

  React.useEffect(() => {
    if (gameMode !== "ranked") return;
    let cancelled = false;
    setRankedLoading(true);
    void getRankedLeaderboard(deviceId).then((leaderboard) => {
      if (!cancelled) { setRankedProfile(leaderboard?.currentPlayer ?? null); setRankedLoading(false); }
    });
    return () => { cancelled = true; };
  }, [deviceId, gameMode]);

  function selectMode(mode: GameMode) {
    if (mode === "ranked" && !registered) {
      showDialog({ title: t("account.signInRequired"), message: t("account.rankedRequiresAccount"), cancelLabel: t("validation.cancel"), confirmLabel: t("account.signIn"), onConfirm: onSignInRequired });
      return;
    }
    setGameMode(mode);
  }

  async function handleSubmit() {
    if (submitting || !trimmedName) return;
    if (gameMode === "damage" && damageWager > stars) { showFeedback(t("shop.notEnoughStars")); return; }
    try {
      setSubmitting(true);
      await onCreate(trimmedName, rounds, gameMode, visibility, damageWager, gameMode === "friends" ? { teamMode: friendsTeamMode, categories: friendCategories, customQuestions: customQuestions.filter((item) => item.question.trim() && item.answer.trim()) } : undefined);
    } catch (error) {
      const message = error instanceof Error ? error.message : t("network.unknownError");
      showFeedback(t("feedback.actionFailed"), t("network.createFailed", { message }));
    } finally { setSubmitting(false); }
  }

  const modes: Array<{ id: GameMode; icon: React.ComponentProps<typeof MaterialCommunityIcons>["name"]; detail: string }> = [
    { id: "classic", icon: "cards-outline", detail: t("create.rounds") },
    { id: "friends", icon: "account-group-outline", detail: t("create.friendsPlayers") },
    { id: "ranked", icon: "trophy-outline", detail: t("create.rankedPlayers") },
    { id: "damage", icon: "sword-cross", detail: t("create.damageHealth") },
  ];

  return (
    <Screen androidScale={ANDROID_COMPACT_MENU_UI_SCALE * 0.99}>
      <BackIconButton label={t("common.back")} onPress={onBack} disabled={submitting} />
      <Title>{t("home.createGame")}</Title>
      <View style={styles.body}>
        <View style={styles.modeRail}>
          <Text style={styles.sectionLabel}>{t("create.mode")}</Text>
          {modes.map((mode) => {
            const selected = gameMode === mode.id;
            return <Pressable key={mode.id} accessibilityRole="radio" accessibilityState={{ selected }} onPress={() => selectMode(mode.id)} style={({ pressed }) => [styles.modeItem, selected && styles.modeItemSelected, pressed && styles.modeItemPressed]}>
              <View style={[styles.modeIcon, selected && styles.modeIconSelected]}><MaterialCommunityIcons name={mode.icon} size={21} color={selected ? "#FFFFFF" : theme.textDim} /></View>
              <View style={styles.modeCopy}><Text style={styles.modeTitle}>{t(`create.${mode.id}`)}</Text><Text numberOfLines={1} style={styles.modeDetail}>{mode.detail}</Text></View>
              <MaterialCommunityIcons name="chevron-right" size={18} color={selected ? theme.primary : "rgba(185,176,214,0.42)"} />
            </Pressable>;
          })}
        </View>

        <View style={styles.configurationPanel}>
          <View style={styles.playerRow}>
            <View style={styles.playerIdentity}><Text style={styles.fieldLabel}>{t("create.yourName")}</Text><Text numberOfLines={1} style={styles.playerName}>{initialName}</Text></View>
            <View style={styles.modePill}><Text style={styles.modePillText}>{t(`create.${gameMode}`)}</Text></View>
          </View>
          <View style={styles.divider} />
          <View style={styles.settingsArea}>
            {gameMode === "classic" ? <>
              <View style={[styles.settingGroup, styles.classicFirstSetting]}>
                <Text style={styles.fieldLabel}>{t("create.rounds")}</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.optionScroller}>
                  {ROUND_OPTIONS.map((value) => <Pressable key={value} accessibilityRole="radio" accessibilityState={{ selected: rounds === value }} onPress={() => setRounds(value)} style={[styles.optionChip, rounds === value && styles.optionChipSelected]}><Text style={[styles.optionText, rounds === value && styles.optionTextSelected]}>{value}</Text></Pressable>)}
                </ScrollView>
              </View>
              <View style={styles.settingGroup}>
                <Text style={styles.fieldLabel}>{t("create.visibility")}</Text>
                <View style={styles.segmentedControl}>{(["private", "public"] as const).map((value) => {
                  const selected = visibility === value;
                  return <Pressable key={value} accessibilityRole="radio" accessibilityState={{ selected }} onPress={() => setVisibility(value)} style={[styles.segment, selected && styles.segmentSelected]}><MaterialCommunityIcons name={value === "private" ? "lock-outline" : "earth"} size={15} color={selected ? "#FFFFFF" : theme.textDim} /><Text style={[styles.segmentText, selected && styles.segmentTextSelected]}>{t(`create.${value}`)}</Text></Pressable>;
                })}</View>
              </View>
            </> : null}

            {gameMode === "damage" ? <View style={styles.settingGroup}>
              <Text style={styles.fieldLabel}>{t("create.starWager")}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.optionScroller}>
                {DAMAGE_WAGER_OPTIONS.map((value) => <Pressable key={value} onPress={() => { if (value > stars) { showFeedback(t("shop.notEnoughStars")); return; } setDamageWager(value); }} style={[styles.optionChip, damageWager === value && styles.wagerChipSelected]}><Text style={[styles.optionText, damageWager === value && styles.wagerTextSelected]}>★ {value}</Text></Pressable>)}
              </ScrollView>
            </View> : null}

            {gameMode === "friends" ? <View style={styles.friendsSettingsFrame}><ScrollView
              style={styles.friendsSettings}
              contentContainerStyle={styles.friendsSettingsContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              scrollEventThrottle={16}
              onLayout={(event) => setCustomViewportHeight(event.nativeEvent.layout.height)}
              onContentSizeChange={(_, height) => setCustomContentHeight(height)}
              onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: customScrollY } } }], { useNativeDriver: false })}
            >
              <View style={styles.friendsTopRow}>
                <View style={styles.friendsTopGroup}>
                  <Text style={styles.fieldLabel}>{t("create.teamFormat")}</Text>
                  <View style={styles.segmentedControl}>{(["ffa", "duos"] as const).map((value) => {
                    const selected = friendsTeamMode === value;
                    return <Pressable key={value} onPress={() => setFriendsTeamMode(value)} style={[styles.segment, selected && styles.segmentSelected]}><Text style={[styles.segmentText, selected && styles.segmentTextSelected]}>{t(`create.${value}`)}</Text></Pressable>;
                  })}</View>
                </View>
                <View style={styles.friendsRoundsGroup}>
                  <Text style={styles.fieldLabel}>{t("create.rounds")}</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>{ROUND_OPTIONS.map((value) => <Pressable key={value} onPress={() => setRounds(value)} style={[styles.miniOption, rounds === value && styles.optionChipSelected]}><Text style={[styles.miniOptionText, rounds === value && styles.optionTextSelected]}>{value}</Text></Pressable>)}</ScrollView>
                </View>
              </View>
              <Text style={styles.fieldLabel}>{t("create.visibility")}</Text>
              <View style={[styles.segmentedControl, styles.friendsVisibility]}>{(["private", "public"] as const).map((value) => {
                const selected = (customQuestions.length > 0 ? "private" : visibility) === value;
                const disabled = customQuestions.length > 0 && value === "public";
                return <Pressable key={value} accessibilityRole="radio" accessibilityState={{ selected, disabled }} disabled={disabled} onPress={() => setVisibility(value)} style={[styles.segment, selected && styles.segmentSelected, disabled && styles.disabledSegment]}><MaterialCommunityIcons name={value === "private" ? "lock-outline" : "earth"} size={14} color={selected ? "#FFFFFF" : theme.textDim} /><Text style={[styles.segmentText, selected && styles.segmentTextSelected]}>{t(`create.${value}`)}</Text></Pressable>;
              })}</View>
              <Text style={styles.fieldLabel}>{t("create.categories")}</Text>
              <View style={styles.categoryGrid}>{FRIEND_CATEGORIES.map((category) => {
                const selected = friendCategories.includes(category);
                return <Pressable key={category} accessibilityRole="checkbox" accessibilityState={{ checked: selected }} onPress={() => setFriendCategories((current) => selected ? current.filter((item) => item !== category) : [...current, category])} style={[styles.categoryChip, selected && styles.categoryChipSelected]}><Text style={[styles.categoryText, selected && styles.categoryTextSelected]}>{t(`categories.${category}`, { defaultValue: category })}</Text></Pressable>;
              })}</View>
              <View style={styles.customHeader}><Text style={styles.fieldLabel}>{t("create.customQuestions")}</Text>{customQuestions.length < 5 ? <Pressable accessibilityRole="button" onPress={() => setCustomQuestions((current) => [...current, { question: "", answer: "" }])} style={styles.addQuestion}><MaterialCommunityIcons name="plus" size={16} color="#FFFFFF" /><Text style={styles.addQuestionText}>{t("create.addQuestion")}</Text></Pressable> : null}</View>
              {customQuestions.map((item, index) => <View key={index} style={styles.customQuestionRow}>
                <TextInput value={item.question} onChangeText={(question) => setCustomQuestions((current) => current.map((entry, itemIndex) => itemIndex === index ? { ...entry, question } : entry))} maxLength={160} placeholder={t("create.questionPlaceholder")} placeholderTextColor={theme.textDim} style={[styles.customInput, styles.questionInput]} />
                <TextInput value={item.answer} onChangeText={(answer) => setCustomQuestions((current) => current.map((entry, itemIndex) => itemIndex === index ? { ...entry, answer } : entry))} maxLength={48} placeholder={t("create.answerPlaceholder")} placeholderTextColor={theme.textDim} style={styles.customInput} />
                <Pressable accessibilityRole="button" accessibilityLabel={t("common.remove", { defaultValue: "Remove" })} onPress={() => setCustomQuestions((current) => current.filter((_, itemIndex) => itemIndex !== index))} style={styles.removeQuestion}><MaterialCommunityIcons name="close" size={17} color={theme.textDim} /></Pressable>
              </View>)}
              {customQuestions.length > 0 ? <Text style={styles.privateNote}>{t("create.customPrivateNote")}</Text> : null}
            </ScrollView>{customMaxScroll > 1 ? <View pointerEvents="none" style={styles.scrollCue}><View onLayout={(event) => setCustomTrackHeight(event.nativeEvent.layout.height)} style={styles.scrollCueTrack}><Animated.View style={[styles.scrollCueThumb, { height: customThumbHeight, transform: [{ translateY: customThumbTranslate }] }]} /></View></View> : null}</View> : null}

            {gameMode === "ranked" ? <View style={styles.rankedSummary}>
              {rankedLoading ? <Text style={styles.rankedLoading}>{t("ranked.loading")}</Text> : rankedProfile ? <>
                <View style={styles.rankedBlock}><Text style={styles.fieldLabel}>{t("ranked.yourRank")}</Text><View style={styles.rankedIdentity}>{rankedProfile.placementMatches >= RANKED_PLACEMENT_MATCHES ? <RankIcon rankKey={rankedProfile.rankKey} size={31} /> : null}<Text style={[styles.rankedRank, { color: rankedProfile.placementMatches >= RANKED_PLACEMENT_MATCHES ? getRankedDivision(rankedProfile.lp).color : theme.textDim }]}>{t(`ranked.ranks.${rankedProfile.rankKey}`)}</Text></View></View>
                <View style={styles.rankedDivider} />
                <View style={styles.rankedBlock}><Text style={styles.fieldLabel}>{t("ranked.lp")}</Text><Text style={styles.rankedLp}>{rankedProfile.placementMatches >= RANKED_PLACEMENT_MATCHES ? rankedProfile.lp : "-"}</Text></View>
                {rankedProfile.placementMatches < RANKED_PLACEMENT_MATCHES ? <Text style={styles.placements}>{t("ranked.placements", { current: rankedProfile.placementMatches, total: RANKED_PLACEMENT_MATCHES })}</Text> : null}
              </> : <Text style={styles.rankedLoading}>{t("ranked.noProfile")}</Text>}
            </View> : null}
          </View>

          <BigButton label={gameMode === "ranked" || gameMode === "damage" ? (submitting ? t("create.queueing") : t("create.queue")) : (submitting ? t("create.creating") : t("create.create"))} onPress={handleSubmit} disabled={!trimmedName || submitting} style={[styles.actionButton, gameMode === "friends" && styles.customActionButton]} />
        </View>
      </View>
      <FeedbackPopup notice={notice} onDismiss={clearFeedback} />
      <GameDialog dialog={dialog} onCancel={dismissDialog} onConfirm={confirmDialog} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1, minHeight: 0, width: "91%", maxWidth: 830, alignSelf: "center", flexDirection: "row", gap: 18, paddingTop: Platform.OS === "android" ? 8 : 12, paddingBottom: 4 },
  modeRail: { width: "31%", minWidth: 205, paddingRight: 16, borderRightWidth: 1, borderRightColor: "rgba(185,176,214,0.22)" },
  sectionLabel: { color: theme.textDim, fontSize: 11, fontWeight: "900", textTransform: "uppercase", marginBottom: 7 },
  modeItem: { width: "100%", minHeight: 58, flexDirection: "row", alignItems: "center", gap: 9, marginBottom: 7, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 8, borderWidth: 1, borderColor: "rgba(185,176,214,0.14)", backgroundColor: "rgba(24,19,40,0.78)" },
  modeItemSelected: { borderColor: theme.primary, backgroundColor: "rgba(63,45,105,0.92)" },
  modeItemPressed: { opacity: 0.76 },
  modeIcon: { width: 35, height: 35, borderRadius: 7, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.05)" },
  modeIconSelected: { backgroundColor: theme.primary },
  modeCopy: { flex: 1, minWidth: 0 },
  modeTitle: { color: theme.text, fontSize: 14, fontWeight: "900" },
  modeDetail: { color: theme.textDim, fontSize: 9, fontWeight: "700", marginTop: 2 },
  configurationPanel: { flex: 1, minWidth: 0, paddingLeft: 2 },
  playerRow: { minHeight: Platform.OS === "android" ? 49 : 45, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  playerIdentity: { flex: 1, minWidth: 0 },
  fieldLabel: { color: theme.textDim, fontSize: Platform.OS === "android" ? 11 : 10, fontWeight: "900", textTransform: "uppercase", marginBottom: 4 },
  playerName: { color: theme.text, fontSize: Platform.OS === "android" ? 20 : 18, fontWeight: "900" },
  modePill: { paddingHorizontal: Platform.OS === "android" ? 14 : 12, paddingVertical: Platform.OS === "android" ? 7 : 6, borderRadius: 7, backgroundColor: "rgba(124,92,255,0.18)", borderWidth: 1, borderColor: "rgba(124,92,255,0.55)" },
  modePillText: { color: "#C8BCFF", fontSize: Platform.OS === "android" ? 12 : 11, fontWeight: "900" },
  divider: { width: "100%", height: 1, backgroundColor: "rgba(185,176,214,0.2)", marginVertical: 8 },
  settingsArea: { flex: 1, minHeight: 0, justifyContent: "center" },
  friendsSettings: { flex: 1, minHeight: 0 },
  friendsSettingsFrame: { flex: 1, minHeight: 0, position: "relative", paddingRight: 15 },
  friendsSettingsContent: { paddingVertical: 3, paddingRight: 5, paddingBottom: 22 },
  scrollCue: { position: "absolute", top: 2, right: 0, bottom: 1, width: 12, alignItems: "center" },
  scrollCueTrack: { flex: 1, width: 3, borderRadius: 2, backgroundColor: "rgba(185,176,214,0.2)", overflow: "hidden" },
  scrollCueThumb: { width: 3, height: 32, borderRadius: 2, backgroundColor: "#8E75FF" },
  friendsTopRow: { flexDirection: "row", gap: 12, marginBottom: 10 },
  friendsTopGroup: { width: "48%" },
  friendsRoundsGroup: { flex: 1, minWidth: 0 },
  friendsVisibility: { maxWidth: 280, marginBottom: 10 },
  disabledSegment: { opacity: 0.35 },
  miniOption: { minWidth: Platform.OS === "android" ? 34 : 31, height: Platform.OS === "android" ? 35 : 32, marginRight: 5, borderRadius: 6, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "rgba(185,176,214,0.16)", backgroundColor: theme.surface },
  miniOptionText: { color: theme.text, fontSize: Platform.OS === "android" ? 12 : 11, fontWeight: "900" },
  categoryGrid: { flexDirection: "row", flexWrap: "wrap", gap: 5, marginBottom: 10 },
  categoryChip: { paddingHorizontal: 9, paddingVertical: 5, borderRadius: 6, borderWidth: 1, borderColor: "rgba(185,176,214,0.2)", backgroundColor: theme.surface },
  categoryChipSelected: { borderColor: theme.primary, backgroundColor: "#342A59" },
  categoryText: { color: theme.textDim, fontSize: Platform.OS === "android" ? 10 : 9, fontWeight: "800", textTransform: "capitalize" },
  categoryTextSelected: { color: "#C8BCFF" },
  customHeader: { minHeight: 27, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  addQuestion: { flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, backgroundColor: theme.primary },
  addQuestionText: { color: "#FFFFFF", fontSize: 9, fontWeight: "900" },
  customQuestionRow: { flexDirection: "row", alignItems: "center", gap: 5, marginBottom: 5 },
  customInput: { width: "31%", height: Platform.OS === "android" ? 38 : 34, paddingHorizontal: 8, paddingVertical: 5, borderRadius: 6, color: theme.text, fontSize: Platform.OS === "android" ? 11 : 10, fontWeight: "700", backgroundColor: "rgba(18,14,30,0.9)", borderWidth: 1, borderColor: "rgba(185,176,214,0.2)" },
  questionInput: { flex: 1, width: undefined },
  removeQuestion: { width: 28, height: 28, alignItems: "center", justifyContent: "center" },
  privateNote: { color: "#D6C86A", fontSize: 9, fontWeight: "700", marginTop: 2 },
  settingGroup: { width: "100%", marginBottom: 13 },
  classicFirstSetting: { marginTop: 8 },
  optionScroller: { paddingRight: 8 },
  optionChip: { minWidth: Platform.OS === "android" ? 49 : 45, height: Platform.OS === "android" ? 42 : 38, marginRight: 7, paddingHorizontal: 11, alignItems: "center", justifyContent: "center", borderRadius: 7, borderWidth: 1, borderColor: "rgba(185,176,214,0.16)", backgroundColor: theme.surface },
  optionChipSelected: { borderColor: theme.primary, backgroundColor: "#342A59" },
  optionText: { color: theme.text, fontSize: Platform.OS === "android" ? 15 : 13, fontWeight: "900" },
  optionTextSelected: { color: "#B9AAFF" },
  wagerChipSelected: { borderColor: "#F7D85B", backgroundColor: "#342D20" },
  wagerTextSelected: { color: "#F7D85B" },
  segmentedControl: { width: "100%", maxWidth: 310, height: Platform.OS === "android" ? 44 : 40, flexDirection: "row", padding: 3, borderRadius: 8, backgroundColor: "rgba(18,14,30,0.86)", borderWidth: 1, borderColor: "rgba(185,176,214,0.16)" },
  segment: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, borderRadius: 6 },
  segmentSelected: { backgroundColor: theme.primary },
  segmentText: { color: theme.textDim, fontSize: Platform.OS === "android" ? 13 : 12, fontWeight: "800" },
  segmentTextSelected: { color: "#FFFFFF" },
  rankedSummary: { width: "100%", minHeight: 80, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 16, paddingHorizontal: 16 },
  rankedBlock: { minWidth: 92, alignItems: "center" },
  rankedIdentity: { flexDirection: "row", alignItems: "center", gap: 5 },
  rankedRank: { fontSize: Platform.OS === "android" ? 18 : 16, fontWeight: "900" },
  rankedLp: { color: "#F7D85B", fontSize: Platform.OS === "android" ? 20 : 18, fontWeight: "900" },
  rankedDivider: { width: 1, height: 42, backgroundColor: "rgba(255,255,255,0.14)" },
  placements: { color: theme.textDim, fontSize: 10, fontWeight: "700", textAlign: "center" },
  rankedLoading: { color: theme.textDim, fontSize: 12, fontWeight: "700" },
  actionButton: { width: "100%", minHeight: Platform.OS === "android" ? 48 : 50, paddingVertical: Platform.OS === "android" ? 12 : 14, marginTop: 5 },
  customActionButton: { transform: [{ translateY: 14 }] },
});
