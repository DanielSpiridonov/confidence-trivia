import React from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { ANDROID_MENU_UI_SCALE, BackIconButton, Screen, Title, theme } from "../components/ui";

export function ProfileScreen({ displayName, registered, provider, busy, authAvailable, onGoogle, onApple, onBack }: {
  displayName: string;
  registered: boolean;
  provider: string | null;
  busy: boolean;
  authAvailable: boolean;
  onGoogle: () => void;
  onApple: () => void;
  onBack: () => void;
}) {
  const { t } = useTranslation();
  return (
    <Screen style={styles.screen} androidScale={ANDROID_MENU_UI_SCALE}>
      <BackIconButton label={t("common.back")} onPress={onBack} disabled={busy} />
      <Title>{t("account.title")}</Title>
      <View style={styles.card}>
        <Text style={styles.name}>{displayName}</Text>
        <Text style={styles.status}>{registered ? t("account.signedInWith", { provider: provider ?? t("account.socialAccount") }) : t("account.guest")}</Text>
        {!registered ? <Text style={styles.explanation}>{t("account.guestLimits")}</Text> : null}
        {!authAvailable ? <Text style={styles.warning}>{t("account.configurationRequired")}</Text> : null}
        {busy ? <ActivityIndicator color={theme.primary} /> : registered ? (
          <Text style={styles.linked}>{t("account.progressProtected")}</Text>
        ) : (
          <View style={styles.actions}>
            <Pressable onPress={onGoogle} style={styles.button}><Text style={styles.buttonText}>{t("account.google")}</Text></Pressable>
            <Pressable onPress={onApple} style={[styles.button, styles.appleButton]}><Text style={styles.buttonText}>{t("account.apple")}</Text></Pressable>
          </View>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { justifyContent: "flex-start", paddingTop: 12 },
  card: { width: "72%", maxWidth: 560, alignSelf: "center", marginTop: 20, padding: 20, borderRadius: 16, alignItems: "center", backgroundColor: "rgba(31,26,51,0.92)", borderWidth: 1, borderColor: "rgba(185,176,214,0.24)" },
  name: { color: theme.text, fontSize: 24, fontWeight: "900" },
  status: { color: "#7CFFA0", fontSize: 12, fontWeight: "800", marginTop: 4 },
  explanation: { color: theme.textDim, fontSize: 12, textAlign: "center", marginTop: 12, lineHeight: 18 },
  warning: { color: "#F7D85B", fontSize: 11, textAlign: "center", marginTop: 10 },
  linked: { color: theme.textDim, fontSize: 12, textAlign: "center", marginTop: 16 },
  actions: { width: "100%", gap: 10, marginTop: 16 },
  button: { minHeight: 44, alignItems: "center", justifyContent: "center", borderRadius: 10, backgroundColor: "#4285F4" },
  appleButton: { backgroundColor: "#050505", borderWidth: 1, borderColor: "rgba(255,255,255,0.35)" },
  buttonText: { color: "#FFFFFF", fontSize: 14, fontWeight: "900" },
});
