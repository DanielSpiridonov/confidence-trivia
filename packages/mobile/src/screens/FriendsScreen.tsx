import React from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useTranslation } from "react-i18next";
import { ANDROID_MENU_UI_SCALE, BackIconButton, Screen, Title, theme } from "../components/ui";
import { FriendSearchResult, FriendSummary, claimFriendGift, getFriends, requestFriend, respondFriendRequest, searchFriends, sendFriendGift, updateFriendship } from "../network/client";
import { PointsIcon } from "../components/PointsIcon";

type FriendsTab = "friends" | "requests" | "gifts";

export function FriendsScreen({ playerId, onStarsChange, onBack }: { playerId: string; onStarsChange: (stars: number) => void; onBack: () => void }) {
  const { t } = useTranslation();
  const [tab, setTab] = React.useState<FriendsTab>("friends");
  const [data, setData] = React.useState<Awaited<ReturnType<typeof getFriends>> | null>(null);
  const [query, setQuery] = React.useState("");
  const [results, setResults] = React.useState<FriendSearchResult[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [searching, setSearching] = React.useState(false);
  const [busyId, setBusyId] = React.useState<string | null>(null);

  const showError = React.useCallback((error: unknown) => {
    Alert.alert(t("feedback.actionFailed"), error instanceof Error ? error.message : t("feedback.tryAgain"));
  }, [t]);

  const refresh = React.useCallback(async () => {
    try {
      setData(await getFriends(playerId));
    } catch (error) {
      showError(error);
    } finally {
      setLoading(false);
    }
  }, [playerId, showError]);

  React.useEffect(() => { void refresh(); }, [refresh]);

  async function runAction(id: string, action: () => Promise<unknown>) {
    setBusyId(id);
    try {
      await action();
      await refresh();
      if (query.trim().length >= 2) setResults(await searchFriends(playerId, query.trim()));
    } catch (error) {
      showError(error);
    } finally {
      setBusyId(null);
    }
  }

  async function search() {
    if (query.trim().length < 2) {
      Alert.alert(t("friends.searchHint"));
      return;
    }
    setSearching(true);
    try {
      setResults(await searchFriends(playerId, query.trim()));
    } catch (error) {
      showError(error);
    } finally {
      setSearching(false);
    }
  }

  const pendingGifts = data?.friends.filter((friend) => friend.giftId) ?? [];

  return (
    <Screen style={styles.screen} androidScale={ANDROID_MENU_UI_SCALE}>
      <BackIconButton label={t("common.back")} onPress={onBack} />
      <Title>{t("friends.title")}</Title>
      <View style={styles.tabs}>
        {(["friends", "requests", "gifts"] as FriendsTab[]).map((item) => {
          const count = item === "requests" ? data?.incoming.length ?? 0 : item === "gifts" ? data?.unclaimedGiftCount ?? 0 : 0;
          return <Pressable key={item} onPress={() => setTab(item)} style={[styles.tab, tab === item && styles.tabSelected]}><Text style={[styles.tabText, tab === item && styles.tabTextSelected]}>{t(`friends.tabs.${item}`)}{count ? ` (${count})` : ""}</Text></Pressable>;
        })}
      </View>

      <View style={styles.body}>
        <View style={styles.searchPanel}>
          <Text style={styles.panelTitle}>{t("friends.findPlayers")}</Text>
          <View style={styles.searchRow}>
            <TextInput value={query} onChangeText={setQuery} onSubmitEditing={() => void search()} returnKeyType="search" autoCapitalize="none" maxLength={20} placeholder={t("friends.searchPlaceholder")} placeholderTextColor={theme.textDim} style={styles.searchInput} />
            <Pressable disabled={searching} onPress={() => void search()} style={styles.primaryButton}><Text style={styles.primaryButtonText}>{searching ? t("friends.searching") : t("friends.search")}</Text></Pressable>
          </View>
          <ScrollView style={styles.searchResults} contentContainerStyle={styles.listContent} keyboardShouldPersistTaps="handled">
            {results.map((result) => <SearchRow key={result.playerId} item={result} busy={busyId === result.playerId} onAdd={() => void runAction(result.playerId, () => requestFriend(playerId, result.playerId))} />)}
            {!searching && query.trim().length >= 2 && results.length === 0 ? <Empty text={t("friends.noSearchResults")} /> : null}
          </ScrollView>
        </View>

        <View style={styles.listPanel}>
          {loading ? <ActivityIndicator color={theme.primary} style={styles.loader} /> : null}
          {!loading && tab === "friends" ? (
            <ScrollView contentContainerStyle={styles.listContent}>
              {data?.friends.map((friend) => <FriendRow key={friend.friendshipId} item={friend} busy={busyId === friend.friendshipId} giftMode={false} onGift={() => void runAction(friend.friendshipId, () => sendFriendGift(playerId, friend.friendshipId))} onRemove={() => confirmRelationshipAction(t("friends.removeConfirm", { name: friend.displayName }), () => void runAction(friend.friendshipId, () => updateFriendship(playerId, friend.friendshipId, "remove")))} onBlock={() => confirmRelationshipAction(t("friends.blockConfirm", { name: friend.displayName }), () => void runAction(friend.friendshipId, () => updateFriendship(playerId, friend.friendshipId, "block")))} />)}
              {data?.friends.length === 0 ? <Empty text={t("friends.noFriends")} /> : null}
            </ScrollView>
          ) : null}
          {!loading && tab === "requests" ? (
            <ScrollView contentContainerStyle={styles.listContent}>
              {data?.incoming.map((request) => <RequestRow key={request.friendshipId} item={request} busy={busyId === request.friendshipId} onAccept={() => void runAction(request.friendshipId, () => respondFriendRequest(playerId, request.friendshipId, "accept"))} onReject={() => void runAction(request.friendshipId, () => respondFriendRequest(playerId, request.friendshipId, "reject"))} />)}
              {data?.outgoing.map((request) => <View key={request.friendshipId} style={styles.personRow}><Text style={styles.personName}>{request.displayName}</Text><Text style={styles.statusText}>{t("friends.requestSent")}</Text></View>)}
              {(data?.incoming.length ?? 0) + (data?.outgoing.length ?? 0) === 0 ? <Empty text={t("friends.noRequests")} /> : null}
            </ScrollView>
          ) : null}
          {!loading && tab === "gifts" ? (
            <ScrollView contentContainerStyle={styles.listContent}>
              {pendingGifts.map((friend) => <FriendRow key={friend.friendshipId} item={friend} busy={busyId === friend.friendshipId} giftMode onGift={() => {}} onClaim={() => void runAction(friend.friendshipId, async () => { const claimed = await claimFriendGift(playerId, friend.giftId!); onStarsChange(claimed.stars); })} onRemove={() => {}} onBlock={() => {}} />)}
              {pendingGifts.length === 0 ? <Empty text={t("friends.noGifts")} /> : null}
            </ScrollView>
          ) : null}
        </View>
      </View>
    </Screen>
  );
}

function confirmRelationshipAction(message: string, action: () => void) {
  Alert.alert("", message, [{ text: "Cancel", style: "cancel" }, { text: "OK", style: "destructive", onPress: action }]);
}

function SearchRow({ item, busy, onAdd }: { item: FriendSearchResult; busy: boolean; onAdd: () => void }) {
  const { t } = useTranslation();
  const available = item.relationship === "none";
  return <View style={styles.personRow}><Text numberOfLines={1} style={styles.personName}>{item.displayName}</Text>{available ? <SmallButton label={busy ? "..." : t("friends.add")} onPress={onAdd} disabled={busy} /> : <Text style={styles.statusText}>{t(`friends.relationship.${item.relationship}`)}</Text>}</View>;
}

function RequestRow({ item, busy, onAccept, onReject }: { item: FriendSummary; busy: boolean; onAccept: () => void; onReject: () => void }) {
  const { t } = useTranslation();
  return <View style={styles.personRow}><Text numberOfLines={1} style={styles.personName}>{item.displayName}</Text><SmallButton label={t("friends.accept")} onPress={onAccept} disabled={busy} /><SmallButton label={t("friends.reject")} onPress={onReject} disabled={busy} muted /></View>;
}

function FriendRow({ item, busy, giftMode, onGift, onClaim, onRemove, onBlock }: { item: FriendSummary; busy: boolean; giftMode: boolean; onGift: () => void; onClaim?: () => void; onRemove: () => void; onBlock: () => void }) {
  const { t } = useTranslation();
  return <View style={styles.personRow}><Text numberOfLines={1} style={styles.personName}>{item.displayName}</Text>{giftMode ? <SmallButton label={t("friends.claimGift")} onPress={onClaim!} disabled={busy} icon /> : <><SmallButton label={item.giftSentToday ? t("friends.giftSent") : t("friends.sendGift")} onPress={onGift} disabled={busy || item.giftSentToday} icon /><SmallButton label={t("friends.remove")} onPress={onRemove} disabled={busy} muted /><SmallButton label={t("friends.block")} onPress={onBlock} disabled={busy} danger /></>}</View>;
}

function SmallButton({ label, onPress, disabled, muted, danger, icon }: { label: string; onPress: () => void; disabled?: boolean; muted?: boolean; danger?: boolean; icon?: boolean }) {
  return <Pressable disabled={disabled} onPress={onPress} style={[styles.smallButton, muted && styles.smallButtonMuted, danger && styles.smallButtonDanger, disabled && styles.buttonDisabled]}>{icon ? <PointsIcon size={15} /> : null}<Text style={styles.smallButtonText}>{label}</Text></Pressable>;
}

function Empty({ text }: { text: string }) { return <Text style={styles.empty}>{text}</Text>; }

const styles = StyleSheet.create({
  screen: { justifyContent: "flex-start", paddingTop: 10 },
  tabs: { flexDirection: "row", gap: 7, alignSelf: "center", marginTop: 5 },
  tab: { minWidth: 105, paddingHorizontal: 15, paddingVertical: 8, borderRadius: 10, alignItems: "center", backgroundColor: "rgba(31,26,51,0.86)", borderWidth: 1, borderColor: "rgba(185,176,214,0.18)" },
  tabSelected: { borderColor: theme.primary, backgroundColor: "rgba(124,92,255,0.26)" },
  tabText: { color: theme.textDim, fontSize: 12, fontWeight: "900" },
  tabTextSelected: { color: theme.text },
  body: { flex: 1, minHeight: 0, width: "100%", flexDirection: "row", gap: 10, marginTop: 9 },
  searchPanel: { width: "38%", minWidth: 235, borderRadius: 14, padding: 12, backgroundColor: "rgba(31,26,51,0.9)", borderWidth: 1, borderColor: "rgba(185,176,214,0.16)" },
  listPanel: { flex: 1, minWidth: 0, borderRadius: 14, padding: 10, backgroundColor: "rgba(31,26,51,0.9)", borderWidth: 1, borderColor: "rgba(185,176,214,0.16)" },
  panelTitle: { color: theme.text, fontSize: 15, fontWeight: "900", marginBottom: 8 },
  searchRow: { flexDirection: "row", gap: 7 },
  searchInput: { flex: 1, height: 39, borderRadius: 9, paddingHorizontal: 10, color: theme.text, backgroundColor: "rgba(10,8,19,0.72)", borderWidth: 1, borderColor: "rgba(185,176,214,0.28)", fontSize: 13, fontWeight: "700" },
  primaryButton: { height: 39, minWidth: 72, paddingHorizontal: 10, alignItems: "center", justifyContent: "center", borderRadius: 9, backgroundColor: theme.primary },
  primaryButtonText: { color: "white", fontWeight: "900", fontSize: 11 },
  searchResults: { flex: 1, minHeight: 0, marginTop: 8 },
  listContent: { gap: 7, paddingBottom: 4 },
  personRow: { minHeight: 48, flexDirection: "row", alignItems: "center", gap: 7, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, backgroundColor: "rgba(12,10,22,0.7)", borderWidth: 1, borderColor: "rgba(185,176,214,0.13)" },
  personName: { flex: 1, minWidth: 0, color: theme.text, fontSize: 13, fontWeight: "900" },
  statusText: { color: theme.textDim, fontSize: 10, fontWeight: "800" },
  smallButton: { minHeight: 31, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 3, paddingHorizontal: 9, borderRadius: 8, backgroundColor: "rgba(124,92,255,0.72)" },
  smallButtonMuted: { backgroundColor: "rgba(93,86,116,0.55)" },
  smallButtonDanger: { backgroundColor: "rgba(175,58,83,0.68)" },
  smallButtonText: { color: "white", fontSize: 10, fontWeight: "900" },
  buttonDisabled: { opacity: 0.45 },
  loader: { marginTop: 50 },
  empty: { color: theme.textDim, textAlign: "center", fontSize: 12, fontWeight: "700", paddingVertical: 28 },
});
