import React from "react";
import { Animated, View, Text, FlatList, Image, ImageSourcePropType, Platform, ScrollView, StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";
import { Room } from "colyseus.js";
import { ANDROID_GAME_UI_SCALE, Screen, Title, Subtitle, theme } from "../components/ui";
import { useRoomState } from "../network/client";
import { PhaseTimer } from "../components/PhaseTimer";
import { LeaderboardStrip } from "./LeaderboardScreen";
import { DamageHud } from "../components/DamageHud";

const DAMAGE_AVATARS: Record<string, ImageSourcePropType> = {
  smart_owl: require("../../assets/avatars/smart-owl.png"),
  clever_fox: require("../../assets/avatars/fox.png"),
  quiz_bot: require("../../assets/avatars/quiz-bot.png"),
  omniscient_avatar: require("../../assets/avatars/omniscient.png"),
  trivia_wizard: require("../../assets/avatars/trivia-wizard.png"),
  detective_avatar: require("../../assets/avatars/detective.png"),
  living_globe: require("../../assets/avatars/globe.png"),
};
const QUIZ_BOT_CALCULATOR: ImageSourcePropType = require("../../assets/combat/quiz-bot-calculator.png");
const SMART_OWL_BOOK: ImageSourcePropType = require("../../assets/combat/smart-owl-book.png");
const PROJECTILE_BY_AVATAR: Record<string, ImageSourcePropType> = {
  quiz_bot: QUIZ_BOT_CALCULATOR,
  smart_owl: SMART_OWL_BOOK,
};

export function RevealScreen({ room }: { room: Room }) {
  const { t } = useTranslation();
  const state = useRoomState<any>(room);
  if (!state) return null;

  const nameFor = (id: string) => `${state.players.get(id)?.name ?? "?"}${id === room.sessionId ? " (You)" : ""}`;
  const results = [...state.revealResults];
  const leaderboardPlayers = [...state.players.values()].map((player: any) => ({
    id: player.id,
    name: player.name,
    score: player.score,
    streak: player.streak,
    nameColor: player.nameColor,
    frameId: player.frameId,
  }));
  const isOrderingReveal = state.currentQuestion?.qType === "ordering";
  const isClosestAnswerReveal = state.currentQuestion?.qType === "closest_answer";

  if (state.gameMode === "damage") {
    return (
      <Screen style={styles.damageTransitionScreen} androidScale={ANDROID_GAME_UI_SCALE}>
        <DamageHud state={state} myPlayerId={room.sessionId} />
        <View style={styles.damageCorrectAnswerWrap}>
          <Text style={styles.damageCorrectAnswerLabel}>{t("reveal.correctAnswer")}</Text>
          <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={styles.damageCorrectAnswerText}>{state.correctAnswerText}</Text>
        </View>
        <View style={styles.damageBattleStage}>
          <DamageAvatarPane state={state} results={results} myPlayerId={room.sessionId} />
        </View>
      </Screen>
    );
  }

  if (isClosestAnswerReveal) {
    const guessMarkerWidth = Platform.OS === "android" ? 116 : 104;
    const correctAnswer = Number(state.correctAnswerText);
    const rankedGuesses = results
      .map((item: any) => ({ ...item, numericAnswer: Number(item.answerText) }))
      .filter((item: any) => Number.isFinite(item.numericAnswer))
      .sort((a: any, b: any) => {
        const distanceDifference = Math.abs(b.numericAnswer - correctAnswer) - Math.abs(a.numericAnswer - correctAnswer);
        return distanceDifference || a.numericAnswer - b.numericAnswer;
      });
    const timelineWidth = Math.max(
      Platform.OS === "android" ? 800 : 650,
      rankedGuesses.length * (Platform.OS === "android" ? 122 : 110) + 150,
    );
    const guessStartX = 95;
    const guessEndX = timelineWidth - 215;
    const resultX = timelineWidth - (Platform.OS === "android" ? 90 : 60);
    const resultMarkerWidth = Platform.OS === "android" ? 180 : 110;

    return (
      <Screen style={styles.closestScreen} androidScale={ANDROID_GAME_UI_SCALE}>
        <PhaseTimer phaseEndsAt={state.phaseEndsAt} />
        <DamageHud state={state} myPlayerId={room.sessionId} />
        <Title>{t("reveal.closestTimelineTitle")}</Title>
        <ScrollView
          horizontal
          style={styles.timelineScroll}
          contentContainerStyle={styles.timelineScrollContent}
          showsHorizontalScrollIndicator={rankedGuesses.length > 5}
        >
          <View style={[styles.timeline, { width: timelineWidth }]}>
            <Text
              numberOfLines={Platform.OS === "android" ? 1 : undefined}
              adjustsFontSizeToFit={Platform.OS === "android"}
              minimumFontScale={0.7}
              style={[styles.timelineSideLabel, styles.timelineFarthestLabel]}
            >
              {t("reveal.farthest")}
            </Text>
            <View style={styles.timelineLine} />
            <Text
              numberOfLines={Platform.OS === "android" ? 1 : undefined}
              adjustsFontSizeToFit={Platform.OS === "android"}
              minimumFontScale={0.7}
              style={[styles.timelineSideLabel, styles.timelineClosestLabel]}
            >
              {t("reveal.closest")}
            </Text>
            {rankedGuesses.map((item: any, index: number) => {
              const progress = rankedGuesses.length <= 1 ? 1 : index / (rankedGuesses.length - 1);
              const markerX = guessStartX + progress * (guessEndX - guessStartX);
              const labelAbove = index % 2 === 0;
              return (
                <View
                  key={item.playerId}
                  style={[
                    styles.guessMarker,
                    { left: markerX - guessMarkerWidth / 2, width: guessMarkerWidth },
                  ]}
                >
                  <View style={[
                    styles.guessLabel,
                    { width: guessMarkerWidth },
                    labelAbove ? styles.guessLabelAbove : styles.guessLabelBelow,
                    item.correct && styles.guessLabelWinner,
                  ]}>
                    <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={[styles.guessName, { color: state.players.get(item.playerId)?.nameColor || theme.text }]}>{nameFor(item.playerId)}</Text>
                    <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75} style={styles.guessNumber}>{item.answerText}</Text>
                    <Text style={[styles.guessDelta, { color: item.scoreDelta >= 0 ? "#7CFFA0" : theme.danger }] }>
                      {item.scoreDelta >= 0 ? "+" : ""}{item.scoreDelta}
                    </Text>
                  </View>
                  <View style={[styles.guessDot, item.correct && styles.guessDotWinner]} />
                </View>
              );
            })}
            <View style={[styles.resultMarker, { left: resultX - resultMarkerWidth / 2, width: resultMarkerWidth }]}>
              <Text style={styles.resultLabel}>{t("reveal.result")}</Text>
              <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.65} style={styles.resultNumber}>
                {state.correctAnswerText}
              </Text>
              <View style={styles.resultDot} />
            </View>
          </View>
        </ScrollView>
      </Screen>
    );
  }

  return (
    <Screen style={styles.screen} androidScale={ANDROID_GAME_UI_SCALE}>
      <PhaseTimer phaseEndsAt={state.phaseEndsAt} />
      <DamageHud state={state} myPlayerId={room.sessionId} />
      <Subtitle>{t("reveal.correctAnswer")}</Subtitle>
      <Title>{state.correctAnswerText}</Title>

      <View style={styles.revealBody}>
        <FlatList
          style={styles.list}
          data={results}
          keyExtractor={(r: any) => r.playerId}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }: any) => (
          <View style={[styles.row, { borderLeftColor: item.correct ? "#7CFFA0" : theme.danger }]}>
            <View style={styles.rowHeader}>
              <Text style={[styles.name, { color: state.players.get(item.playerId)?.nameColor || theme.text }]}>{nameFor(item.playerId)}</Text>
              <View style={styles.scoreBlock}>
                <Text style={styles.currentScore}>{state.gameMode === "damage" ? `${state.players.get(item.playerId)?.health ?? 0} HP` : state.players.get(item.playerId)?.score ?? 0}</Text>
                <Text style={[styles.delta, { color: item.scoreDelta >= 0 ? "#7CFFA0" : theme.danger }] }>
                  {item.scoreDelta >= 0 ? "+" : ""}
                  {item.scoreDelta}{state.gameMode === "damage" ? ` ${t("damage.damage")}` : ""}
                </Text>
                {state.gameMode === "damage" && item.shieldGained > 0 ? <Text style={styles.shieldGain}>+{item.shieldGained} {t("damage.shield")}</Text> : null}
              </View>
            </View>
            {isOrderingReveal && item.orderingItems?.length ? (
              <>
                <Text style={styles.answerLabel}>{t("reveal.answer")}:</Text>
                <View style={styles.orderingAnswerWrap}>
                  {item.orderingItems.map((answerPart: string, index: number) => (
                    <View
                      key={`${item.playerId}-${index}-${answerPart}`}
                      style={[
                        styles.orderingAnswerChip,
                        item.orderingMatches?.[index] ? styles.orderingAnswerChipCorrect : styles.orderingAnswerChipWrong,
                      ]}
                    >
                      <Text style={styles.orderingAnswerChipText}>{answerPart}</Text>
                    </View>
                  ))}
                </View>
              </>
            ) : (
              <Text style={styles.answerValue}>
                <Text style={styles.answerLabel}>{t("reveal.answer")}: </Text>
                {item.answerText || t("reveal.noAnswer")}
              </Text>
            )}
          </View>
          )}
        />
        <View style={styles.leaderboardPane}>
          <LeaderboardStrip players={leaderboardPlayers} myPlayerId={room.sessionId} />
        </View>
      </View>
    </Screen>
  );
}

