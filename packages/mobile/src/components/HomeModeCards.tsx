import React from "react";
import { AccessibilityInfo, Animated, Platform, StyleSheet, Text, View } from "react-native";
import { useFonts } from "expo-font";
import { useTranslation } from "react-i18next";
import Svg, { Path } from "react-native-svg";
import { Pressable } from "./menuHaptics";
import { playSound } from "../audio/sounds";
import { HOME_MODE_COLORS, HomeCardGlow, HomeChalkBoard, HomeModeIllustration, type HomeMode } from "./HomeMenuArtwork";
import { getHomeCardsLayout } from "./homeMenuLayout";

function HomeModeCard({ mode, title, subtitle, onPress, width, height, fontReady, reducedMotion }: {
  mode: HomeMode; title: string; subtitle: string; onPress: () => void;
  width: number; height: number; fontReady: boolean; reducedMotion: boolean;
}) {
  const c = HOME_MODE_COLORS[mode];
  const progress = React.useRef(new Animated.Value(0)).current;
  const [highlighted, setHighlighted] = React.useState(false);
  const held = React.useRef(false), hovered = React.useRef(false);
  const fontFamily = fontReady ? "Kalam-Bold" : Platform.OS === "ios" ? "ChalkboardSE-Bold" : "casual";
  const textScale = Math.min(1.06, width / 190, height / 270);
  function updateHighlight() {
    const next = held.current || hovered.current;
    setHighlighted(next);
    progress.stopAnimation();
    if (reducedMotion) { progress.setValue(0); return; }
    Animated.spring(progress, { toValue: next ? 1 : 0, damping: 18, stiffness: 330, mass: 0.6, useNativeDriver: true }).start();
  }
  React.useEffect(() => { if (reducedMotion) { progress.stopAnimation(); progress.setValue(0); } }, [reducedMotion, progress]);
  React.useEffect(() => () => progress.stopAnimation(), [progress]);
  return <Pressable accessibilityRole="button" accessibilityLabel={title} accessibilityHint={subtitle}
    onPressIn={() => { held.current = true; updateHighlight(); }} onPressOut={() => { held.current = false; updateHighlight(); }}
    onHoverIn={() => { hovered.current = true; updateHighlight(); }} onHoverOut={() => { hovered.current = false; updateHighlight(); }}
    onPress={() => { playSound("button"); onPress(); }}
    style={{ width, height }}>
    <Animated.View style={[s.card, { shadowColor: c.accent, shadowOpacity: highlighted ? 0.3 : 0.12, transform: [{ translateY: progress.interpolate({ inputRange: [0,1], outputRange: [0,-4] }) }, { scale: progress.interpolate({ inputRange: [0,1], outputRange: [1,1.018] }) }] }]}>
      <View pointerEvents="none" style={[s.glow, { opacity: highlighted ? 1 : 0.85 }]}><HomeCardGlow mode={mode} /></View>
      <View pointerEvents="none" style={StyleSheet.absoluteFill}><HomeChalkBoard mode={mode} highlighted={highlighted} /></View>
      <View pointerEvents="none" style={s.copy}>
        <View style={[s.headingArea, { height: height * 0.31 + 16, transform: [{ rotate: mode === "join" ? "-3deg" : "-4deg" }] }]}>
          <Text allowFontScaling maxFontSizeMultiplier={1.2} numberOfLines={mode === "endless" ? 1 : 2} adjustsFontSizeToFit minimumFontScale={0.72}
            style={[s.heading, { fontFamily, fontSize: (mode === "endless" ? 31 : 36) * textScale, lineHeight: 40 * textScale, transform: [{ translateY: mode === "endless" ? 0 : height * 0.04 }] }]}>
            {mode === "endless" ? title.toUpperCase() : title.toUpperCase().replace(/\s+/, "\n")}
          </Text>
        </View>
        <View style={{ width: "88%", height: 10 }}><Svg width="100%" height="100%" viewBox="0 0 180 12" preserveAspectRatio="none"><Path d="m7 7 51-3 46 1 65-4-37 5-77 2-43 2" fill={c.accent} opacity="0.9" /><Path d="m18 11 107-2 34-4" stroke={c.light} strokeWidth="0.7" opacity="0.65" /></Svg></View>
        <Text numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.8} maxFontSizeMultiplier={1.2}
          style={[s.subtitle, { fontFamily: fontReady ? "Kalam-Regular" : fontFamily, fontSize: 14.5 * textScale, lineHeight: 20 * textScale, color: mode === "endless" ? "#E7CFAC" : "#D2CDE1" }]}>{subtitle}</Text>
        <View style={s.illustration}><HomeModeIllustration mode={mode} /></View>
      </View>
    </Animated.View>
  </Pressable>;
}

