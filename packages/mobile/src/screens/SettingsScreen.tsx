import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { ANDROID_COMPACT_MENU_UI_SCALE, BackIconButton, Screen, Title, BigButton, theme } from "../components/ui";

type SettingsSection = "sounds" | "haptics" | "language" | "accessibility";

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
  locale,
  soundEffectsVolume,
  musicVolume,
  hapticsEnabled,
  highContrastEnabled,
  onChangeLocale,
  onChangeSoundEffectsVolume,
  onChangeMusicVolume,
  onChangeHapticsEnabled,
  onChangeHighContrastEnabled,
  onBack,
}: {
  locale: "en" | "bg";
  soundEffectsVolume: number;
  musicVolume: number;
  hapticsEnabled: boolean;
  highContrastEnabled: boolean;
  onChangeLocale: (locale: "en" | "bg") => void;
  onChangeSoundEffectsVolume: (volume: number) => void;
  onChangeMusicVolume: (volume: number) => void;
  onChangeHapticsEnabled: (enabled: boolean) => void;
  onChangeHighContrastEnabled: (enabled: boolean) => void;
  onBack: () => void;
}) {
  const { t } = useTranslation();
  const [section, setSection] = React.useState<SettingsSection>("sounds");

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
            <BigButton label={t("settings.english")} onPress={() => onChangeLocale("en")} variant={locale === "en" ? "primary" : "secondary"} style={styles.languageButton} />
            <BigButton label={t("settings.bulgarian")} onPress={() => onChangeLocale("bg")} variant={locale === "bg" ? "primary" : "secondary"} style={styles.languageButton} />
          </View>
        );
      case "accessibility":
        return <View style={styles.panelContent}><SettingsToggle label={t("settings.highContrast")} value={highContrastEnabled} onChange={onChangeHighContrastEnabled} /></View>;
    }
  }

  return (
    <Screen style={styles.screen} androidScale={ANDROID_COMPACT_MENU_UI_SCALE}>
      <BackIconButton label={t("common.back")} onPress={onBack} />
      <Title>{t("settings.title")}</Title>
      <View style={styles.settingsLayout}>
        <View style={styles.sidebar}>
          {(["sounds", "haptics", "language", "accessibility"] as const).map((value) => (
            <Pressable
              key={value}
              onPress={() => setSection(value)}
              style={[styles.sectionButton, section === value && styles.sectionButtonSelected]}
            >
              <Text style={[styles.sectionButtonText, section === value && styles.sectionButtonTextSelected]}>
                {t(`settings.${value}`)}
              </Text>
            </Pressable>
          ))}
        </View>
        <View style={styles.settingsPanel}>
          <Text style={styles.panelTitle}>{t(`settings.${section}`)}</Text>
          {renderPanel()}
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { justifyContent: "flex-start", paddingTop: 14 },
  settingsLayout: { flex: 1, minHeight: 0, width: "100%", flexDirection: "row", gap: 24 },
  sidebar: { width: "30%", minWidth: 180, justifyContent: "center" },
  sectionButton: { width: "100%", paddingHorizontal: 14, paddingVertical: 8, marginBottom: 4, borderLeftWidth: 3, borderLeftColor: "transparent" },
  sectionButtonSelected: { borderLeftColor: theme.primary, backgroundColor: "rgba(124, 92, 255, 0.12)" },
  sectionButtonText: { color: theme.textDim, fontSize: 16, fontWeight: "700" },
  sectionButtonTextSelected: { color: theme.text },
  settingsPanel: { flex: 1, minWidth: 0, justifyContent: "center", paddingHorizontal: 10 },
  panelTitle: { color: theme.text, fontSize: 18, fontWeight: "800", marginBottom: 8 },
  panelContent: { width: "100%", maxWidth: 520 },
  languageButton: { width: "100%", minWidth: 0 },
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
});