function DamageAvatarPane({ state, results, myPlayerId }: { state: any; results: any[]; myPlayerId: string }) {
  const [showHit, setShowHit] = React.useState(false);
  const hitEndRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const allPlayers = [...state.players.values()] as any[];
  const players = [
    allPlayers.find((player) => player.id === myPlayerId),
    ...allPlayers.filter((player) => player.id !== myPlayerId),
  ].filter(Boolean).slice(0, 2) as any[];
  const projectileAttack = players.some((player) => PROJECTILE_BY_AVATAR[player.avatarId] && (results.find((result: any) => result.playerId === player.id)?.damageDealt ?? 0) > 0);

  const triggerImpact = React.useCallback(() => {
    setShowHit(true);
    if (hitEndRef.current) clearTimeout(hitEndRef.current);
    hitEndRef.current = setTimeout(() => setShowHit(false), 1_000);
  }, []);

  React.useEffect(() => {
    if (projectileAttack) return;
    const hitStart = setTimeout(triggerImpact, 420);
    return () => {
      clearTimeout(hitStart);
      if (hitEndRef.current) clearTimeout(hitEndRef.current);
    };
  }, [projectileAttack, triggerImpact]);

  return (
      <View style={styles.damageAvatarPane}>
        {players.map((player, index) => {
          const ownResult = results.find((result: any) => result.playerId === player.id);
          const opponent = players[index === 0 ? 1 : 0];
          const incomingDamage = results.find((result: any) => result.playerId === opponent?.id)?.damageDealt ?? 0;
          const isHit = showHit && incomingDamage > 0;
          return (
            <DamageFighter key={player.id} isHit={isHit}>
              <Image
                source={DAMAGE_AVATARS[player.avatarId] ?? DAMAGE_AVATARS.smart_owl}
                resizeMode="contain"
                style={[styles.damageAvatar, index === 1 && styles.damageAvatarFacingLeft]}
              />
              {isHit ? <Image source={DAMAGE_AVATARS[player.avatarId] ?? DAMAGE_AVATARS.smart_owl} resizeMode="contain" style={[styles.damageAvatarHitOverlay, index === 1 && styles.damageAvatarFacingLeft]} /> : null}
              {incomingDamage > 0 && isHit ? <DamageNumber amount={incomingDamage} /> : null}
              <Text numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.7} style={styles.damagePlayerAnswer}>{ownResult?.answerText || "—"}</Text>
            </DamageFighter>
          );
        })}
        <AvatarProjectile players={players} results={results} onImpact={triggerImpact} />
        <Text style={styles.damageVersus}>VS</Text>
      </View>
  );
}

