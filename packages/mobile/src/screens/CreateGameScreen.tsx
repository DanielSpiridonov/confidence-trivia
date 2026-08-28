import React, { useState } from "react";
import { TextInput, StyleSheet, Text, ScrollView, Pressable, View, Platform } from "react-native";
import { useTranslation } from "react-i18next";
import { ANDROID_COMPACT_MENU_UI_SCALE, BackIconButton, Screen, Title, BigButton, theme } from "../components/ui";
import { DEFAULT_ROUND_COUNT } from "@confidence-trivia/shared";
import { isValidPlayerName } from "../utils/playerName";

const ROUND_OPTIONS = [3, 5, 7, 9, 11, 13, 15];
const DEFAULT_ROUNDS = ROUND_OPTIONS.reduce((closest, value) => {
  const valueDistance = Math.abs(value - DEFAULT_ROUND_COUNT);
  const closestDistance = Math.abs(closest - DEFAULT_ROUND_COUNT);
  return valueDistance < closestDistance ? value : closest;
}, ROUND_OPTIONS[0]);

export function CreateGameScreen({
  onCreate,
  locale,
  initialName,
  onBack,
}: {
  onCreate: (name: string, rounds: number, gameMode: "classic" | "friends", visibility: "private" | "public") => Promise<void>;
  locale: "en" | "bg";
  initialName: string;
  onBack: () => void;
}) {
  const { t } = useTranslation();
  const [name, setName] = useState(initialName);
  const [gameMode, setGameMode] = useState<"classic" | "friends">("classic");
  const [visibility, setVisibility] = useState<"private" | "public">("private");
  const [rounds, setRounds] = useState(DEFAULT_ROUNDS);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const trimmedName = name.trim();
  const hasInvalidNameCharacters = trimmedName.length > 0 && !isValidPlayerName(trimmedName);

  async function handleSubmit() {
    if (submitting || !isValidPlayerName(name)) return;

    try {
      setSubmitting(true);
      setError(null);
      await onCreate(trimmedName, rounds, gameMode, visibility);
    } catch (err) {
      const message = err instanceof Error ? err.message : t("network.unknownError");
      setError(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Screen androidScale={ANDROID_COMPACT_MENU_UI_SCALE}>
      <BackIconButton label={t("common.back")} onPress={onBack} disabled={submitting} />
      <Title>{t("home.createGame")}</Title>
      <View style={styles.titleGap} />
      <View style={styles.body}>
        <View style={styles.formColumn}>
          <TextInput
            style={styles.input}
            placeholder={t("create.yourName") as string}
            placeholderTextColor={theme.textDim}
            value={name}
            onChangeText={(value) => {
              setName(value);
              if (error) setError(null);
            }}
            maxLength={20}
          />
          <View style={styles.modeSection}>
            <Text style={styles.roundsLabel}>{t("create.mode")}</Text>
            <View style={styles.modeRow}>
              <Pressable
                onPress={() => setGameMode("classic")}
                style={[styles.modeCard, gameMode === "classic" && styles.modeCardSelected]}
              >
                <Text style={styles.modeTitle}>{t("create.classic")}</Text>
              </Pressable>
              <View style={[styles.modeCard, styles.modeCardDisabled]}>
                <Text style={styles.modeTitle}>{t("create.friends")}</Text>
                <Text style={styles.modeComingSoon}>{t("create.comingSoon")}</Text>
              </View>
            </View>
          </View>
          <View style={styles.settingsRow}>
            <View style={styles.roundsSection}>
              <Text style={styles.roundsLabel}>{t("create.rounds")}</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.roundsScroller}
              >
                {ROUND_OPTIONS.map((value) => {
                  const isSelected = rounds === value;
                  return (
                    <Pressable
                      key={value}
                      onPress={() => setRounds(value)}
                      style={[styles.roundChip, isSelected && styles.roundChipSelected]}
                    >
                      <Text style={[styles.roundChipText, isSelected && styles.roundChipTextSelected]}>{value}</Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
            <View style={styles.visibilitySection}>
              <Text style={styles.roundsLabel}>{t("create.visibility")}</Text>
              <View style={styles.modeRow}>
                {(["private", "public"] as const).map((value) => (
                  <Pressable
                    key={value}
                    onPress={() => setVisibility(value)}
                    style={[styles.modeCard, styles.visibilityCard, visibility === value && styles.modeCardSelected]}
                  >
                    <Text style={styles.modeTitle}>{t(`create.${value}`)}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          </View>
        </View>
        <View style={styles.actionsColumn}>
          {error && <Text style={styles.error}>{t("network.createFailed", { message: error })}</Text>}
          <BigButton
            label={submitting ? t("create.creating") : t("create.create")}
            onPress={handleSubmit}
            disabled={!isValidPlayerName(name) || submitting}
            style={styles.actionButton}
          />
          {hasInvalidNameCharacters ? <Text style={styles.validationError}>{t("validation.nameSpecialCharacters")}</Text> : null}
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: {
    flex: 1,
    minHeight: 0,
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 28,
  },
  titleGap: { height: Platform.OS === "android" ? 44 : 0 },
  formColumn: { width: "62%", maxWidth: 560 },
  actionsColumn: { width: "30%", maxWidth: 300, justifyContent: "center" },
  settingsRow: { width: "100%", flexDirection: "row", gap: 10 },
  visibilitySection: { flex: 1, minWidth: 0, marginBottom: 12 },
  visibilityCard: { minHeight: 44 },
  input: {
    backgroundColor: theme.surface,
    color: theme.text,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    marginBottom: 12,
    width: "100%",
  },
  roundsSection: {
    flex: 1,
    minWidth: 0,
    marginBottom: 12,
  },
  modeSection: {
    width: "100%",
    marginBottom: 10,
  },
  modeRow: { flexDirection: "row", gap: 10 },
  modeCard: {
    flex: 1,
    minHeight: 52,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.surface,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "transparent",
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  modeCardSelected: { borderColor: theme.primary },
  modeCardDisabled: { opacity: 0.42 },
  modeTitle: { color: theme.text, fontSize: 15, fontWeight: "800" },
  modeComingSoon: { color: theme.textDim, fontSize: 10, fontWeight: "700", marginTop: 2 },
  actionButton: {
    width: "100%",
  },
  roundsLabel: {
    color: theme.textDim,
    marginBottom: 8,
    fontSize: 14,
    fontWeight: "600",
  },
  roundsScroller: {
    paddingRight: 8,
  },
  roundChip: {
    backgroundColor: theme.surface,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginRight: 8,
    borderWidth: 2,
    borderColor: "transparent",
  },
  roundChipSelected: {
    borderColor: theme.primary,
    backgroundColor: "#2A2245",
  },
  roundChipText: {
    color: theme.text,
    fontSize: 16,
    fontWeight: "700",
  },
  roundChipTextSelected: {
    color: theme.primary,
  },
  error: {
    color: theme.danger,
    marginBottom: 8,
    textAlign: "center",
  },
  validationError: { color: theme.danger, marginTop: 8, textAlign: "center", fontSize: 13 },
});
