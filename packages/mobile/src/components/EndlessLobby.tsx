import React from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { Ionicons } from "@expo/vector-icons";
import { ENDLESS_MILESTONES, ENDLESS_TIMERS } from "@confidence-trivia/shared";
import { PointsIcon } from "./PointsIcon";
import { menuTap } from "./menuHaptics";
import { playSound } from "../audio/sounds";
import { EndlessMountain } from "./EndlessMountain";

const CHALK = Platform.OS === "ios" ? "ChalkboardSE-Regular" : "casual";
const RULES = [
  { title: "Three lives", detail: "Three mistakes and the run ends.", icon: "heart", color: "#F586AC" },
  { title: "Timed questions", detail: `${ENDLESS_TIMERS.easy}s on Easy & Medium. ${ENDLESS_TIMERS.hard}s on Hard & Expert.`, icon: "stopwatch-outline", color: "#8CB9F1" },
  { title: "Increasing difficulty", detail: "Easy → Medium → Hard → Expert", icon: "stats-chart", color: "#F0CC81" },
] as const;

function ChalkMark() {
  return <View accessible={false} style={s.logoMark}><Ionicons name="ribbon-outline" size={23} color="#EFCA7E" style={s.crown} />
    <Svg width={146} height={54} viewBox="0 0 210 84">
      <Path d="M105 43 C72 7 15 1 15 42 C15 83 64 78 105 43 C146 8 195 2 195 42 C195 82 144 79 105 43" stroke="#B77AE9" strokeWidth={15} strokeLinecap="round" fill="none" />
      <Path d="M105 42 C69 6 17 7 19 43 C21 79 65 76 105 42 C146 8 191 10 191 43 C191 79 143 76 105 42" stroke="#F1D8FF" strokeWidth={2} strokeLinecap="round" fill="none" />
      <Path d="M29 24 L37 17 M41 18 L49 15 M55 20 L63 17 M151 20 L159 15 M166 22 L175 18 M177 31 L186 27 M24 50 L31 45 M34 63 L41 58 M145 65 L153 59 M159 64 L168 58" stroke="#DEC1FA" strokeWidth={2} strokeLinecap="round" fill="none" />
    </Svg>
  </View>;
}
export function EndlessLobby({ best, busy, unavailable, onStart, onLeaderboard }: {
  best: number | null; busy: boolean; unavailable: boolean;
  onStart: () => void; onLeaderboard: () => void;
}) {
  const next = best === null ? null : ENDLESS_MILESTONES.find((reward) => reward.score > best);
  return <View style={s.layout}>
    <View style={s.rules}>{RULES.map((rule) => <View key={rule.title} style={s.rule}>
      <View style={s.ruleIcon}>{rule.icon === "heart" ? <View style={s.hearts}>{[0,1,2].map((i) => <Ionicons key={i} name="heart" size={18} color={rule.color} />)}</View> : <Ionicons name={rule.icon} size={38} color={rule.color} />}</View>
      <View style={s.ruleCopy}><Text style={s.ruleTitle}>{rule.title}</Text><Text style={s.ruleDetail}>{rule.detail}</Text></View>
    </View>)}</View>
    <View style={s.hero}>
      <ChalkMark /><Text style={s.title}>ENDLESS</Text><View style={s.underline} /><Text style={s.subtitle}>How far can you go?</Text>
      <View pointerEvents="none" style={s.mountain}><EndlessMountain /></View>
      <Pressable accessibilityRole="button" accessibilityLabel="Start Endless" accessibilityState={{ disabled: busy || unavailable }} disabled={busy || unavailable}
        onPress={() => { menuTap(); playSound("button"); onStart(); }} style={({ pressed }) => [s.play, (pressed || busy || unavailable) && { opacity: 0.6 }]}>
        <Ionicons name="play" size={21} color="#F5EFFF" style={s.playIcon} /><Text style={s.playText}>{busy ? "Connecting…" : "Let’s play"}</Text>
      </Pressable>
      <Text style={s.runHint}>Leaving the game ends your run.</Text>
    </View>
    <View style={s.panels}>
      <Pressable accessibilityRole="button" accessibilityLabel="Your best score; open Endless rankings" onPress={onLeaderboard} style={s.panel}>
        <View style={s.heading}><Ionicons name="ribbon-outline" size={18} color="#F1CE7D" /><Text style={s.panelTitle}>Your best score</Text></View>
        <View style={s.bestRow}><Text style={s.best}>{best ?? "—"}<Text style={s.points}> points</Text></Text><Text style={s.muted}>Your highest{ "\n" }single run</Text></View>
        <View style={s.rankLinkRow}><Text style={s.rankLink}>Endless leaderboard</Text><Ionicons name="chevron-forward" size={16} color="#D7B8F1" /></View>
      </Pressable>
      <View style={s.panel}>
        <View style={s.heading}><Ionicons name="gift-outline" size={18} color="#C49AEF" /><Text style={s.panelTitle}>Next milestone</Text></View>
        {next ? <View style={s.nextRow}><Text style={s.nextScore}>{next.score}<Text style={s.points}> correct</Text></Text><View style={s.stars}><PointsIcon size={25} /><Text style={s.starAmount}>+{next.stars}</Text></View></View> : <Text style={s.message}>{best === null ? "Earn Stars by beating your best." : "Every reward unlocked!"}</Text>}
        <Text style={s.rewardHint}>{next && best !== null ? `${next.score - best} beyond your best` : "Your milestone Stars are yours to keep."}</Text>
      </View>
    </View>
  </View>;
}
const s = StyleSheet.create({
  layout: { flex: 1, minHeight: 0, flexDirection: "row", gap: 13, paddingHorizontal: 4, paddingTop: 2 },
  rules: { width: "28%", justifyContent: "center", gap: 12 },
  rule: { flex: 1, maxHeight: 92, flexDirection: "row", alignItems: "center", borderWidth: 1.5, borderColor: "#55466B", borderRadius: 16, backgroundColor: "rgba(24,17,39,0.72)", paddingHorizontal: 10, gap: 10, transform: [{ rotate: "-0.5deg" }] },
  ruleIcon: { width: 54, alignItems: "center" }, hearts: { flexDirection: "row", gap: 1 }, ruleCopy: { flex: 1 },
  ruleTitle: { color: "#F5EAFB", fontFamily: CHALK, fontSize: 16 }, ruleDetail: { color: "#BBACD2", fontSize: 11, lineHeight: 15, marginTop: 5 },
  hero: { flex: 1, minWidth: 0, alignItems: "center", paddingTop: 2 },
  logoMark: { height: 58, justifyContent: "flex-end" }, crown: { position: "absolute", top: -8, left: 60, transform: [{ rotate: "-8deg" }] },
  title: { color: "#FAF0FF", fontFamily: CHALK, fontSize: 43, lineHeight: 52, fontWeight: "900", letterSpacing: 2, transform: [{ rotate: "-3deg" }] },
  underline: { width: "86%", height: 3, backgroundColor: "#AA69D9", borderRadius: 6, transform: [{ rotate: "-4deg" }], marginTop: -3 },
  subtitle: { color: "#F2E6FF", fontFamily: CHALK, fontSize: 16, lineHeight: 22, marginTop: 5, transform: [{ rotate: "-3deg" }] },
  mountain: { flex: 1, minHeight: 75, width: "100%", marginVertical: 1 },
  play: { width: "95%", minHeight: 44, borderRadius: 15, borderWidth: 2, borderColor: "#B192E2", backgroundColor: "#5039A0", flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 8, shadowColor: "#B581E7", shadowOpacity: 0.22, shadowRadius: 10, shadowOffset: { width: 0, height: 2 }, elevation: 3 },
  playIcon: { position: "absolute", left: 15 }, playText: { width: "100%", paddingHorizontal: 40, color: "#FCF7FF", fontFamily: CHALK, fontSize: 21, lineHeight: 29, textAlign: "center", textAlignVertical: "center", includeFontPadding: false }, runHint: { color: "#B7A0CD", fontSize: 10, textAlign: "center", marginTop: 6, marginBottom: 2 },
  panels: { width: "31%", gap: 8, justifyContent: "center" },
  panel: { borderRadius: 15, borderWidth: 1.5, borderColor: "#5D4877", backgroundColor: "rgba(24,17,39,0.78)", padding: 12 },
  heading: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 3 }, panelTitle: { color: "#F3E7FF", fontFamily: CHALK, fontSize: 17 }, rankLinkRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 8 }, rankLink: { color: "#D7B8F1", fontFamily: CHALK, fontSize: 13 },
  bestRow: { flexDirection: "row", alignItems: "center", gap: 6 }, best: { flex: 1, color: "#F5E8FF", fontSize: 38, fontWeight: "900" }, points: { color: "#BAA7CD", fontSize: 11, fontWeight: "400" }, muted: { color: "#B6A1CE", fontSize: 11, lineHeight: 15 },
  nextRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, nextScore: { color: "#E8D7FA", fontSize: 27, fontWeight: "800" }, stars: { flexDirection: "row", alignItems: "center", gap: 4 }, starAmount: { color: "#F5D798", fontSize: 21, fontWeight: "800" }, rewardHint: { color: "#B7A3CA", fontSize: 11, lineHeight: 15, marginTop: 3 },
  message: { color: "#BCA4D3", fontSize: 11, lineHeight: 15, paddingVertical: 8 },
});