function AvatarProjectile({ players, results, onImpact }: { players: any[]; results: any[]; onImpact: () => void }) {
  const progress = React.useRef(new Animated.Value(0)).current;
  const [loaded, setLoaded] = React.useState(false);
  const attackerIndex = players.findIndex((player) => PROJECTILE_BY_AVATAR[player.avatarId] && (results.find((result: any) => result.playerId === player.id)?.damageDealt ?? 0) > 0);

  React.useEffect(() => {
    if (attackerIndex < 0 || !loaded) return;
    progress.setValue(0);
    Animated.timing(progress, { toValue: 1, duration: 1_150, delay: 550, useNativeDriver: true }).start(({ finished }) => {
      if (finished) onImpact();
    });
  }, [attackerIndex, loaded, onImpact, progress]);

  if (attackerIndex < 0) return null;
  const direction = attackerIndex === 1 ? -1 : 1;
  return (
    <Animated.Image
      source={PROJECTILE_BY_AVATAR[players[attackerIndex].avatarId]}
      onLoad={() => setLoaded(true)}
      fadeDuration={0}
      resizeMode="contain"
      style={[
        styles.quizBotProjectile,
        attackerIndex === 1 ? styles.quizBotProjectileRight : styles.quizBotProjectileLeft,
        {
          opacity: loaded ? progress.interpolate({ inputRange: [0, 0.88, 1], outputRange: [1, 1, 0] }) : 0,
          transform: [
            { translateX: progress.interpolate({ inputRange: [0, 1], outputRange: [0, direction * 390] }) },
            { translateY: progress.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, -52, 0] }) },
            { rotate: progress.interpolate({ inputRange: [0, 1], outputRange: ["0deg", `${direction * 720}deg`] }) },
          ],
        },
      ]}
    />
  );
}

