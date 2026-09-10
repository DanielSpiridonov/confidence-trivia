import React from "react";
import { Animated, Image, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { ANDROID_MENU_UI_SCALE, Screen, Title, BigButton } from "../components/ui";
import { PointsIcon } from "../components/PointsIcon";
import { getPlayerCustomization } from "../network/client";

const DAILY_REWARD_PLATFORM_IMAGE: number = require("../../assets/popup-platform.png");
const DAILY_REWARD_PRESENT_IMAGE: number = require("../../assets/stars-gift.png");
const CLAIMED_REWARD_PRESENT_IMAGE: number = require("../../assets/ui-thumbnails/gift-opened.png");
const RANKED_TROPHY_IMAGE: number = require("../../assets/ui-thumbnails/trophy.png");
const SHOP_IMAGE: number = require("../../assets/ui-thumbnails/shop.png");
const INVENTORY_MENU_IMAGE: number = require("../../assets/inventory-icon.png");
const FRIENDS_MENU_IMAGE: number = require("../../assets/friends-icon.png");
const NEWS_MENU_IMAGE: number = require("../../assets/news-icon.png");
const DEFAULT_AVATAR_HEAD_IMAGE: number = require("../../assets/avatar-heads/smart-owl.png");
const AVATAR_HEAD_IMAGES: Record<string, number> = {
  smart_owl: DEFAULT_AVATAR_HEAD_IMAGE,
  clever_fox: require("../../assets/avatar-heads/fox.png"),
  quiz_bot: require("../../assets/avatar-heads/quiz-bot.png"),
  omniscient_avatar: require("../../assets/avatar-heads/omniscient.png"),
  trivia_wizard: require("../../assets/avatar-heads/trivia-wizard.png"),
  detective_avatar: require("../../assets/avatar-heads/detective.png"),
  living_globe: require("../../assets/avatar-heads/globe.png"),
};
const REWARD_STAGES = [10, 20, 30, 50, 75] as const;
const SIDEBAR_ITEM_WIDTH = 82;
const SIDEBAR_ITEM_HEIGHT = 91;

function HomePopup({ label, amount, streakLabel, claimed, claimedLabel, countdown, platformImage, featureImage, disabled, onPress }: {
  label: string;
  amount: number;
  streakLabel: string;
  claimed: boolean;
  claimedLabel: string;
  countdown?: string;
  platformImage?: number;
  featureImage?: number;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label}, ${amount}`}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.popup, disabled && !claimed && styles.popupDisabled, pressed && !disabled && styles.popupPressed]}
    >
      <View style={styles.popupArtwork}>
        {platformImage ? <Image source={platformImage} defaultSource={platformImage} fadeDuration={0} resizeMode="contain" style={[styles.popupPlatformImage, claimed && styles.popupPlatformClaimed]} /> : null}
        {featureImage ? (
          <Image source={featureImage} defaultSource={featureImage} fadeDuration={0} resizeMode="contain" style={[styles.popupFeatureImage, claimed && styles.popupFeatureClaimed]} />
        ) : (
          <View style={styles.popupFeatureFallback}><PointsIcon size={38} /></View>
        )}
        <Text style={styles.popupStreakLabel}>{streakLabel}</Text>
        {claimed && countdown ? <Text style={styles.popupCountdown}>{countdown}</Text> : null}
      </View>
      <Text numberOfLines={1} style={[styles.popupLabel, claimed && styles.popupTextClaimed]}>{label}</Text>
      <Text style={[styles.popupAmount, claimed && styles.popupTextClaimed]}>{claimed ? claimedLabel : `+${amount}`}</Text>
    </Pressable>
  );
}

export function HomeScreen({
  onCreate,
  onJoin,
  onProfile,
  onFriends,
  onNews,
  onInventory,
  deviceId,
  onRanked,
  onShop,
  dailyReward,
  dailyRewardClaiming,
  dailyRewardCelebration,
  onDailyRewardCelebrationShown,
  onClaimDailyReward,
}: {
  onCreate: () => void;
  onJoin: () => void;
  onProfile: () => void;
  onFriends: () => void;
  onNews: () => void;
  onInventory: () => void;
  deviceId: string | null;
  onRanked: () => void;
  onShop: () => void;
  dailyReward: { available: boolean; amount: number; streakDay: number; nextClaimAt: string } | null;
  dailyRewardClaiming: boolean;
  dailyRewardCelebration: { id: number; amount: number; streakDay: number } | null;
  onDailyRewardCelebrationShown: () => void;
  onClaimDailyReward: () => void;
}) {
  const { t } = useTranslation();
  const [now, setNow] = React.useState(Date.now());
  const [showCelebration, setShowCelebration] = React.useState(false);
  const [activeCelebration, setActiveCelebration] = React.useState(dailyRewardCelebration);
  const [avatarHead, setAvatarHead] = React.useState<number>(DEFAULT_AVATAR_HEAD_IMAGE);
  const [menuOpen, setMenuOpen] = React.useState(false);
  const celebrationOpacity = React.useRef(new Animated.Value(0)).current;
  const celebrationScale = React.useRef(new Animated.Value(0.94)).current;
  const menuProgress = React.useRef(new Animated.Value(0)).current;
  const isAndroid = Platform.OS === "android";

  function toggleMenu() {
    const nextOpen = !menuOpen;
    setMenuOpen(nextOpen);
    menuProgress.stopAnimation();
    if (isAndroid) {
      Animated.timing(menuProgress, { toValue: nextOpen ? 1 : 0, duration: 120, useNativeDriver: true }).start();
      return;
    }
    Animated.spring(menuProgress, { toValue: nextOpen ? 1 : 0, damping: 18, stiffness: 220, mass: 0.7, useNativeDriver: true }).start();
  }

  function openFromMenu(action: () => void) {
    setMenuOpen(false);
    menuProgress.setValue(0);
    action();
  }

  React.useEffect(() => {
    if (!deviceId) return;
    void getPlayerCustomization(deviceId).then((customization) => {
      if (customization) {
        setAvatarHead(AVATAR_HEAD_IMAGES[customization.avatarId] ?? DEFAULT_AVATAR_HEAD_IMAGE);
      }
    });
  }, [deviceId]);

  React.useEffect(() => {
    if (!dailyReward || dailyReward.available) return;
    setNow(Date.now());
    const interval = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(interval);
  }, [dailyReward?.available, dailyReward?.nextClaimAt]);

  const closeCelebration = React.useCallback(() => {
    Animated.parallel([
      Animated.timing(celebrationOpacity, { toValue: 0, duration: 180, useNativeDriver: true }),
      Animated.timing(celebrationScale, { toValue: 0.97, duration: 180, useNativeDriver: true }),
    ]).start(() => setShowCelebration(false));
  }, [celebrationOpacity, celebrationScale]);

  const openCelebration = React.useCallback((celebration: { id: number; amount: number; streakDay: number }) => {
    setActiveCelebration(celebration);
    setShowCelebration(true);
    celebrationOpacity.setValue(0);
    celebrationScale.setValue(0.94);
    Animated.parallel([
      Animated.timing(celebrationOpacity, { toValue: 1, duration: 220, useNativeDriver: true }),
      Animated.spring(celebrationScale, { toValue: 1, damping: 15, stiffness: 180, useNativeDriver: true }),
    ]).start();
  }, [celebrationOpacity, celebrationScale]);

  React.useEffect(() => {
    if (!dailyRewardCelebration) return;
    openCelebration(dailyRewardCelebration);
    onDailyRewardCelebrationShown();
  }, [dailyRewardCelebration?.id, onDailyRewardCelebrationShown, openCelebration]);

  React.useEffect(() => {
    if (!showCelebration || !activeCelebration) return;
    const timeout = setTimeout(closeCelebration, 5_000);
    return () => clearTimeout(timeout);
  }, [activeCelebration?.id, closeCelebration, showCelebration]);

  const remainingSeconds = dailyReward
    ? Math.max(0, Math.ceil((new Date(dailyReward.nextClaimAt).getTime() - now) / 1_000))
    : 0;
  const countdown = [
    Math.floor(remainingSeconds / 3_600),
    Math.floor((remainingSeconds % 3_600) / 60),
    remainingSeconds % 60,
  ].map((value) => String(value).padStart(2, "0")).join(":");
  return (
    <Screen androidScale={ANDROID_MENU_UI_SCALE * 1.21} androidOverflowScale={1.1}>
      <View style={styles.popupRail}>
        {dailyReward ? (
          <HomePopup
            label={t("home.dailyReward")}
            amount={dailyReward.amount}
            streakLabel={t("home.rewardDay", { count: dailyReward.streakDay })}
            claimed={!dailyReward.available}
            claimedLabel={t("home.claimed")}
            countdown={countdown}
            featureImage={dailyReward.available ? DAILY_REWARD_PRESENT_IMAGE : CLAIMED_REWARD_PRESENT_IMAGE}
            disabled={dailyRewardClaiming}
            onPress={() => {
              if (dailyReward.available) {
                onClaimDailyReward();
              } else {
                openCelebration({ id: Date.now(), amount: dailyReward.amount, streakDay: dailyReward.streakDay });
              }
            }}
          />
        ) : null}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("ranked.shortTitle")}
          onPress={onRanked}
          style={({ pressed }) => [styles.popup, pressed && styles.popupPressed]}
        >
          <View style={styles.popupArtwork}>
            <Image source={DAILY_REWARD_PLATFORM_IMAGE} defaultSource={DAILY_REWARD_PLATFORM_IMAGE} fadeDuration={0} resizeMode="contain" style={styles.popupPlatformImage} />
            <Image source={RANKED_TROPHY_IMAGE} defaultSource={RANKED_TROPHY_IMAGE} fadeDuration={0} resizeMode="contain" style={styles.rankedTrophyImage} />
          </View>
          <Text numberOfLines={1} style={styles.popupLabel}>{t("ranked.shortTitle")}</Text>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={t("shop.title")} onPress={onShop} style={({ pressed }) => [styles.popup, pressed && styles.popupPressed]}>
          <View style={styles.popupArtwork}>
            <Image source={SHOP_IMAGE} defaultSource={SHOP_IMAGE} fadeDuration={0} resizeMode="contain" style={styles.shopFeatureImage} />
          </View>
          <Text numberOfLines={1} style={styles.popupLabel}>{t("shop.shortTitle")}</Text>
        </Pressable>
      </View>
      <View style={styles.mainActionsBlock}>
        <Title>🔥 {t("home.title")}</Title>
        <View style={styles.actions}>
          <BigButton label={t("home.createGame")} onPress={onCreate} style={styles.homePlayButton} textStyle={styles.homePlayButtonText} />
          <BigButton label={t("home.joinGame")} onPress={onJoin} variant="secondary" style={styles.homePlayButton} textStyle={styles.homePlayButtonText} />
        </View>
      </View>
      <View style={styles.homeMenuDock}>
        <Animated.View pointerEvents={menuOpen ? "auto" : "none"} style={[styles.homeMenuItems, { opacity: menuProgress, transform: isAndroid
          ? [{ translateX: menuProgress.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) }]
          : [{ translateX: menuProgress.interpolate({ inputRange: [0, 1], outputRange: [44, 0] }) }, { scale: menuProgress.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] }) }]
        }]}>
          <Pressable accessibilityRole="button" accessibilityLabel={t("news.title")} onPress={() => openFromMenu(onNews)} style={({ pressed }) => [styles.menuItemButton, pressed && styles.profileButtonPressed]}><Image source={NEWS_MENU_IMAGE} defaultSource={NEWS_MENU_IMAGE} fadeDuration={0} resizeMode="contain" style={styles.menuItemIcon} /><Text numberOfLines={1} style={styles.profileLabel}>{t("news.shortTitle")}</Text></Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel={t("home.friends")} onPress={() => openFromMenu(onFriends)} style={({ pressed }) => [styles.menuItemButton, pressed && styles.profileButtonPressed]}><Image source={FRIENDS_MENU_IMAGE} defaultSource={FRIENDS_MENU_IMAGE} fadeDuration={0} resizeMode="contain" style={styles.menuItemIcon} /><Text numberOfLines={1} style={styles.profileLabel}>{t("home.friends")}</Text></Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel={t("shop.tabs.inventory")} onPress={() => openFromMenu(onInventory)} style={({ pressed }) => [styles.menuItemButton, pressed && styles.profileButtonPressed]}><Image source={INVENTORY_MENU_IMAGE} defaultSource={INVENTORY_MENU_IMAGE} fadeDuration={0} resizeMode="contain" style={styles.menuItemIcon} /><Text numberOfLines={1} style={styles.profileLabel}>{t("shop.tabs.inventory")}</Text></Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel={t("home.profile")} onPress={() => openFromMenu(onProfile)} style={({ pressed }) => [styles.menuItemButton, pressed && styles.profileButtonPressed]}><Image source={avatarHead} defaultSource={avatarHead} fadeDuration={0} resizeMode="contain" style={styles.profileAvatar} /><Text numberOfLines={1} style={styles.profileLabel}>{t("home.profile")}</Text></Pressable>
        </Animated.View>
        <Pressable accessibilityRole="button" accessibilityLabel={t("home.menu")} accessibilityState={{ expanded: menuOpen }} onPress={toggleMenu} style={({ pressed }) => [styles.hamburgerButton, pressed && styles.profileButtonPressed]}>
          <Animated.View style={isAndroid ? undefined : { transform: [{ rotate: menuProgress.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "90deg"] }) }] }}><Text style={styles.hamburgerIcon}>{menuOpen ? "×" : "☰"}</Text></Animated.View>
        </Pressable>
      </View>
      {showCelebration && activeCelebration ? (
        <View style={styles.celebrationBackdrop}>
          <Animated.View style={[styles.celebrationPanel, { opacity: celebrationOpacity, transform: [{ scale: celebrationScale }] }]}>
            <Pressable accessibilityRole="button" accessibilityLabel={t("common.close")} hitSlop={10} onPress={closeCelebration} style={styles.celebrationClose}>
              <Text style={styles.celebrationCloseText}>X</Text>
            </Pressable>
            <Text style={styles.celebrationTitle}>{t("home.rewardUnlocked")}</Text>
            <Text style={styles.celebrationEarned}>+{activeCelebration.amount} {t("home.stars")}</Text>
            <View style={styles.rewardTrack}>
              <View style={styles.rewardTrackLine} />
              {REWARD_STAGES.map((amount, index) => {
                const day = index + 1;
                const current = day === activeCelebration.streakDay;
                const completed = day <= activeCelebration.streakDay;
                return (
                  <View key={day} style={styles.rewardStage}>
                    <Text style={[styles.rewardDay, completed && styles.rewardDayCompleted, current && styles.rewardDayCurrent]}>{t("home.rewardDay", { count: day })}</Text>
                    <View style={[styles.rewardNode, completed && styles.rewardNodeCompleted, current && styles.rewardNodeCurrent]}>
                      <PointsIcon size={current ? 27 : 22} color={current ? "#F7D85B" : completed ? "#B5A5FF" : "#777184"} />
                    </View>
                    <Text style={[styles.rewardAmount, completed && styles.rewardAmountCompleted, current && styles.rewardAmountCurrent]}>+{amount}</Text>
                  </View>
                );
              })}
            </View>
          </Animated.View>
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  mainActionsBlock: Platform.OS === "android" ? { width: "100%", alignItems: "center", transform: [{ translateY: -24 }] } : { width: "100%", alignItems: "center" },
  actions: {
    width: "100%",
    maxWidth: Platform.OS === "android" ? 460 : 420,
    alignSelf: "center",
  },
  homePlayButton: Platform.OS === "android" ? { maxWidth: 430, minHeight: 52, paddingVertical: 12, marginTop: 7 } : {},
  homePlayButtonText: Platform.OS === "android" ? { paddingHorizontal: 5, fontSize: 16 } : {},
  homeMenuDock: { position: "absolute", right: Platform.OS === "android" ? 34 : 8, bottom: Platform.OS === "android" ? 26 : 4, height: 44, zIndex: 12 },
  homeMenuItems: { position: "absolute", right: 72, bottom: 0, height: 44, flexDirection: "row", gap: 6 },
  menuItemButton: { minWidth: 106, height: 44, paddingHorizontal: 10, borderRadius: 14, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, borderWidth: 2, borderColor: "#A982FF", backgroundColor: "rgba(42,25,72,0.97)", shadowColor: "#7C5CFF", shadowOpacity: 0.42, shadowRadius: 5, shadowOffset: { width: 0, height: 2 }, elevation: 5 },
  hamburgerButton: { width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: "#7C5CFF", backgroundColor: "rgba(12,9,23,0.96)" },
  hamburgerIcon: { color: "#B9AAFF", fontSize: 27, lineHeight: 30, fontWeight: "900" },
  menuItemIcon: { width: 32, height: 32 },
  profileButtonPressed: { opacity: 0.72, transform: [{ scale: 0.97 }] },
  profileAvatar: { width: 34, height: 34 },
  profileLabel: { color: "#7C5CFF", fontSize: 14, fontWeight: "800", flexShrink: 0 },
  popupRail: { position: "absolute", left: Platform.OS === "android" ? 24 : 1, top: Platform.OS === "android" ? 20 : 38, bottom: Platform.OS === "android" ? 20 : 12, width: SIDEBAR_ITEM_WIDTH, justifyContent: Platform.OS === "android" ? "center" : "flex-start", gap: 3, zIndex: 5 },
  popup: { width: SIDEBAR_ITEM_WIDTH, height: SIDEBAR_ITEM_HEIGHT, alignItems: "center", justifyContent: "flex-end", paddingBottom: 2 },
  popupDisabled: { opacity: 0.55 },
  popupPressed: { transform: [{ scale: 0.96 }] },
  popupArtwork: { width: 80, height: 61, position: "relative", alignItems: "center", justifyContent: "flex-end" },
  popupPlatformImage: { position: "absolute", bottom: 1, width: 80, height: 20 },
  popupFeatureImage: { position: "absolute", width: 50, height: 50, bottom: 10 },
  popupPlatformClaimed: { bottom: 0, height: 28 },
  popupFeatureClaimed: { width: 53, height: 53, bottom: 8 },
  popupStreakLabel: { position: "absolute", top: 0, zIndex: 2, color: "#FFFFFF", fontSize: 8, fontWeight: "900", textShadowColor: "#000000", textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 },
  popupCountdown: { position: "absolute", top: 24, zIndex: 2, color: "#FFFFFF", fontSize: 9, fontWeight: "900", textShadowColor: "#000000", textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 },
  popupFeatureFallback: { position: "absolute", width: 68, height: 68, bottom: 18, alignItems: "center", justifyContent: "center" },
  popupLabel: { color: "#FFFFFF", fontSize: 9, fontWeight: "800", textAlign: "center", width: "100%" },
  popupAmount: { color: "#F7D85B", fontSize: 10, fontWeight: "900", textAlign: "center" },
  popupTextClaimed: { color: "rgba(255, 255, 255, 0.68)" },
  rankedTrophyImage: { position: "absolute", width: 55, height: 53, bottom: 9 },
  shopFeatureImage: { position: "absolute", width: 57, height: 57, bottom: 5 },
  celebrationBackdrop: { ...StyleSheet.absoluteFillObject, zIndex: 30, alignItems: "center", justifyContent: "center" },
  celebrationPanel: { width: "78%", maxWidth: 620, minHeight: 204, borderRadius: 8, backgroundColor: "rgba(31, 26, 51, 0.98)", borderWidth: 1, borderColor: "rgba(181, 165, 255, 0.35)", paddingHorizontal: 28, paddingVertical: 18, alignItems: "center" },
  celebrationClose: { position: "absolute", top: 8, right: 10, zIndex: 2, width: 30, height: 30, alignItems: "center", justifyContent: "center" },
  celebrationCloseText: { color: "#B9B0D6", fontSize: 17, fontWeight: "900" },
  celebrationTitle: { color: "#FFFFFF", fontSize: 20, fontWeight: "900" },
  celebrationEarned: { color: "#F7D85B", fontSize: 16, fontWeight: "900", marginTop: 2 },
  rewardTrack: { width: "100%", flexDirection: "row", justifyContent: "space-between", marginTop: 20, position: "relative" },
  rewardTrackLine: { position: "absolute", left: "10%", right: "10%", top: 37, height: 3, backgroundColor: "rgba(124, 92, 255, 0.34)" },
  rewardStage: { width: "18%", alignItems: "center", zIndex: 1 },
  rewardDay: { color: "#777184", fontSize: 10, fontWeight: "800", marginBottom: 5 },
  rewardDayCompleted: { color: "#B5A5FF" },
  rewardDayCurrent: { color: "#F7D85B" },
  rewardNode: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center", backgroundColor: "#292438", borderWidth: 2, borderColor: "#504A5E" },
  rewardNodeCompleted: { borderColor: "#7C5CFF", backgroundColor: "#342A59" },
  rewardNodeCurrent: { width: 48, height: 48, borderRadius: 24, marginTop: -3, marginBottom: -3, borderColor: "#F7D85B", backgroundColor: "#3C3355" },
  rewardAmount: { color: "#777184", fontSize: 11, fontWeight: "900", marginTop: 5 },
  rewardAmountCompleted: { color: "#B5A5FF" },
  rewardAmountCurrent: { color: "#F7D85B" },
});
