import React, { useEffect, useRef, useState } from "react";
import { Animated, AppState, Image, InteractionManager, Keyboard, Linking, Platform, Pressable, StyleSheet, Text, Vibration, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { FontAwesome5 } from "@expo/vector-icons";
import * as NavigationBar from "expo-navigation-bar";
import { useKeepAwake } from "expo-keep-awake";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Room } from "colyseus.js";
import { isOffensivePlayerName } from "@confidence-trivia/shared";
import "./src/i18n";
import i18n from "./src/i18n";
import { BigButton, GAME_BACKGROUND, theme } from "./src/components/ui";
import { PointsIcon } from "./src/components/PointsIcon";
import { FeedbackPopup, useFeedbackPopup } from "./src/components/FeedbackPopup";
import { GameDialog, useGameDialog } from "./src/components/GameDialog";
import { configureMenuHaptics, menuTap } from "./src/components/menuHaptics";

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
import { RankedScreen } from "./src/screens/RankedScreen";
import { ShopScreen } from "./src/screens/ShopScreen";
import { ProfileScreen } from "./src/screens/ProfileScreen";
import { RulesScreen } from "./src/screens/RulesScreen";
import { FriendsScreen } from "./src/screens/FriendsScreen";
import { InboxScreen } from "./src/screens/InboxScreen";
import { StartupScreen, StartupState } from "./src/screens/StartupScreen";
import { AccountProfile, claimDailyReward, createRoom, DailyRewardStatus, deleteAccount, getAccountProfile, getChallenges, getDailyRewardStatus, getFriends, getNews, getPlayerStars, joinPublicRoom, joinRoom, linkPlayerAccount, NewsPost, PlayerChallenge, reconnectRoom, respondChallenge, SERVER_CONFIGURATION_ERROR, updateAccountName, updatePresence, useRoomState } from "./src/network/client";
import { prepareSoundEffects, setSoundEffectsVolume, stopAllSoundEffects } from "./src/audio/sounds";
import { pauseMusicForBackground, prepareMusic, setMusicVolume as applyMusicVolume, startMenuMusic, stopMenuMusic } from "./src/audio/music";
import { createFreshGuestIdentity, getOrCreateDeviceId, getOrCreateGuestName } from "./src/utils/deviceId";
import { authConfigured, getLinkedProviders, getStoredSession, linkAppleIdentity, linkGoogleIdentity, signInWithApple, signInWithSocialProvider, signOutAccount, subscribeToAuthChanges } from "./src/auth/supabase";

type Nav = "startup" | "home" | "create" | "join" | "ranked" | "shop" | "settings" | "profile" | "friends" | "rules" | "in-room";
type RoomRecoveryState = "reconnecting" | "failed";
const SFX_VOLUME_STORAGE_KEY = "confidence-trivia:sfx-volume";
const MUSIC_VOLUME_STORAGE_KEY = "confidence-trivia:music-volume";
const PLAYER_NAME_STORAGE_KEY = "confidence-trivia:player-name";
const HAPTICS_STORAGE_KEY = "confidence-trivia:haptics-enabled";
const HIGH_CONTRAST_STORAGE_KEY = "confidence-trivia:high-contrast-enabled";
const RECENT_QUESTIONS_STORAGE_KEY = "confidence-trivia:recent-question-ids";
const NEWS_READ_STORAGE_PREFIX = "confidence-trivia:read-news";
const COMMUNITY_URL = "https://discord.gg/BjcjJGSyxv";
const LEGAL_URL = "https://daniel-portfolio-pied.vercel.app/projects/confivia/privacy";
const MINIMUM_STARTUP_CHECK_MS = 900;
const RECENT_QUESTION_LIMIT = 40;
const COMBAT_PRELOAD_IMAGES = [
  require("./assets/combat-ios/smart-owl.png"),
  require("./assets/combat-ios/fox.png"),
  require("./assets/combat-ios/quiz-bot.png"),
  require("./assets/combat-ios/omniscient.png"),
  require("./assets/combat-ios/trivia-wizard.png"),
  require("./assets/combat-ios/detective.png"),
  require("./assets/combat-ios/globe.png"),
  require("./assets/combat-ios-defeated/smart-owl.png"),
  require("./assets/combat-ios-defeated/fox.png"),
  require("./assets/combat-ios-defeated/quiz-bot.png"),
  require("./assets/combat-ios-defeated/omniscient.png"),
  require("./assets/combat-ios-defeated/trivia-wizard.png"),
  require("./assets/combat-ios-defeated/detective.png"),
  require("./assets/combat-ios-defeated/globe.png"),
  require("./assets/combat-ios/quiz-bot-calculator.png"),
  require("./assets/combat-ios/smart-owl-book.png"),
  require("./assets/combat-ios/fox-lightbulb.png"),
  require("./assets/combat-ios/omniscient-eye.png"),
  require("./assets/combat-ios/wizard-spell.png"),
  require("./assets/combat-ios/detective-magnifier.png"),
  require("./assets/combat-ios/globe-earth.png"),
] as const;

function AssetPreloader({ sources, onReady }: { sources: readonly number[]; onReady?: () => void }) {
  const loaded = useRef(new Set<number>());

  const handleLoadEnd = (index: number) => {
    if (loaded.current.has(index)) return;
    loaded.current.add(index);
    if (loaded.current.size === sources.length) onReady?.();
  };

  return (
    <View pointerEvents="none" style={styles.combatPreloader}>
      {sources.map((source, index) => <Image key={index} source={source} defaultSource={source} fadeDuration={0} onLoadEnd={() => handleLoadEnd(index)} style={styles.combatPreloadImage} />)}
    </View>
  );
}

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
        defaultSource={GAME_BACKGROUND}
        resizeMode="cover"
        fadeDuration={0}
        style={styles.appBackgroundImage}
      />
      <View pointerEvents="none" style={[styles.appBackgroundShade, highContrast && styles.appBackgroundShadeHighContrast]} />
      <View style={styles.appContent}>{children}</View>
    </View>
  );
}

