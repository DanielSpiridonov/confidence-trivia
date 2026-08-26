import React, { useEffect, useRef, useState } from "react";
import { AppState, Image, Pressable, StyleSheet, Text, Vibration, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Room } from "colyseus.js";
import "./src/i18n";
import i18n from "./src/i18n";
import { BigButton, GAME_BACKGROUND, theme } from "./src/components/ui";
import { PointsIcon } from "./src/components/PointsIcon";

import { HomeScreen } from "./src/screens/HomeScreen";
import { CreateGameScreen } from "./src/screens/CreateGameScreen";
import { JoinGameScreen } from "./src/screens/JoinGameScreen";
import { LobbyScreen } from "./src/screens/LobbyScreen";
import { QuestionScreen } from "./src/screens/QuestionScreen";
import { ConfidenceScreen } from "./src/screens/ConfidenceScreen";
import { ConfidenceBoardScreen } from "./src/screens/ConfidenceBoardScreen";
import { RevealScreen } from "./src/screens/RevealScreen";
import { FinalResultsScreen } from "./src/screens/FinalResultsScreen";
import { SettingsScreen, VolumeControl } from "./src/screens/SettingsScreen";
import { createRoom, getPlayerLifetimePoints, joinPublicRoom, joinRoom, reconnectRoom, useRoomState } from "./src/network/client";
import { prepareSoundEffects, setSoundEffectsVolume, stopAllSoundEffects } from "./src/audio/sounds";
import { pauseMusicForBackground, prepareMusic, setMusicVolume as applyMusicVolume, startMenuMusic, stopMenuMusic } from "./src/audio/music";
import { getOrCreateDeviceId } from "./src/utils/deviceId";

type Nav = "home" | "create" | "join" | "settings" | "in-room";
type RoomRecoveryState = "reconnecting" | "failed";
const LANGUAGE_STORAGE_KEY = "confidence-trivia:locale";
const SFX_VOLUME_STORAGE_KEY = "confidence-trivia:sfx-volume";
const MUSIC_VOLUME_STORAGE_KEY = "confidence-trivia:music-volume";
const PLAYER_NAME_STORAGE_KEY = "confidence-trivia:player-name";
const HAPTICS_STORAGE_KEY = "confidence-trivia:haptics-enabled";
const HIGH_CONTRAST_STORAGE_KEY = "confidence-trivia:high-contrast-enabled";
const RECENT_QUESTIONS_STORAGE_KEY = "confidence-trivia:recent-question-ids";
const RECENT_QUESTION_LIMIT = 40;

function AppFrame({ children, highContrast = false }: { children: React.ReactNode; highContrast?: boolean }) {
  const [backgroundRevision, setBackgroundRevision] = useState(0);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active") {
        setBackgroundRevision((revision) => revision + 1);
      }
    });
    return () => subscription.remove();
  }, []);

  return (
    <View style={styles.appFrame} collapsable={false}>
      <Image
        key={backgroundRevision}
        source={GAME_BACKGROUND}
        resizeMode="cover"
        fadeDuration={0}
        style={styles.appBackgroundImage}
      />
      <View pointerEvents="none" style={[styles.appBackgroundShade, highContrast && styles.appBackgroundShadeHighContrast]} />
      <View style={styles.appContent}>{children}</View>
    </View>
  );
}

function PointsBadge({ points }: { points: number }) {
  return (
    <View pointerEvents="none" style={styles.pointsBadge}>
      <PointsIcon />
      <Text style={styles.pointsBadgeText}>{points}</Text>
    </View>
  );
}

