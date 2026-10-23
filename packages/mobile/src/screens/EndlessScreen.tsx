import React from "react";
import { Animated, AppState, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { randomUUID } from "expo-crypto";
import { Ionicons } from "@expo/vector-icons";
import { ENDLESS_FEEDBACK_MS, ENDLESS_HEARTBEAT_MS, type EndlessState } from "@confidence-trivia/shared";
import { Screen, theme } from "../components/ui";
import { EndlessRunProgress } from "../components/EndlessRunProgress";
import { EndlessLobby } from "../components/EndlessLobby";
import { EndlessAnswerOption } from "../components/EndlessAnswerOption";
import { getEndlessOptionState, getEndlessOutcome } from "../components/endlessPresentation";
import { getCachedEndlessState, getEndlessState, sendEndlessAction } from "../network/client";
import { asEndlessRequestError, type EndlessRequestError } from "../network/endlessTransport";
import { menuTap } from "../components/menuHaptics";
import { playSound } from "../audio/sounds";

const ACCENTS = { easy: "#B7C8D0", medium: "#A6C3DE", hard: "#E5BC83", expert: "#C4ABDA" };
function Action({ label, onPress, disabled, secondary = false }: { label: string; onPress: () => void; disabled?: boolean; secondary?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled: !!disabled }} disabled={disabled} onPress={() => { menuTap(); onPress(); }} style={({ pressed }) => [s.action, secondary && s.secondary, (disabled || pressed) && { opacity: 0.5 }]}><Text style={s.actionText}>{label}</Text></Pressable>;
}