export function HomeModeCards({ onCreate, onJoin, onEndless }: { onCreate: () => void; onJoin: () => void; onEndless: () => void }) {
  const { t } = useTranslation();
  const [bounds, setBounds] = React.useState({ width: 640, height: 272 });
  const [fontReady] = useFonts({ "Kalam-Bold": require("../../assets/fonts/Kalam-Bold.ttf"), "Kalam-Regular": require("../../assets/fonts/Kalam-Regular.ttf") });
  const [reducedMotion, setReducedMotion] = React.useState(true);
  React.useEffect(() => {
    let active = true;
    void AccessibilityInfo.isReduceMotionEnabled().then(value => { if (active) setReducedMotion(value); }).catch(() => undefined);
    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", setReducedMotion);
    return () => { active = false; subscription.remove(); };
  }, []);
  const layout = getHomeCardsLayout(bounds.width, bounds.height);
  return <View style={s.area} onLayout={event => { const { width, height } = event.nativeEvent.layout; setBounds(current => current.width === width && current.height === height ? current : {width,height}); }}>
    <View style={[s.row, { width: layout.width, height: layout.cardHeight, gap: layout.gap }]}>
      <HomeModeCard mode="create" title={t("home.createGame")} subtitle={t("home.createSubtitle")} onPress={onCreate} width={layout.cardWidth} height={layout.cardHeight} fontReady={fontReady} reducedMotion={reducedMotion} />
      <HomeModeCard mode="join" title={t("home.joinGame")} subtitle={t("home.joinSubtitle")} onPress={onJoin} width={layout.cardWidth} height={layout.cardHeight} fontReady={fontReady} reducedMotion={reducedMotion} />
      <HomeModeCard mode="endless" title={t("home.endless")} subtitle={t("home.endlessSubtitle")} onPress={onEndless} width={layout.cardWidth} height={layout.cardHeight} fontReady={fontReady} reducedMotion={reducedMotion} />
    </View>
  </View>;
}

const s = StyleSheet.create({
  area: { position: "absolute", left: Platform.OS === "android" ? 116 : 112, right: Platform.OS === "android" ? 92 : 64, top: 78, bottom: Platform.OS === "android" ? 62 : 44, alignItems: "center", justifyContent: "center" },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "center" },
  card: { flex: 1, shadowRadius: 13, shadowOffset: { width: 0, height: 5 } },
  glow: { position: "absolute", left: "-17%", right: "-17%", top: "-11%", bottom: "-13%" },
  copy: { position: "absolute", top: "7%", bottom: "7%", left: "12%", right: "12%", alignItems: "center" },
  headingArea: { width: "118%", alignItems: "center", justifyContent: "center" },
  heading: { color: "#FAF3E8", textAlign: "center", includeFontPadding: true, paddingVertical: 8, textShadowColor: "rgba(0,0,0,0.6)", textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 2 },
  subtitle: { width: "118%", minHeight: 24, textAlign: "center", paddingTop: 5, includeFontPadding: false },
  illustration: { flex: 1, width: "111%", minHeight: 0, marginTop: 7 },
});
