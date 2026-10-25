import React from "react";
import { Pressable } from "../components/menuHaptics";
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { FontAwesome5 } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { ANDROID_COMPACT_MENU_UI_SCALE, BackIconButton, Screen, Title, BigButton, theme } from "../components/ui";
import { redeemPromoCode, submitPlayerReport } from "../network/client";
import { FeedbackKind } from "../components/FeedbackPopup";

type SettingsSection = "sounds" | "haptics" | "language" | "accessibility" | "redeem" | "report";

const SETTINGS_GROUPS = [
  { label: "audioAndFeel", sections: [{ id: "sounds", icon: "volume-up" }, { id: "haptics", icon: "mobile-alt" }] },
  { label: "preferences", sections: [{ id: "language", icon: "globe" }, { id: "accessibility", icon: "universal-access" }] },
  { label: "extrasAndSupport", sections: [{ id: "redeem", icon: "gift" }, { id: "report", icon: "flag" }] },
] as const;

function SettingsToggle({ label, value, onChange }: { label: string; value: boolean; onChange: (value: boolean) => void }) {
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      onPress={() => onChange(!value)}
      style={styles.toggleRow}
    >
      <Text style={styles.toggleLabel}>{label}</Text>
      <View style={[styles.toggleTrack, value && styles.toggleTrackEnabled]}>
        <View style={[styles.toggleThumb, value && styles.toggleThumbEnabled]} />
      </View>
    </Pressable>
  );
}

export function VolumeControl({
  label,
  value,
  hint,
  onChange,
}: {
  label: string;
  value: number;
  hint?: string;
  onChange: (value: number) => void;
}) {
  const touchAreaRef = React.useRef<View | null>(null);
  const trackMetricsRef = React.useRef<{ x: number; width: number } | null>(null);

  function updateFromPagePosition(pageX: number) {
    const metrics = trackMetricsRef.current;
    if (!metrics) return;
    const { x, width } = metrics;
    const nextValue = Math.min(1, Math.max(0, (pageX - x) / width));
    onChange(Math.round(nextValue * 100) / 100);
  }

  function measureAndUpdate(pageX: number) {
    touchAreaRef.current?.measureInWindow((x, _y, width) => {
      trackMetricsRef.current = { x, width: Math.max(1, width) };
      updateFromPagePosition(pageX);
    });
  }

  function measureTrack() {
    touchAreaRef.current?.measureInWindow((x, _y, width) => {
      trackMetricsRef.current = { x, width: Math.max(1, width) };
    });
  }

  return (
    <View style={styles.volumeControl}>
      <View style={styles.volumeHeader}>
        <Text style={styles.volumeLabel}>{label}</Text>
        <Text style={styles.volumeValue}>{Math.round(value * 100)}%</Text>
      </View>
      <View
        ref={touchAreaRef}
        collapsable={false}
        style={styles.volumeTouchArea}
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={label}
        accessibilityValue={{ min: 0, max: 100, now: Math.round(value * 100), text: `${Math.round(value * 100)}%` }}
        accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
        onAccessibilityAction={(event) => {
          const direction = event.nativeEvent.actionName === "increment" ? 0.1 : -0.1;
          onChange(Math.min(1, Math.max(0, value + direction)));
        }}
        onLayout={measureTrack}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderGrant={(event) => measureAndUpdate(event.nativeEvent.pageX)}
        onResponderMove={(event) => updateFromPagePosition(event.nativeEvent.pageX)}
      >
        <View style={styles.volumeTrack}>
          <View style={[styles.volumeFill, { width: `${value * 100}%` }]} />
          <View style={[styles.volumeThumb, { left: `${value * 100}%` }]} />
        </View>
      </View>
      {hint ? <Text style={styles.volumeHint}>{hint}</Text> : null}
    </View>
  );
}

