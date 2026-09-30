import React from "react";
import { ActivityIndicator, Image, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";
import { ANDROID_MENU_UI_SCALE, BigButton, Screen, theme } from "../components/ui";

const EMBLEM = require("../../assets/emblem-logo-android.png");

export type StartupState = "idle" | "loading" | "error";

export function StartupScreen({
  accountName,
  accountConnected,
  sessionReady,
  state,
  stage,
  error,
  onStart,
  onRepair,
  onCommunity,
  onLegal,
  onAccount,
}: {
  accountName: string;
  accountConnected: boolean;
  sessionReady: boolean;
  state: StartupState;
  stage: "assets" | "connecting" | null;
  error: string | null;
  onStart: () => void;
  onRepair: () => void;
  onCommunity: () => void;
  onLegal: () => void;
  onAccount: () => void;
}) {
  const { t } = useTranslation();
  const loading = state === "loading" || !sessionReady;
  const canStart = accountConnected && sessionReady && !loading;
  const loadingLabel = stage === "assets"
    ? t("startup.loadingAssets")
    : stage === "connecting"
      ? t("startup.connecting")
      : t("startup.loading");

  return (
    <Screen style={styles.screen} androidScale={ANDROID_MENU_UI_SCALE}>
      <View style={styles.utilities}>
        <UtilityButton icon="build-outline" label={t("startup.repair")} onPress={onRepair} disabled={loading} />
        <UtilityButton
          icon="logo-discord"
          label={t("startup.community")}
          onPress={onCommunity}
          disabled={loading}
        />
        <UtilityButton
          icon="document-text-outline"
          label={t("startup.legal")}
          onPress={onLegal}
          disabled={loading}
        />
        <UtilityButton icon="person-circle-outline" label={t("startup.account")} onPress={onAccount} disabled={loading} />
      </View>

      <View style={styles.main}>
        <Image source={EMBLEM} defaultSource={EMBLEM} fadeDuration={0} resizeMode="contain" style={styles.emblem} />
        <Text style={styles.title}>CONFIVIA</Text>
        <BigButton
          label={loading ? loadingLabel : t("startup.start")}
          onPress={onStart}
          disabled={!canStart}
          style={styles.startButton}
          textStyle={styles.startButtonText}
        />
        {loading ? <ActivityIndicator color={theme.primary} size="small" style={styles.loadingStatus} /> : null}
        {!accountConnected && sessionReady ? <Text style={styles.hint}>{t("startup.connectHint")}</Text> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </View>
      <View style={[styles.accountStatus, accountConnected && styles.accountStatusConnected]}>
        <View style={[styles.statusDot, accountConnected && styles.statusDotConnected]} />
        <Text numberOfLines={1} style={styles.accountText}>
          {accountConnected ? t("startup.connectedAs", { name: accountName }) : t("startup.accountRequired")}
        </Text>
      </View>
    </Screen>
  );
}

function UtilityButton({ icon, label, onPress, disabled }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.utilityButton, disabled && styles.disabled, pressed && !disabled && styles.pressed]}
    >
      <Ionicons name={icon} size={Platform.OS === "android" ? 21 : 17} color={theme.text} style={styles.utilityIcon} />
      <Text numberOfLines={1} style={styles.utilityText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { justifyContent: "center" },
  utilities: { position: "absolute", left: 18, top: 14, width: Platform.OS === "android" ? 174 : 142, gap: Platform.OS === "android" ? 8 : 6 },
  utilityButton: { minHeight: Platform.OS === "android" ? 43 : 34, flexDirection: "row", alignItems: "center", paddingHorizontal: Platform.OS === "android" ? 13 : 10, borderRadius: 6, backgroundColor: "rgba(31,26,51,.88)", borderWidth: 1, borderColor: "rgba(185,176,214,.25)" },
  utilityIcon: { width: Platform.OS === "android" ? 29 : 23 },
  utilityText: { flex: 1, color: theme.text, fontSize: Platform.OS === "android" ? 12 : 10, fontWeight: "800" },
  main: { width: "100%", alignItems: "center", justifyContent: "center" },
  emblem: { width: 106, height: 106 },
  title: { color: theme.text, fontSize: 25, fontWeight: "900", marginTop: -4 },
  accountStatus: { position: "absolute", right: 18, bottom: 14, maxWidth: 310, minHeight: 28, flexDirection: "row", alignItems: "center", paddingHorizontal: 11, borderRadius: 6, backgroundColor: "rgba(255,92,122,.11)", borderWidth: 1, borderColor: "rgba(255,92,122,.38)" },
  accountStatusConnected: { backgroundColor: "rgba(124,255,160,.09)", borderColor: "rgba(124,255,160,.32)" },
  statusDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: theme.danger, marginRight: 7 },
  statusDotConnected: { backgroundColor: "#7CFFA0" },
  accountText: { flexShrink: 1, color: theme.text, fontSize: 10, fontWeight: "800" },
  startButton: { width: 230, minHeight: 48, marginTop: 12 },
  startButtonText: { fontSize: 17 },
  loadingStatus: { minHeight: 22, marginTop: 7 },
  hint: { color: theme.textDim, fontSize: 10, fontWeight: "700", marginTop: 8 },
  error: { maxWidth: 420, color: "#FF9B9B", fontSize: 10, fontWeight: "700", textAlign: "center", marginTop: 7 },
  disabled: { opacity: .42 },
  pressed: { opacity: .75 },
});
