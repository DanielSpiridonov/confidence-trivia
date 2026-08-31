import React from "react";
import { Animated, Image, ImageSourcePropType, Pressable, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { ANDROID_MENU_UI_SCALE, Screen, Title, BigButton } from "../components/ui";
import { PointsIcon } from "../components/PointsIcon";
import { getPlayerCustomization } from "../network/client";

const DAILY_REWARD_PLATFORM_IMAGE: ImageSourcePropType = require("../../assets/popup-platform.png");
const DAILY_REWARD_PRESENT_IMAGE: ImageSourcePropType = require("../../assets/stars-gift.png");
const CLAIMED_REWARD_PRESENT_IMAGE: ImageSourcePropType = require("../../assets/ui-thumbnails/gift-opened.png");
const RANKED_TROPHY_IMAGE: ImageSourcePropType = require("../../assets/ui-thumbnails/trophy.png");
const DEFAULT_AVATAR_HEAD_IMAGE: ImageSourcePropType = require("../../assets/avatar-heads/smart-owl.png");
const AVATAR_HEAD_IMAGES: Record<string, ImageSourcePropType> = {
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
  platformImage?: ImageSourcePropType;
  featureImage?: ImageSourcePropType;
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
        {platformImage ? <Image source={platformImage} fadeDuration={0} resizeMode="contain" style={[styles.popupPlatformImage, claimed && styles.popupPlatformClaimed]} /> : null}
        {featureImage ? (
          <Image source={featureImage} fadeDuration={0} resizeMode="contain" style={[styles.popupFeatureImage, claimed && styles.popupFeatureClaimed]} />
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
  const [avatarHead, setAvatarHead] = React.useState<ImageSourcePropType>(DEFAULT_AVATAR_HEAD_IMAGE);
  const celebrationOpacity = React.useRef(new Animated.Value(0)).current;
  const celebrationScale = React.useRef(new Animated.Value(0.94)).current;

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
    <Screen androidScale={ANDROID_MENU_UI_SCALE}>
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
            <Image source={DAILY_REWARD_PLATFORM_IMAGE} fadeDuration={0} resizeMode="contain" style={styles.popupPlatformImage} />
            <Image source={RANKED_TROPHY_IMAGE} fadeDuration={0} resizeMode="contain" style={styles.rankedTrophyImage} />
          </View>
          <Text numberOfLines={1} style={styles.popupLabel}>{t("ranked.shortTitle")}</Text>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={t("shop.title")} onPress={onShop} style={({ pressed }) => [styles.popup, pressed && styles.popupPressed]}>
          <View style={styles.popupArtwork}>
            <Text style={styles.shopIcon}>🛍️</Text>
          </View>
          <Text numberOfLines={1} style={styles.popupLabel}>{t("shop.shortTitle")}</Text>
        </Pressable>
      </View>
      <Title>🔥 {t("home.title")}</Title>
      <View style={styles.actions}>
        <BigButton label={t("home.createGame")} onPress={onCreate} />
        <BigButton label={t("home.joinGame")} onPress={onJoin} variant="secondary" />
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel={t("home.profile")} onPress={onProfile} style={({ pressed }) => [styles.profileButton, pressed && styles.profileButtonPressed]}>
        <Image source={avatarHead} fadeDuration={0} resizeMode="contain" style={styles.profileAvatar} />
        <Text numberOfLines={1} style={styles.profileLabel}>{t("home.profile")}</Text>
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel={t("shop.tabs.inventory")} onPress={onInventory} style={({ pressed }) => [styles.profileButton, styles.inventoryButton, pressed && styles.profileButtonPressed]}>
        <Text style={styles.inventoryIcon}>▤</Text>
        <Text numberOfLines={1} style={styles.profileLabel}>{t("shop.tabs.inventory")}</Text>
      </Pressable>
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
  actions: {
    width: "100%",
    maxWidth: 420,
    alignSelf: "center",
  },
  profileButton: { position: "absolute", right: 8, bottom: 4, width: 126, height: 44, paddingHorizontal: 8, borderRadius: 14, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, borderWidth: 2, borderColor: "#7C5CFF", backgroundColor: "transparent" },
  inventoryButton: { right: 142 },
  inventoryIcon: { width: 30, color: "#7C5CFF", fontSize: 27, lineHeight: 31, fontWeight: "900", textAlign: "center" },
  profileButtonPressed: { opacity: 0.72, transform: [{ scale: 0.97 }] },
  profileAvatar: { width: 34, height: 34 },
  profileLabel: { color: "#7C5CFF", fontSize: 14, fontWeight: "800", flexShrink: 1 },
  popupRail: { position: "absolute", left: 1, top: 38, bottom: 12, width: SIDEBAR_ITEM_WIDTH, justifyContent: "flex-start", gap: 3, zIndex: 5 },
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
  shopIcon: { position: "absolute", bottom: 6, fontSize: 43 },
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