function StarsBadge({ stars, gain, width, onPress }: { stars: number; gain: { id: number; amount: number } | null; width: number; onPress: () => void }) {
  const gainOpacity = useRef(new Animated.Value(0)).current;
  const gainTranslateY = useRef(new Animated.Value(8)).current;

  useEffect(() => {
    if (!gain) return;
    gainOpacity.setValue(1);
    gainTranslateY.setValue(8);
    Animated.parallel([
      Animated.timing(gainOpacity, { toValue: 0, duration: 1400, useNativeDriver: true }),
      Animated.timing(gainTranslateY, { toValue: -10, duration: 1400, useNativeDriver: true }),
    ]).start();
  }, [gain?.id, gainOpacity, gainTranslateY]);

  return (
    <View pointerEvents="box-none" style={styles.starsHud}>
      <Pressable accessibilityRole="button" accessibilityLabel={`${stars} stars`} onPress={onPress} style={({ pressed }) => [styles.pointsBadge, { width }, pressed && styles.pointsBadgePressed]}>
        <PointsIcon size={38} />
        <Text numberOfLines={1} style={styles.pointsBadgeText}>{stars}</Text>
      </Pressable>
      {gain ? (
        <Animated.Text style={[styles.starGainText, { opacity: gainOpacity, transform: [{ translateY: gainTranslateY }] }]}>+{gain.amount} stars</Animated.Text>
      ) : null}
    </View>
  );
}

