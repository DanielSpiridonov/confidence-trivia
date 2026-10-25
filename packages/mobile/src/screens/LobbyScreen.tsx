import { Pressable } from "../components/menuHaptics";
import React, { useEffect, useRef, useState } from "react";
import { View, Text, FlatList, Platform, StyleSheet } from "react-native";
import { FontAwesome5 } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import { useTranslation } from "react-i18next";
import { Room } from "colyseus.js";
import { FRAME_COSMETIC_COLORS, MIN_PLAYERS_TO_START, RANKED_PLAYER_COUNT } from "@confidence-trivia/shared";
import { ANDROID_GAME_UI_SCALE, Screen, BigButton, theme } from "../components/ui";
import { playSound } from "../audio/sounds";
import { PlayerFrameEffect } from "../components/PlayerFrameEffect";
import { MatchmakingQueueScreen } from "./MatchmakingQueueScreen";

interface PublicPlayerView {
  id: string;
  name: string;
  ready: boolean;
  isHost: boolean;
  connected: boolean;
  stars: number;
  nameColor: string;
  avatarId: string;
  frameId: string;
  team: string;
}

export function LobbyScreen({ room, state, mySessionId }: { room: Room; state: any; mySessionId: string }) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [countdownEndsAt, setCountdownEndsAt] = useState<number | null>(null);
  const [startError, setStartError] = useState<string | null>(null);
  const [startPending, setStartPending] = useState(false);
  const startTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startInFlight = useRef(false);
  const mounted = useRef(true);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownSoundPlayed = useRef(false);
  const isStarting = state?.phase === "starting";

  function finishStartRequest() {
    if (startTimer.current) clearTimeout(startTimer.current);
    startTimer.current = null;
    startInFlight.current = false;
    if (mounted.current) setStartPending(false);
  }
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; if (startTimer.current) clearTimeout(startTimer.current); if (copyTimer.current) clearTimeout(copyTimer.current); };
  }, []);
  useEffect(() => { if (isStarting) finishStartRequest(); }, [isStarting]);

  useEffect(() => {
    return room.onMessage("gameStartError", (message: { code?: string; names?: string[]; stake?: number }) => {
      finishStartRequest();
      if (message.code === "insufficient_stars") {
        setStartError(t("lobby.insufficientWagerStars", { names: message.names?.join(", ") || "Player", stake: message.stake ?? 0 }));
      } else if (message.code === "players_not_ready") {
        setStartError(t("lobby.waitingForReady"));
      } else {
        setStartError(message.code === "not_enough_players" ? "This room does not have enough connected players to start." : "The game could not start. Please leave and create a new room.");
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
    avatarId: p.avatarId,
    frameId: p.frameId,
    team: p.team,
  }));

  const me = players.find((p) => p.id === mySessionId);
  const isHost = me?.isHost ?? false;
  const requiredPlayers = state.gameMode === "damage" ? 2 : state.gameMode === "ranked" ? RANKED_PLAYER_COUNT : state.gameMode === "friends" && state.friendsTeamMode === "duos" ? 4 : MIN_PLAYERS_TO_START;
  const connectedPlayerCount = players.filter((player) => player.connected).length;
  const isRanked = state.gameMode === "ranked";
  const isChallenge = Boolean(state.isChallenge);
  const isMatchmade = isRanked || (state.gameMode === "damage" && !isChallenge);
  const validFriendsTeamSize = state.gameMode !== "friends" || state.friendsTeamMode !== "duos" || (connectedPlayerCount >= 4 && connectedPlayerCount % 2 === 0);
  const everyoneReady = isMatchmade || players.every(player => !player.connected || player.isHost || player.ready);
  const canStart = isHost && everyoneReady && validFriendsTeamSize && (state.gameMode === "damage" || state.gameMode === "ranked" ? connectedPlayerCount === requiredPlayers : connectedPlayerCount >= requiredPlayers);

  function handleStart() {
    if (!canStart || startInFlight.current) return;
    startInFlight.current = true; setStartPending(true); setStartError(null);
    try {
      if (!mounted.current || room.connection?.isOpen === false) throw new Error("The room connection was lost. Please leave and create a new room.");
      room.send("startGame");
      startTimer.current = setTimeout(() => {
        finishStartRequest();
        if (mounted.current) setStartError("The server did not start this room. Please try again, or leave and create a new room.");
      }, 6000);
    } catch (error) {
      finishStartRequest();
      if (mounted.current) setStartError(error instanceof Error ? error.message : "The game could not start. Please try again.");
    }
  }

  async function handleCopyCode() {
    try {
      await Clipboard.setStringAsync(String(state.code));
      if (!mounted.current) return;
      setCopied(true);
      if (copyTimer.current) clearTimeout(copyTimer.current);
      copyTimer.current = setTimeout(() => setCopied(false), 1500);
    } catch { setCopied(false); }
  }

  if (isMatchmade) {
    return <MatchmakingQueueScreen players={players} mySessionId={mySessionId} ranked={isRanked} isStarting={isStarting} countdownSeconds={countdownSeconds} wager={state.damageWager} pot={state.damagePot} error={startError} />;
  }

  return (
    <Screen androidScale={ANDROID_GAME_UI_SCALE * 0.9}>
      <View style={styles.contentWrap}>
        <View style={styles.lobbyColumns}>
          <View style={styles.playersColumn}>
            <View style={styles.rosterHeader}>
              <View><Text style={styles.rosterEyebrow}>{t("lobby.waitingRoom")}</Text><Text style={styles.columnTitle}>{t("lobby.players")}</Text></View>
              <View style={styles.playerCountPill}><FontAwesome5 name="users" size={12} color="#CDB3E7" /><Text style={styles.playerCount}>{connectedPlayerCount}</Text></View>
            </View>
            <View style={styles.rosterDivider} />
            <FlatList style={styles.list} data={players} keyExtractor={(p) => p.id} contentContainerStyle={styles.listContent} nestedScrollEnabled showsVerticalScrollIndicator persistentScrollbar renderItem={({ item, index }) => (
              <View style={[styles.playerRow, item.id === mySessionId && styles.myPlayerRow, item.frameId ? { borderColor: FRAME_COSMETIC_COLORS[item.frameId as keyof typeof FRAME_COSMETIC_COLORS] } : null]}>
                <PlayerFrameEffect frameId={item.frameId} />
                <View style={[styles.playerNumber, item.isHost && styles.hostNumber]}>{item.isHost ? <FontAwesome5 name="crown" size={13} color="#F7D887" /> : <Text style={styles.playerNumberText}>{String(index + 1).padStart(2, "0")}</Text>}</View>
                <View style={styles.playerIdentity}>
                  <View style={styles.playerNameLine}><Text numberOfLines={1} style={[styles.playerName, { color: item.nameColor || theme.text }]}>{item.name}</Text>{item.id === mySessionId ? <Text style={styles.youLabel}>{t("common.you")}</Text> : null}</View>
                  {item.isHost ? <Text style={styles.hostLabel}>{t("lobby.host")}</Text> : null}
                </View>
                {item.team ? <Text style={[styles.teamBadge, item.team === "B" && styles.teamBadgeB]}>{t("lobby.team", { team: item.team })}</Text> : null}
                <View style={styles.playerStatus}><View style={[styles.statusDot, !item.connected ? styles.disconnectedDot : item.ready || item.isHost ? styles.readyDot : null]} /><Text numberOfLines={1} style={item.connected && (item.ready || item.isHost) ? styles.readyBadge : styles.notReadyBadge}>{!item.connected ? t("lobby.reconnecting") : item.isHost ? t("lobby.host") : item.ready ? t("lobby.ready") : t("lobby.notReady")}</Text></View>
              </View>
            )} />
            {!isChallenge ? <View style={styles.rosterFooter}><FontAwesome5 name="user-plus" size={12} color="#A58CBF" /><Text style={styles.rosterHint}>{t("lobby.inviteHint")}</Text></View> : null}
          </View>

          <View style={styles.infoColumn}>
            <View style={styles.infoColumnContent}>
            <View style={styles.roomDetails}><Text style={styles.modeLabel}>{isChallenge ? t("lobby.challengeLobby") : t(`create.${state.gameMode}`)}</Text>{state.gameMode !== "damage" ? <Text style={styles.roundsLabel}>{t("lobby.roundCount", { count: state.totalRounds })}{state.gameMode === "friends" && state.friendsTeamMode === "duos" ? " · " + t("create.duos") : ""}</Text> : null}</View>
            {isChallenge ? <View style={styles.rankedQueue}><Text style={styles.rankedCount}>{connectedPlayerCount}/{requiredPlayers}</Text><Text style={styles.copyHint}>{t("lobby.challengeManualStart")}</Text></View> : <>
              <Text style={styles.codeLabel}>{t("lobby.roomCode")}</Text>
              <Pressable accessibilityRole="button" accessibilityLabel={t("lobby.copyCode", { code: state.code })} onPress={() => void handleCopyCode()} style={styles.codeWrap}>
                <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6} selectable={false} style={styles.roomCode}>{state.code}</Text>
                <View style={styles.copyAction}><FontAwesome5 name={copied ? "check" : "copy"} size={12} color={copied ? "#9DE3BD" : "#C4A2E6"} /><Text style={styles.copyHint}>{copied ? t("lobby.copied") : t("lobby.tapToCopy")}</Text></View>
              </Pressable>
            </>}
            {state.gameMode === "damage" ? <View style={styles.wagerBanner}>
              <Text style={styles.wagerStake}>{t("lobby.wagerStake", { count: state.damageWager })}</Text>
              <Text style={styles.wagerPot}>{t("lobby.wagerPot", { count: state.damagePot })}</Text>
            </View> : null}
            {!isChallenge && isHost && !isStarting && !state.customQuestionsEnabled ? <Pressable accessibilityRole="switch" accessibilityState={{ checked: Boolean(state.isPublic) }} onPress={() => room.send("toggleRoomVisibility")} style={styles.visibilityControl}>
              <Text style={styles.visibilityLabel}>{state.isPublic ? t("lobby.partyPublic") : t("lobby.partyPrivate")}</Text>
              <View style={[styles.visibilityTrack, state.isPublic && styles.visibilityTrackEnabled]}><View style={[styles.visibilityThumb, state.isPublic && styles.visibilityThumbEnabled]} /></View>
            </Pressable> : null}
            <View style={styles.actionArea}>
              {!isStarting ? <Text style={styles.waitingHint}>{connectedPlayerCount < requiredPlayers ? t("lobby.waitingForPlayers", { count: requiredPlayers - connectedPlayerCount }) : !validFriendsTeamSize ? t("lobby.evenTeamsHint") : !everyoneReady ? t("lobby.waitingForReady") : isHost ? t("lobby.hostCanStart") : t("lobby.waitingForHost")}</Text> : null}
              {!isStarting && (isHost ? <BigButton label={startPending ? "Starting…" : t("lobby.start")} onPress={() => void handleStart()} disabled={!canStart || startPending} lobbyHaptic /> : <BigButton label={me?.ready ? t("lobby.notReady") : t("lobby.ready")} onPress={() => room.send("toggleReady")} variant="secondary" lobbyHaptic />)}
              {!isStarting && startError ? <Text style={styles.startError}>{startError}</Text> : null}
            </View>
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
  playersColumn: { width: "58%", minWidth: 0, backgroundColor: "rgba(25,18,36,0.87)", borderRadius: 18, borderWidth: 1, borderColor: "#51405F", padding: 14 },
  infoColumn: { flex: 1, minWidth: 0, alignItems: "center", justifyContent: "center", paddingHorizontal: 10 },
  infoColumnContent: {
    width: Platform.OS === "android" ? "90.91%" : "100%",
    height: Platform.OS === "android" ? "90.91%" : "100%",
    alignItems: "center",
    justifyContent: "center",
    ...(Platform.OS === "android" ? { transform: [{ scale: 1.1 }] } : {}),
  },
  columnTitle: { color: "#F5EBDC", fontSize: 24, fontWeight: "900", marginTop: 2 },
  roomDetails: { alignItems: "center", marginBottom: 13 },
  modeLabel: { color: "#F5EBDC", fontSize: 26, fontWeight: "900", textAlign: "center" },
  roundsLabel: { color: "#B6A2CA", fontSize: 11, fontWeight: "700", marginTop: 4 },
  codeLabel: { color: "#AF95C9", fontSize: 9, letterSpacing: 1.7, fontWeight: "900", marginBottom: 6 },
  codeWrap: { width: "100%", maxWidth: 310, paddingVertical: 12, paddingHorizontal: 12, borderRadius: 13, borderWidth: 1, borderStyle: "dashed", borderColor: "#9370B8", backgroundColor: "rgba(66,42,88,0.25)", alignItems: "center", marginBottom: 10 },
  roomCode: { width: "100%", textAlign: "center", color: "#F6EAD5", fontSize: 37, lineHeight: 44, letterSpacing: 5, fontWeight: "900" },
  copyAction: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 },
  copyHint: { color: "#BBA3D2", textAlign: "center", fontSize: 10 },
  rosterHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  rosterEyebrow: { color: "#AC93C5", fontSize: 9, letterSpacing: 1.3, fontWeight: "900", textTransform: "uppercase" },
  playerCountPill: { flexDirection: "row", alignItems: "center", gap: 7, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, backgroundColor: "#382947" },
  playerCount: { color: "#F0DFFB", fontSize: 14, fontWeight: "900" },
  rosterDivider: { height: 1, backgroundColor: "#4A365B", marginTop: 10, marginBottom: 10 },
  playerNumber: { width: 31, height: 31, borderRadius: 9, alignItems: "center", justifyContent: "center", backgroundColor: "#392C48" },
  hostNumber: { backgroundColor: "#4D3A2C" },
  playerNumberText: { color: "#BDA8D3", fontSize: 11, fontWeight: "900" },
  playerIdentity: { flex: 1, minWidth: 0 },
  playerNameLine: { flexDirection: "row", alignItems: "center", gap: 5 },
  youLabel: { color: "#C5A0E6", fontSize: 9, fontWeight: "800" },
  hostLabel: { color: "#D2B577", fontSize: 9, marginTop: 2 },
  myPlayerRow: { borderColor: "#A075CB", backgroundColor: "#38264A" },
  playerStatus: { flexDirection: "row", alignItems: "center", gap: 5, maxWidth: "30%" },
  statusDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: "#8D7B9D" },
  readyDot: { backgroundColor: "#94D6AC" },
  disconnectedDot: { backgroundColor: "#E4B66B" },
  rosterFooter: { flexDirection: "row", alignItems: "center", gap: 7, borderTopWidth: 1, borderTopColor: "#43324F", paddingTop: 9, marginTop: 5 },
  rosterHint: { flex: 1, color: "#AF99C3", fontSize: 10 },
  waitingHint: { color: "#C3AFD5", fontSize: 11, textAlign: "center", marginBottom: 6 },
  rankedQueue: { width: "100%", alignItems: "center" },
  rankedCount: { color: theme.text, fontSize: 42, fontWeight: "900", marginVertical: 8 },
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
  teamBadge: { marginRight: 7, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 5, color: "#D8D0FF", backgroundColor: "rgba(124,92,255,0.25)", fontSize: 9, fontWeight: "900" },
  teamBadgeB: { color: "#AEECD1", backgroundColor: "rgba(52,190,130,0.2)" },
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
    minHeight: 0,
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
  playerRow: { flexDirection: "row", alignItems: "center", gap: 9, backgroundColor: "#271F34", paddingHorizontal: 9, paddingVertical: 8, borderWidth: 1, borderColor: "#42324F", borderRadius: 10, marginBottom: 6, minHeight: 48, overflow: "hidden" },
  playerName: { color: theme.text, fontSize: 13, fontWeight: "800", flexShrink: 1 },
  readyBadge: { color: "#9BDDAD", fontSize: 10, fontWeight: "800", flexShrink: 1 },
  notReadyBadge: { color: "#B4A3C4", fontSize: 10, flexShrink: 1 },
});
