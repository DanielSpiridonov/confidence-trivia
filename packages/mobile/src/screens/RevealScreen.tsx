import React from "react";
import { View, Text, FlatList, Platform, ScrollView, StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";
import { Room } from "colyseus.js";
import { ANDROID_GAME_UI_SCALE, Screen, Title, Subtitle, theme } from "../components/ui";
import { useRoomState } from "../network/client";
import { PhaseTimer } from "../components/PhaseTimer";
import { LeaderboardStrip } from "./LeaderboardScreen";

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
  }));
  const isOrderingReveal = state.currentQuestion?.qType === "ordering";
  const isClosestAnswerReveal = state.currentQuestion?.qType === "closest_answer";

  if (isClosestAnswerReveal) {
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
      rankedGuesses.length * 110 + 150,
    );
    const guessStartX = 95;
    const guessEndX = timelineWidth - 215;
    const resultX = timelineWidth - (Platform.OS === "android" ? 90 : 60);
    const resultMarkerWidth = Platform.OS === "android" ? 180 : 110;

    return (
      <Screen style={styles.closestScreen} androidScale={ANDROID_GAME_UI_SCALE}>
        <PhaseTimer phaseEndsAt={state.phaseEndsAt} />
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
                    { left: markerX - 52 },
                    labelAbove ? styles.guessMarkerAbove : styles.guessMarkerBelow,
                  ]}
                >
                  <View style={[styles.guessLabel, item.correct && styles.guessLabelWinner]}>
                    <Text numberOfLines={1} style={styles.guessName}>{nameFor(item.playerId)}</Text>
                    <Text style={styles.guessNumber}>{item.answerText}</Text>
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
              <Text style={styles.name}>{nameFor(item.playerId)}</Text>
              <View style={styles.scoreBlock}>
                <Text style={styles.currentScore}>{state.players.get(item.playerId)?.score ?? 0}</Text>
                <Text style={[styles.delta, { color: item.scoreDelta >= 0 ? "#7CFFA0" : theme.danger }] }>
                  {item.scoreDelta >= 0 ? "+" : ""}
                  {item.scoreDelta}
                </Text>
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

const styles = StyleSheet.create({
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
  guessMarker: { position: "absolute", width: 104, alignItems: "center" },
  guessMarkerAbove: { top: 16 },
  guessMarkerBelow: { top: 122, flexDirection: "column-reverse" },
  guessLabel: {
    width: 104, minHeight: 78, justifyContent: "center", alignItems: "center",
    paddingHorizontal: 6, paddingVertical: 5, borderRadius: 10,
    backgroundColor: theme.surface, borderWidth: 1, borderColor: "rgba(124, 92, 255, 0.55)",
  },
  guessLabelWinner: { borderColor: "#7CFFA0", backgroundColor: "rgba(47, 91, 66, 0.92)" },
  guessName: { color: theme.text, fontSize: 12, fontWeight: "800", width: "100%", textAlign: "center" },
  guessNumber: { color: theme.primary, fontSize: 16, fontWeight: "900", marginTop: 2 },
  guessDelta: { fontSize: 11, fontWeight: "800", marginTop: 1 },
  guessDot: {
    width: 14, height: 14, marginVertical: 5, borderRadius: 7,
    backgroundColor: theme.primary, borderWidth: 2, borderColor: theme.text,
  },
  guessDotWinner: { backgroundColor: "#7CFFA0" },
  resultMarker: { position: "absolute", top: Platform.OS === "android" ? 26 : 68, width: 110, alignItems: "center" },
  resultLabel: { color: "#7CFFA0", fontSize: 12, fontWeight: "900", textTransform: "uppercase" },
  resultNumber: { color: theme.text, fontSize: 20, fontWeight: "900", marginTop: 2 },
  resultDot: {
    width: 18, height: 18, marginTop: 6, borderRadius: 9,
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