export function EndlessScreen({ playerId, onBack, onLeaderboard, onStarsChange, onPlayingChange }: { playerId: string; onBack: () => void; onLeaderboard: () => void; onStarsChange: (stars: number) => void; onPlayingChange: (playing: boolean) => void }) {
  const [state, setState] = React.useState<EndlessState | null>(() => getCachedEndlessState(playerId));
  const [playing, setPlaying] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<EndlessRequestError | null>(null);
  const [now, setNow] = React.useState(state?.serverNow ?? 0);
  const [starting, setStarting] = React.useState(false);
  const startPending = React.useRef(false);
  const requestTask = React.useRef<Promise<boolean> | null>(null);
  const [selected, setSelected] = React.useState<number | null>(null);
  const submittedSeconds = React.useRef(0);
  const lastFeedbackToken = React.useRef<string | null>(null);
  const [feedbackReadyAt, setFeedbackReadyAt] = React.useState(0);
  const [foreground, setForeground] = React.useState(AppState.currentState === "active");
  const [reviewedRunId, setReviewedRunId] = React.useState<string | null>(null);
  const finishProgress = React.useCallback((runId: string) => setReviewedRunId(runId), []);
  const resultsOpacity = React.useRef(new Animated.Value(0)).current;
  const inFlight = React.useRef(false);
  const heartbeatInFlight = React.useRef(false);
  const mustAbandon = React.useRef(false);
  const alive = React.useRef(true);
  const currentState = React.useRef(state);
  const clock = React.useRef({ server: state?.serverNow ?? 0, local: performance.now() });
  const pendingStart = React.useRef<string | null>(null);
  const lifeScale = React.useRef(new Animated.Value(1)).current;
  const recordScale = React.useRef(new Animated.Value(1)).current;
  const timerScale = React.useRef(new Animated.Value(1)).current;
  const run = state?.run ?? null;
  const question = run?.question;
  const accent = question ? ACCENTS[question.difficulty] : ACCENTS.expert;
  const outcome = getEndlessOutcome(run?.feedback ?? null);
  const serverTime = () => clock.current.server + performance.now() - clock.current.local;

  const receiveError = React.useCallback((error: unknown) => {
    const failure = asEndlessRequestError(error);
    setError(failure); setSelected(null);
    if (failure.kind === "protocol" || failure.kind === "auth" || failure.kind === "invalid-action") {
      // A rejected API contract is not a dropped connection. Stop sending the
      // same unsupported command and return to a recoverable lobby.
      mustAbandon.current = true;
      setPlaying(false);
    }
  }, []);

  const receiveState = React.useCallback((result: EndlessState) => {
    if (!alive.current || result.serverNow < clock.current.server) return;
    if (result.run?.feedback && result.run.question?.token !== lastFeedbackToken.current) {
      lastFeedbackToken.current = result.run.question?.token ?? null;
      setFeedbackReadyAt(Math.max(result.run.feedback.readyAt, result.serverNow + ENDLESS_FEEDBACK_MS));
    }
    // Heartbeats must not clear a pending selection or roll back a newer answer.
    if (result.run?.phase !== "question" || result.run.question?.token !== currentState.current?.run?.question?.token) setSelected(null);
    currentState.current = result;
    clock.current = { server: result.serverNow, local: performance.now() };
    setState(result); setNow(result.serverNow); setError(null); onStarsChange(result.stars);
  }, [onStarsChange]);

  const abandon = React.useCallback(() => {
    mustAbandon.current = true;
    const active = currentState.current?.run;
    if (active && active.phase !== "finished") {
      // Best effort even if an answer is in flight or the screen is unmounting.
      // The server's ten-second lease covers termination without a final request.
      void sendEndlessAction(playerId, { type: "abandon", runId: active.id }).then(receiveState).catch(() => undefined);
    }
  }, [playerId, receiveState]);

  function leave() { abandon(); onBack(); }

  const request = React.useCallback((command?: object): Promise<boolean> => {
    if (inFlight.current) return Promise.resolve(false);
    inFlight.current = true; setBusy(true);
    const task = (async () => {
    try {
      let result = command ? await sendEndlessAction(playerId, command) : await getEndlessState(playerId);
      // Only a Start that completed after leaving needs a compensating abandon.
      // A read/retry must remain a read even when an earlier abandon failed.
      if ((command as { type?: string } | undefined)?.type === "start" && mustAbandon.current && result.run && result.run.phase !== "finished") result = await sendEndlessAction(playerId, { type: "abandon", runId: result.run.id });
      if (!alive.current) return false;
      receiveState(result);
      return true;
    } catch (e) {
      if (alive.current) receiveError(e);
      return false;
    } finally { inFlight.current = false; if (alive.current) setBusy(false); }
    })();
    requestTask.current = task;
    return task;
  }, [receiveState, receiveError, playerId]);

  React.useEffect(() => { onPlayingChange(playing); }, [playing, onPlayingChange]);
  React.useEffect(() => () => onPlayingChange(false), [onPlayingChange]);

  React.useEffect(() => {
    alive.current = true; void request();
    const ticker = setInterval(() => setNow(serverTime()), 100);
    return () => { alive.current = false; clearInterval(ticker); };
  }, [request]);

  React.useEffect(() => {
    const subscription = AppState.addEventListener("change", (value) => {
      setForeground(value === "active");
      if (value === "background" && (playing || startPending.current)) abandon();
      if (value === "active") void request();
    });
    return () => subscription.remove();
  }, [playing, abandon, request]);

  React.useEffect(() => {
    if (!playing || !foreground || !run || run.phase === "finished") return;
    const heartbeat = async () => {
      if (AppState.currentState !== "active" || mustAbandon.current || heartbeatInFlight.current || inFlight.current) return;
      heartbeatInFlight.current = true;
      const lastResponse = clock.current.server;
      try { receiveState(await sendEndlessAction(playerId, { type: "heartbeat", runId: run.id })); }
      catch (error) { if (alive.current && !mustAbandon.current && clock.current.server === lastResponse) receiveError(error); }
      finally { heartbeatInFlight.current = false; }
    };
    void heartbeat();
    const ticker = setInterval(() => void heartbeat(), ENDLESS_HEARTBEAT_MS);
    return () => clearInterval(ticker);
  }, [playing, foreground, run?.id, run?.phase === "finished", playerId, receiveState, receiveError]);

  React.useEffect(() => {
    if (!question || run?.phase !== "question" || !playing || !foreground || selected !== null) return;
    timerScale.setValue(Math.max(0, Math.min(1, (question.deadline - serverTime()) / (question.duration * 1000))));
    const animation = Animated.timing(timerScale, { toValue: 0, duration: Math.max(0, question.deadline - serverTime()), useNativeDriver: true });
    animation.start(); return () => animation.stop();
  }, [question?.token, run?.phase, playing, foreground, selected, timerScale]);

  React.useEffect(() => {
    if (!playing || !foreground || !run || !question || busy || error) return;
    if (run.phase === "question" && now >= question.deadline) void request({ type: "answer", runId: run.id, token: question.token, answer: null });
    if (run.phase === "feedback" && now >= Math.max(run.feedback?.readyAt ?? Infinity, feedbackReadyAt)) void request({ type: "next", runId: run.id, token: question.token });
  }, [now, playing, foreground, run, busy, error, feedbackReadyAt, request]);

  React.useEffect(() => {
    if (!run?.feedback || run.feedback.correct) return;
    lifeScale.setValue(1.2);
    Animated.spring(lifeScale, { toValue: 1, friction: 4, useNativeDriver: true }).start();
  }, [run?.lives, lifeScale]);
  React.useEffect(() => {
    if (!run || run.score <= run.previousBest) return;
    recordScale.setValue(1.08);
    Animated.spring(recordScale, { toValue: 1, friction: 4, useNativeDriver: true }).start();
  }, [run?.score, recordScale]);

  async function start() {
    if (startPending.current) return;
    mustAbandon.current = false;
    startPending.current = true; setStarting(true);
    if (!pendingStart.current) pendingStart.current = randomUUID();
    try {
      // A tap during background refresh is queued, never discarded.
      await requestTask.current;
      if (!alive.current) return;
      // Validate the currently deployed API before Start or cleanup actions.
      // Cached run data cannot establish support for heartbeat/abandon.
      if (!await request()) return;
      const previousRun = currentState.current?.run;
      // Starting from the lobby is a new attempt. Only an idempotent retry of
      // this same Start may recover its own request after a brief network drop.
      if (!playing && previousRun && previousRun.phase !== "finished" && previousRun.id !== pendingStart.current) {
        if (!await request({ type: "abandon", runId: previousRun.id })) return;
      }
      if (!alive.current || mustAbandon.current || AppState.currentState !== "active") return;
      if (await request({ type: "start", requestId: pendingStart.current })) { pendingStart.current = null; setPlaying(true); }
    } finally { startPending.current = false; if (alive.current) setStarting(false); }
  }
  async function retry() {
    await requestTask.current;
    if (!alive.current || !await request()) return;
    const active = currentState.current?.run;
    if (playing && !mustAbandon.current && AppState.currentState === "active" && active && active.phase !== "finished") {
      await request({ type: "heartbeat", runId: active.id });
    }
  }
  const finishedReady = playing && run?.phase === "finished" && (!run.feedback || now >= Math.max(run.feedback.readyAt, feedbackReadyAt));
  const showProgress = finishedReady && reviewedRunId !== run?.id;
  const showResults = finishedReady && !showProgress;
  const showQuestion = playing && run && !finishedReady;
  const connectionExpired = !!(playing && run && run.phase !== "finished" && (!Number.isFinite(run.connectionDeadline) || now >= run.connectionDeadline));
  const reconnectSeconds = run ? Math.max(0, Math.ceil((run.connectionDeadline - now) / 1000)) : 0;
  const seconds = selected !== null ? submittedSeconds.current : question ? Math.max(0, Math.ceil((question.deadline - now) / 1000)) : 0;
  const totalReward = run?.rewards.reduce((sum, r) => sum + r.stars, 0) ?? 0;

  React.useEffect(() => {
    if (!showResults) return;
    resultsOpacity.setValue(0);
    const animation = Animated.timing(resultsOpacity, { toValue: 1, duration: 250, useNativeDriver: true });
    animation.start(); return () => animation.stop();
  }, [showResults, resultsOpacity]);
  React.useEffect(() => {
    if (!showResults || !run || run.score <= run.previousBest) return;
    recordScale.setValue(0.9);
    Animated.spring(recordScale, { toValue: 1, friction: 5, useNativeDriver: true }).start();
  }, [showResults, recordScale]);

  return <Screen style={s.screen}>
    <View style={s.header}>
      <Pressable accessibilityRole="button" accessibilityLabel={playing && run?.phase !== "finished" ? "End run and return to main menu" : "Return to main menu"} onPress={leave} style={[s.back, !playing && s.menuBack]}><Ionicons name="arrow-back" size={23} color="white" />{!playing ? <Text style={s.backText}>Back</Text> : null}</Pressable>
      {playing ? <View style={s.brand}><Ionicons name="flame-outline" size={22} color="#D5B8FF" /><Text style={s.brandName}>ENDLESS</Text></View> : null}
      {showQuestion && run ? <View style={s.gameHud}>
        <Animated.Text style={[s.hudScore, { transform: [{ scale: recordScale }] }]}>{run.score} <Text style={s.small}>correct</Text></Animated.Text>
        <Animated.View accessibilityLabel={`${run.lives} lives remaining`} style={[s.hearts, { transform: [{ scale: lifeScale }] }]}>{[0, 1, 2].map((i) => <Ionicons key={i} name={i < run.lives ? "heart" : "heart-outline"} size={22} color={i < run.lives ? "#FF7899" : "#685373"} />)}</Animated.View>
      </View> : <Text style={s.headerHint}>{playing ? "A LITTLE WISDOM. A LONG WAY." : ""}</Text>}
    </View>
    {!playing ? <EndlessLobby best={state?.personalBest ?? null} busy={starting} unavailable={!!error} onStart={() => void start()} onLeaderboard={onLeaderboard} /> : null}

    {showQuestion && question ? <View style={s.playBody}>
      <View style={s.questionPanel}>
        <View style={s.questionMeta}><View style={s.questionLabels}><Text style={s.questionNumber}>QUESTION {question.number.toString().padStart(2, "0")}</Text><Text style={[s.difficulty, { color: accent }]}>{question.difficulty.toUpperCase()}</Text><Text style={s.category}>{question.category}</Text></View>
          {outcome ? <Ionicons accessibilityLabel={outcome.title} name={outcome.icon} size={25} color={outcome.color} /> : <Text accessibilityLabel={`${seconds} seconds remaining`} style={[s.seconds, seconds <= 5 && { color: "#FF9FAD" }]}>{seconds}<Text style={s.timeUnit}> s</Text></Text>}
        </View>
        <View style={s.timerTrack}><Animated.View style={[s.timerFill, { backgroundColor: seconds <= 5 ? "#EAA0A0" : "#DBC59F", transform: [{ scaleX: timerScale }] }]} /></View>
        <ScrollView style={s.questionScroll} contentContainerStyle={s.questionTextWrap}><Text style={s.questionText}>{question.text}</Text></ScrollView>
      </View>
        <View style={s.options}>{[0, 2].map((rowStart) => <View key={rowStart} style={s.optionRow}>{question.options.slice(rowStart, rowStart + 2).map((option, column) => {
          const i = rowStart + column;
          return <EndlessAnswerOption key={`${question.token}:${i}`} index={i} text={option} state={getEndlessOptionState(i, selected, run.feedback)} disabled={busy || selected !== null || !!error || connectionExpired || run.phase !== "question" || seconds === 0} onPress={() => {
            if (inFlight.current) return;
            submittedSeconds.current = seconds;
            timerScale.stopAnimation();
            setSelected(i);
            menuTap(true); playSound("answerLocked");
            void request({ type: "answer", runId: run.id, token: question.token, answer: i });
          }} />;
        })}</View>)}</View>
        <View accessibilityLiveRegion="polite" style={[s.feedback, outcome?.kind === "wrong" && s.feedbackWrong, outcome?.kind === "timeout" && s.feedbackTimeout, outcome?.kind === "correct" && s.feedbackCorrect]}>
          {outcome ? <Ionicons name={outcome.icon} size={20} color={outcome.color} /> : null}
          <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={[s.feedbackTitle, outcome && { color: outcome.color }]}>{connectionExpired ? "Connection window ended · checking result" : error ? "Connection lost · reconnect below" : outcome ? outcome.title : selected !== null ? "Answer locked" : busy ? "One moment…" : "Choose your answer"}</Text>
          {run.feedback && !run.feedback.correct ? <Text numberOfLines={2} style={s.answerExplanation}>Right answer: {question.options[run.feedback.correctIndex]}</Text> : null}
        </View>
    </View> : null}

    {showProgress && run && state ? <EndlessRunProgress key={run.id} run={run} best={state.personalBest} claimed={state.claimed} active={foreground && !busy && !error} onComplete={finishProgress} /> : null}

    {showResults && run ? <Animated.View style={[s.body, { opacity: resultsOpacity }]}>
      <Animated.View style={[s.resultScore, { transform: [{ scale: recordScale }] }]}><Text style={s.eyebrow}>{run.score > run.previousBest ? "✧ NEW PERSONAL BEST ✧" : "RUN COMPLETE"}</Text><Text style={s.finalScore}>{run.score}</Text><Text style={s.small}>{run.score} correct answers · {question?.number ?? 0} questions</Text><Text style={s.small}>Previous best {run.previousBest} · Best {state?.personalBest}</Text></Animated.View>
      <View style={s.introCopy}><Text style={s.title}>{run.endReason === "abandoned" ? "Your run has ended." : run.score > run.previousBest ? "A new mark to beat." : "Every run is a fresh chance."}</Text><Text style={s.description}>{run.endReason === "abandoned" ? "You left the game or the 10-second connection window ended. Your best score and earned Stars are saved." : run.endReason === "exhausted" ? "You cleared every available question! Your record and rewards are saved. More questions can be added without resetting your progress." : "Three lives, well spent. Your Reward Road keeps every milestone you earned."}</Text><Text style={s.reward}>{totalReward ? `+${totalReward} Stars · ${run.rewards.map((r) => r.score).join(", ")} milestones` : "Beat your best to reach the next Star reward."}</Text><View style={s.buttons}><Action label="Play again" disabled={busy || !!error} onPress={() => void start()} /><Action label="Main menu" secondary onPress={leave} /></View></View>
    </Animated.View> : null}

    {error ? <View style={s.error}><Text style={s.errorText}>{error.message}{playing && run?.phase !== "finished" ? connectionExpired ? " The connection window ended. Check your result." : ` Reconnect within ${reconnectSeconds}s. The timer keeps running.` : ""}</Text><Action label={busy ? "Checking…" : !playing ? "Try again" : connectionExpired ? "Check result" : "Reconnect"} disabled={busy} onPress={() => void retry()} /></View> : null}
  </Screen>;
}
const s = StyleSheet.create({
  screen: { paddingVertical: 10, maxWidth: Platform.OS === "ios" ? undefined : 820, gap: 8 }, header: { flexDirection: "row", alignItems: "center", gap: 10, height: 34, flexShrink: 0 }, back: { padding: 5 },
  menuBack: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, borderWidth: 1.5, borderColor: "#655078", borderRadius: 13, backgroundColor: "rgba(25,18,39,0.75)" }, backText: { color: "#E9D8F7", fontFamily: Platform.OS === "ios" ? "ChalkboardSE-Regular" : "casual", fontSize: 16 }, currency: { flexDirection: "row", alignItems: "center", gap: 7, paddingHorizontal: 11, paddingVertical: 4, borderWidth: 1.5, borderColor: "#655078", borderRadius: 13, backgroundColor: "rgba(25,18,39,0.75)" }, currencyText: { color: "#F5E8FC", fontWeight: "800", fontSize: 15 },
  gameHud: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 24, paddingRight: 8 }, hudScore: { color: "white", fontSize: 23, fontWeight: "900" },
  brand: { flexDirection: "row", alignItems: "center", gap: 7 }, brandName: { color: "#D5B8FF", fontSize: 19, letterSpacing: 3, fontWeight: "900" }, headerHint: { flex: 1, color: theme.textDim, fontSize: 9, letterSpacing: 1, textAlign: "right" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" }, body: { flex: 1, minHeight: 0, flexDirection: "row", alignItems: "center", gap: 24, paddingHorizontal: 14 },
  introCopy: { flex: 1, gap: 6 }, title: { color: theme.text, fontSize: 24, fontWeight: "900" }, description: { color: "#E2D7F2", fontSize: 13, lineHeight: 18 }, small: { color: theme.textDim, fontSize: 10 }, eyebrow: { color: "#C5B0DF", fontSize: 10, fontWeight: "800", letterSpacing: 1 },
  action: { backgroundColor: "#7851BC", paddingHorizontal: 18, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: "#BE94FF", alignItems: "center", minWidth: 120, alignSelf: "flex-start" }, actionText: { color: "white", fontSize: 13, fontWeight: "800" }, secondary: { backgroundColor: "#2B203C", borderColor: "#6C557D" },
  playBody: { flex: 1, minHeight: 0, gap: 9 }, hearts: { flexDirection: "row", gap: 5 }, reward: { color: "#FFE398", fontSize: 11, fontWeight: "700" },
  questionPanel: { flex: 1, minWidth: 0, minHeight: 0, backgroundColor: "rgba(20,15,29,0.65)", borderRadius: 18, borderWidth: 1, borderColor: "rgba(206,183,228,0.22)", paddingHorizontal: 18, paddingVertical: 8 }, questionMeta: { height: 30, flexShrink: 0, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, questionLabels: { flexDirection: "row", gap: 12, alignItems: "center", flex: 1 }, questionNumber: { color: "#DED0E8", fontSize: 10, fontWeight: "900", letterSpacing: 1.3 }, category: { color: "#B9A7C9", fontSize: 11, textTransform: "capitalize" }, difficulty: { fontSize: 9, fontWeight: "800", letterSpacing: 0.5, backgroundColor: "rgba(230,210,248,0.08)", paddingHorizontal: 8, paddingVertical: 5, borderRadius: 6 }, seconds: { color: "#F8EFDF", fontSize: 24, fontWeight: "800", fontVariant: ["tabular-nums"] }, timeUnit: { color: "#BCAACD", fontSize: 12 },
  timerTrack: { height: 3, flexShrink: 0, borderRadius: 2, backgroundColor: "rgba(228,208,246,0.13)", overflow: "hidden", marginTop: 6 }, timerFill: { height: 3, width: "100%", transformOrigin: "left" }, questionScroll: { flex: 1, minHeight: 0, marginVertical: 4 }, questionTextWrap: { flexGrow: 1, justifyContent: "center" }, questionText: { color: "#FFF5E9", fontFamily: Platform.OS === "ios" ? "ChalkboardSE-Regular" : "casual", fontSize: 25, lineHeight: 30, textAlign: "center" },
  // Reserve both answer rows before the question panel takes the remaining height.
  options: { flexShrink: 0, gap: 9 }, optionRow: { flexDirection: "row", height: 72, flexShrink: 0, gap: 9 }, feedback: { flexDirection: "row", alignItems: "center", justifyContent: "center", flexShrink: 0, gap: 8, height: 32, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5 }, feedbackTitle: { color: "#C5B6D2", fontSize: 12, fontWeight: "800", flexShrink: 1 }, feedbackWrong: { backgroundColor: "#40272E" }, feedbackTimeout: { backgroundColor: "#403426" }, feedbackCorrect: { backgroundColor: "#263C33" }, answerExplanation: { color: "#F2E8D5", fontSize: 11, lineHeight: 11, flexShrink: 1 },
  resultScore: { width: 230, alignItems: "center", gap: 4 }, finalScore: { color: "#FFE398", fontSize: 86, lineHeight: 92, fontWeight: "900" }, buttons: { flexDirection: "row", gap: 9, marginTop: 4 }, error: { position: "absolute", top: 48, left: 10, right: 10, zIndex: 10, flexDirection: "row", gap: 12, alignItems: "center", backgroundColor: "#542D46", padding: 8, borderRadius: 9 }, errorText: { flex: 1, color: "#FFE0E8", fontSize: 11 },
});
