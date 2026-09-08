import React from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useTranslation } from "react-i18next";
import { ANDROID_MENU_UI_SCALE, BackIconButton, Screen, Title, theme } from "../components/ui";
import { FriendSearchResult, FriendSummary, challengeFriend, claimFriendGift, getFriendSuggestions, getFriends, requestFriend, respondFriendRequest, searchFriends, sendFriendGift, updateFriendship } from "../network/client";
import { PointsIcon } from "../components/PointsIcon";

type FriendsTab = "friends" | "requests" | "blocked";

export function FriendsScreen({ playerId, onStarsChange, onBack }: { playerId: string; onStarsChange: (stars: number) => void; onBack: () => void }) {
  const { t } = useTranslation();
  const [tab, setTab] = React.useState<FriendsTab>("friends");
  const [data, setData] = React.useState<Awaited<ReturnType<typeof getFriends>> | null>(null);
  const [suggestions, setSuggestions] = React.useState<FriendSearchResult[]>([]);
  const [results, setResults] = React.useState<FriendSearchResult[] | null>(null);
  const [query, setQuery] = React.useState("");
  const [loading, setLoading] = React.useState(true);
  const [searching, setSearching] = React.useState(false);
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [expandedId, setExpandedId] = React.useState<string | null>(null);

  const showError = React.useCallback((error: unknown) => Alert.alert(t("feedback.actionFailed"), error instanceof Error ? error.message : t("feedback.tryAgain")), [t]);
  const refresh = React.useCallback(async () => {
    try {
      const [friends, suggested] = await Promise.all([getFriends(playerId), getFriendSuggestions(playerId)]);
      setData(friends); setSuggestions(suggested);
    } catch (error) { showError(error); }
    finally { setLoading(false); }
  }, [playerId, showError]);

  React.useEffect(() => { void refresh(); }, [refresh]);

  async function runAction(id: string, action: () => Promise<unknown>) {
    setBusyId(id);
    try {
      await action(); setExpandedId(null); await refresh();
      if (results && query.trim().length >= 2) setResults(await searchFriends(playerId, query.trim()));
    } catch (error) { showError(error); }
    finally { setBusyId(null); }
  }

  async function search() {
    const trimmed = query.trim();
    if (trimmed.length < 2) { Alert.alert(t("friends.searchHint")); return; }
    setSearching(true);
    try { setResults(await searchFriends(playerId, trimmed)); }
    catch (error) { showError(error); }
    finally { setSearching(false); }
  }

  function confirmAction(message: string, action: () => void) {
    Alert.alert(t("friends.confirmTitle"), message, [{ text: t("validation.cancel"), style: "cancel" }, { text: t("friends.confirm"), style: "destructive", onPress: action }]);
  }

  const discoveryItems = results ?? suggestions;
  return (
    <Screen style={styles.screen} androidScale={ANDROID_MENU_UI_SCALE * 0.9}>
      <BackIconButton label={t("common.back")} onPress={onBack} />
      <Title>{t("friends.title")}</Title>
      <View style={styles.toolbar}>
        <View style={styles.tabs}>{(["friends", "requests", "blocked"] as FriendsTab[]).map((item) => {
          const count = item === "requests" ? data?.incoming.length ?? 0 : item === "blocked" ? data?.blocked.length ?? 0 : 0;
          return <Pressable key={item} onPress={() => setTab(item)} style={[styles.tab, tab === item && styles.tabSelected]}><Text style={[styles.tabText, tab === item && styles.tabTextSelected]}>{t(`friends.tabs.${item}`)}{count ? ` (${count})` : ""}</Text></Pressable>;
        })}</View>
        <View style={styles.searchRow}>
          <TextInput value={query} onChangeText={(value) => { setQuery(value); if (!value) setResults(null); }} onSubmitEditing={() => void search()} returnKeyType="search" autoCapitalize="none" maxLength={20} placeholder={t("friends.searchPlaceholder")} placeholderTextColor={theme.textDim} style={styles.searchInput} />
          {results ? <Pressable onPress={() => { setQuery(""); setResults(null); }} style={styles.clearButton}><Text style={styles.clearText}>×</Text></Pressable> : null}
          <Pressable disabled={searching} onPress={() => void search()} style={styles.searchButton}><Text style={styles.searchButtonText}>{searching ? "..." : t("friends.search")}</Text></Pressable>
        </View>
      </View>
      <View style={styles.body}>
        <View style={styles.suggestionsPanel}>
          <View style={styles.panelHeader}><Text style={styles.panelTitle}>{results ? t("friends.searchResults") : t("friends.suggestions")}</Text>{!results ? <Pressable onPress={() => void refresh()}><Text style={styles.refreshText}>{t("friends.refresh")}</Text></Pressable> : null}</View>
          <ScrollView contentContainerStyle={styles.listContent} keyboardShouldPersistTaps="handled">
            {discoveryItems.map((item) => <DiscoveryRow key={item.playerId} item={item} busy={busyId === item.playerId} onAdd={() => void runAction(item.playerId, () => requestFriend(playerId, item.playerId))} />)}
            {!loading && discoveryItems.length === 0 ? <Empty text={results ? t("friends.noSearchResults") : t("friends.noSuggestions")} /> : null}
          </ScrollView>
        </View>
        <View style={styles.listPanel}>
          {loading ? <ActivityIndicator color={theme.primary} style={styles.loader} /> : null}
          {!loading && tab === "friends" ? <ScrollView contentContainerStyle={styles.listContent}>
            {data?.friends.map((friend) => <FriendRow key={friend.friendshipId} item={friend} expanded={expandedId === friend.friendshipId} busy={busyId === friend.friendshipId} onToggle={() => setExpandedId((current) => current === friend.friendshipId ? null : friend.friendshipId)} onBless={() => void runAction(friend.friendshipId, () => sendFriendGift(playerId, friend.friendshipId))} onClaim={() => void runAction(friend.friendshipId, async () => { const claimed = await claimFriendGift(playerId, friend.giftId!); onStarsChange(claimed.stars); })} onChallenge={() => void runAction(friend.friendshipId, async () => { await challengeFriend(playerId, friend.playerId); Alert.alert(t("friends.challengeSent")); })} onRemove={() => confirmAction(t("friends.removeConfirm", { name: friend.displayName }), () => void runAction(friend.friendshipId, () => updateFriendship(playerId, friend.friendshipId, "remove")))} onBlock={() => confirmAction(t("friends.blockConfirm", { name: friend.displayName }), () => void runAction(friend.friendshipId, () => updateFriendship(playerId, friend.friendshipId, "block")))} />)}
            {data?.friends.length === 0 ? <Empty text={t("friends.noFriends")} /> : null}
          </ScrollView> : null}
          {!loading && tab === "requests" ? <ScrollView contentContainerStyle={styles.listContent}>
            {data?.incoming.map((request) => <View key={request.friendshipId} style={styles.personRow}><Text numberOfLines={1} style={styles.personName}>{request.displayName}</Text><SmallButton label={t("friends.accept")} onPress={() => void runAction(request.friendshipId, () => respondFriendRequest(playerId, request.friendshipId, "accept"))} disabled={busyId === request.friendshipId} /><SmallButton label={t("friends.reject")} onPress={() => void runAction(request.friendshipId, () => respondFriendRequest(playerId, request.friendshipId, "reject"))} disabled={busyId === request.friendshipId} muted /></View>)}
            {data?.outgoing.map((request) => <View key={request.friendshipId} style={styles.personRow}><Text numberOfLines={1} style={styles.personName}>{request.displayName}</Text><Text style={styles.statusText}>{t("friends.requestSent")}</Text></View>)}
            {(data?.incoming.length ?? 0) + (data?.outgoing.length ?? 0) === 0 ? <Empty text={t("friends.noRequests")} /> : null}
          </ScrollView> : null}
          {!loading && tab === "blocked" ? <ScrollView contentContainerStyle={styles.listContent}>
            {data?.blocked.map((blocked) => <View key={blocked.friendshipId} style={styles.personRow}><Text numberOfLines={1} style={styles.personName}>{blocked.displayName}</Text><SmallButton label={t("friends.unblock")} onPress={() => void runAction(blocked.friendshipId, () => updateFriendship(playerId, blocked.friendshipId, "unblock"))} disabled={busyId === blocked.friendshipId} /></View>)}
            {data?.blocked.length === 0 ? <Empty text={t("friends.noBlocked")} /> : null}
          </ScrollView> : null}
        </View>
      </View>
    </Screen>
  );
}

