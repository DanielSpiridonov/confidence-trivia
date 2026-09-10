import React from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useTranslation } from "react-i18next";
import { AccountProfile } from "../network/client";
import { ANDROID_MENU_UI_SCALE, BackIconButton, Screen, Title, theme } from "../components/ui";

interface Props {
  displayName: string; registered: boolean; provider: string | null; profile: AccountProfile | null;
  busy: boolean; authAvailable: boolean; onGoogle: () => void; onSaveName: (name: string) => void;
  onSignOut: () => void; onDeleteAccount: () => void; onBack: () => void;
}

export function ProfileScreen(props: Props) {
  const { displayName, registered, provider, profile, busy, authAvailable, onGoogle, onSaveName, onSignOut, onDeleteAccount, onBack } = props;
  const { t } = useTranslation();
  const [name, setName] = React.useState(displayName);
  const trimmedName = name.trim();
  const valid = /^[\p{L}\p{N} _-]{3,20}$/u.test(trimmedName);
  const initials = displayName.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "?";
  React.useEffect(() => setName(displayName), [displayName]);

  return <Screen style={s.screen} androidScale={ANDROID_MENU_UI_SCALE}>
    <BackIconButton label={t("common.back")} onPress={onBack} disabled={busy} />
    <Title>{t("account.title")}</Title>
    <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
      <View style={s.surface}>
        <View style={s.identityColumn}>
          <View style={s.identityHeader}>
            <View style={s.avatar}><Text style={s.avatarText}>{initials}</Text></View>
            <View style={s.identityText}>
              <Text numberOfLines={1} adjustsFontSizeToFit style={s.name}>{displayName}</Text>
              <Text numberOfLines={1} style={s.status}>{registered ? t("account.signedInWith", { provider: provider ?? "Google" }) : t("account.guest")}</Text>
            </View>
          </View>
          <Text style={[s.badge, registered && s.protectedBadge]}>{registered ? t("account.protected") : t("account.localOnly")}</Text>
          {registered && profile ? <View style={s.emailBlock}>
            <Text style={s.eyebrow}>{t("account.email")}</Text>
            <Text numberOfLines={1} style={s.email}>{profile.email ?? "-"}</Text>
          </View> : <View style={s.guestIntro}>
            <Text style={s.sectionTitle}>{t("account.unlockProfile")}</Text>
            <Text style={s.bodyText}>{t("account.guestLimits")}</Text>
          </View>}
          {registered ? <Pressable accessibilityRole="button" disabled={busy} onPress={onSignOut} style={({ pressed }) => [s.signOut, pressed && s.pressed]}>
            <Text style={s.signOutText}>{t("account.signOut")}</Text>
          </Pressable> : null}
          {registered ? <Pressable accessibilityRole="button" disabled={busy} onPress={onDeleteAccount} style={({ pressed }) => [s.deleteAccount, pressed && s.pressed]}>
            <Text style={s.deleteAccountText}>{t("account.deleteAccount")}</Text>
          </Pressable> : null}
        </View>

        <View style={s.divider} />
        <View style={s.detailsColumn}>
          {registered && profile ? <>
            <Text style={s.eyebrow}>{t("account.namePlaceholder")}</Text>
            <View style={s.editor}>
              <TextInput value={name} onChangeText={setName} maxLength={20} style={s.input} placeholder={t("account.namePlaceholder")} placeholderTextColor={theme.textDim} returnKeyType="done" onSubmitEditing={() => valid && trimmedName !== displayName && onSaveName(trimmedName)} />
              <Pressable accessibilityRole="button" disabled={busy || !valid || trimmedName === displayName} onPress={() => onSaveName(trimmedName)} style={({ pressed }) => [s.save, (!valid || trimmedName === displayName) && s.disabled, pressed && s.pressed]}>
                <Text style={s.buttonText}>{t("account.saveName")}</Text>
              </Pressable>
            </View>
            {!valid && name.length > 0 ? <Text style={s.error}>{t("account.nameRules")}</Text> : null}
            <View style={s.stats}>
              <Stat label={t("account.stars")} value={profile.stars} />
              <Stat label={t("account.games")} value={profile.gamesPlayed} />
              <Stat label={t("account.wins")} value={profile.wins} />
              <Stat label={t("account.rank")} value={t(`ranked.ranks.${profile.rankKey}`)} />
              <Stat label="LP" value={profile.rankedLp} last />
            </View>
            <Text style={s.protectedText}>{t("account.progressProtected")}</Text>
          </> : <>
            <View style={s.benefits}>
              <Benefit text={t("account.benefitProgress")} />
              <Benefit text={t("account.benefitRanked")} />
              <Benefit text={t("account.benefitSocial")} />
            </View>
            <Text style={s.transferHint}>{t("account.transferHint")}</Text>
            {!authAvailable ? <Text style={s.warning}>{t("account.configurationRequired")}</Text> : null}
            <Pressable accessibilityRole="button" disabled={busy || !authAvailable} onPress={onGoogle} style={({ pressed }) => [s.google, (!authAvailable || busy) && s.disabled, pressed && s.pressed]}>
              <View style={s.googleIcon}><Text style={s.googleLetter}>G</Text></View><Text style={s.buttonText}>{t("account.google")}</Text>
            </Pressable>
            <View style={s.apple}><Text style={s.appleMark}>A</Text><Text style={s.appleText}>{t("account.appleComingSoon")}</Text></View>
          </>}
        </View>
        {busy ? <View style={s.loader} pointerEvents="none"><ActivityIndicator color={theme.primary} /></View> : null}
      </View>
    </ScrollView>
  </Screen>;
}