function DamageFighter({ isHit, children }: { isHit: boolean; children: React.ReactNode }) {
  const shake = React.useRef(new Animated.Value(0)).current;
  React.useEffect(() => {
    if (!isHit) return;
    Animated.sequence([
      Animated.timing(shake, { toValue: -7, duration: 45, useNativeDriver: true }),
      Animated.timing(shake, { toValue: 7, duration: 70, useNativeDriver: true }),
      Animated.timing(shake, { toValue: -5, duration: 70, useNativeDriver: true }),
      Animated.timing(shake, { toValue: 4, duration: 65, useNativeDriver: true }),
      Animated.timing(shake, { toValue: 0, duration: 60, useNativeDriver: true }),
    ]).start();
  }, [isHit, shake]);
  return <Animated.View style={[styles.damageFighter, isHit && styles.damageFighterHit, { transform: [{ translateX: shake }] }]}>{children}</Animated.View>;
}

function DamageNumber({ amount }: { amount: number }) {
  const rise = React.useRef(new Animated.Value(0)).current;
  React.useEffect(() => {
    Animated.timing(rise, { toValue: 1, duration: 850, useNativeDriver: true }).start();
  }, [rise]);
  return <Animated.Text style={[styles.damageTaken, { opacity: rise.interpolate({ inputRange: [0, 0.72, 1], outputRange: [1, 1, 0] }), transform: [{ translateY: rise.interpolate({ inputRange: [0, 1], outputRange: [0, -44] }) }] }]}>-{amount} HP</Animated.Text>;
}

