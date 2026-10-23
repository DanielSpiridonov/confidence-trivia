import React, { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, Easing, Image, StyleSheet, Text, View } from "react-native";
import Svg, { Defs, LinearGradient, Path, Rect, Stop } from "react-native-svg";
import { useTranslation } from "react-i18next";
import { FRAME_COSMETIC_COLORS } from "@confidence-trivia/shared";
import { ANDROID_GAME_UI_SCALE, Screen, theme } from "../components/ui";
import { PointsIcon } from "../components/PointsIcon";
import { PlayerFrameEffect } from "../components/PlayerFrameEffect";

const AVATARS: Record<string, number> = {
  smart_owl: require("../../assets/combat-ios/smart-owl.png"),
  clever_fox: require("../../assets/combat-ios/fox.png"),
  quiz_bot: require("../../assets/combat-ios/quiz-bot.png"),
  omniscient_avatar: require("../../assets/combat-ios/omniscient.png"),
  trivia_wizard: require("../../assets/combat-ios/trivia-wizard.png"),
  detective_avatar: require("../../assets/combat-ios/detective.png"),
  living_globe: require("../../assets/combat-ios/globe.png"),
};

export interface QueuePlayer {
  id: string;
  name: string;
  connected: boolean;
  avatarId: string;
  nameColor: string;
  frameId: string;
}

function useReducedMotion() {
  // Keep the screen still until the device preference has been read.
  const [reduced, setReduced] = useState(true);
  useEffect(() => {
    let active = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((value) => {
      if (active) setReduced(value);
    }).catch(() => {});
    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduced);
    return () => { active = false; subscription.remove(); };
  }, []);
  return reduced;
}