function Stat({ label, value, last = false }: { label: string; value: string | number; last?: boolean }) {
  return <View style={[s.stat, last && s.lastStat]}><Text numberOfLines={1} adjustsFontSizeToFit style={s.statValue}>{value}</Text><Text numberOfLines={1} style={s.statLabel}>{label}</Text></View>;
}

function Benefit({ text }: { text: string }) {
  return <View style={s.benefit}><Text style={s.check}>+</Text><Text numberOfLines={1} adjustsFontSizeToFit style={s.benefitText}>{text}</Text></View>;
}

const s = StyleSheet.create({
  screen: { justifyContent: "flex-start", paddingTop: 10 }, scroll: { flex: 1, width: "100%" },
  scrollContent: { flexGrow: 1, justifyContent: "center", paddingHorizontal: 16, paddingVertical: 8 },
  surface: { width: "92%", maxWidth: 820, minHeight: 224, alignSelf: "center", flexDirection: "row", borderRadius: 8, borderWidth: 1, borderColor: "rgba(185,176,214,.28)", backgroundColor: "rgba(31,26,51,.94)", overflow: "hidden" },
  identityColumn: { width: "38%", padding: 16 }, detailsColumn: { flex: 1, justifyContent: "center", padding: 16 },
  divider: { width: 1, marginVertical: 14, backgroundColor: "rgba(185,176,214,.2)" }, identityHeader: { flexDirection: "row", alignItems: "center" },
  avatar: { width: 46, height: 46, borderRadius: 23, alignItems: "center", justifyContent: "center", backgroundColor: "#7C5CFF", borderWidth: 2, borderColor: "#B9AAFF" },
  avatarText: { color: "#FFF", fontSize: 17, fontWeight: "900" }, identityText: { flex: 1, minWidth: 0, marginLeft: 10 },
  name: { color: theme.text, fontSize: 20, fontWeight: "900" }, status: { color: "#9FE5B1", fontSize: 10, fontWeight: "800", marginTop: 2 },
  badge: { alignSelf: "flex-start", color: "#CABFFF", fontSize: 9, fontWeight: "900", marginTop: 10, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4, borderWidth: 1, borderColor: "rgba(155,131,255,.55)" },
  protectedBadge: { color: "#9FE5B1", borderColor: "rgba(124,255,160,.45)" }, emailBlock: { marginTop: 13 },
  eyebrow: { color: theme.textDim, fontSize: 9, fontWeight: "900", textTransform: "uppercase" }, email: { color: theme.text, fontSize: 11, fontWeight: "700", marginTop: 3 },
  guestIntro: { marginTop: 12 }, sectionTitle: { color: theme.text, fontSize: 15, fontWeight: "900" }, bodyText: { color: theme.textDim, fontSize: 10, lineHeight: 15, marginTop: 5 },
  editor: { flexDirection: "row", gap: 8, marginTop: 5 }, input: { flex: 1, minHeight: 36, borderRadius: 6, borderWidth: 1, borderColor: "#62558E", backgroundColor: "#171329", color: theme.text, paddingHorizontal: 10, paddingVertical: 5, fontSize: 12, fontWeight: "800" },
  save: { minWidth: 70, alignItems: "center", justifyContent: "center", borderRadius: 6, backgroundColor: theme.primary }, buttonText: { color: "#FFF", fontSize: 12, fontWeight: "900" },
  error: { color: "#FF9B9B", fontSize: 9, marginTop: 4 }, stats: { minHeight: 58, flexDirection: "row", alignItems: "stretch", marginTop: 14, borderTopWidth: 1, borderBottomWidth: 1, borderColor: "rgba(185,176,214,.18)" },
  stat: { flex: 1, minWidth: 0, alignItems: "center", justifyContent: "center", borderRightWidth: 1, borderRightColor: "rgba(185,176,214,.18)", paddingHorizontal: 3 }, lastStat: { borderRightWidth: 0 },
  statValue: { width: "100%", color: theme.text, fontSize: 14, fontWeight: "900", textAlign: "center" }, statLabel: { color: theme.textDim, fontSize: 8, fontWeight: "800", marginTop: 2 }, protectedText: { color: theme.textDim, fontSize: 9, textAlign: "center", marginTop: 8 },
  signOut: { alignSelf: "flex-start", marginTop: "auto", paddingHorizontal: 13, paddingVertical: 6, borderRadius: 6, borderWidth: 1, borderColor: "#D96E79" }, signOutText: { color: "#FF9B9B", fontSize: 10, fontWeight: "900" },
  deleteAccount: { alignSelf: "flex-start", marginTop: 6, paddingHorizontal: 13, paddingVertical: 5 }, deleteAccountText: { color: "#FF7D8B", fontSize: 9, fontWeight: "800", textDecorationLine: "underline" },
  benefits: { gap: 2 }, benefit: { minHeight: 27, flexDirection: "row", alignItems: "center" }, check: { width: 20, height: 20, borderRadius: 10, color: "#171329", backgroundColor: "#9FE5B1", textAlign: "center", lineHeight: 20, fontSize: 14, fontWeight: "900", marginRight: 8 }, benefitText: { flex: 1, color: theme.text, fontSize: 11, fontWeight: "800" },
  transferHint: { color: theme.textDim, fontSize: 9, marginTop: 5 }, warning: { color: "#F7D85B", fontSize: 9, lineHeight: 12, marginTop: 5 },
  google: { minHeight: 36, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 6, backgroundColor: "#4285F4", marginTop: 9 },
  googleIcon: { width: 21, height: 21, borderRadius: 11, alignItems: "center", justifyContent: "center", backgroundColor: "#FFF" }, googleLetter: { color: "#4285F4", fontSize: 12, fontWeight: "900" },
  apple: { minHeight: 32, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, borderRadius: 6, borderWidth: 1, borderColor: "rgba(255,255,255,.22)", marginTop: 5, opacity: .5 }, appleMark: { color: "#FFF", fontSize: 10, fontWeight: "900" }, appleText: { color: "#FFF", fontSize: 10, fontWeight: "800" },
  disabled: { opacity: .4 }, pressed: { opacity: .75 }, loader: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(23,19,41,.35)" },
});