export default function App() {
  const [nav, setNav] = useState<Nav>("home");
  const [room, setRoom] = useState<Room | null>(null);
  const [locale, setLocale] = useState<"en" | "bg">("en");
  const [localeReady, setLocaleReady] = useState(false);
  const [soundEffectsVolume, setSoundEffectsVolumeState] = useState(1);
  const [musicVolume, setMusicVolume] = useState(0.5);
  const [defaultPlayerName, setDefaultPlayerName] = useState("");
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [lifetimePoints, setLifetimePoints] = useState(0);
  const [hapticsEnabled, setHapticsEnabled] = useState(true);
  const [highContrastEnabled, setHighContrastEnabled] = useState(false);
  const [roomRecovery, setRoomRecovery] = useState<RoomRecoveryState | null>(null);
  const [roomRecoveryMessage, setRoomRecoveryMessage] = useState<string | null>(null);
  const intentionalLeaveRef = useRef(false);
  const reconnectionTokenRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadLocale() {
      try {
        const [saved, savedSfxVolume, savedMusicVolume, savedPlayerName, savedHaptics, savedHighContrast, storedDeviceId] = await Promise.all([
          AsyncStorage.getItem(LANGUAGE_STORAGE_KEY),
          AsyncStorage.getItem(SFX_VOLUME_STORAGE_KEY),
          AsyncStorage.getItem(MUSIC_VOLUME_STORAGE_KEY),
          AsyncStorage.getItem(PLAYER_NAME_STORAGE_KEY),
          AsyncStorage.getItem(HAPTICS_STORAGE_KEY),
          AsyncStorage.getItem(HIGH_CONTRAST_STORAGE_KEY),
          getOrCreateDeviceId(),
        ]);
        if (!cancelled) {
          setDefaultPlayerName(savedPlayerName ?? "");
          setDeviceId(storedDeviceId);
          setHapticsEnabled(savedHaptics !== "false");
          setHighContrastEnabled(savedHighContrast === "true");
        }
        void getPlayerLifetimePoints(storedDeviceId).then((points) => {
          if (!cancelled && points !== null) setLifetimePoints(points);
        });
        if (!cancelled && (saved === "en" || saved === "bg")) {
          setLocale(saved);
          await i18n.changeLanguage(saved);
        }
        const parsedSfxVolume = Number(savedSfxVolume);
        if (!cancelled && savedSfxVolume !== null && Number.isFinite(parsedSfxVolume)) {
          const volume = Math.min(1, Math.max(0, parsedSfxVolume));
          setSoundEffectsVolumeState(volume);
          setSoundEffectsVolume(volume);
        }
        const parsedMusicVolume = Number(savedMusicVolume);
        if (!cancelled && savedMusicVolume !== null && Number.isFinite(parsedMusicVolume)) {
          const volume = Math.min(1, Math.max(0, parsedMusicVolume));
          setMusicVolume(volume);
          applyMusicVolume(volume);
        }
      } finally {
        if (!cancelled) setLocaleReady(true);
      }

      // Audio is optional and must not block preferences or player identity.
      await Promise.allSettled([prepareSoundEffects(), prepareMusic()]);
    }

    void loadLocale();
    return () => {
      cancelled = true;
    };
  }, []);

  async function requireDeviceId(): Promise<string> {
    if (deviceId) return deviceId;
    const storedDeviceId = await getOrCreateDeviceId();
    setDeviceId(storedDeviceId);
    void getPlayerLifetimePoints(storedDeviceId).then((points) => {
      if (points !== null) setLifetimePoints(points);
    });
    return storedDeviceId;
  }

  async function handleCreate(name: string, rounds: number, gameMode: "classic" | "friends", visibility: "private" | "public") {
    const currentDeviceId = await requireDeviceId();
    let recentQuestionIds: string[] = [];
    try {
      const saved = await AsyncStorage.getItem(RECENT_QUESTIONS_STORAGE_KEY);
      const parsed = saved ? JSON.parse(saved) : [];
      if (Array.isArray(parsed)) recentQuestionIds = parsed.filter((id): id is string => typeof id === "string");
    } catch {
      // A corrupt local history should never prevent room creation.
    }
    const r = await createRoom(currentDeviceId, name, rounds, locale, gameMode, recentQuestionIds, visibility);
    reconnectionTokenRef.current = r.reconnectionToken;
    setRoom(r);
    setRoomRecovery(null);
    setRoomRecoveryMessage(null);
    setNav("in-room");
  }

  async function handleJoin(code: string, name: string) {
    const currentDeviceId = await requireDeviceId();
    const r = await joinRoom(code, currentDeviceId, name);
    reconnectionTokenRef.current = r.reconnectionToken;
    setRoom(r);
    setRoomRecovery(null);
    setRoomRecoveryMessage(null);
    setNav("in-room");
  }

  async function handleJoinPublic(roomId: string, name: string) {
    const currentDeviceId = await requireDeviceId();
    const r = await joinPublicRoom(roomId, currentDeviceId, name);
    reconnectionTokenRef.current = r.reconnectionToken;
    setRoom(r);
    setRoomRecovery(null);
    setRoomRecoveryMessage(null);
    setNav("in-room");
  }

  function handleExitToHome() {
    intentionalLeaveRef.current = true;
    stopAllSoundEffects();
    void room?.leave().catch(() => undefined);
    setRoomRecovery(null);
    setRoomRecoveryMessage(null);
    setRoom(null);
    setNav("home");
    intentionalLeaveRef.current = false;
  }

  function handleChangeLocale(l: "en" | "bg") {
    setLocale(l);
    void i18n.changeLanguage(l);
    void AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, l);
  }

  function handleSoundEffectsVolume(volume: number) {
    setSoundEffectsVolumeState(volume);
    setSoundEffectsVolume(volume);
    void AsyncStorage.setItem(SFX_VOLUME_STORAGE_KEY, String(volume));
  }

  function handleMusicVolume(volume: number) {
    setMusicVolume(volume);
    applyMusicVolume(volume);
    void AsyncStorage.setItem(MUSIC_VOLUME_STORAGE_KEY, String(volume));
  }

  function handleDefaultPlayerName(name: string) {
    setDefaultPlayerName(name);
    void AsyncStorage.setItem(PLAYER_NAME_STORAGE_KEY, name);
  }

  function handleHapticsEnabled(enabled: boolean) {
    setHapticsEnabled(enabled);
    void AsyncStorage.setItem(HAPTICS_STORAGE_KEY, String(enabled));
  }

  function handleHighContrastEnabled(enabled: boolean) {
    setHighContrastEnabled(enabled);
    void AsyncStorage.setItem(HIGH_CONTRAST_STORAGE_KEY, String(enabled));
  }

  useEffect(() => {
    if (!localeReady) return;
    if (nav === "in-room") stopMenuMusic();
    else startMenuMusic();
  }, [localeReady, nav]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active") {
        if (nav !== "in-room") startMenuMusic();
      } else {
        pauseMusicForBackground();
      }
    });
    return () => subscription.remove();
  }, [nav]);

  async function attemptReconnect() {
    const token = reconnectionTokenRef.current;
    if (!token) {
      setRoomRecovery("failed");
      setRoomRecoveryMessage(i18n.t("connection.reconnectMissing"));
      return;
    }

    setRoomRecovery("reconnecting");
    setRoomRecoveryMessage(null);

    try {
      const reconnectedRoom = await reconnectRoom(token);
      reconnectionTokenRef.current = reconnectedRoom.reconnectionToken;
      setRoom(reconnectedRoom);
      setRoomRecovery(null);
      setRoomRecoveryMessage(null);
      setNav("in-room");
    } catch (error) {
      setRoomRecovery("failed");
      setRoomRecoveryMessage(error instanceof Error ? error.message : i18n.t("network.unknownError"));
    }
  }

  useEffect(() => {
    if (!room) return;

    reconnectionTokenRef.current = room.reconnectionToken;

    const handleUnexpectedLeave = () => {
      if (intentionalLeaveRef.current) return;
      void attemptReconnect();
    };

    room.onLeave(handleUnexpectedLeave);
    return () => {
      room.onLeave.remove(handleUnexpectedLeave);
    };
  }, [room]);

  if (!localeReady) {
    return (
      <AppFrame highContrast={highContrastEnabled}>
        <View style={styles.loadingRoot} />
      </AppFrame>
    );
  }

  return (
    <AppFrame highContrast={highContrastEnabled}>
      <StatusBar style="light" />
      {nav === "in-room" && room ? (
        <InRoomRouter
          room={room}
          onExit={handleExitToHome}
          roomRecovery={roomRecovery}
          roomRecoveryMessage={roomRecoveryMessage}
          onRetryReconnect={() => void attemptReconnect()}
          onReturnHome={handleExitToHome}
          soundEffectsVolume={soundEffectsVolume}
          musicVolume={musicVolume}
          onChangeSoundEffectsVolume={handleSoundEffectsVolume}
          onChangeMusicVolume={handleMusicVolume}
          hapticsEnabled={hapticsEnabled}
          onLifetimePointsChange={setLifetimePoints}
        />
      ) : (
        <>
          {nav === "home" && (
            <HomeScreen
              onCreate={() => setNav("create")}
              onJoin={() => setNav("join")}
              onSettings={() => setNav("settings")}
            />
          )}
          {nav === "create" && <CreateGameScreen onCreate={handleCreate} locale={locale} initialName={defaultPlayerName} onBack={() => setNav("home")} />}
          {nav === "join" && <JoinGameScreen onJoin={handleJoin} onJoinPublic={handleJoinPublic} initialName={defaultPlayerName} onBack={() => setNav("home")} />}
          {nav === "settings" && (
            <SettingsScreen
              locale={locale}
              soundEffectsVolume={soundEffectsVolume}
              musicVolume={musicVolume}
              defaultPlayerName={defaultPlayerName}
              hapticsEnabled={hapticsEnabled}
              highContrastEnabled={highContrastEnabled}
              onChangeLocale={handleChangeLocale}
              onChangeSoundEffectsVolume={handleSoundEffectsVolume}
              onChangeMusicVolume={handleMusicVolume}
              onChangeDefaultPlayerName={handleDefaultPlayerName}
              onChangeHapticsEnabled={handleHapticsEnabled}
              onChangeHighContrastEnabled={handleHighContrastEnabled}
              onBack={() => setNav("home")}
            />
          )}
        </>
      )}
      <PointsBadge points={lifetimePoints} />
    </AppFrame>
  );
}

