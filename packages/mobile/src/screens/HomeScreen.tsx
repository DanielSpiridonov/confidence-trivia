import React from "react";
import { View, StyleSheet, Text } from "react-native";
import { useTranslation } from "react-i18next";
import { ANDROID_MENU_UI_SCALE, Screen, Title, Subtitle, BigButton } from "../components/ui";

export function HomeScreen({
  onCreate,
  onJoin,
  onSettings,
  dailyReward,
  dailyRewardClaiming,
  onClaimDailyReward,
}: {
  onCreate: () => void;
  onJoin: () => void;
  onSettings: () => void;
  dailyReward: { available: boolean; amount: number } | null;
  dailyRewardClaiming: boolean;
  onClaimDailyReward: () => void;
}) {
  const { t } = useTranslation();
  return (
    <Screen androidScale={ANDROID_MENU_UI_SCALE}>
      <Title>🔥 {t("home.title")}</Title>
      <Subtitle>{t("home.tagline")}</Subtitle>
      <View style={styles.actions}>
        <BigButton label={t("home.createGame")} onPress={onCreate} />
        <BigButton label={t("home.joinGame")} onPress={onJoin} variant="secondary" />
        <BigButton label={t("home.settings")} onPress={onSettings} variant="secondary" />
        {dailyReward ? (
          <View style={styles.dailyReward}>
            <BigButton
              label={dailyReward.available
                ? t("home.claimDailyReward", { count: dailyReward.amount })
                : t("home.dailyRewardClaimed")}
              onPress={onClaimDailyReward}
              variant="secondary"
              disabled={!dailyReward.available || dailyRewardClaiming}
            />
            {!dailyReward.available ? <Text style={styles.dailyHint}>{t("home.dailyRewardTomorrow")}</Text> : null}
          </View>
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  actions: {
    width: "100%",
    maxWidth: 420,
    alignSelf: "center",
  },
  dailyReward: { width: "100%", marginTop: 5 },
  dailyHint: { color: "rgba(244, 240, 255, 0.68)", fontSize: 12, textAlign: "center", marginTop: 3 },
});