const styles = StyleSheet.create({
  damageTransitionScreen: { justifyContent: "flex-start", paddingTop: 16 },
  damageCorrectAnswerWrap: { width: "64%", minHeight: 38, alignSelf: "center", alignItems: "center", justifyContent: "center", marginTop: 2 },
  damageCorrectAnswerLabel: { color: theme.textDim, fontSize: 10, fontWeight: "800", textTransform: "uppercase" },
  damageCorrectAnswerText: { width: "100%", color: "#7CFFA0", fontSize: 19, lineHeight: 22, fontWeight: "900", textAlign: "center" },
  damageBattleStage: { flex: 1, minHeight: 0, width: "104%", alignSelf: "center" },
  damageAvatarPane: { flex: 1, minHeight: 0, marginTop: 8, flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", position: "relative", backgroundColor: "transparent", paddingHorizontal: 0, paddingBottom: 2, overflow: "hidden" },
  damageFighter: { width: "40%", height: "100%", alignItems: "center", justifyContent: "flex-end", overflow: "hidden" },
  damageFighterHit: { backgroundColor: "transparent" },
  damageAvatar: { width: "100%", height: "86%" },
  damageAvatarFacingLeft: { transform: [{ scaleX: -1 }] },
  damageAvatarHitOverlay: { position: "absolute", top: 0, width: "100%", height: "86%", tintColor: "#FF405F", opacity: 0.78, zIndex: 2 },
  damageTaken: { position: "absolute", top: "42%", color: "#FFFFFF", fontSize: 18, fontWeight: "900", textShadowColor: "#8F1028", textShadowRadius: 5, zIndex: 3 },
  quizBotProjectile: { position: "absolute", top: "39%", width: 82, height: 82, zIndex: 8 },
  quizBotProjectileLeft: { left: "24%" },
  quizBotProjectileRight: { right: "24%" },
  damagePlayerAnswer: { width: "94%", minHeight: 25, color: theme.text, fontSize: 12, lineHeight: 14, fontWeight: "800", textAlign: "center", paddingHorizontal: 4 },
  damageVersus: { position: "absolute", left: "42%", top: "45%", width: "16%", textAlign: "center", color: "#F7D85B", fontSize: 14, fontWeight: "900", zIndex: 4 },
  closestScreen: { justifyContent: "flex-start", paddingTop: 14 },
  revealBody: {
    flex: 1,
    minHeight: 0,
    width: Platform.OS === "android" ? "110%" : "100%",
    alignSelf: "center",
    flexDirection: "row",
    gap: 12,
  },
  leaderboardPane: { width: "34%", minWidth: 210, minHeight: 0, overflow: "hidden" },
  timelineScroll: { flex: 1, width: "100%", marginTop: 4 },
  timelineScrollContent: { alignItems: "center", minWidth: "100%" },
  timeline: { height: 250, position: "relative" },
  timelineLine: {
    position: "absolute", left: Platform.OS === "android" ? 120 : 82, right: Platform.OS === "android" ? 90 : 60, top: 123, height: 5, borderRadius: 3, backgroundColor: theme.primary,
  },
  timelineSideLabel: {
    position: "absolute", top: 115, width: Platform.OS === "android" ? 110 : 72, color: theme.textDim,
    fontSize: 11, fontWeight: "800", textAlign: "center",
  },
  timelineFarthestLabel: { left: 4 },
  timelineClosestLabel: { right: Platform.OS === "android" ? 35 : 24, top: 145 },
  guessMarker: { position: "absolute", top: 0, width: 104, height: 250, alignItems: "center" },
  guessLabel: {
    position: "absolute",
    width: 104,
    minHeight: 78,
    ...(Platform.OS === "android" ? { height: 82 } : {}),
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: Platform.OS === "android" ? 9 : 6,
    paddingVertical: Platform.OS === "android" ? 7 : 5,
    borderRadius: 10,
    backgroundColor: theme.surface, borderWidth: 1, borderColor: "rgba(124, 92, 255, 0.55)",
  },
  guessLabelAbove: { top: 27 },
  guessLabelBelow: { top: 149 },
  guessLabelWinner: { borderColor: "#7CFFA0", backgroundColor: "rgba(47, 91, 66, 0.92)" },
  guessName: { color: theme.text, fontSize: 12, fontWeight: "800", width: "100%", textAlign: "center" },
  guessNumber: { color: theme.primary, fontSize: 16, fontWeight: "900", marginTop: 2 },
  guessDelta: { fontSize: 11, fontWeight: "800", marginTop: 1 },
  guessDot: {
    position: "absolute", top: 118, width: 14, height: 14, borderRadius: 7,
    backgroundColor: theme.primary, borderWidth: 2, borderColor: theme.text,
  },
  guessDotWinner: { backgroundColor: "#7CFFA0" },
  resultMarker: { position: "absolute", top: 0, height: 250, width: 110, alignItems: "center" },
  resultLabel: { position: "absolute", top: 67, color: "#7CFFA0", fontSize: 12, fontWeight: "900", textTransform: "uppercase" },
  resultNumber: { position: "absolute", top: 84, width: "100%", textAlign: "center", color: theme.text, fontSize: 20, fontWeight: "900" },
  resultDot: {
    position: "absolute", top: 116, width: 18, height: 18, borderRadius: 9,
    backgroundColor: "#7CFFA0", borderWidth: 3, borderColor: theme.text,
  },
  screen: {
    justifyContent: "flex-start",
    paddingTop: 12,
  },
  list: { flex: 1, minWidth: 0, marginTop: 12 },
  listContent: { paddingBottom: 10 },
  row: {
    backgroundColor: theme.surface,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    marginBottom: 8,
    borderLeftWidth: 4,
  },
  rowHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  name: { color: theme.text, fontSize: Platform.OS === "android" ? 14 : 16, fontWeight: "700", flex: 1, flexShrink: 1, paddingRight: 12 },
  scoreBlock: { alignItems: "flex-end", minWidth: 54 },
  currentScore: { color: theme.textDim, fontSize: Platform.OS === "android" ? 11 : 12, fontWeight: "700" },
  shieldGain: { color: "#7CCBFF", fontSize: 10, fontWeight: "800" },
  delta: { fontSize: Platform.OS === "android" ? 16 : 18, fontWeight: "900", marginTop: 2 },
  answerLabel: { color: theme.textDim, marginTop: 6, fontSize: Platform.OS === "android" ? 11 : 12, fontWeight: "700" },
  answerValue: { color: theme.text, marginTop: 6, fontSize: Platform.OS === "android" ? 12 : 14, fontWeight: "600" },
  orderingAnswerWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 4,
  },
  orderingAnswerChip: {
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 5,
    marginRight: 6,
    marginBottom: 6,
  },
  orderingAnswerChipCorrect: {
    backgroundColor: "rgba(124, 255, 160, 0.18)",
    borderWidth: 1,
    borderColor: "#7CFFA0",
  },
  orderingAnswerChipWrong: {
    backgroundColor: "rgba(255, 107, 107, 0.16)",
    borderWidth: 1,
    borderColor: theme.danger,
  },
  orderingAnswerChipText: {
    color: theme.text,
    fontSize: Platform.OS === "android" ? 11 : 12,
    fontWeight: "700",
  },
});