function DiscoveryRow({ item, busy, onAdd }: { item: FriendSearchResult; busy: boolean; onAdd: () => void }) {
  const { t } = useTranslation();
  return <View style={styles.personRow}><Text numberOfLines={1} style={styles.personName}>{item.displayName}</Text>{item.relationship === "none" ? <SmallButton label={busy ? "..." : t("friends.add")} onPress={onAdd} disabled={busy} /> : <Text style={styles.statusText}>{t(`friends.relationship.${item.relationship}`)}</Text>}</View>;
}

function FriendRow({ item, expanded, busy, onToggle, onBless, onClaim, onChallenge, onRemove, onBlock }: { item: FriendSummary; expanded: boolean; busy: boolean; onToggle: () => void; onBless: () => void; onClaim: () => void; onChallenge: () => void; onRemove: () => void; onBlock: () => void }) {
  const { t } = useTranslation();
  return <View style={[styles.friendCard, expanded && styles.friendCardExpanded]}><Pressable onPress={onToggle} style={styles.friendMainRow}><View style={styles.friendAvatar}><Text style={styles.friendAvatarText}>{item.displayName.slice(0, 1).toUpperCase()}</Text></View><Text numberOfLines={1} style={styles.personName}>{item.displayName}</Text>{item.giftId ? <SmallButton label={t("friends.claimBlessing")} onPress={onClaim} disabled={busy} icon /> : <SmallButton label={item.giftSentToday ? t("friends.blessedToday") : t("friends.bless")} onPress={onBless} disabled={busy || item.giftSentToday} icon />}<Text style={styles.expandIcon}>{expanded ? "⌃" : "⌄"}</Text></Pressable>{expanded ? <View style={styles.manageRow}><SmallButton label={t("friends.challenge")} onPress={onChallenge} disabled={busy} /><Text style={styles.manageHint}>{t("friends.manageHint")}</Text><SmallButton label={t("friends.remove")} onPress={onRemove} disabled={busy} muted /><SmallButton label={t("friends.block")} onPress={onBlock} disabled={busy} danger /></View> : null}</View>;
}