export function MatchmakingQueueScreen({ players, mySessionId, ranked, isStarting, countdownSeconds, wager, pot, error }: {
  players: QueuePlayer[];
  mySessionId: string;
  ranked: boolean;
  isStarting: boolean;
  countdownSeconds: number;
  wager: number;
  pot: number;
  error: string | null;
}) {
  const { t } = useTranslation();
  const reducedMotion = useReducedMotion();
  const joinedAt = useRef(Date.now()).current;
  const [elapsed, setElapsed] = useState(0);
  const scan = useRef(new Animated.Value(0)).current;
  const required = ranked ? 4 : 2;
  const found = players.filter((player) => player.connected).length;
  const filled = found >= required;
  const opponents = players.filter((player) => player.id !== mySessionId);
  const slots = [players.find((player) => player.id === mySessionId), ...opponents.filter((player) => player.connected), ...opponents.filter((player) => !player.connected)];
  const tipIndex = Math.floor(elapsed / 8) % 3;

  useEffect(() => {
    if (isStarting) return;
    const update = () => setElapsed(Math.floor((Date.now() - joinedAt) / 1000));
    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, [isStarting, joinedAt]);

  useEffect(() => {
    scan.setValue(0);
    if (reducedMotion || filled) return;
    const animation = Animated.loop(Animated.timing(scan, {
      toValue: 1, duration: 2200, easing: Easing.linear, useNativeDriver: true, isInteraction: false,
    }));
    animation.start();
    return () => animation.stop();
  }, [scan, reducedMotion, filled]);

  const status = isStarting ? t("queue.matchReady") : filled ? t("queue.playersFound") : t(ranked ? "queue.findingPlayers" : "queue.findingOpponent");

  return (
    <Screen androidScale={ANDROID_GAME_UI_SCALE} style={styles.screen}>
      <View style={styles.header}>
        <View>
          <Text style={styles.eyebrow}>{t("queue.eyebrow")}</Text>
          <Text style={styles.heading}>{t(ranked ? "queue.rankedTitle" : "queue.damageTitle")}</Text>
        </View>
        <View style={styles.searchBadge}>
          <View style={[styles.liveDot, filled && styles.readyDot]} />
          <Text style={styles.badgeText}>{t(isStarting ? "queue.ready" : "queue.matchmaking")}</Text>
          {!isStarting ? <Text style={styles.elapsed}>{Math.floor(elapsed / 60).toString().padStart(2, "0")}:{(elapsed % 60).toString().padStart(2, "0")}</Text> : null}
        </View>
      </View>

      <View style={styles.stage}>
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          <Svg width="100%" height="100%" viewBox="0 0 760 210" preserveAspectRatio="none">
            <Defs>
              <LinearGradient id="queueLeft" x1="0" y1="1" x2="1" y2="0">
                <Stop offset="0" stopColor="#5536A5" stopOpacity="0.55" />
                <Stop offset="1" stopColor="#5536A5" stopOpacity="0" />
              </LinearGradient>
              <LinearGradient id="queueRight" x1="1" y1="1" x2="0" y2="0">
                <Stop offset="0" stopColor="#A73661" stopOpacity="0.35" />
                <Stop offset="1" stopColor="#A73661" stopOpacity="0" />
              </LinearGradient>
            </Defs>
            <Rect width="380" height="210" fill="url(#queueLeft)" />
            <Rect x="380" width="380" height="210" fill="url(#queueRight)" />
            <Path d="M 0 185 L 330 185 L 350 165 M 410 165 L 430 185 L 760 185" fill="none" stroke="#A38ADB" strokeOpacity="0.3" />
            <Path d="M 390 0 L 370 210" stroke="#B09ADB" strokeOpacity="0.15" />
          </Svg>
        </View>

        <View style={styles.fighters}>
          {Array.from({ length: required }, (_, index) => (
            <React.Fragment key={index}>
              {!ranked && index === 1 ? <View style={styles.versusWrap}>
                <View style={[styles.versusDiamond, isStarting && styles.versusDiamondReady]}>
                  <Text style={[styles.versusText, isStarting && styles.countdown]}>{isStarting ? Math.max(1, countdownSeconds) : "VS"}</Text>
                </View>
                <Text style={styles.versusCaption}>{t(isStarting ? "queue.startsIn" : "queue.duel")}</Text>
              </View> : null}
              <QueueSlot player={slots[index]} mine={index === 0} index={index} compact={ranked} reducedMotion={reducedMotion} />
            </React.Fragment>
          ))}
        </View>
      </View>

      <View style={styles.footer}>
        <View style={styles.statusBlock} accessibilityLiveRegion="polite">
          <Text style={[styles.status, filled && styles.statusReady]}>{status}{ranked && isStarting ? ` · ${Math.max(1, countdownSeconds)}` : ""}</Text>
          <View style={styles.seatRow}>
            {Array.from({ length: required }, (_, index) => <View key={index} style={[styles.seat, index < found && styles.seatFilled]} />)}
            <Text style={styles.seatCount}>{t("queue.playerCount", { found, required })}</Text>
          </View>
        </View>
        {!ranked ? <View style={styles.prize}>
          <PointsIcon size={24} />
          <View>
            <Text style={styles.prizeLabel}>{t("queue.prize")}</Text>
            <Text style={styles.prizeAmount}>{t("queue.pot", { count: pot })}</Text>
            <Text style={styles.stake}>{t("queue.stake", { count: wager })}</Text>
          </View>
        </View> : <View style={styles.rankedNote}><Text style={styles.rankedLabel}>{t("queue.rankedFormat")}</Text><Text style={styles.stake}>{t("queue.rankedRule")}</Text></View>}
      </View>

      <View style={styles.tipRow}>
        <Text style={styles.tipLabel}>{t("queue.tipLabel")}</Text>
        <Text style={styles.tip}>{t(`queue.${ranked ? "rankedTip" : "damageTip"}${tipIndex}`)}</Text>
      </View>
      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
      <View pointerEvents="none" style={styles.scanTrack}>
        <Animated.View style={[styles.scanSegment, filled && styles.scanComplete, !filled && {
          opacity: reducedMotion ? 0.6 : scan.interpolate({ inputRange: [0, 0.15, 0.85, 1], outputRange: [0, 1, 1, 0] }),
          transform: [{ translateX: reducedMotion ? 0 : scan.interpolate({ inputRange: [0, 1], outputRange: [-100, 760] }) }],
        }]} />
      </View>
    </Screen>
  );
}

function QueueSlot({ player, mine, index, compact, reducedMotion }: {
  player?: QueuePlayer; mine: boolean; index: number; compact: boolean; reducedMotion: boolean;
}) {
  const { t } = useTranslation();
  const arrival = useRef(new Animated.Value(1)).current;
  const pulse = useRef(new Animated.Value(0)).current;
  const connected = Boolean(player?.connected);
  useEffect(() => {
    arrival.setValue(reducedMotion ? 1 : 0);
    if (reducedMotion) return;
    const animation = Animated.timing(arrival, { toValue: 1, duration: 420, useNativeDriver: true, isInteraction: false });
    animation.start();
    return () => animation.stop();
  }, [arrival, player?.id, connected, reducedMotion]);
  useEffect(() => {
    pulse.setValue(0);
    if (connected || reducedMotion) return;
    const animation = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1, duration: 1100, useNativeDriver: true, isInteraction: false }),
      Animated.timing(pulse, { toValue: 0, duration: 1100, useNativeDriver: true, isInteraction: false }),
    ]));
    animation.start();
    return () => animation.stop();
  }, [pulse, connected, reducedMotion]);
  const frameColor = player?.frameId ? FRAME_COSMETIC_COLORS[player.frameId as keyof typeof FRAME_COSMETIC_COLORS] : undefined;
  return (
    <Animated.View style={[styles.fighter, { opacity: arrival, transform: [{ translateY: arrival.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }] }]}>
      <Text style={[styles.playerLabel, mine && styles.myLabel]}>{t(mine ? "queue.you" : compact ? "queue.contender" : "queue.challenger", { number: index + 1 })}</Text>
      <View style={[styles.avatarStage, compact && styles.compactAvatarStage]}>
        <View style={[styles.podium, !mine && styles.opponentPodium, !connected && styles.emptyPodium]} />
        {connected && player ? <Image source={AVATARS[player.avatarId] ?? AVATARS.smart_owl} fadeDuration={0} resizeMode="contain" style={[styles.avatar, compact && styles.compactAvatar]} /> : (
          <Animated.View style={[styles.target, compact && styles.compactTarget, { opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.4, 0.85] }), transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1.04] }) }] }]}>
            <View style={styles.targetInner}><Text style={styles.questionMark}>?</Text></View>
          </Animated.View>
        )}
      </View>
      <View style={[styles.nameplate, mine && styles.myNameplate, frameColor ? { borderColor: frameColor } : null]}>
        {player && !reducedMotion ? <PlayerFrameEffect frameId={player.frameId} /> : null}
        <Text numberOfLines={1} style={[styles.name, { color: connected ? player?.nameColor || theme.text : theme.textDim }]}>{player?.name || t("queue.unknown")}</Text>
        <Text style={[styles.playerStatus, connected && styles.playerConnected]}>{t(connected ? "queue.lockedIn" : player ? "queue.reconnecting" : "queue.searching")}</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  screen: { justifyContent: "flex-start", paddingTop: 12, paddingBottom: 10 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingRight: 44, marginBottom: 4 },
  eyebrow: { color: "#B8A1E7", fontSize: 9, letterSpacing: 3, fontWeight: "800" },
  heading: { color: "#FFF5DF", fontSize: 26, fontWeight: "900", letterSpacing: 1, marginTop: 1 },
  searchBadge: { flexDirection: "row", alignItems: "center", gap: 7, paddingHorizontal: 12, paddingVertical: 7, borderWidth: 1, borderColor: "#514369", borderRadius: 20, backgroundColor: "#211A33" },
  liveDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: "#BB9BFF" },
  readyDot: { backgroundColor: "#87E9B4" },
  badgeText: { color: "#C7B9DF", fontSize: 9, fontWeight: "800", letterSpacing: 1 },
  elapsed: { color: theme.text, fontSize: 11, fontWeight: "800", fontVariant: ["tabular-nums"], marginLeft: 5 },
  stage: { flex: 1, minHeight: 0, width: "100%", overflow: "hidden", borderRadius: 12 },
  fighters: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 12, paddingHorizontal: 22, paddingVertical: 6 },
  fighter: { flex: 1, minWidth: 0, maxWidth: 250, alignItems: "center" },
  playerLabel: { color: "#DC9EAD", fontSize: 9, letterSpacing: 2, fontWeight: "900", marginBottom: 3 },
  myLabel: { color: "#B9A1FF" },
  avatarStage: { height: 120, width: "100%", alignItems: "center", justifyContent: "center" },
  compactAvatarStage: { height: 104 },
  avatar: { width: "100%", height: 118 },
  compactAvatar: { height: 100 },
  podium: { position: "absolute", bottom: 0, width: "75%", height: 15, borderRadius: 100, backgroundColor: "#6843A4", borderWidth: 1, borderColor: "#AB7FF2" },
  opponentPodium: { backgroundColor: "#73324F", borderColor: "#B55C7E" },
  emptyPodium: { opacity: 0.3 },
  target: { width: 92, height: 92, borderRadius: 46, borderWidth: 1, borderStyle: "dashed", borderColor: "#BF9CDA", alignItems: "center", justifyContent: "center" },
  compactTarget: { width: 78, height: 78, borderRadius: 39 },
  targetInner: { width: "74%", height: "74%", borderRadius: 60, borderWidth: 1, borderColor: "#76598E", alignItems: "center", justifyContent: "center", backgroundColor: "rgba(70,42,85,0.25)" },
  questionMark: { color: "#C7A7DD", fontSize: 35, fontWeight: "300" },
  nameplate: { width: "100%", maxWidth: 216, alignItems: "center", borderWidth: 1, borderColor: "#674457", borderRadius: 7, backgroundColor: "rgba(29,20,41,0.94)", paddingHorizontal: 8, paddingVertical: 6, marginTop: 5, overflow: "hidden" },
  myNameplate: { borderColor: "#7455AF" },
  name: { fontSize: 15, fontWeight: "800", width: "100%", textAlign: "center" },
  playerStatus: { color: "#A88BB1", fontSize: 8, letterSpacing: 1.3, fontWeight: "800", marginTop: 3 },
  playerConnected: { color: "#8DE3B2" },
  versusWrap: { width: 76, alignItems: "center", gap: 16 },
  versusDiamond: { width: 48, height: 48, borderRadius: 7, borderWidth: 1, borderColor: "#AC8550", backgroundColor: "#382639", transform: [{ rotate: "45deg" }], alignItems: "center", justifyContent: "center" },
  versusDiamondReady: { borderColor: "#F7D58A", backgroundColor: "#59402D" },
  versusText: { color: "#F8D899", fontSize: 20, fontWeight: "900", transform: [{ rotate: "-45deg" }] },
  countdown: { fontSize: 30 },
  versusCaption: { color: "#C5A781", fontSize: 8, fontWeight: "800", letterSpacing: 1.5 },
  footer: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 22, paddingTop: 10, paddingBottom: 8, gap: 12 },
  statusBlock: { flex: 1 },
  status: { color: "#E7DBFF", fontSize: 16, fontWeight: "800" },
  statusReady: { color: "#A7F0C5" },
  seatRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 6 },
  seat: { width: 18, height: 3, borderRadius: 2, backgroundColor: "#483957" },
  seatFilled: { backgroundColor: "#AC8CF2" },
  seatCount: { color: "#AE9DC4", fontSize: 10, marginLeft: 4 },
  prize: { flexDirection: "row", alignItems: "center", gap: 9, borderLeftWidth: 1, borderLeftColor: "#594538", paddingLeft: 16 },
  prizeLabel: { color: "#B9A17B", fontSize: 8, letterSpacing: 1.5, fontWeight: "900" },
  prizeAmount: { color: "#FFE0A2", fontSize: 18, fontWeight: "900" },
  stake: { color: "#B8A8CA", fontSize: 9, marginTop: 2 },
  rankedNote: { alignItems: "flex-end" },
  rankedLabel: { color: "#E6C98E", fontSize: 12, fontWeight: "900" },
  tipRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 22, minHeight: 23 },
  tipLabel: { color: "#B89CDA", fontSize: 8, fontWeight: "900", letterSpacing: 1.5 },
  tip: { flex: 1, color: "#B0A2C0", fontSize: 10 },
  error: { color: theme.danger, textAlign: "center", fontSize: 11, paddingHorizontal: 20, marginTop: 3 },
  scanTrack: { height: 2, width: "100%", overflow: "hidden", backgroundColor: "rgba(139,107,182,0.15)", marginTop: 5 },
  scanSegment: { height: 2, width: 100, backgroundColor: "#BC98FF" },
  scanComplete: { width: "100%", backgroundColor: "#87E9B4" },
});