export default function App() {
  const { notice: appNotice, showFeedback, clearFeedback } = useFeedbackPopup();
  const { dialog: appDialog, showDialog, dismissDialog, confirmDialog } = useGameDialog();
  const [nav, setNav] = useState<Nav>("startup");
  const [hasEnteredApp, setHasEnteredApp] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);
  const [startupState, setStartupState] = useState<StartupState>("idle");
  const [startupStage, setStartupStage] = useState<"assets" | "connecting" | null>(null);
  const [startupError, setStartupError] = useState<string | null>(SERVER_CONFIGURATION_ERROR);
  const [inboxOpen, setInboxOpen] = useState(false);
  const [friendRequestCount, setFriendRequestCount] = useState(0);
  const [unreadNewsCount, setUnreadNewsCount] = useState(0);
  const [pendingChallengeCount, setPendingChallengeCount] = useState(0);
  const [shopRequest, setShopRequest] = useState<{ tab: "featured" | "inventory"; id: number }>({ tab: "featured", id: 0 });
  const [room, setRoom] = useState<Room | null>(null);
  const [locale, setLocale] = useState<"en" | "bg">("en");
  const [localeReady, setLocaleReady] = useState(false);
  const [combatImagesReady, setCombatImagesReady] = useState(false);
  const [combatPreloadStarted, setCombatPreloadStarted] = useState(false);
  const [soundEffectsVolume, setSoundEffectsVolumeState] = useState(1);
  const [musicVolume, setMusicVolume] = useState(0.5);
  const [defaultPlayerName, setDefaultPlayerName] = useState("");
  const defaultPlayerNameRef = useRef("");
  defaultPlayerNameRef.current = defaultPlayerName;
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [guestPlayerId, setGuestPlayerId] = useState<string | null>(null);
  const [registeredAccount, setRegisteredAccount] = useState<AccountProfile | null>(null);
  const [authBusy, setAuthBusy] = useState(false);
  const [linkedProviders, setLinkedProviders] = useState<string[]>([]);
  const [stars, setStars] = useState(0);
  const [starGain, setStarGain] = useState<{ id: number; amount: number } | null>(null);
  const [incomingChallenge, setIncomingChallenge] = useState<PlayerChallenge | null>(null);
  const [challengeSentNotice, setChallengeSentNotice] = useState<{ id: number; playerName: string; damageWager: number } | null>(null);
  const challengeOpacity = useRef(new Animated.Value(0)).current;
  const challengeSentOpacity = useRef(new Animated.Value(0)).current;
  const handledChallengeIds = useRef(new Set<string>());
  const dismissedChallengePopupIds = useRef(new Set<string>());
  const joiningChallengeId = useRef<string | null>(null);
  const [dailyRewardCelebration, setDailyRewardCelebration] = useState<{ id: number; amount: number; streakDay: number } | null>(null);
  const [dailyReward, setDailyReward] = useState<DailyRewardStatus | null>(null);
  const [dailyRewardClaiming, setDailyRewardClaiming] = useState(false);
  const [hapticsEnabled, setHapticsEnabled] = useState(true);
  const [highContrastEnabled, setHighContrastEnabled] = useState(false);
  const [roomRecovery, setRoomRecovery] = useState<RoomRecoveryState | null>(null);
  const [roomRecoveryMessage, setRoomRecoveryMessage] = useState<string | null>(null);
  const intentionalLeaveRef = useRef(false);
  const reconnectionTokenRef = useRef<string | null>(null);
  const intentionalSignOutRef = useRef(false);

  const refreshNotificationCounts = React.useCallback(async () => {
    if (!hasEnteredApp || !registeredAccount || !deviceId || nav === "in-room") return;
    const readNewsKey = `${NEWS_READ_STORAGE_PREFIX}:${deviceId}:${locale}`;
    const [friendsResult, newsResult, savedReadIds] = await Promise.all([
      getFriends(deviceId).catch(() => null),
      getNews(locale).catch(() => null),
      AsyncStorage.getItem(readNewsKey).catch(() => null),
    ]);
    if (friendsResult) setFriendRequestCount(friendsResult.incoming.length);
    if (newsResult) {
      let readIds = new Set<string>();
      try {
        const parsed = savedReadIds ? JSON.parse(savedReadIds) : [];
        if (Array.isArray(parsed)) readIds = new Set(parsed.filter((id): id is string => typeof id === "string"));
      } catch {
        // Invalid local read history should make current posts appear unread.
      }
      setUnreadNewsCount(newsResult.filter((post) => !readIds.has(post.id)).length);
    }
  }, [deviceId, hasEnteredApp, locale, nav, registeredAccount]);

  useEffect(() => {
    if (!hasEnteredApp || !registeredAccount || !deviceId || nav === "in-room") return;
    void refreshNotificationCounts();
    const interval = setInterval(() => void refreshNotificationCounts(), 15_000);
    return () => clearInterval(interval);
  }, [deviceId, hasEnteredApp, nav, refreshNotificationCounts, registeredAccount]);

  const handleNewsViewed = React.useCallback(async (posts: NewsPost[]) => {
    if (!deviceId) return;
    const postIds = posts.map((post) => post.id);
    const key = `${NEWS_READ_STORAGE_PREFIX}:${deviceId}:${locale}`;
    let readIds = new Set<string>();
    try {
      const saved = await AsyncStorage.getItem(key);
      const parsed = saved ? JSON.parse(saved) : [];
      if (Array.isArray(parsed)) readIds = new Set(parsed.filter((id): id is string => typeof id === "string"));
    } catch {
      // Replace invalid local read history.
    }
    const newlyReadCount = postIds.filter((id) => !readIds.has(id)).length;
    postIds.forEach((id) => readIds.add(id));
    setUnreadNewsCount((count) => Math.max(0, count - newlyReadCount));
    await AsyncStorage.setItem(key, JSON.stringify([...readIds])).catch(() => undefined);
  }, [deviceId, locale]);

  useEffect(() => {
    if (Platform.OS !== "android") return;

    const applyAndroidSystemBars = () => {
      void (async () => {
        await NavigationBar.setVisibilityAsync("hidden");
      })().catch(() => {
        // Some Android gesture-navigation modes do not expose bar visibility.
      });
    };

    applyAndroidSystemBars();
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") applyAndroidSystemBars();
    });
    const keyboardSubscription = Keyboard.addListener("keyboardDidHide", applyAndroidSystemBars);
    return () => { subscription.remove(); keyboardSubscription.remove(); };
  }, [nav]);

  useEffect(() => subscribeToAuthChanges(() => {
    if (intentionalSignOutRef.current || !registeredAccount) return;
    void createFreshGuestIdentity().then((guest) => {
      setGuestPlayerId(guest.deviceId); setDeviceId(guest.deviceId); setDefaultPlayerName(guest.displayName); setRegisteredAccount(null); setStars(0);
      setHasEnteredApp(false); setNav("startup"); setStartupState("idle");
      showFeedback(i18n.t("account.sessionExpired"), i18n.t("account.sessionExpiredMessage"), "info");
    });
  }), [registeredAccount]);

  useEffect(() => {
    let cancelled = false;

    async function loadLocale() {
      try {
        const [savedSfxVolume, savedMusicVolume, savedPlayerName, savedHaptics, savedHighContrast, storedDeviceId, storedGuestName] = await Promise.all([
          AsyncStorage.getItem(SFX_VOLUME_STORAGE_KEY),
          AsyncStorage.getItem(MUSIC_VOLUME_STORAGE_KEY),
          AsyncStorage.getItem(PLAYER_NAME_STORAGE_KEY),
          AsyncStorage.getItem(HAPTICS_STORAGE_KEY),
          AsyncStorage.getItem(HIGH_CONTRAST_STORAGE_KEY),
          getOrCreateDeviceId(),
          getOrCreateGuestName(),
        ]);
        const initialPlayerName = savedPlayerName?.trim() || storedGuestName;
        if (!cancelled) {
          setDefaultPlayerName(initialPlayerName);
          setDeviceId(storedDeviceId);
          setGuestPlayerId(storedDeviceId);
          setHapticsEnabled(savedHaptics !== "false");
          setHighContrastEnabled(savedHighContrast === "true");
        }
        if (!savedPlayerName?.trim()) void AsyncStorage.setItem(PLAYER_NAME_STORAGE_KEY, initialPlayerName);
        void getPlayerStars(storedDeviceId).then((storedStars) => {
          if (!cancelled && storedStars !== null) setStars(storedStars);
        });
        void getDailyRewardStatus(storedDeviceId).then((status) => {
          if (!cancelled && status) {
            setDailyReward(status);
            setStars(status.stars);
          }
        });
        if (!cancelled) {
          setLocale("en");
          await i18n.changeLanguage("en");
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
    void getPlayerStars(storedDeviceId).then((storedStars) => {
      if (storedStars !== null) setStars(storedStars);
    });
    return storedDeviceId;
  }

  const applyAuthenticatedSession = React.useCallback(async (guestId: string, accessToken: string) => {
    const account = await linkPlayerAccount(guestId, defaultPlayerNameRef.current, accessToken);
    if (!account) throw new Error(i18n.t("account.linkFailed"));
    setDeviceId(account.playerId);
    const profile = await getAccountProfile(account.playerId);
    setRegisteredAccount(profile);
    if (account.displayName) setDefaultPlayerName(account.displayName);
    const accountStars = await getPlayerStars(account.playerId);
    if (accountStars !== null) setStars(accountStars);
  }, []);

  useEffect(() => {
    if (!guestPlayerId) return;
    if (!authConfigured) {
      setSessionReady(true);
      return;
    }
    let cancelled = false;
    setSessionReady(false);
    void getStoredSession().then(async (session) => {
      if (!session || cancelled) return;
      try {
        await applyAuthenticatedSession(guestPlayerId, session.access_token);
      } catch (error) {
        if (!cancelled) setStartupError(error instanceof Error ? error.message : i18n.t("network.unknownError"));
      }
    }).finally(() => { if (!cancelled) setSessionReady(true); });
    return () => { cancelled = true; };
  }, [applyAuthenticatedSession, guestPlayerId]);

  const runStartupChecks = React.useCallback(async (enterHome: boolean) => {
    if (SERVER_CONFIGURATION_ERROR) {
      setStartupError(SERVER_CONFIGURATION_ERROR);
      return;
    }
    if (!registeredAccount || !deviceId) {
      setStartupError(i18n.t("startup.accountRequired"));
      return;
    }
    setStartupState("loading");
    setStartupStage(enterHome ? "assets" : "connecting");
    setStartupError(null);
    try {
      const startedAt = Date.now();
      const serverRequest = Promise.all([
        getAccountProfile(deviceId),
        getPlayerStars(deviceId),
        getDailyRewardStatus(deviceId),
      ]).then(
        ([profile, storedStars, rewardStatus]) => ({ profile, storedStars, rewardStatus, error: null as unknown }),
        (error: unknown) => ({ profile: null, storedStars: null, rewardStatus: null, error }),
      );
      if (enterHome) {
        setStartupStage("connecting");
      }
      const { profile, storedStars, rewardStatus, error } = await serverRequest;
      if (error) throw error;
      if (enterHome) {
        const remaining = Math.max(0, MINIMUM_STARTUP_CHECK_MS - (Date.now() - startedAt));
        if (remaining > 0) await new Promise<void>((resolve) => setTimeout(resolve, remaining));
      }
      if (!profile) throw new Error(i18n.t("startup.serverUnavailable"));
      if (storedStars === null || rewardStatus === null) throw new Error(i18n.t("startup.serverUnavailable"));
      setRegisteredAccount(profile);
      setDefaultPlayerName(profile.displayName);
      setStars(rewardStatus.stars ?? storedStars);
      setDailyReward(rewardStatus);
      setStartupState("idle");
      setStartupStage(null);
      if (enterHome) {
        setHasEnteredApp(true);
        setNav("home");
      }
    } catch (error) {
      setStartupState("error");
      setStartupStage(null);
      setStartupError(error instanceof Error ? error.message : i18n.t("startup.serverUnavailable"));
    }
  }, [deviceId, registeredAccount]);

  useEffect(() => {
    if (nav !== "in-room" || combatPreloadStarted) return;
    const interaction = InteractionManager.runAfterInteractions(() => {
      setCombatPreloadStarted(true);
    });
    return () => interaction.cancel();
  }, [combatPreloadStarted, nav]);

  async function handleRepairClient() {
    setStartupState("loading");
    setStartupError(null);
    intentionalLeaveRef.current = true;
    stopAllSoundEffects();
    await room?.leave().catch(() => undefined);
    setRoom(null);
    reconnectionTokenRef.current = null;
    setRoomRecovery(null);
    setRoomRecoveryMessage(null);
    await AsyncStorage.removeItem(RECENT_QUESTIONS_STORAGE_KEY).catch(() => undefined);
    intentionalLeaveRef.current = false;
    await runStartupChecks(false);
  }

  function confirmExternalNavigation(url: string) {
    showDialog({
      title: i18n.t("startup.leaveGameTitle"),
      message: i18n.t("startup.leaveGameMessage"),
      cancelLabel: i18n.t("startup.stayInGame"),
      confirmLabel: i18n.t("startup.continueOutside"),
      onConfirm: () => void Linking.openURL(url).catch(() => {
        showFeedback(i18n.t("startup.externalOpenFailed"));
      }),
    });
  }

  async function handleSocialSignIn(provider: "google" | "apple") {
    if (!authConfigured) {
      showFeedback(i18n.t("account.configurationTitle"), i18n.t("account.configurationRequired"));
      return;
    }
    if (!guestPlayerId || authBusy) return;
    setAuthBusy(true);
    try {
      const session = provider === "apple" ? await signInWithApple() : await signInWithSocialProvider(provider);
      await applyAuthenticatedSession(guestPlayerId, session.access_token);
    } catch (error) {
      if (error instanceof Error && error.message === "auth_cancelled") return;
      showFeedback(i18n.t("account.signInFailed"), error instanceof Error ? error.message : i18n.t("network.unknownError"));
    } finally {
      setAuthBusy(false);
    }
  }

  const refreshLinkedProviders = React.useCallback(async () => {
    if (!registeredAccount) {
      setLinkedProviders([]);
      return;
    }
    try {
      setLinkedProviders(await getLinkedProviders());
    } catch {
      setLinkedProviders(registeredAccount.provider ? [registeredAccount.provider] : []);
    }
  }, [registeredAccount]);

  useEffect(() => { void refreshLinkedProviders(); }, [refreshLinkedProviders]);

  async function handleLinkIdentity(provider: "google" | "apple") {
    if (!registeredAccount || authBusy || linkedProviders.includes(provider)) return;
    setAuthBusy(true);
    try {
      if (provider === "apple") await linkAppleIdentity();
      else await linkGoogleIdentity();
      await refreshLinkedProviders();
      showFeedback(i18n.t("account.identityLinkedTitle"), i18n.t("account.identityLinked", { provider: provider === "apple" ? "Apple" : "Google" }), "success");
    } catch (error) {
      if (error instanceof Error && error.message === "auth_cancelled") return;
      showFeedback(i18n.t("account.identityLinkFailed"), error instanceof Error ? error.message : i18n.t("network.unknownError"));
    } finally {
      setAuthBusy(false);
    }
  }

  async function handleAccountName(displayName: string) {
    if (!registeredAccount || authBusy) return;
    if (isOffensivePlayerName(displayName)) {
      showFeedback(i18n.t("account.offensiveNameTitle"), i18n.t("account.offensiveName"));
      return;
    }
    const previousAccount = registeredAccount;
    const previousName = defaultPlayerName;
    setAuthBusy(true);
    setRegisteredAccount({ ...registeredAccount, displayName });
    setDefaultPlayerName(displayName);
    void AsyncStorage.setItem(PLAYER_NAME_STORAGE_KEY, displayName);
    try {
      const profile = await updateAccountName(registeredAccount.playerId, displayName);
      setRegisteredAccount(profile); setDefaultPlayerName(profile.displayName);
      void AsyncStorage.setItem(PLAYER_NAME_STORAGE_KEY, profile.displayName);
      showFeedback(i18n.t("account.nameUpdated"), undefined, "success");
    } catch (error) {
      setRegisteredAccount(previousAccount);
      setDefaultPlayerName(previousName);
      void AsyncStorage.setItem(PLAYER_NAME_STORAGE_KEY, previousName);
      showFeedback(i18n.t("account.nameUpdateFailed"), error instanceof Error ? error.message : i18n.t("network.unknownError"));
    }
    finally { setAuthBusy(false); }
  }

  function handleSignOut() {
    showDialog({ title: i18n.t("account.signOut"), message: i18n.t("account.signOutConfirm"), cancelLabel: i18n.t("validation.cancel"), confirmLabel: i18n.t("account.signOut"), destructive: true, onConfirm: () => void (async () => {
        setAuthBusy(true);
        try {
          intentionalSignOutRef.current = true;
          await signOutAccount();
          const guest = await createFreshGuestIdentity();
          setGuestPlayerId(guest.deviceId); setDeviceId(guest.deviceId); setDefaultPlayerName(guest.displayName); setRegisteredAccount(null); setStars(0);
          setHasEnteredApp(false); setNav("startup"); setStartupState("idle"); setStartupError(null);
        } finally { intentionalSignOutRef.current = false; setAuthBusy(false); }
      })() });
  }

  function handleDeleteAccount() {
    if (!registeredAccount) return;
    showDialog({ title: i18n.t("account.deleteAccount"), message: i18n.t("account.deleteAccountConfirm"), cancelLabel: i18n.t("validation.cancel"), confirmLabel: i18n.t("account.deleteForever"), destructive: true, onConfirm: () => void (async () => {
      setAuthBusy(true);
      try {
        await deleteAccount(registeredAccount.playerId);
        intentionalSignOutRef.current = true;
        await signOutAccount();
        const guest = await createFreshGuestIdentity();
        setGuestPlayerId(guest.deviceId); setDeviceId(guest.deviceId); setDefaultPlayerName(guest.displayName); setRegisteredAccount(null); setStars(0); setHasEnteredApp(false); setNav("startup"); setStartupState("idle"); setStartupError(null);
        showFeedback(i18n.t("account.accountDeleted"), undefined, "success");
      } catch (error) {
        showFeedback(i18n.t("account.deleteFailed"), error instanceof Error ? error.message : i18n.t("feedback.tryAgain"));
      } finally { intentionalSignOutRef.current = false; setAuthBusy(false); }
    })() });
  }

  function openRegisteredFeature(destination: "shop" | "ranked" | "friends", open: () => void) {
    if (registeredAccount) {
      open();
      return;
    }
    showDialog({ title: i18n.t("account.signInRequired"), message: i18n.t(`account.${destination}RequiresAccount`), cancelLabel: i18n.t("validation.cancel"), confirmLabel: i18n.t("account.signIn"), onConfirm: () => setNav("profile") });
  }

  async function handleCreate(name: string, rounds: number, gameMode: "classic" | "friends" | "ranked" | "damage", visibility: "private" | "public", damageWager: number, friendsOptions?: { teamMode: "ffa" | "duos"; categories: string[]; customQuestions: Array<{ question: string; answer: string }> }) {
    const currentDeviceId = await requireDeviceId();
    let recentQuestionIds: string[] = [];
    try {
      const saved = await AsyncStorage.getItem(RECENT_QUESTIONS_STORAGE_KEY);
      const parsed = saved ? JSON.parse(saved) : [];
      if (Array.isArray(parsed)) recentQuestionIds = parsed.filter((id): id is string => typeof id === "string");
    } catch {
      // A corrupt local history should never prevent room creation.
    }
    const r = await createRoom(currentDeviceId, name, rounds, locale, gameMode, recentQuestionIds, visibility, damageWager, undefined, friendsOptions);
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

  function openShop(tab: "featured" | "inventory") {
    setShopRequest((current) => ({ tab, id: current.id + 1 }));
    setNav("shop");
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

  function handleHapticsEnabled(enabled: boolean) {
    setHapticsEnabled(enabled);
    void AsyncStorage.setItem(HAPTICS_STORAGE_KEY, String(enabled));
  }

  function handleHighContrastEnabled(enabled: boolean) {
    setHighContrastEnabled(enabled);
    void AsyncStorage.setItem(HIGH_CONTRAST_STORAGE_KEY, String(enabled));
  }

  async function handleClaimDailyReward() {
    if (dailyRewardClaiming || !dailyReward?.available) return;
    const previousReward = dailyReward;
    const previousStars = stars;
    const optimisticAmount = dailyReward.amount;
    const optimisticClaim = {
      ...dailyReward,
      available: false,
      stars: stars + optimisticAmount,
      nextClaimAt: new Date(Date.now() + 24 * 60 * 60 * 1_000).toISOString(),
    };
    setDailyRewardClaiming(true);
    setDailyReward(optimisticClaim);
    setStars(optimisticClaim.stars);
    const optimisticCelebrationId = Date.now();
    setStarGain({ id: optimisticCelebrationId, amount: optimisticAmount });
    setDailyRewardCelebration({ id: optimisticCelebrationId, amount: optimisticAmount, streakDay: dailyReward.streakDay });
    try {
      const currentDeviceId = await requireDeviceId();
      const status = await claimDailyReward(currentDeviceId, defaultPlayerName);
      if (!status) {
        setDailyReward(previousReward);
        setStars(previousStars);
        showFeedback(i18n.t("feedback.actionFailed"), i18n.t("feedback.tryAgain"));
        return;
      }
      setDailyReward(status);
      setStars(status.stars);
    } catch (error) {
      setDailyReward(previousReward);
      setStars(previousStars);
      showFeedback(i18n.t("feedback.actionFailed"), error instanceof Error ? error.message : i18n.t("feedback.tryAgain"));
    } finally {
      setDailyRewardClaiming(false);
    }
  }

  useEffect(() => {
    if (!deviceId || !dailyReward || dailyReward.available) return;
    const refreshDelay = Math.max(1_000, new Date(dailyReward.nextClaimAt).getTime() - Date.now() + 500);
    const timeout = setTimeout(() => {
      void getDailyRewardStatus(deviceId).then((status) => {
        if (status) {
          setDailyReward(status);
          setStars(status.stars);
        }
      });
    }, Math.min(refreshDelay, 2_147_483_647));
    return () => clearTimeout(timeout);
  }, [dailyReward?.available, dailyReward?.nextClaimAt, deviceId]);

  useEffect(() => {
    if (!localeReady) return;
    if (nav === "in-room") stopMenuMusic();
    else startMenuMusic();
  }, [localeReady, nav]);

  // The match result is persisted asynchronously. Refresh a few times after
  // returning home so the currency badge always catches the completed award,
  // including when the player exits the results screen immediately.
  useEffect(() => {
    if (nav === "in-room" || !deviceId) return;

    let cancelled = false;
    const timeoutIds: Array<ReturnType<typeof setTimeout>> = [];
    const refresh = () => {
      void getPlayerStars(deviceId).then((storedStars) => {
        if (!cancelled && storedStars !== null) setStars(storedStars);
      });
      void getDailyRewardStatus(deviceId).then((status) => {
        if (!cancelled && status) {
          setDailyReward(status);
          setStars(status.stars);
        }
      });
    };

    refresh();
    timeoutIds.push(setTimeout(refresh, 750));
    timeoutIds.push(setTimeout(refresh, 2000));
    return () => {
      cancelled = true;
      timeoutIds.forEach(clearTimeout);
    };
  }, [deviceId, nav]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active") {
        if (nav !== "in-room") startMenuMusic();
        if (deviceId) {
          void getDailyRewardStatus(deviceId).then((status) => {
            if (status) {
              setDailyReward(status);
              setStars(status.stars);
            }
          });
        }
      } else {
        pauseMusicForBackground();
      }
    });
    return () => subscription.remove();
  }, [deviceId, nav]);

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

  useEffect(() => {
    if (!hasEnteredApp || !registeredAccount || !deviceId) {
      setIncomingChallenge(null);
      setPendingChallengeCount(0);
      return;
    }
    if (nav === "in-room") {
      setIncomingChallenge(null);
      void updatePresence(deviceId, false).catch(() => undefined);
      return;
    }
    let cancelled = false;
    let polling = false;
    const poll = async () => {
      if (polling) return;
      polling = true;
      try {
        await updatePresence(deviceId, true);
        const challenges = await getChallenges(deviceId);
        if (cancelled) return;
        const pendingChallenges = challenges.filter((challenge) => challenge.status === "pending" && challenge.challengedId === deviceId);
        const incoming = pendingChallenges.find((challenge) => !dismissedChallengePopupIds.current.has(challenge.id)) ?? null;
        setIncomingChallenge(incoming);
        setPendingChallengeCount(pendingChallenges.length);
        const accepted = challenges.find((challenge) => challenge.status === "accepted" && !handledChallengeIds.current.has(challenge.id));
        if (accepted) await enterChallengeLobby(accepted);
      } catch {
        // Presence polling recovers automatically on the next interval.
      } finally {
        polling = false;
      }
    };
    void poll();
    const interval = setInterval(() => void poll(), 2_000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [defaultPlayerName, deviceId, hasEnteredApp, nav, registeredAccount]);

  async function enterChallengeLobby(challenge: PlayerChallenge) {
    if (!deviceId || nav === "in-room" || joiningChallengeId.current === challenge.id || handledChallengeIds.current.has(challenge.id)) return;
    joiningChallengeId.current = challenge.id;
    try {
      const challengeRoom = await createRoom(deviceId, defaultPlayerName, 10, locale, "damage", [], "private", challenge.damageWager, challenge.id);
      handledChallengeIds.current.add(challenge.id);
      reconnectionTokenRef.current = challengeRoom.reconnectionToken;
      setRoom(challengeRoom);
      setRoomRecovery(null);
      setRoomRecoveryMessage(null);
      setIncomingChallenge(null);
      setPendingChallengeCount((count) => Math.max(0, count - 1));
      setNav("in-room");
    } catch (error) {
      showFeedback(i18n.t("friends.challengeFailed"), error instanceof Error ? error.message : i18n.t("feedback.tryAgain"));
    } finally {
      joiningChallengeId.current = null;
    }
  }

  useEffect(() => {
    if (!incomingChallenge || !deviceId) {
      challengeOpacity.setValue(0);
      return;
    }
    challengeOpacity.setValue(1);
    const animation = Animated.sequence([
      Animated.delay(2_600),
      Animated.timing(challengeOpacity, { toValue: 0, duration: 400, useNativeDriver: true }),
    ]);
    animation.start(({ finished }) => {
      if (finished) {
        // Hide the notice only. The challenge stays actionable in Inbox until
        // the server's one-minute expiry, and polling must not show it again.
        dismissedChallengePopupIds.current.add(incomingChallenge.id);
        setIncomingChallenge((current) => current?.id === incomingChallenge.id ? null : current);
      }
    });
    return () => animation.stop();
  }, [challengeOpacity, deviceId, incomingChallenge?.id]);

  useEffect(() => {
    if (!challengeSentNotice) return;
    challengeSentOpacity.setValue(1);
    const animation = Animated.sequence([
      Animated.delay(2_200),
      Animated.timing(challengeSentOpacity, { toValue: 0, duration: 350, useNativeDriver: true }),
    ]);
    animation.start(({ finished }) => { if (finished) setChallengeSentNotice(null); });
    return () => animation.stop();
  }, [challengeSentNotice?.id, challengeSentOpacity]);

  const starsBadgeWidth = Math.max(88, 70 + String(Math.max(0, stars)).length * 10);
  const settingsButtonRight = 18 + starsBadgeWidth + 8;
  const rulesButtonRight = settingsButtonRight + 48;

  configureMenuHaptics(hapticsEnabled, nav !== "in-room");

  return (
    <AppFrame highContrast={highContrastEnabled}>
      {combatPreloadStarted && !combatImagesReady ? <AssetPreloader sources={COMBAT_PRELOAD_IMAGES} onReady={() => setCombatImagesReady(true)} /> : null}
      <StatusBar style="light" hidden={Platform.OS === "android"} animated />
      {nav === "startup" ? (
        <StartupScreen
          accountName={registeredAccount?.displayName ?? defaultPlayerName}
          accountConnected={Boolean(registeredAccount)}
          sessionReady={sessionReady && localeReady}
          state={startupState}
          stage={startupStage}
          error={startupError}
          onStart={() => void runStartupChecks(true)}
          onRepair={() => showDialog({
            title: i18n.t("startup.repairConfirmTitle"),
            message: i18n.t("startup.repairConfirmMessage"),
            cancelLabel: i18n.t("validation.cancel"),
            confirmLabel: i18n.t("startup.repairConfirm"),
            onConfirm: () => void handleRepairClient(),
          })}
          onCommunity={() => confirmExternalNavigation(COMMUNITY_URL)}
          onLegal={() => confirmExternalNavigation(LEGAL_URL)}
          onAccount={() => setNav("profile")}
        />
      ) : null}
      {hasEnteredApp && nav !== "in-room" ? <View pointerEvents={nav === "home" ? "auto" : "none"} style={[styles.persistentScreen, nav !== "home" && styles.persistentScreenHidden]}>
        <HomeScreen
          onCreate={() => {
            if (!defaultPlayerName.trim()) {
              showDialog({ title: i18n.t("validation.playerNameRequiredTitle"), message: i18n.t("validation.playerNameRequiredMessage"), cancelLabel: i18n.t("validation.cancel"), confirmLabel: i18n.t("validation.setPlayerName"), onConfirm: () => setNav("profile") });
              return;
            }
            setNav("create");
          }}
          onJoin={() => setNav("join")}
          onProfile={() => setNav("profile")}
          onFriends={() => openRegisteredFeature("friends", () => setNav("friends"))}
          onInbox={() => setInboxOpen(true)}
          friendRequestCount={friendRequestCount}
          unreadInboxCount={unreadNewsCount + pendingChallengeCount}
          onInventory={() => openRegisteredFeature("shop", () => openShop("inventory"))}
          deviceId={deviceId}
          onRanked={() => openRegisteredFeature("ranked", () => setNav("ranked"))}
          onShop={() => openRegisteredFeature("shop", () => openShop("featured"))}
          dailyReward={dailyReward}
          dailyRewardClaiming={dailyRewardClaiming}
          dailyRewardCelebration={dailyRewardCelebration}
          onDailyRewardCelebrationShown={() => setDailyRewardCelebration(null)}
          onClaimDailyReward={() => void handleClaimDailyReward()}
        />
      </View> : null}
      {hasEnteredApp && deviceId && nav !== "in-room" ? (
        <View pointerEvents={nav === "shop" ? "auto" : "none"} style={[styles.persistentScreen, nav !== "shop" && styles.persistentScreenHidden]}>
          <ShopScreen deviceId={deviceId} displayName={defaultPlayerName} stars={stars} onStarsChange={setStars} requestedTab={shopRequest.tab} requestId={shopRequest.id} onBack={() => setNav("home")} />
        </View>
      ) : null}
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
          onStarsChange={setStars}
        />
      ) : (
        <>
          {nav === "create" && deviceId ? <CreateGameScreen onCreate={handleCreate} locale={locale} deviceId={deviceId} stars={stars} registered={Boolean(registeredAccount)} onSignInRequired={() => setNav("profile")} initialName={defaultPlayerName} onBack={() => setNav("home")} /> : null}
          {nav === "join" && <JoinGameScreen onJoin={handleJoin} onJoinPublic={handleJoinPublic} initialName={defaultPlayerName} onBack={() => setNav("home")} />}
          {nav === "ranked" && deviceId ? (
            <RankedScreen
              deviceId={deviceId}
              onBack={() => setNav("home")}
            />
          ) : null}
          {nav === "settings" && (
            <SettingsScreen
              soundEffectsVolume={soundEffectsVolume}
              musicVolume={musicVolume}
              hapticsEnabled={hapticsEnabled}
              highContrastEnabled={highContrastEnabled}
              onChangeSoundEffectsVolume={handleSoundEffectsVolume}
              onChangeMusicVolume={handleMusicVolume}
              onChangeHapticsEnabled={handleHapticsEnabled}
              onChangeHighContrastEnabled={handleHighContrastEnabled}
              playerId={deviceId}
              registered={Boolean(registeredAccount)}
              onStarsChange={setStars}
              onFeedback={showFeedback}
              onBack={() => setNav("home")}
            />
          )}
          {nav === "rules" && <RulesScreen onBack={() => setNav("home")} />}
          {nav === "friends" && deviceId ? <FriendsScreen playerId={deviceId} stars={stars} onStarsChange={setStars} onRequestCountChange={setFriendRequestCount} onChallengeSent={(playerName, damageWager) => setChallengeSentNotice({ id: Date.now(), playerName, damageWager })} onBack={() => setNav("home")} /> : null}
          {nav === "profile" && (
            <ProfileScreen
              displayName={defaultPlayerName}
              registered={Boolean(registeredAccount)}
              provider={registeredAccount?.provider ?? null}
              linkedProviders={linkedProviders}
              profile={registeredAccount}
              busy={authBusy}
              authAvailable={authConfigured}
              onGoogle={() => void handleSocialSignIn("google")}
              onApple={() => void handleSocialSignIn("apple")}
              onLinkGoogle={() => void handleLinkIdentity("google")}
              onLinkApple={() => void handleLinkIdentity("apple")}
              onSaveName={(name) => void handleAccountName(name)}
              onSignOut={handleSignOut}
              onDeleteAccount={handleDeleteAccount}
              onBack={() => setNav(hasEnteredApp ? "home" : "startup")}
            />
          )}
        </>
      )}
      {nav === "home" ? (
        <>
          <Pressable accessibilityRole="button" accessibilityLabel={i18n.t("home.ruleBook")} onPress={() => { menuTap(); setNav("rules"); }} style={({ pressed }) => [styles.homeSettingsButton, styles.homeRulesButton, { right: rulesButtonRight }, pressed && styles.homeSettingsButtonPressed]}>
            <FontAwesome5 name="book" solid size={19} color={theme.text} style={styles.homeRulesIcon} />
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel={i18n.t("home.settings")} onPress={() => { menuTap(); setNav("settings"); }} style={({ pressed }) => [styles.homeSettingsButton, { right: settingsButtonRight }, pressed && styles.homeSettingsButtonPressed]}>
            <Text style={styles.homeSettingsIcon}>{"\u2699"}</Text>
          </Pressable>
        </>
      ) : null}
      {nav === "home" && inboxOpen ? <InboxScreen playerId={deviceId} initialCategory={pendingChallengeCount > 0 ? "challenges" : "news"} onPostsViewed={handleNewsViewed} onChallengeCountChange={setPendingChallengeCount} onAcceptChallenge={(challenge) => { dismissedChallengePopupIds.current.add(challenge.id); setInboxOpen(false); setIncomingChallenge(null); void enterChallengeLobby(challenge); }} onBack={() => setInboxOpen(false)} /> : null}
      {incomingChallenge && deviceId && !inboxOpen ? (
        <Animated.View style={[styles.challengePopup, { opacity: challengeOpacity }]}>
          <Text style={styles.challengePopupTitle}>{i18n.t("friends.challengeIncoming", { player: incomingChallenge.challengerName })}</Text>
          <Text style={styles.challengePopupMode}>{i18n.t("friends.challengeMode", { wager: incomingChallenge.damageWager })}</Text>
          <View style={styles.challengePopupActions}>
            <Pressable accessibilityRole="button" accessibilityLabel={`${i18n.t("friends.decline")}: ${incomingChallenge.challengerName}`} onPress={() => { const challenge = incomingChallenge; dismissedChallengePopupIds.current.add(challenge.id); setIncomingChallenge(null); void respondChallenge(deviceId, challenge.id, "decline").catch(() => undefined); }} style={[styles.challengePopupButton, styles.challengeDecline]}><Text style={styles.challengePopupButtonText}>{i18n.t("friends.decline")}</Text></Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel={`${i18n.t("friends.accept")}: ${incomingChallenge.challengerName}`} onPress={() => { const challenge = incomingChallenge; dismissedChallengePopupIds.current.add(challenge.id); setIncomingChallenge(null); void (async () => { try { await respondChallenge(deviceId, challenge.id, "accept"); await enterChallengeLobby({ ...challenge, status: "accepted" }); } catch (error) { showFeedback(i18n.t("friends.challengeFailed"), error instanceof Error ? error.message : i18n.t("feedback.tryAgain")); } })(); }} style={styles.challengePopupButton}><Text style={styles.challengePopupButtonText}>{i18n.t("friends.accept")}</Text></Pressable>
          </View>
        </Animated.View>
      ) : null}
      {challengeSentNotice && !incomingChallenge ? (
        <Animated.View pointerEvents="none" style={[styles.challengePopup, { opacity: challengeSentOpacity }]}>
          <Text style={styles.challengePopupTitle}>{i18n.t("friends.challengeSent", { player: challengeSentNotice.playerName })}</Text>
          <Text style={styles.challengePopupMode}>{i18n.t("friends.challengeMode", { wager: challengeSentNotice.damageWager })}</Text>
        </Animated.View>
      ) : null}
      <FeedbackPopup notice={appNotice} onDismiss={clearFeedback} />
      <GameDialog dialog={appDialog} onCancel={dismissDialog} onConfirm={confirmDialog} />
      <View
        pointerEvents={hasEnteredApp && nav !== "in-room" ? "box-none" : "none"}
        style={[styles.starsPersistentLayer, (!hasEnteredApp || nav === "in-room") && styles.persistentScreenHidden]}
      >
        <StarsBadge stars={stars} gain={starGain} width={starsBadgeWidth} onPress={() => openRegisteredFeature("shop", () => openShop("featured"))} />
      </View>
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
  onStarsChange,
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
  onStarsChange: (stars: number) => void;
}) {
  useKeepAwake();
  const { t } = i18n;
  const state = useRoomState<any>(room);
  const [gameMenuPanel, setGameMenuPanel] = useState<"menu" | "settings" | null>(null);
  const previousPhaseRef = useRef<string | null>(null);

  useEffect(() => {
    const playerStars = state?.players?.get(room.sessionId)?.stars;
    if (typeof playerStars === "number") onStarsChange(playerStars);
  }, [onStarsChange, room.sessionId, state?.players?.get(room.sessionId)?.stars]);

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
        return <LobbyScreen room={room} state={state} mySessionId={room.sessionId} />;
      case "question":
        return <QuestionScreen room={room} state={state} />;
      case "confidence":
        return <ConfidenceScreen room={room} state={state} />;
      case "board_sidebet":
        return <ConfidenceBoardScreen room={room} state={state} mySessionId={room.sessionId} />;
      case "reveal":
        return <RevealScreen room={room} state={state} />;
      case "final_results":
        return <FinalResultsScreen room={room} state={state} onExit={onExit} />;
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
            <View style={styles.gameMenuTopAccent} />
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
            <View style={styles.gameMenuDivider} />
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
  persistentScreen: { ...StyleSheet.absoluteFillObject, opacity: 1 },
  // Opacity alone leaves hidden screens in Android's layout and composition
  // work. Preserve their React state while removing their native view trees.
  persistentScreenHidden: Platform.OS === "android" ? { display: "none", opacity: 0 } : { opacity: 0 },
  starsPersistentLayer: { ...StyleSheet.absoluteFillObject, zIndex: 20 },
  combatPreloader: { position: "absolute", left: 0, top: 0, width: 192, height: 192, opacity: 0.001, overflow: "hidden" },
  combatPreloadImage: { position: "absolute", width: 192, height: 192 },
  starsHud: {
    position: "absolute",
    top: 18,
    right: 18,
    zIndex: 20,
    alignItems: "center",
  },
  pointsBadgePressed: { opacity: 0.76, transform: [{ scale: 0.97 }] },
  homeSettingsButton: {
    position: "absolute",
    top: 18,
    right: 142,
    zIndex: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(31, 26, 51, 0.92)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.10)",
  },
  homeSettingsButtonPressed: { opacity: 0.7, transform: [{ scale: 0.96 }] },
  homeRulesButton: { right: 190 },
  homeRulesIcon: { transform: [{ rotate: "-12deg" }] },
  homeSettingsIcon: { color: theme.text, fontSize: 24, lineHeight: 27, fontWeight: "800" },
  challengePopup: { position: "absolute", top: 68, right: 18, zIndex: 60, width: 270, borderRadius: 13, padding: 12, backgroundColor: "rgba(31,26,51,0.98)", borderWidth: 1, borderColor: "rgba(185,176,214,0.5)", shadowColor: "#000", shadowOpacity: 0.35, shadowRadius: 8, elevation: 8 },
  challengePopupTitle: { color: theme.text, fontSize: 13, fontWeight: "900" },
  challengePopupMode: { color: "#B9AAFF", fontSize: 10, fontWeight: "800", marginTop: 3 },
  challengePopupActions: { flexDirection: "row", justifyContent: "flex-end", gap: 7, marginTop: 10 },
  challengePopupButton: { minWidth: 78, paddingHorizontal: 12, paddingVertical: 7, alignItems: "center", borderRadius: 8, backgroundColor: theme.primary },
  challengeDecline: { backgroundColor: "rgba(112,103,135,0.8)" },
  challengePopupButtonText: { color: "#FFF", fontSize: 11, fontWeight: "900" },
  pointsBadge: {
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
    textAlign: "center",
  },
  starGainText: {
    color: "#F7D85B",
    fontSize: 13,
    fontWeight: "900",
    marginTop: 3,
  },
  menuButton: {
    position: "absolute",
    top: 18,
    right: 18,
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
    backgroundColor: "rgba(22, 17, 39, 0.98)",
    borderWidth: 2,
    borderColor: "rgba(124, 92, 255, 0.72)",
    borderRadius: 16,
    paddingTop: 18,
    shadowColor: "#7C5CFF",
    shadowOpacity: 0.34,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 5 },
    elevation: 12,
    overflow: "hidden",
  },
  settingsModalCard: { maxWidth: 540, paddingVertical: 16, paddingHorizontal: 20 },
  gameMenuTopAccent: { position: "absolute", top: 0, left: "22%", right: "22%", height: 3, borderBottomLeftRadius: 4, borderBottomRightRadius: 4, backgroundColor: "#A982FF" },
  gameMenuDivider: { alignSelf: "center", width: "76%", height: 1, marginTop: 9, marginBottom: 7, backgroundColor: "rgba(185,176,214,0.22)" },
  gameMenuCloseButton: {
    position: "absolute",
    top: 12,
    right: 14,
    zIndex: 2,
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
  },
  gameMenuCloseText: { color: theme.text, fontSize: 16, lineHeight: 19, fontWeight: "900" },
  gameMenuActions: { width: "100%", alignItems: "center", marginTop: 3, paddingBottom: 2 },
  gameMenuButton: { width: 280, minWidth: 0, marginTop: 8 },
  inGameSettings: { width: "100%", maxWidth: 500, alignSelf: "center", marginTop: 0, paddingHorizontal: 6 },
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