function SmallButton({ label, onPress, disabled, muted, danger, icon }: { label: string; onPress: () => void; disabled?: boolean; muted?: boolean; danger?: boolean; icon?: boolean }) { return <Pressable disabled={disabled} onPress={onPress} style={[styles.smallButton, muted && styles.smallButtonMuted, danger && styles.smallButtonDanger, disabled && styles.buttonDisabled]}>{icon ? <PointsIcon size={15} /> : null}<Text numberOfLines={1} style={styles.smallButtonText}>{label}</Text></Pressable>; }
function Empty({ text }: { text: string }) { return <Text style={styles.empty}>{text}</Text>; }

const styles = StyleSheet.create({
  screen: { justifyContent: "flex-start", paddingTop: 10 }, toolbar: { width: "100%", flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, marginTop: 5 }, tabs: { flexDirection: "row", gap: 7 },
  tab: { minWidth: 98, paddingHorizontal: 13, paddingVertical: 8, borderRadius: 10, alignItems: "center", backgroundColor: "rgba(31,26,51,0.86)", borderWidth: 1, borderColor: "rgba(185,176,214,0.18)" }, tabSelected: { borderColor: theme.primary, backgroundColor: "rgba(124,92,255,0.26)" }, tabText: { color: theme.textDim, fontSize: 11, fontWeight: "900" }, tabTextSelected: { color: theme.text },
  searchRow: { width: "39%", minWidth: 265, flexDirection: "row", gap: 6, position: "relative" }, searchInput: { flex: 1, height: 38, borderRadius: 9, paddingLeft: 10, paddingRight: 28, color: theme.text, backgroundColor: "rgba(10,8,19,0.78)", borderWidth: 1, borderColor: "rgba(185,176,214,0.28)", fontSize: 12, fontWeight: "700" }, clearButton: { position: "absolute", right: 72, top: 4, zIndex: 2, width: 28, height: 30, alignItems: "center", justifyContent: "center" }, clearText: { color: theme.textDim, fontSize: 21, lineHeight: 23 }, searchButton: { width: 68, height: 38, alignItems: "center", justifyContent: "center", borderRadius: 9, backgroundColor: theme.primary }, searchButtonText: { color: "white", fontWeight: "900", fontSize: 10 },
  body: { flex: 1, minHeight: 0, width: "100%", flexDirection: "row", gap: 10, marginTop: 9 }, suggestionsPanel: { width: "38%", minWidth: 235, borderRadius: 14, padding: 10, backgroundColor: "rgba(31,26,51,0.9)", borderWidth: 1, borderColor: "rgba(185,176,214,0.16)" }, listPanel: { flex: 1, minWidth: 0, borderRadius: 14, padding: 10, backgroundColor: "rgba(31,26,51,0.9)", borderWidth: 1, borderColor: "rgba(185,176,214,0.16)" }, panelHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 7 }, panelTitle: { color: theme.text, fontSize: 14, fontWeight: "900" }, refreshText: { color: "#B9AAFF", fontSize: 10, fontWeight: "900" }, listContent: { gap: 7, paddingBottom: 4 },
  personRow: { minHeight: 48, flexDirection: "row", alignItems: "center", gap: 7, borderRadius: 10, paddingHorizontal: 9, paddingVertical: 6, backgroundColor: "rgba(15,12,27,0.76)", borderWidth: 1, borderColor: "rgba(185,176,214,0.16)" }, friendCard: { borderRadius: 11, backgroundColor: "rgba(15,12,27,0.76)", borderWidth: 1, borderColor: "rgba(185,176,214,0.16)", overflow: "hidden" }, friendCardExpanded: { borderColor: "rgba(124,92,255,0.65)" }, friendMainRow: { minHeight: 51, flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 9, paddingVertical: 6 }, friendAvatar: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(124,92,255,0.28)", borderWidth: 1, borderColor: "#7C5CFF" }, friendAvatarText: { color: "white", fontSize: 15, fontWeight: "900" }, personName: { flex: 1, minWidth: 0, color: theme.text, fontSize: 13, fontWeight: "900" }, statusText: { color: theme.textDim, fontSize: 9, fontWeight: "800" }, expandIcon: { color: theme.textDim, width: 17, fontSize: 16, textAlign: "center" }, manageRow: { flexDirection: "row", alignItems: "center", gap: 7, paddingHorizontal: 10, paddingVertical: 7, borderTopWidth: 1, borderTopColor: "rgba(185,176,214,0.12)", backgroundColor: "rgba(8,6,15,0.38)" }, manageHint: { flex: 1, color: theme.textDim, fontSize: 9, fontWeight: "700" },
  smallButton: { minWidth: 58, minHeight: 31, paddingHorizontal: 9, flexDirection: "row", gap: 4, alignItems: "center", justifyContent: "center", borderRadius: 8, backgroundColor: "rgba(124,92,255,0.78)" }, smallButtonMuted: { backgroundColor: "rgba(74,68,88,0.9)" }, smallButtonDanger: { backgroundColor: "rgba(170,55,72,0.84)" }, smallButtonText: { color: "white", fontSize: 9, fontWeight: "900" }, buttonDisabled: { opacity: 0.48 }, loader: { marginTop: 45 }, empty: { color: theme.textDim, fontSize: 10, fontWeight: "700", textAlign: "center", padding: 15 },
});
