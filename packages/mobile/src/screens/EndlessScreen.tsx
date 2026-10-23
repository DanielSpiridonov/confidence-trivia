import React from "react";
import { ActivityIndicator, Animated, AppState, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { randomUUID } from "expo-crypto";
import { Ionicons } from "@expo/vector-icons";
import type { EndlessState } from "@confidence-trivia/shared";
import { Screen, theme } from "../components/ui";
import { RewardRoad } from "../components/RewardRoad";
import { getEndlessState, sendEndlessAction } from "../network/client";
import { menuTap } from "../components/menuHaptics";

const ACCENTS = { easy: "#98E6C2", medium: "#80CDF6", hard: "#FFCA85", expert: "#E0AAFF" };
function Action({ label, onPress, disabled, secondary = false }: { label: string; onPress: () => void; disabled?: boolean; secondary?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled: !!disabled }} disabled={disabled} onPress={() => { menuTap(); onPress(); }} style={({ pressed }) => [s.action, secondary && s.secondary, (disabled || pressed) && { opacity: 0.5 }]}><Text style={s.actionText}>{label}</Text></Pressable>;
}

export function EndlessScreen({ playerId, onBack, onLeaderboard, onStarsChange }: { playerId: string; onBack: () => void; onLeaderboard: () => void; onStarsChange: (stars: number) => void }) {
  const [state, setState] = React.useState<EndlessState | null>(null);
  const [playing, setPlaying] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [now, setNow] = React.useState(0);
  const [selected, setSelected] = React.useState<number | null>(null);
  const [foreground, setForeground] = React.useState(AppState.currentState === "active");
  const [milestone, setMilestone] = React.useState<{ score: number; stars: number } | null>(null);
  const previousRewards = React.useRef<{ runId: string; count: number } | null>(null);
  const rewardOpacity = React.useRef(new Animated.Value(0)).current;
  const rewardScale = React.useRef(new Animated.Value(0.9)).current;
  const inFlight = React.useRef(false);
  const alive = React.useRef(true);
  const clock = React.useRef({ server: 0, local: 0 });
  const pendingStart = React.useRef<string | null>(null);
  const lifeScale = React.useRef(new Animated.Value(1)).current;
  const recordScale = React.useRef(new Animated.Value(1)).current;
  const timerScale = React.useRef(new Animated.Value(1)).current;
  const run = state?.run ?? null;
  const question = run?.question;
  const accent = question ? ACCENTS[question.difficulty] : ACCENTS.expert;
  const serverTime = () => clock.current.server + performance.now() - clock.current.local;

  const request = React.useCallback(async (command?: object): Promise<boolean> => {
    if (inFlight.current) return false;
    inFlight.current = true; setBusy(true);
    try {
      const result = command ? await sendEndlessAction(playerId, command) : await getEndlessState(playerId);
      if (!alive.current) return false;
      clock.current = { server: result.serverNow, local: performance.now() };
      setState(result); setNow(result.serverNow); setSelected(null); setError(null); onStarsChange(result.stars);
      return true;
    } catch (e) {
      if (alive.current) { setError(e instanceof Error && e.name !== "AbortError" ? e.message : "Connection interrupted. Reconnect to recover your saved run."); setSelected(null); }
      return false;
    } finally { inFlight.current = false; if (alive.current) setBusy(false); }
  }, [onStarsChange, playerId]);

  React.useEffect(() => {
    alive.current = true; void request();
    const subscription = AppState.addEventListener("change", (value) => { setForeground(value === "active"); if (value === "active") void request(); });
    const ticker = setInterval(() => setNow(serverTime()), 100);
    return () => { alive.current = false; clearInterval(ticker); subscription.remove(); };
  }, [request]);

  React.useEffect(() => {
    if (!question || run?.phase !== "question" || !playing || !foreground) return;
    timerScale.setValue(Math.max(0, Math.min(1, (question.deadline - serverTime()) / (question.duration * 1000))));
    const animation = Animated.timing(timerScale, { toValue: 0, duration: Math.max(0, question.deadline - serverTime()), useNativeDriver: true });
    animation.start(); return () => animation.stop();
  }, [question?.token, run?.phase, playing, foreground, timerScale]);

  React.useEffect(() => {
    if (!playing || !foreground || !run || !question || busy || error) return;
    if (run.phase === "question" && now >= question.deadline) void request({ type: "answer", runId: run.id, token: question.token, answer: null });
    if (run.phase === "feedback" && now >= (run.feedback?.readyAt ?? Infinity)) void request({ type: "next", runId: run.id, token: question.token });
  }, [now, playing, foreground, run, busy, error, request]);

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
    if (!pendingStart.current) pendingStart.current = randomUUID();
    if (await request({ type: "start", requestId: pendingStart.current })) { pendingStart.current = null; setPlaying(true); }
  }
  const showResults = playing && run?.phase === "finished" && (!run.feedback || now >= run.feedback.readyAt);
  const showQuestion = playing && run && !showResults;
  const seconds = question ? Math.max(0, Math.ceil((question.deadline - now) / 1000)) : 0;
  const totalReward = run?.rewards.reduce((sum, r) => sum + r.stars, 0) ?? 0;

  React.useEffect(() => {
    if (!run) return;
    const previous = previousRewards.current;
    previousRewards.current = { runId: run.id, count: run.rewards.length };
    if (!previous || previous.runId !== run.id || previous.count >= run.rewards.length) return;
    setMilestone(run.rewards[run.rewards.length - 1]);
    rewardOpacity.setValue(1); rewardScale.setValue(0.9);
    const animation = Animated.sequence([
      Animated.spring(rewardScale, { toValue: 1, friction: 5, useNativeDriver: true }),
      Animated.delay(1600),
      Animated.timing(rewardOpacity, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]);
    animation.start(); return () => animation.stop();
  }, [run?.id, run?.rewards.length, rewardOpacity, rewardScale]);
  React.useEffect(() => {
    if (!showResults || !run || run.score <= run.previousBest) return;
    recordScale.setValue(0.9);
    Animated.spring(recordScale, { toValue: 1, friction: 5, useNativeDriver: true }).start();
  }, [showResults, recordScale]);

  return <Screen style={s.screen}>
    <View style={s.header}>
      <Pressable accessibilityRole="button" accessibilityLabel="Return to main menu; run remains saved" onPress={onBack} style={s.back}><Ionicons name="arrow-back" size={23} color="white" /></Pressable>
      <Text style={s.brand}>∞ <Text style={s.brandName}>ENDLESS</Text></Text>
      <Text style={s.headerHint}>{showQuestion ? "ONE QUESTION. KEEP GOING." : "A LITTLE WISDOM. A LONG WAY."}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel="Endless leaderboard" onPress={onLeaderboard} style={s.back}><Ionicons name="trophy-outline" size={22} color="#F4D18B" /></Pressable>
    </View>
    {!state ? <View style={s.center}>{busy ? <ActivityIndicator color="#C6A5FF" /> : <Action label="Retry connection" onPress={() => void request()} />}</View> : null}

    {state && !showQuestion && !showResults ? <View style={s.body}>
      <View style={s.introMark}><Text style={s.infinity}>∞</Text><Text style={s.eyebrow}>YOUR PERSONAL BEST</Text><Text style={s.bestScore}>{state.personalBest}</Text></View>
      <View style={s.introCopy}><Text style={s.title}>How far can you go?</Text><Text style={s.description}>Three lives. Four choices. One point for every correct answer. The questions get tougher as you go.</Text><Text style={s.small}>30s Easy · 25s Medium · 20s Hard · 15s Expert</Text><Text style={s.small}>Beat your best to unlock permanent Star rewards.</Text>
        {run && run.phase !== "finished" ? <><Text style={s.saved}>Saved run · {run.score} correct · {run.lives} lives</Text><Action label="Resume run" disabled={busy || !!error} onPress={() => { setPlaying(true); void request(); }} /><Text style={s.small}>The current timer keeps running when you leave.</Text></> : <View style={s.buttons}><Action label={busy ? "Connecting…" : "Start a run"} disabled={busy || !!error} onPress={() => void start()} />{run ? <Action label="Last results" secondary onPress={() => setPlaying(true)} /> : null}</View>}
      </View>
    </View> : null}

    {showQuestion && question ? <View style={s.playBody}>
      <View style={s.sidebar}>
        <Text style={s.eyebrow}>CORRECT ANSWERS</Text><Animated.Text style={[s.score, { transform: [{ scale: recordScale }] }]}>{run.score}</Animated.Text>
        <Animated.View accessibilityLabel={`${run.lives} lives remaining`} style={[s.hearts, { transform: [{ scale: lifeScale }] }]}>{[0, 1, 2].map((i) => <Ionicons key={i} name={i < run.lives ? "heart" : "heart-outline"} size={26} color={i < run.lives ? "#FF7899" : "#685373"} />)}</Animated.View>
        <Text style={s.small}>BEST {state?.personalBest ?? 0}</Text>
        {run.score > run.previousBest ? <Text style={s.record}>NEW PERSONAL BEST</Text> : null}
        {totalReward > 0 ? <Text style={s.reward}>+{totalReward} Stars this run</Text> : null}
      </View>
      <View style={[s.questionPanel, { borderColor: accent }]}>
        <View style={s.questionMeta}><Text style={[s.difficulty, { color: accent }]}>{question.difficulty.toUpperCase()} <Text style={s.small}>· {question.category} · Q{question.number}</Text></Text><Text accessibilityLabel={`${seconds} seconds remaining`} style={[s.seconds, seconds <= 5 && { color: "#FF7899" }]}>{run.phase === "question" ? `${seconds}s` : "✓"}</Text></View>
        <View style={s.timerTrack}><Animated.View style={[s.timerFill, { backgroundColor: seconds <= 5 ? "#FF7899" : accent, transform: [{ scaleX: timerScale }] }]} /></View>
        <ScrollView style={s.questionScroll} contentContainerStyle={s.questionTextWrap}><Text style={s.questionText}>{question.text}</Text></ScrollView>
        <View style={s.options}>{question.options.map((option, i) => {
          const feedback = run.feedback;
          const correct = feedback?.correctIndex === i;
          const wrong = feedback?.selectedIndex === i && !feedback.correct;
          return <Pressable key={`${question.token}:${i}`} accessibilityRole="button" accessibilityLabel={`${String.fromCharCode(65 + i)}. ${option}${correct ? ". Correct answer" : ""}`} accessibilityState={{ disabled: busy || !!error || run.phase !== "question" || seconds === 0 }} disabled={busy || !!error || run.phase !== "question" || seconds === 0} onPress={() => {
            if (inFlight.current) return; menuTap(); setSelected(i); void request({ type: "answer", runId: run.id, token: question.token, answer: i });
          }} style={[s.option, selected === i && s.optionSelected, correct && s.optionCorrect, wrong && s.optionWrong]}><Text style={s.letter}>{correct ? "✓" : wrong ? "×" : String.fromCharCode(65 + i)}</Text><Text numberOfLines={3} adjustsFontSizeToFit minimumFontScale={0.7} style={s.optionText}>{option}</Text></Pressable>;
        })}</View>
        <Text accessibilityLiveRegion="polite" style={[s.feedback, run.feedback?.correct && { color: "#98E6C2" }]}>{error ? "Connection lost · reconnect below" : run.feedback ? run.feedback.correct ? "Correct! +1" : `${run.feedback.timedOut ? "Time’s up" : "Not quite"} · ${question.options[run.feedback.correctIndex]}` : busy ? "Saving answer…" : "Choose your answer"}</Text>
      </View>
    </View> : null}

    {showResults && run ? <View style={s.body}>
      <Animated.View style={[s.resultScore, { transform: [{ scale: recordScale }] }]}><Text style={s.eyebrow}>{run.score > run.previousBest ? "✧ NEW PERSONAL BEST ✧" : "RUN COMPLETE"}</Text><Text style={s.finalScore}>{run.score}</Text><Text style={s.small}>{run.score} correct answers · {question?.number ?? 0} questions</Text><Text style={s.small}>Previous best {run.previousBest} · Best {state?.personalBest}</Text></Animated.View>
      <View style={s.introCopy}><Text style={s.title}>{run.score > run.previousBest ? "A new mark to beat." : "Every run is a fresh chance."}</Text><Text style={s.description}>{run.endReason === "exhausted" ? "You cleared every available question! Your record and rewards are saved. More questions can be added without resetting your progress." : "Three lives, well spent. Your Reward Road keeps every milestone you earned."}</Text><Text style={s.reward}>{totalReward ? `+${totalReward} Stars · ${run.rewards.map((r) => r.score).join(", ")} milestones` : "Beat your best to reach the next Star reward."}</Text><View style={s.buttons}><Action label="Play again" disabled={busy || !!error} onPress={() => void start()} /><Action label="Main menu" secondary onPress={onBack} /></View></View>
    </View> : null}

    {milestone ? <Animated.View pointerEvents="none" accessibilityLiveRegion="polite" style={[s.milestoneToast, { opacity: rewardOpacity, transform: [{ scale: rewardScale }] }]}><Ionicons name="star" size={18} color="#FFE398" /><Text style={s.reward}>Milestone {milestone.score} · +{milestone.stars} Stars!</Text></Animated.View> : null}
    {error ? <View style={s.error}><Text style={s.errorText}>{error}</Text><Action label={busy ? "Connecting…" : "Reconnect"} disabled={busy} onPress={() => void request()} /></View> : null}
    {state ? <RewardRoad best={state.personalBest} claimed={state.claimed} /> : null}
  </Screen>;
}
const s = StyleSheet.create({
  screen: { paddingVertical: 10, maxWidth: 820, gap: 8 }, header: { flexDirection: "row", alignItems: "center", gap: 10, height: 34 }, back: { padding: 5 },
  milestoneToast: { position: "absolute", top: 8, right: 52, padding: 8, backgroundColor: "#4D326C", borderRadius: 10, borderWidth: 1, borderColor: "#E6C77D", flexDirection: "row", alignItems: "center", gap: 6 },
  brand: { color: "#D5B8FF", fontSize: 34, fontWeight: "900", lineHeight: 36 }, brandName: { fontSize: 19, letterSpacing: 3 }, headerHint: { flex: 1, color: theme.textDim, fontSize: 9, letterSpacing: 1, textAlign: "right" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" }, body: { flex: 1, minHeight: 0, flexDirection: "row", alignItems: "center", gap: 24, paddingHorizontal: 14 },
  introMark: { width: 170, alignItems: "center" }, infinity: { fontSize: 105, lineHeight: 105, color: "#CCA6FF", fontWeight: "700" }, bestScore: { color: "#FFE398", fontSize: 45, fontWeight: "900" },
  introCopy: { flex: 1, gap: 6 }, title: { color: theme.text, fontSize: 24, fontWeight: "900" }, description: { color: "#E2D7F2", fontSize: 13, lineHeight: 18 }, small: { color: theme.textDim, fontSize: 10 }, eyebrow: { color: "#C5B0DF", fontSize: 10, fontWeight: "800", letterSpacing: 1 }, saved: { color: "#FFE398", fontSize: 12, fontWeight: "700" },
  action: { backgroundColor: "#7851BC", paddingHorizontal: 18, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: "#BE94FF", alignItems: "center", minWidth: 120, alignSelf: "flex-start" }, actionText: { color: "white", fontSize: 13, fontWeight: "800" }, secondary: { backgroundColor: "#2B203C", borderColor: "#6C557D" },
  playBody: { flex: 1, minHeight: 0, flexDirection: "row", gap: 14 }, sidebar: { width: 142, alignItems: "center", justifyContent: "center", gap: 5 }, score: { fontSize: 64, lineHeight: 70, color: "white", fontWeight: "900" }, hearts: { flexDirection: "row", gap: 5 }, record: { color: "#FFE398", fontSize: 9, fontWeight: "900", marginTop: 5 }, reward: { color: "#FFE398", fontSize: 11, fontWeight: "700" },
  questionPanel: { flex: 1, minWidth: 0, backgroundColor: "rgba(32,22,49,0.97)", borderRadius: 16, borderWidth: 1, padding: 12 }, questionMeta: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, difficulty: { fontSize: 10, fontWeight: "900", letterSpacing: 0.5 }, seconds: { color: "white", fontSize: 19, fontWeight: "900", fontVariant: ["tabular-nums"] },
  timerTrack: { height: 3, borderRadius: 2, backgroundColor: "#483451", overflow: "hidden", marginTop: 4 }, timerFill: { height: 3, width: "100%", transformOrigin: "left" }, questionScroll: { flex: 1, minHeight: 38, marginVertical: 6 }, questionTextWrap: { flexGrow: 1, justifyContent: "center" }, questionText: { color: "#FFF7FF", fontSize: 18, lineHeight: 23, fontWeight: "800" },
  options: { flexDirection: "row", flexWrap: "wrap", gap: 6 }, option: { width: "49%", flexGrow: 1, flexBasis: "47%", height: 43, backgroundColor: "#3A2A50", borderRadius: 9, borderWidth: 1, borderColor: "#72568C", flexDirection: "row", alignItems: "center", paddingHorizontal: 8, gap: 7 }, letter: { color: "#C7A8E7", fontSize: 13, fontWeight: "900" }, optionText: { flex: 1, color: "white", fontSize: 13, fontWeight: "700" }, optionSelected: { borderColor: "#E2C1FF", backgroundColor: "#65428C" }, optionCorrect: { borderColor: "#98E6C2", backgroundColor: "#245C4B" }, optionWrong: { borderColor: "#FF7899", backgroundColor: "#662B46" }, feedback: { color: "#E3C8E9", fontSize: 11, textAlign: "center", marginTop: 5, minHeight: 15 },
  resultScore: { width: 230, alignItems: "center", gap: 4 }, finalScore: { color: "#FFE398", fontSize: 86, lineHeight: 92, fontWeight: "900" }, buttons: { flexDirection: "row", gap: 9, marginTop: 4 }, error: { position: "absolute", top: 48, left: 10, right: 10, zIndex: 10, flexDirection: "row", gap: 12, alignItems: "center", backgroundColor: "#542D46", padding: 8, borderRadius: 9 }, errorText: { flex: 1, color: "#FFE0E8", fontSize: 11 },
});
