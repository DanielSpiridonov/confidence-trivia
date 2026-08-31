import React, { useEffect, useRef, useState } from "react";
import { View, Text, FlatList, Platform, StyleSheet, Pressable } from "react-native";
import * as Clipboard from "expo-clipboard";
import { useTranslation } from "react-i18next";
import { Room } from "colyseus.js";
import { FRAME_COSMETIC_COLORS, MIN_PLAYERS_TO_START } from "@confidence-trivia/shared";
import { ANDROID_GAME_UI_SCALE, Screen, Title, Subtitle, BigButton, theme } from "../components/ui";
import { useRoomState } from "../network/client";
import { playSound } from "../audio/sounds";

interface PublicPlayerView {
  id: string;
  name: string;
  ready: boolean;
  isHost: boolean;
  connected: boolean;
  stars: number;
  nameColor: string;
  frameId: string;
}

export function LobbyScreen({ room, mySessionId }: { room: Room; mySessionId: string }) {
  const { t } = useTranslation();
  const state = useRoomState<any>(room);
  const [copied, setCopied] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [countdownEndsAt, setCountdownEndsAt] = useState<number | null>(null);
  const [startError, setStartError] = useState<string | null>(null);
  const countdownSoundPlayed = useRef(false);
  const isStarting = state?.phase === "starting";

  useEffect(() => {
    room.onMessage("gameStartError", (message: { code?: string; names?: string[]; stake?: number }) => {
      if (message.code === "insufficient_stars") {
        setStartError(t("lobby.insufficientWagerStars", { names: message.names?.join(", ") || "Player", stake: message.stake ?? 0 }));
      }
    });
  }, [room, t]);

  useEffect(() => {
    if (!isStarting) {
      setCountdownEndsAt(null);
      countdownSoundPlayed.current = false;
      return;
    }

    const localDeadline = Date.now() + 3_000;
    setNow(Date.now());
    setCountdownEndsAt(localDeadline);
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [isStarting]);

  const countdownSeconds = isStarting
    ? countdownEndsAt === null
      ? 3
      : Math.min(3, Math.max(0, Math.ceil((countdownEndsAt - now) / 1000)))
    : 0;

  useEffect(() => {
    if (!isStarting || countdownSeconds !== 3 || countdownSoundPlayed.current) return;
    countdownSoundPlayed.current = true;
    playSound("roomCountdown");
  }, [countdownSeconds, isStarting]);

  if (!state) return null;

  const players: PublicPlayerView[] = [...state.players.values()].map((p: any) => ({
    id: p.id,
    name: p.name,
    ready: p.ready,
    isHost: p.isHost,
    connected: p.connected,
    stars: p.stars,
    nameColor: p.nameColor,
    frameId: p.frameId,
  }));

  const me = players.find((p) => p.id === mySessionId);
  const isHost = me?.isHost ?? false;
  const requiredPlayers = state.gameMode === "damage" ? 2 : MIN_PLAYERS_TO_START;
  const canStart = isHost && players.length >= requiredPlayers;

  async function handleCopyCode() {
    await Clipboard.setStringAsync(String(state.code));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <Screen androidScale={ANDROID_GAME_UI_SCALE}>
      <View style={styles.contentWrap}>
        <View style={styles.lobbyColumns}>
          <View style={styles.playersColumn}>
            <Text style={styles.columnTitle}>{t("lobby.players")}</Text>
            <FlatList style={styles.list} data={players} keyExtractor={(p) => p.id} contentContainerStyle={styles.listContent} nestedScrollEnabled showsVerticalScrollIndicator={players.length > 4} renderItem={({ item }) => (
              <View style={[styles.playerRow, item.frameId ? { borderWidth: 2, borderColor: FRAME_COSMETIC_COLORS[item.frameId as keyof typeof FRAME_COSMETIC_COLORS] } : null]}>
                <Text numberOfLines={1} style={[styles.playerName, { color: item.nameColor || theme.text }]}>{item.isHost ? "👑 " : ""}{item.name}{!item.connected ? " (reconnecting…)" : ""}</Text>
                <Text style={item.ready ? styles.readyBadge : styles.notReadyBadge}>{item.ready ? t("lobby.ready") : t("lobby.notReady")}</Text>
              </View>
            )} />
          </View>

          <View style={styles.infoColumn}>
            <Subtitle>{t("lobby.roomCode")}</Subtitle>
            <Pressable onPress={() => void handleCopyCode()} style={styles.codeWrap}>
              <Title>{state.code}</Title>
              <Text style={styles.copyHint}>{copied ? t("lobby.copied") : t("lobby.tapToCopy")}</Text>
            </Pressable>
            {state.gameMode === "damage" ? <View style={styles.wagerBanner}>
              <Text style={styles.wagerStake}>{t("lobby.wagerStake", { count: state.damageWager })}</Text>
              <Text style={styles.wagerPot}>{t("lobby.wagerPot", { count: state.damagePot })}</Text>
            </View> : null}
            {isHost && !isStarting ? <Pressable accessibilityRole="switch" accessibilityState={{ checked: Boolean(state.isPublic) }} onPress={() => room.send("toggleRoomVisibility")} style={styles.visibilityControl}>
              <Text style={styles.visibilityLabel}>{state.isPublic ? t("lobby.partyPublic") : t("lobby.partyPrivate")}</Text>
              <View style={[styles.visibilityTrack, state.isPublic && styles.visibilityTrackEnabled]}><View style={[styles.visibilityThumb, state.isPublic && styles.visibilityThumbEnabled]} /></View>
            </Pressable> : null}
            <View style={styles.actionArea}>
              {!isStarting && (isHost ? <BigButton label={t("lobby.start")} onPress={() => { setStartError(null); room.send("startGame"); }} disabled={!canStart} /> : <BigButton label={me?.ready ? t("lobby.notReady") : t("lobby.ready")} onPress={() => room.send("toggleReady")} variant="secondary" />)}
              {!isStarting && !canStart && isHost && <Subtitle>{t("lobby.waitingForPlayers", { count: requiredPlayers })}</Subtitle>}
              {!isStarting && startError ? <Text style={styles.startError}>{startError}</Text> : null}
            </View>
          </View>
        </View>

        {isStarting ? (
          <View pointerEvents="none" style={styles.startingOverlay}>
            <View style={styles.startingWrap}>
              <Text style={styles.startingTitle}>{t("lobby.startingTitle")}</Text>
              <Text style={styles.startingCountdown}>{countdownSeconds}</Text>
              <Text style={styles.startingHint}>{t("lobby.startingMessage")}</Text>
            </View>
          </View>
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  contentWrap: {
    flex: 1,
    width: "100%",
  },
  lobbyColumns: { flex: 1, minHeight: 0, width: "100%", flexDirection: "row", alignItems: "stretch", justifyContent: "space-between", gap: 24 },
  playersColumn: { width: "52%", minWidth: 0, backgroundColor: "rgba(31, 26, 51, 0.55)", borderRadius: 14, padding: 12 },
  infoColumn: { flex: 1, minWidth: 0, alignItems: "center", justifyContent: "center", paddingHorizontal: 10 },
  columnTitle: { color: theme.text, fontSize: 18, fontWeight: "900", marginBottom: 9, textAlign: "center" },
  codeWrap: {
    alignSelf: "center",
    width: "100%",
    maxWidth: 360,
  },
  copyHint: {
    color: theme.textDim,
    textAlign: "center",
    marginTop: -4,
    marginBottom: 10,
    fontSize: 13,
  },
  visibilityControl: {
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    marginTop: 0,
    marginBottom: 8,
    paddingVertical: 4,
  },
  wagerBanner: { alignSelf: "center", flexDirection: "row", gap: 14, marginBottom: 8, paddingHorizontal: 14, paddingVertical: 5, borderRadius: 10, backgroundColor: "rgba(247, 216, 91, 0.11)", borderWidth: 1, borderColor: "rgba(247, 216, 91, 0.45)" },
  wagerStake: { color: "#F7D85B", fontSize: 12, fontWeight: "900" },
  wagerPot: { color: theme.text, fontSize: 12, fontWeight: "800" },
  startError: { color: theme.danger, textAlign: "center", fontSize: 12, fontWeight: "700", marginTop: 5 },
  visibilityLabel: { color: theme.textDim, fontSize: 13, fontWeight: "700" },
  visibilityTrack: {
    width: 38,
    height: 22,
    borderRadius: 11,
    padding: 3,
    backgroundColor: "rgba(185, 176, 214, 0.3)",
  },
  visibilityTrackEnabled: { backgroundColor: theme.primary },
  visibilityThumb: { width: 16, height: 16, borderRadius: 8, backgroundColor: theme.text },
  visibilityThumbEnabled: { alignSelf: "flex-end" },
  list: {
    flex: 1,
    minHeight: Platform.OS === "android" ? 120 : 0,
    width: "100%",
  },
  listContent: { paddingBottom: 4 },
  actionArea: { width: "100%", maxWidth: 360, marginTop: 4 },
  startingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  startingWrap: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.surface,
    width: "40%",
    maxWidth: 420,
    alignSelf: "center",
    borderRadius: 16,
    paddingHorizontal: 18,
    paddingVertical: 20,
    marginTop: 12,
  },
  startingTitle: {
    color: theme.text,
    fontSize: 20,
    fontWeight: "800",
    textAlign: "center",
  },
  startingCountdown: {
    color: theme.text,
    fontSize: 46,
    fontWeight: "900",
    lineHeight: 52,
    marginTop: 8,
  },
  startingHint: {
    color: theme.textDim,
    fontSize: 14,
    textAlign: "center",
    marginTop: 8,
  },
  playerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: theme.surface,
    padding: 14,
    borderRadius: 10,
    marginBottom: 8,
  },
  playerName: { color: theme.text, fontSize: 16, fontWeight: "600", flex: 1, flexShrink: 1, paddingRight: 12 },
  readyBadge: { color: "#7CFFA0", fontWeight: "700" },
  notReadyBadge: { color: theme.textDim },
});