/**
 * Once inside a room, the SERVER's `phase` field is the single source of
 * truth for which screen renders — the client does not maintain its own
 * notion of what phase the game is in. This is what makes "server drives
 * all round transitions" (spec §29/§32) hold at the UI layer too.
 */
function InRoomRouter({
  room,
  onExit,
  roomRecovery,
  roomRecoveryMessage,
  onRetryReconnect,
  onReturnHome,
  soundEffectsVolume,
  musicVolume,
  onChangeSoundEffectsVolume,
  onChangeMusicVolume,
  hapticsEnabled,
  onLifetimePointsChange,
}: {
  room: Room;
  onExit: () => void;
  roomRecovery: RoomRecoveryState | null;
  roomRecoveryMessage: string | null;
  onRetryReconnect: () => void;
  onReturnHome: () => void;
  soundEffectsVolume: number;
  musicVolume: number;
  onChangeSoundEffectsVolume: (volume: number) => void;
  onChangeMusicVolume: (volume: number) => void;
  hapticsEnabled: boolean;
  onLifetimePointsChange: (points: number) => void;
}) {
  const { t } = i18n;
  const state = useRoomState<any>(room);
  const [gameMenuPanel, setGameMenuPanel] = useState<"menu" | "settings" | null>(null);
  const previousPhaseRef = useRef<string | null>(null);

  useEffect(() => {
    const points = state?.players?.get(room.sessionId)?.lifetimePoints;
    if (typeof points === "number") onLifetimePointsChange(points);
  }, [onLifetimePointsChange, room.sessionId, state?.players?.get(room.sessionId)?.lifetimePoints]);

  useEffect(() => {
    const phase = state?.phase as string | undefined;
    if (!phase) return;

    const previousPhase = previousPhaseRef.current;
    previousPhaseRef.current = phase;
    if (previousPhase === null || previousPhase === phase) return;

    if (!hapticsEnabled) return;
    if (phase === "starting") {
      Vibration.vibrate(250);
    } else if (phase === "final_results") {
      Vibration.vibrate([0, 220, 120, 350]);
    }
  }, [hapticsEnabled, state?.phase]);

  useEffect(() => {
    const questionId = state?.currentQuestion?.id;
    if (!questionId) return;

    async function rememberQuestion() {
      try {
        const saved = await AsyncStorage.getItem(RECENT_QUESTIONS_STORAGE_KEY);
        const parsed = saved ? JSON.parse(saved) : [];
        const currentIds = Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : [];
        const nextIds = [questionId, ...currentIds.filter((id) => id !== questionId)].slice(0, RECENT_QUESTION_LIMIT);
        await AsyncStorage.setItem(RECENT_QUESTIONS_STORAGE_KEY, JSON.stringify(nextIds));
      } catch {
        // Duplicate prevention is best-effort and must not interrupt play.
      }
    }

    void rememberQuestion();
  }, [state?.currentQuestion?.id]);

  if (!state) return null;

  const currentScreen = (() => {
    switch (state.phase) {
      case "lobby":
      case "starting":
        return <LobbyScreen room={room} mySessionId={room.sessionId} />;
      case "question":
        return <QuestionScreen room={room} />;
      case "confidence":
        return <ConfidenceScreen room={room} />;
      case "board_sidebet":
        return <ConfidenceBoardScreen room={room} mySessionId={room.sessionId} />;
      case "reveal":
        return <RevealScreen room={room} />;
      case "final_results":
        return <FinalResultsScreen room={room} onExit={onExit} />;
      default:
        return null;
    }
  })();

  return (
    <>
      {gameMenuPanel ? (
        <View style={styles.modalBackdrop}>
          <Pressable style={styles.modalDismissArea} onPress={() => setGameMenuPanel(null)} />
          <View style={[styles.modalCard, styles.gameMenuCard, gameMenuPanel === "settings" && styles.settingsModalCard]}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("gameMenu.continue")}
              onPress={() => setGameMenuPanel(null)}
              hitSlop={10}
              style={styles.gameMenuCloseButton}
            >
              <Text style={styles.gameMenuCloseText}>X</Text>
            </Pressable>
            <Text style={styles.modalTitle}>
              {gameMenuPanel === "settings" ? t("settings.title") : t("gameMenu.title")}
            </Text>
            {gameMenuPanel === "menu" ? (
              <View style={styles.gameMenuActions}>
                <BigButton label={t("settings.title")} onPress={() => setGameMenuPanel("settings")} variant="secondary" style={styles.gameMenuButton} />
                <BigButton label={t("leave.confirm")} onPress={onExit} variant="danger" style={styles.gameMenuButton} />
              </View>
            ) : (
              <View style={styles.inGameSettings}>
                <VolumeControl
                  label={t("settings.soundEffects")}
                  value={soundEffectsVolume}
                  onChange={onChangeSoundEffectsVolume}
                />
                <VolumeControl
                  label={t("settings.music")}
                  value={musicVolume}
                  onChange={onChangeMusicVolume}
                />
                <BigButton label={t("common.back")} onPress={() => setGameMenuPanel("menu")} variant="secondary" style={styles.gameMenuButton} />
              </View>
            )}
          </View>
        </View>
      ) : null}
      {roomRecovery ? (
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              {roomRecovery === "reconnecting" ? t("connection.reconnectingTitle") : t("connection.reconnectFailedTitle")}
            </Text>
            <Text style={styles.modalMessage}>
              {roomRecovery === "reconnecting" ? t("connection.reconnectingMessage") : t("connection.reconnectFailedMessage")}
            </Text>
            {roomRecoveryMessage ? <Text style={styles.modalFootnote}>{roomRecoveryMessage}</Text> : null}
            <View style={styles.recoveryActions}>
              {roomRecovery === "failed" ? (
                <BigButton label={t("connection.retry")} onPress={onRetryReconnect} style={styles.recoveryButton} />
              ) : null}
              <BigButton
                label={t("leave.confirm")}
                onPress={onReturnHome}
                variant="secondary"
                style={styles.recoveryButton}
              />
            </View>
          </View>
        </View>
      ) : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t("gameMenu.title")}
        onPress={() => setGameMenuPanel("menu")}
        style={styles.menuButton}
      >
        <Text style={styles.menuButtonIcon}>⚙</Text>
      </Pressable>
      {currentScreen}
    </>
  );
}

