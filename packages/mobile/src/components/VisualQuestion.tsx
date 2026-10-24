import React from "react";
import { AccessibilityInfo, Animated, Image, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import Svg, { Defs, Filter, FeGaussianBlur, G, Path } from "react-native-svg";
import { VISUAL_ASSETS, IMAGE_REVEAL_BLUR, imageRevealStage, hasVisualAsset, type VisualPresentation } from "@confidence-trivia/shared";
import { menuTap } from "./menuHaptics";
import { playSound } from "../audio/sounds";
import { visualImageSource } from "./visualImageSources";

function Artwork({ assetId, blur, onLoad, onError }: { assetId: string; blur: number; onLoad?: () => void; onError?: () => void }) {
  const asset = VISUAL_ASSETS[assetId];
  const id = React.useId().replace(/[^a-zA-Z0-9]/g, "");
  if (!hasVisualAsset(assetId)) return null;
  if ("kind" in asset) return <Image accessible={false} source={visualImageSource(assetId)} resizeMode="contain" blurRadius={blur} fadeDuration={0} onLoad={onLoad} onError={onError} style={{ width: "100%", height: "100%" }} />;
  return <Svg accessible={false} width="100%" height="100%" viewBox={asset.viewBox} preserveAspectRatio="xMidYMid meet">
    <Defs><Filter id={id} x="-20%" y="-20%" width="140%" height="140%"><FeGaussianBlur stdDeviation={blur} /></Filter></Defs>
    <G filter={blur ? `url(#${id})` : undefined} fill="#DCC7F3" fillRule={assetId.startsWith("geo_") ? "evenodd" : "nonzero"}>{asset.paths.map((p, i) => <Path key={i} d={p.d} fill={p.fill} stroke={p.stroke} strokeWidth={p.strokeWidth} strokeLinecap="round" strokeLinejoin="round" />)}</G>
  </Svg>;
}
export function VisualCanvas({ presentation, startedAt, durationMs, serverNow, full = false, preparing = false, onReady, onFailure }: {
  presentation: VisualPresentation; startedAt: number; durationMs: number; serverNow?: number; full?: boolean; preparing?: boolean; onReady?: () => void; onFailure?: () => void;
}) {
  const anchor = React.useRef({ server: serverNow ?? Date.now(), local: performance.now() });
  if (serverNow !== undefined && serverNow !== anchor.current.server) anchor.current = { server: serverNow, local: performance.now() };
  const [now, setNow] = React.useState(serverNow ?? Date.now());
  React.useEffect(() => {
    const tick = () => setNow(anchor.current.server + performance.now() - anchor.current.local);
    tick(); const timer = setInterval(tick, 100); return () => clearInterval(timer);
  }, [startedAt]);
  const stage = full || presentation.format === "map_shapes" ? 3 : startedAt ? imageRevealStage(startedAt, durationMs, now) : 1;
  const [previous, setPrevious] = React.useState(stage);
  const [transitioning, setTransitioning] = React.useState(false);
  const last = React.useRef(stage);
  const fade = React.useRef(new Animated.Value(1)).current;
  const [reduceMotion, setReduceMotion] = React.useState(false);
  React.useEffect(() => {
    let active = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((value) => { if (active) setReduceMotion(value); }).catch(() => undefined);
    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduceMotion);
    return () => { active = false; subscription.remove(); };
  }, []);
  React.useEffect(() => {
    if (stage === last.current) return;
    setPrevious(last.current); last.current = stage; setTransitioning(true); fade.setValue(0);
    const animation = Animated.timing(fade, { toValue: 1, duration: reduceMotion ? 0 : 240, useNativeDriver: true });
    animation.start(({ finished }) => { if (finished) setTransitioning(false); }); return () => animation.stop();
  }, [stage, fade, reduceMotion]);
  const notified = React.useRef(false);
  const ready = React.useRef(onReady); ready.current = onReady;
  const failed = React.useRef(onFailure); failed.current = onFailure;
  const raster = hasVisualAsset(presentation.assetId) && "kind" in VISUAL_ASSETS[presentation.assetId];
  const [imageFailed, setImageFailed] = React.useState(false);
  const valid = !imageFailed && hasVisualAsset(presentation.assetId) && (!raster || !!visualImageSource(presentation.assetId));
  const [imageLoaded, setImageLoaded] = React.useState(!raster);
  const [laidOut, setLaidOut] = React.useState(false);
  React.useEffect(() => {
    if (!valid) { failed.current?.(); return; }
    if (!laidOut || !imageLoaded || notified.current) return;
    let nextFrame = 0;
    const frame = requestAnimationFrame(() => { nextFrame = requestAnimationFrame(() => { if (!notified.current) { notified.current = true; ready.current?.(); } }); });
    return () => { cancelAnimationFrame(frame); if (nextFrame) cancelAnimationFrame(nextFrame); };
  }, [valid, laidOut, imageLoaded]);
  const blur = (value: number) => presentation.format === "map_shapes" || full ? 0 : IMAGE_REVEAL_BLUR[value-1];
  return <View style={s.canvas} onLayout={() => setLaidOut(true)}>
    {valid ? <View style={[s.art, preparing && { opacity: 0 }]}>{transitioning ? <Artwork assetId={presentation.assetId} blur={blur(previous)} /> : null}<Animated.View style={[StyleSheet.absoluteFill, { opacity: fade }]}><Artwork assetId={presentation.assetId} blur={blur(stage)} onLoad={() => setImageLoaded(true)} onError={() => setImageFailed(true)} /></Animated.View></View> : <Text style={s.muted}>This illustration is unavailable.</Text>}
    {preparing ? <Text style={s.muted}>Preparing the question…</Text> : presentation.format === "image_reveal" && !full ? <Text style={s.stage}>Stage {stage} / 3</Text> : null}
  </View>;
}
export function VisualQuestionRound({ id, text, presentation, answerType, options, startedAt, durationMs, endsAt, serverNow, preparing, locked, feedback, solo, damage, onSubmit, onDraft, onReady, onFailure }: {
  id: string; text: string; presentation: VisualPresentation; answerType: string; options: string[]; startedAt: number; durationMs: number; endsAt?: number; serverNow?: number;
  preparing: boolean; locked: boolean; feedback?: { correct: boolean; timedOut?: boolean; answer: string } | null; solo?: boolean; damage?: boolean;
  onSubmit: (answer: string | number) => void; onReady: () => void; onFailure: () => void;
  onDraft?: (value: string) => void;
}) {
  const [answer, setAnswer] = React.useState("");
  const [selected, setSelected] = React.useState<number | null>(null);
  const [now, setNow] = React.useState(serverNow ?? Date.now());
  const clock = React.useRef({ server: serverNow ?? Date.now(), local: performance.now() });
  if (serverNow !== undefined && serverNow !== clock.current.server) clock.current = { server: serverNow, local: performance.now() };
  React.useEffect(() => { setAnswer(""); setSelected(null); }, [id]);
  React.useEffect(() => { const timer = setInterval(() => setNow(clock.current.server + performance.now() - clock.current.local), 100); return () => clearInterval(timer); }, []);
  const stage = imageRevealStage(startedAt, durationMs, now);
  const seconds = Math.max(0, Math.ceil((Math.min(startedAt + durationMs, endsAt ?? Infinity) - Math.max(now, startedAt))/1000));
  const disabled = preparing || locked || !!feedback || seconds === 0;
  const number = Number(answer.trim().replace(",", "."));
  const numeric = answerType === "estimate";
  const submitted = React.useRef(false);
  React.useEffect(() => { if (!locked && !feedback) submitted.current = false; }, [locked, feedback, id]);
  function submit(value: string | number) { if (disabled || submitted.current) return; submitted.current = true; menuTap(true); playSound("answerLocked"); onSubmit(value); }
  return <View style={s.round}>
    <View style={s.top}><Text style={s.format}>{presentation.format === "map_shapes" ? "MAP SHAPES" : "IMAGE REVEAL"}</Text><Text style={s.reward}>{solo ? "+1 per correct answer" : presentation.format === "image_reveal" ? `${4-stage} ${damage ? "base damage" : "base points + confidence"}` : "Standard scoring"}</Text><Text style={s.timer}>{preparing ? "Ready…" : feedback ? "" : `${seconds}s`}</Text></View>
    <Text accessibilityLabel={text} numberOfLines={2} maxFontSizeMultiplier={1.15} adjustsFontSizeToFit minimumFontScale={0.75} style={s.prompt}>{text}</Text>
    <View style={s.body}>
      <VisualCanvas key={id} presentation={presentation} startedAt={startedAt} durationMs={durationMs} serverNow={serverNow} preparing={preparing} full={!!feedback} onReady={onReady} onFailure={onFailure} />
      <View style={s.answers}>
        {answerType === "multiple_choice" ? options.map((option, i) => <Pressable key={i} accessibilityRole="button" accessibilityState={{ disabled, selected: selected === i }} disabled={disabled} onPress={() => { if (submitted.current) return; setSelected(i); submit(i); }} style={[s.option, selected === i && s.selected, feedback && selected === i && (feedback.correct ? s.correct : s.wrong)]}><Text numberOfLines={2} maxFontSizeMultiplier={1.15} adjustsFontSizeToFit minimumFontScale={0.7} style={[s.optionText, feedback && selected === i && { color: "#F5EBDC" }]}><Text style={[s.letter, feedback && selected === i && { color: "#EAD6F3" }]}>{String.fromCharCode(65+i)}  </Text>{option}</Text></Pressable>) : <>
          <Text style={s.inputLabel}>{numeric ? "Enter the exact number" : "Type your answer"}</Text><TextInput accessibilityLabel={numeric ? "Exact numeric answer" : "Written answer"} value={answer} onChangeText={(value) => { setAnswer(value); if (!disabled) onDraft?.(value); }} editable={!disabled} keyboardType={numeric ? "decimal-pad" : "default"} autoCorrect={false} autoCapitalize="none" maxLength={numeric ? 12 : 64} placeholder={numeric ? "Your number" : "Your answer"} placeholderTextColor="#9886AC" style={s.input} onSubmitEditing={() => { if (answer.trim() && (!numeric || Number.isFinite(number))) submit(numeric ? number : answer.trim()); }} />
          <Pressable accessibilityRole="button" disabled={disabled || !answer.trim() || (numeric && !Number.isFinite(number))} onPress={() => submit(numeric ? number : answer.trim())} style={[s.submit, (disabled || !answer.trim() || (numeric && !Number.isFinite(number))) && { opacity: 0.5 }]}><Text style={s.submitText}>{preparing ? "Please wait" : locked ? "Answer locked" : "Lock answer"}</Text></Pressable>
        </>}
      </View>
    </View>
    <View accessibilityLiveRegion="polite" style={[s.feedback, feedback && (feedback.correct ? s.correct : s.wrong)]}><Text numberOfLines={2} maxFontSizeMultiplier={1.15} style={s.feedbackText}>{feedback ? `${feedback.correct ? "Correct!" : feedback.timedOut ? "Time’s up · −1 life" : "Incorrect · −1 life"}  ·  Answer: ${feedback.answer}` : preparing ? "The timer starts when the artwork is ready." : locked ? "Answer locked" : "Choose your answer"}</Text></View>
  </View>;
}
const s = StyleSheet.create({
  round: { flex: 1, minHeight: 0, gap: 8 }, top: { flexDirection: "row", gap: 12, alignItems: "center", height: 26, flexShrink: 0 }, format: { color: "#D8BAF1", fontSize: 12, fontWeight: "900", letterSpacing: 1 }, reward: { flex: 1, color: "#B8A5CA", fontSize: 11 }, timer: { color: "#F4E7CE", fontSize: 21, fontWeight: "800" },
  prompt: { color: "#F5EBDC", fontFamily: Platform.OS === "ios" ? "ChalkboardSE-Regular" : "casual", fontSize: 23, lineHeight: 28, textAlign: "center", flexShrink: 1 },
  body: { flex: 1, minHeight: 161, flexDirection: "row", gap: 16 }, canvas: { flex: 1.3, minWidth: 0, minHeight: 0, alignItems: "center", justifyContent: "center", borderRadius: 17, backgroundColor: "#241C32", borderWidth: 1, borderColor: "#6F537F", overflow: "hidden" }, art: { position: "absolute", top: 10, bottom: 22, left: 10, right: 10 }, stage: { position: "absolute", bottom: 5, color: "#D8C1E9", fontSize: 11 }, muted: { color: "#C4B0D5", fontSize: 13 },
  answers: { flex: 1, minWidth: 0, justifyContent: "center", gap: 7 }, option: { flex: 1, minHeight: 35, maxHeight: 55, justifyContent: "center", paddingHorizontal: 12, borderRadius: 10, backgroundColor: "#EAE2D5", borderWidth: 1, borderColor: "#BDAF9D" }, optionText: { color: "#342B3D", fontSize: 16, fontWeight: "700" }, letter: { color: "#725283" }, selected: { backgroundColor: "#D6B7EC", borderColor: "#B890D2" },
  inputLabel: { color: "#C4B0D5", fontSize: 12 }, input: { height: 48, color: "#F6EDFA", backgroundColor: "#251C33", borderColor: "#8C6AA8", borderWidth: 1, borderRadius: 10, paddingHorizontal: 13, fontSize: 19 }, submit: { backgroundColor: "#5039A0", padding: 12, borderRadius: 10, alignItems: "center", marginTop: 5 }, submitText: { color: "white", fontSize: 14, fontWeight: "800" },
  feedback: { height: 35, flexShrink: 0, alignItems: "center", justifyContent: "center", paddingHorizontal: 10, borderRadius: 9 }, feedbackText: { color: "#E2D1ED", fontSize: 12 }, correct: { backgroundColor: "#34503E" }, wrong: { backgroundColor: "#663B48" },
});
