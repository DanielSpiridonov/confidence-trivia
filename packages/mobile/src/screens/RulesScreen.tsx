import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { ANDROID_MENU_UI_SCALE, BackIconButton, Screen, Title, theme } from "../components/ui";

const SECTIONS = ["loop", "confidence", "classic", "damage", "ranked", "stars"] as const;

export function RulesScreen({ onBack }: { onBack: () => void }) {
  const { t } = useTranslation();
  return (
    <Screen style={styles.screen} androidScale={ANDROID_MENU_UI_SCALE}>
      <BackIconButton label={t("common.back")} onPress={onBack} />
      <Title>{t("rules.title")}</Title>
      <Text style={styles.intro}>{t("rules.intro")}</Text>
      <ScrollView contentContainerStyle={styles.grid} showsVerticalScrollIndicator>
        {SECTIONS.map((section, index) => (
          <View key={section} style={styles.card}>
            <View style={styles.number}><Text style={styles.numberText}>{index + 1}</Text></View>
            <View style={styles.copy}>
              <Text style={styles.cardTitle}>{t(`rules.${section}.title`)}</Text>
              <Text style={styles.cardBody}>{t(`rules.${section}.body`)}</Text>
            </View>
          </View>
        ))}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { justifyContent: "flex-start", paddingTop: 10 },
  intro: { color: theme.textDim, fontSize: 13, textAlign: "center", marginBottom: 10 },
  grid: { width: "100%", flexDirection: "row", flexWrap: "wrap", gap: 10, paddingBottom: 12 },
  card: { width: "48.8%", minHeight: 82, flexDirection: "row", padding: 11, borderRadius: 12, backgroundColor: "rgba(31, 26, 51, 0.92)", borderWidth: 1, borderColor: "rgba(124, 92, 255, 0.35)" },
  number: { width: 27, height: 27, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(124, 92, 255, 0.24)", borderWidth: 1, borderColor: theme.primary, marginRight: 9 },
  numberText: { color: "#C9BEFF", fontSize: 12, fontWeight: "900" },
  copy: { flex: 1, minWidth: 0 },
  cardTitle: { color: theme.text, fontSize: 14, fontWeight: "900", marginBottom: 3 },
  cardBody: { color: theme.textDim, fontSize: 11, lineHeight: 15 },
});