const styles = StyleSheet.create({
  loadingRoot: { flex: 1, backgroundColor: "transparent" },
  appFrame: {
    flex: 1,
    backgroundColor: theme.bg,
  },
  appBackgroundImage: {
    ...StyleSheet.absoluteFillObject,
    width: "100%",
    height: "100%",
  },
  appBackgroundShade: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(20, 16, 31, 0.42)",
  },
  appBackgroundShadeHighContrast: {
    backgroundColor: "rgba(8, 5, 14, 0.68)",
  },
  appContent: {
    flex: 1,
  },
  pointsBadge: {
    position: "absolute",
    top: 18,
    right: 18,
    zIndex: 20,
    minWidth: 76,
    height: 40,
    paddingHorizontal: 12,
    borderRadius: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "rgba(31, 26, 51, 0.92)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.10)",
  },
  pointsBadgeText: {
    color: theme.text,
    fontSize: 17,
    fontWeight: "900",
  },
  menuButton: {
    position: "absolute",
    top: 18,
    right: 110,
    zIndex: 20,
    backgroundColor: "rgba(31, 26, 51, 0.9)",
    borderRadius: 18,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  menuButtonIcon: { color: theme.text, fontSize: 22, lineHeight: 24, fontWeight: "800" },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(11, 8, 20, 0.52)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    zIndex: 30,
  },
  modalDismissArea: {
    ...StyleSheet.absoluteFillObject,
  },
  modalCard: {
    width: "100%",
    maxWidth: 720,
    backgroundColor: theme.surface,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    paddingHorizontal: 24,
    paddingVertical: 24,
  },
  gameMenuCard: {
    maxWidth: 500,
    backgroundColor: "rgba(31, 26, 51, 0.96)",
    overflow: "hidden",
  },
  settingsModalCard: { maxWidth: 540, paddingVertical: 16 },
  gameMenuCloseButton: {
    position: "absolute",
    top: 12,
    right: 14,
    zIndex: 2,
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  gameMenuCloseText: { color: theme.textDim, fontSize: 20, lineHeight: 22, fontWeight: "800" },
  gameMenuActions: { alignItems: "center", marginTop: 12 },
  gameMenuButton: { width: 280, minWidth: 0 },
  inGameSettings: { width: "100%", maxWidth: 520, alignSelf: "center", marginTop: 6 },
  modalTitle: {
    color: theme.text,
    fontSize: 24,
    fontWeight: "800",
    textAlign: "center",
  },
  modalMessage: {
    color: theme.textDim,
    fontSize: 16,
    lineHeight: 22,
    textAlign: "center",
    marginTop: 12,
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 14,
    marginTop: 24,
  },
  recoveryActions: {
    alignItems: "center",
    marginTop: 24,
  },
  modalButton: {
    width: 220,
    minWidth: 0,
    marginTop: 0,
  },
  recoveryButton: {
    width: 260,
    minWidth: 0,
  },
  modalFootnote: {
    color: theme.textDim,
    fontSize: 13,
    lineHeight: 18,
    textAlign: "center",
    marginTop: 10,
  },
});
