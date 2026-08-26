import React from "react";
import { View, StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";
import { Screen, Title, Subtitle, BigButton } from "../components/ui";

export function HomeScreen({
  onCreate,
  onJoin,
  onSettings,
}: {
  onCreate: () => void;
  onJoin: () => void;
  onSettings: () => void;
}) {
  const { t } = useTranslation();
  return (
    <Screen>
      <Title>🔥 {t("home.title")}</Title>
      <Subtitle>{t("home.tagline")}</Subtitle>
      <View style={styles.actions}>
        <BigButton label={t("home.createGame")} onPress={onCreate} />
        <BigButton label={t("home.joinGame")} onPress={onJoin} variant="secondary" />
        <BigButton label={t("home.settings")} onPress={onSettings} variant="secondary" />
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
});