export function SettingsScreen({
  soundEffectsVolume,
  musicVolume,
  hapticsEnabled,
  highContrastEnabled,
  onChangeSoundEffectsVolume,
  onChangeMusicVolume,
  onChangeHapticsEnabled,
  onChangeHighContrastEnabled,
  playerId,
  registered,
  onStarsChange,
  onFeedback,
  onBack,
}: {
  soundEffectsVolume: number;
  musicVolume: number;
  hapticsEnabled: boolean;
  highContrastEnabled: boolean;
  onChangeSoundEffectsVolume: (volume: number) => void;
  onChangeMusicVolume: (volume: number) => void;
  onChangeHapticsEnabled: (enabled: boolean) => void;
  onChangeHighContrastEnabled: (enabled: boolean) => void;
  playerId: string | null;
  registered: boolean;
  onStarsChange: (stars: number) => void;
  onFeedback: (title: string, message?: string, kind?: FeedbackKind) => void;
  onBack: () => void;
}) {
  const { t } = useTranslation();
  const [section, setSection] = React.useState<SettingsSection>("sounds");
  const [code, setCode] = React.useState("");
  const [redeeming, setRedeeming] = React.useState(false);
  const [redeemMessage, setRedeemMessage] = React.useState<{ ok: boolean; text: string } | null>(null);
  const [reportedName, setReportedName] = React.useState("");
  const [reportDescription, setReportDescription] = React.useState("");
  const [reporting, setReporting] = React.useState(false);

  async function handleReport() {
    const name = reportedName.trim();
    const description = reportDescription.trim();
    if (!playerId || !registered || reporting || name.length < 3 || description.length < 10) return;
    setReporting(true);
    try {
      await submitPlayerReport(playerId, name, description);
      setReportedName(""); setReportDescription("");
      onFeedback(t("settings.reportSuccessTitle"), t("settings.reportSuccess"), "success");
    } catch (error) {
      onFeedback(t("settings.reportFailed"), error instanceof Error ? error.message : t("feedback.tryAgain"));
    } finally { setReporting(false); }
  }

  async function handleRedeem() {
    if (!playerId || !registered || !code.trim() || redeeming) return;
    setRedeeming(true); setRedeemMessage(null);
    try {
      const result = await redeemPromoCode(playerId, code);
      onStarsChange(result.stars); setCode("");
      setRedeemMessage({ ok: true, text: t("settings.redeemSuccess", { count: result.reward }) });
    } catch (error) { setRedeemMessage({ ok: false, text: error instanceof Error ? error.message : t("feedback.tryAgain") }); }
    finally { setRedeeming(false); }
  }

  function renderPanel() {
    switch (section) {
      case "sounds":
        return (
          <View style={styles.panelContent}>
            <VolumeControl label={t("settings.soundEffects")} value={soundEffectsVolume} onChange={onChangeSoundEffectsVolume} />
            <VolumeControl label={t("settings.music")} value={musicVolume} onChange={onChangeMusicVolume} />
          </View>
        );
      case "haptics":
        return <View style={styles.panelContent}><SettingsToggle label={t("settings.hapticsEnabled")} value={hapticsEnabled} onChange={onChangeHapticsEnabled} /></View>;
      case "language":
        return (
          <View style={styles.panelContent}>
            <BigButton label={t("settings.english")} onPress={() => undefined} variant="primary" style={styles.languageButton} />
            <Text style={styles.languageGroupLabel}>{t("settings.comingSoon")}</Text>
            <View style={styles.comingSoonLanguages}>
              {["bulgarian", "spanish", "german", "french"].map((language) => (
                <BigButton
                  key={language}
                  label={t(`settings.${language}`)}
                  onPress={() => undefined}
                  disabled
                  variant="secondary"
                  style={styles.comingSoonLanguageButton}
                />
              ))}
            </View>
          </View>
        );
      case "accessibility":
        return <View style={styles.panelContent}><SettingsToggle label={t("settings.highContrast")} value={highContrastEnabled} onChange={onChangeHighContrastEnabled} /></View>;
      case "redeem":
        return <View style={styles.panelContent}>{registered ? <><Text style={styles.redeemHint}>{t("settings.redeemHint")}</Text><View style={styles.redeemRow}><TextInput value={code} onChangeText={(value) => { setCode(value.toUpperCase()); setRedeemMessage(null); }} onSubmitEditing={() => void handleRedeem()} autoCapitalize="characters" autoCorrect={false} maxLength={32} placeholder={t("settings.redeemPlaceholder")} placeholderTextColor={theme.textDim} style={styles.codeInput} /><Pressable disabled={!code.trim() || redeeming} onPress={() => void handleRedeem()} style={[styles.redeemButton, (!code.trim() || redeeming) && styles.disabled]}>{redeeming ? <ActivityIndicator color="#FFF" size="small" /> : <Text style={styles.redeemButtonText}>{t("settings.redeemAction")}</Text>}</Pressable></View>{redeemMessage ? <Text style={[styles.redeemMessage, redeemMessage.ok ? styles.redeemSuccess : styles.redeemError]}>{redeemMessage.text}</Text> : null}</> : <Text style={styles.redeemHint}>{t("settings.redeemSignIn")}</Text>}</View>;
      case "report":
        return <View style={styles.panelContent}>{registered ? <><Text style={styles.redeemHint}>{t("settings.reportHint")}</Text><TextInput value={reportedName} onChangeText={setReportedName} maxLength={20} autoCorrect={false} placeholder={t("settings.reportNamePlaceholder")} placeholderTextColor={theme.textDim} style={styles.reportNameInput} /><TextInput value={reportDescription} onChangeText={setReportDescription} maxLength={500} multiline textAlignVertical="top" placeholder={t("settings.reportDescriptionPlaceholder")} placeholderTextColor={theme.textDim} style={styles.reportDescriptionInput} /><View style={styles.reportFooter}><Text style={styles.characterCount}>{reportDescription.length}/500</Text><Pressable disabled={reportedName.trim().length < 3 || reportDescription.trim().length < 10 || reporting} onPress={() => void handleReport()} style={[styles.redeemButton, (reportedName.trim().length < 3 || reportDescription.trim().length < 10 || reporting) && styles.disabled]}>{reporting ? <ActivityIndicator color="#FFF" size="small" /> : <Text style={styles.redeemButtonText}>{t("settings.reportAction")}</Text>}</Pressable></View></> : <Text style={styles.redeemHint}>{t("settings.reportSignIn")}</Text>}</View>;
    }
  }

  return (
    <Screen style={styles.screen} androidScale={ANDROID_COMPACT_MENU_UI_SCALE}>
      <BackIconButton label={t("common.back")} onPress={onBack} />
      <Title>{t("settings.title")}</Title>
      <View style={styles.settingsLayout}>
        <ScrollView style={styles.sidebar} contentContainerStyle={styles.sidebarContent} showsVerticalScrollIndicator={false}>
          {SETTINGS_GROUPS.map(group => <View key={group.label} style={styles.categoryGroup}>
            <Text style={styles.categoryLabel}>{t(`settings.${group.label}`)}</Text>
            {group.sections.map(({ id, icon }) => <Pressable
              key={id}
              accessibilityRole="tab"
              accessibilityState={{ selected: section === id }}
              onPress={() => setSection(id)}
              style={[styles.sectionButton, section === id && styles.sectionButtonSelected]}
            >
              <FontAwesome5 name={icon} size={15} color={section === id ? "#D7B5F5" : "#9787AC"} style={styles.sectionIcon} />
              <Text style={[styles.sectionButtonText, section === id && styles.sectionButtonTextSelected]}>{t(`settings.${id}`)}</Text>
              {section === id ? <FontAwesome5 name="chevron-right" size={10} color="#D7B5F5" /> : null}
            </Pressable>)}
          </View>)}
        </ScrollView>
        <ScrollView key={section} style={styles.settingsPanel} contentContainerStyle={styles.settingsPanelContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <Text style={styles.panelCategory}>{t(`settings.${SETTINGS_GROUPS.find(group => group.sections.some(item => item.id === section))!.label}`)}</Text>
          <Text style={styles.panelTitle}>{t(`settings.${section}`)}</Text>
          <View style={styles.panelAccent} />
          {renderPanel()}
        </ScrollView>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { justifyContent: "flex-start", paddingTop: 14 },
  settingsLayout: { flex: 1, minHeight: 0, width: "100%", flexDirection: "row", gap: 24 },
  sidebar: { width: "29%", minWidth: 180, flexGrow: 0, borderRightWidth: 1, borderRightColor: "rgba(185,160,215,0.18)" },
  sidebarContent: { paddingVertical: 8, paddingRight: 16 },
  categoryGroup: { marginBottom: 12 },
  categoryLabel: { color: "#9984AF", fontSize: 9, fontWeight: "900", letterSpacing: 1.2, textTransform: "uppercase", paddingLeft: 13, marginBottom: 5 },
  sectionIcon: { width: 20, textAlign: "center" },
  sectionButton: { width: "100%", minHeight: 38, flexDirection: "row", alignItems: "center", gap: 9, paddingHorizontal: 11, paddingVertical: 8, marginBottom: 3, borderRadius: 10, borderWidth: 1, borderColor: "transparent" },
  sectionButtonSelected: { borderColor: "rgba(174,122,225,0.45)", backgroundColor: "rgba(116,72,167,0.23)" },
  sectionButtonText: { flex: 1, color: theme.textDim, fontSize: 14, fontWeight: "700" },
  sectionButtonTextSelected: { color: theme.text },
  settingsPanel: { flex: 1, minWidth: 0 },
  settingsPanelContent: { flexGrow: 1, justifyContent: "center", paddingHorizontal: 10, paddingVertical: 14 },
  panelCategory: { color: "#AA90C4", fontSize: 9, fontWeight: "900", letterSpacing: 1.3, textTransform: "uppercase", marginBottom: 5 },
  panelAccent: { width: 42, height: 3, borderRadius: 2, backgroundColor: "#A873D8", marginBottom: 16, transform: [{ rotate: "-3deg" }] },
  panelTitle: { color: theme.text, fontSize: 25, fontWeight: "900", marginBottom: 8 },
  panelContent: { width: "100%", maxWidth: 520 },
  languageButton: { width: "100%", minWidth: 0 },
  languageGroupLabel: { color: theme.textDim, fontSize: 13, fontWeight: "800", marginTop: 14, marginBottom: 7, textTransform: "uppercase" },
  comingSoonLanguages: { width: "100%", flexDirection: "row", flexWrap: "wrap", gap: 8 },
  comingSoonLanguageButton: { width: "48%", minWidth: 0, flexGrow: 1, marginVertical: 0 },
  toggleRow: { width: "100%", minHeight: 54, backgroundColor: theme.surface, borderRadius: 8, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  toggleLabel: { color: theme.text, fontSize: 15, fontWeight: "800", flexShrink: 1, marginRight: 12 },
  toggleTrack: { width: 46, height: 26, borderRadius: 13, padding: 3, backgroundColor: "rgba(185, 176, 214, 0.3)" },
  toggleTrackEnabled: { backgroundColor: theme.primary },
  toggleThumb: { width: 20, height: 20, borderRadius: 10, backgroundColor: theme.textDim },
  toggleThumbEnabled: { transform: [{ translateX: 20 }], backgroundColor: theme.text },
  volumeControl: {
    width: "100%",
    backgroundColor: theme.surface,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginVertical: 5,
  },
  volumeHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  volumeLabel: { color: theme.text, fontSize: 15, fontWeight: "800" },
  volumeValue: { color: theme.primary, fontSize: 15, fontWeight: "900" },
  volumeTouchArea: { height: 34, justifyContent: "center", marginTop: 4 },
  volumeTrack: {
    height: 10,
    borderRadius: 5,
    backgroundColor: "rgba(185, 176, 214, 0.22)",
    position: "relative",
  },
  volumeFill: { height: "100%", borderRadius: 5, backgroundColor: theme.primary },
  volumeThumb: {
    position: "absolute",
    top: -6,
    width: 22,
    height: 22,
    marginLeft: -11,
    borderRadius: 11,
    backgroundColor: theme.text,
    borderWidth: 3,
    borderColor: theme.primary,
  },
  volumeHint: { color: theme.textDim, fontSize: 11, marginTop: 7 },
  redeemHint: { color: theme.textDim, fontSize: 12, fontWeight: "700", marginBottom: 10 },
  redeemRow: { width: "100%", flexDirection: "row", gap: 8 },
  codeInput: { flex: 1, height: 46, paddingHorizontal: 14, borderRadius: 10, color: theme.text, fontSize: 15, fontWeight: "900", letterSpacing: 1, backgroundColor: theme.surface, borderWidth: 1, borderColor: "rgba(185,176,214,0.3)" },
  redeemButton: { minWidth: 112, height: 46, paddingHorizontal: 14, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: theme.primary },
  redeemButtonText: { color: "#FFF", fontSize: 12, fontWeight: "900" }, disabled: { opacity: 0.45 },
  redeemMessage: { marginTop: 10, fontSize: 12, fontWeight: "800" }, redeemSuccess: { color: "#79E6A5" }, redeemError: { color: "#FF8F9C" },
  reportNameInput: { width: "100%", height: 40, paddingHorizontal: 12, borderRadius: 8, color: theme.text, fontSize: 13, fontWeight: "800", backgroundColor: theme.surface, borderWidth: 1, borderColor: "rgba(185,176,214,0.3)", marginBottom: 7 },
  reportDescriptionInput: { width: "100%", minHeight: 76, maxHeight: 92, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 8, color: theme.text, fontSize: 12, backgroundColor: theme.surface, borderWidth: 1, borderColor: "rgba(185,176,214,0.3)" },
  reportFooter: { flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 10, marginTop: 7 }, characterCount: { color: theme.textDim, fontSize: 10, fontWeight: "700" },
});
