import { Pressable } from "../components/menuHaptics";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { FlatList, StyleSheet, Text, TextInput, View } from "react-native";
import { FontAwesome5 } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { ANDROID_MENU_UI_SCALE, BackIconButton, Screen, Title, BigButton, theme } from "../components/ui";
import { listPublicRooms, PublicRoomListing } from "../network/client";

export function JoinGameScreen({
  onJoin,
  onJoinPublic,
  initialName,
  onBack,
}: {
  onJoin: (code: string, name: string) => Promise<void>;
  onJoinPublic: (roomId: string, name: string) => Promise<void>;
  initialName: string;
  onBack: () => void;
}) {
  const { t } = useTranslation();
  const [code, setCode] = useState("");
  const [search, setSearch] = useState("");
  const [modeFilter, setModeFilter] = useState<"all" | "classic" | "friends">("all");
  const [rooms, setRooms] = useState<PublicRoomListing[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [joiningRoomId, setJoiningRoomId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const trimmedName = initialName.trim();

  const refreshRooms = useCallback(async (showSpinner = false) => {
    if (showSpinner) setRefreshing(true);
    try {
      setRooms(await listPublicRooms());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("network.unknownError"));
    } finally {
      if (showSpinner) setRefreshing(false);
    }
  }, [t]);

  useEffect(() => {
    void refreshRooms(true);
    const interval = setInterval(() => void refreshRooms(), 4_000);
    return () => clearInterval(interval);
  }, [refreshRooms]);

  const visibleRooms = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return rooms.filter((room) => (
      (modeFilter === "all" || room.gameMode === modeFilter)
      && (!query || room.leaderName.toLocaleLowerCase().includes(query))
    ));
  }, [modeFilter, rooms, search]);

  async function joinWithCode() {
    if (joiningRoomId || code.length !== 6 || !trimmedName) return;
    try {
      setJoiningRoomId("code");
      setError(null);
      await onJoin(code, trimmedName);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("network.unknownError"));
      setJoiningRoomId(null);
    }
  }

  async function joinListedRoom(roomId: string) {
    if (joiningRoomId || !trimmedName) return;
    try {
      setJoiningRoomId(roomId);
      setError(null);
      await onJoinPublic(roomId, trimmedName);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("network.unknownError"));
      setJoiningRoomId(null);
      void refreshRooms();
    }
  }

  return (
    <Screen style={styles.screen} androidScale={ANDROID_MENU_UI_SCALE * 0.891}>
      <BackIconButton label={t("common.back")} onPress={onBack} disabled={Boolean(joiningRoomId)} />
      <Title>{t("home.joinGame")}</Title>
      <View style={styles.columns}>
        <View style={styles.leftColumn}>
          <FontAwesome5 name="ticket-alt" size={35} color="#86B7EC" style={styles.ticketIcon} />
          <Text style={styles.sectionTitle}>{t("join.codeTab")}</Text>
          <Text style={styles.inviteHint}>{t("join.inviteHint")}</Text>
          <View style={styles.identityLine}><FontAwesome5 name="user" size={11} color="#A99ABF" /><Text numberOfLines={1} style={styles.playerNameText}>{initialName}</Text></View>
          <Text style={styles.fieldLabel}>{t("join.roomCode")}</Text>
          <TextInput
            style={[styles.input, styles.codeInput]}
            placeholder="— — — — — —"
            accessibilityLabel={t("join.roomCode")}
            autoCorrect={false}
            onSubmitEditing={() => void joinWithCode()}
            placeholderTextColor={theme.textDim}
            value={code}
            onChangeText={(value) => { setCode(value.replace(/\D/g, "").slice(0, 6)); setError(null); }}
            keyboardType="number-pad"
            maxLength={6}
          />
          {error ? <Text numberOfLines={2} style={styles.error}>{t("network.joinFailed", { message: error })}</Text> : null}
          <BigButton
            label={joiningRoomId === "code" ? t("join.joining") : t("join.join")}
            onPress={joinWithCode}
            disabled={code.length !== 6 || !trimmedName || Boolean(joiningRoomId)}
            style={styles.actionButton}
          />
        </View>

        <View style={styles.rightColumn}>
          <View style={styles.browseHeading}><Text style={styles.sectionTitle}>{t("join.browseTab")}</Text><Pressable accessibilityRole="button" accessibilityLabel={t("join.refresh")} disabled={refreshing} onPress={() => void refreshRooms(true)} style={styles.refreshButton}><FontAwesome5 name="sync-alt" size={14} color="#B5A5D0" /></Pressable></View>
          <View style={styles.searchRow}><FontAwesome5 name="search" size={12} color="#9C8BAD" /><TextInput
            style={styles.searchInput}
            placeholder={t("join.searchLeader") as string}
            placeholderTextColor={theme.textDim}
            value={search}
            onChangeText={setSearch}
            accessibilityLabel={t("join.searchLeader")}
          /></View>
          <View style={styles.filterRow}>
            {(["all", "classic", "friends"] as const).map((mode) => {
              const selected = modeFilter === mode;
              return (
                <Pressable key={mode} accessibilityRole="radio" accessibilityState={{ selected }} onPress={() => setModeFilter(mode)} style={[styles.filterChip, selected && styles.filterChipSelected]}>
                  <Text numberOfLines={1} style={[styles.filterText, selected && styles.filterTextSelected]}>{t(`join.filters.${mode}`)}</Text>
                </Pressable>
              );
            })}
          </View>
          <FlatList
            style={styles.roomList}
            contentContainerStyle={visibleRooms.length === 0 ? styles.emptyList : styles.roomListContent}
            data={visibleRooms}
            keyExtractor={(room) => room.roomId}
            refreshing={refreshing}
            onRefresh={() => void refreshRooms(true)}
            showsVerticalScrollIndicator
            ListEmptyComponent={<Text style={styles.emptyText}>{refreshing ? t("join.loadingRooms") : t("join.noRooms")}</Text>}
            renderItem={({ item }) => (
              <View style={styles.roomRow}>
                <View style={styles.roomInfo}>
                  <View style={styles.roomModeLine}><FontAwesome5 name={item.gameMode === "friends" ? "sliders-h" : "layer-group"} size={10} color={item.gameMode === "friends" ? "#D5AFEF" : "#95C4F2"} /><Text style={[styles.modeText, item.gameMode === "friends" && styles.customModeText]}>{t(`join.filters.${item.gameMode}`)}</Text></View>
                  <Text numberOfLines={1} style={styles.leaderName}>{item.leaderName}</Text>
                  <Text style={styles.roomMeta}>{item.gameMode === "damage"
                    ? t("join.damageRoomMeta", { players: item.playerCount, max: item.maxClients })
                    : t("join.roomMeta", { players: item.playerCount, max: item.maxClients, rounds: item.roundCount })}</Text>
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t("join.joinLobby", { name: item.leaderName, mode: t(`join.filters.${item.gameMode}`) })}
                  onPress={() => void joinListedRoom(item.roomId)}
                  disabled={!trimmedName || Boolean(joiningRoomId)}
                  style={[styles.joinRoomButton, (!trimmedName || Boolean(joiningRoomId)) && styles.disabled]}
                >
                  <Text style={styles.joinRoomText}>{joiningRoomId === item.roomId ? t("join.joining") : t("join.join")}</Text><FontAwesome5 name="arrow-right" size={12} color="#C4AAF1" />
                </Pressable>
              </View>
            )}
          />
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { justifyContent: "flex-start", paddingTop: 10 },
  columns: { flex: 1, minHeight: 0, width: "100%", flexDirection: "row", gap: 34, alignItems: "stretch" },
  leftColumn: { width: "34%", minWidth: 0, justifyContent: "center", paddingHorizontal: 8, paddingBottom: 10 },
  rightColumn: { flex: 1, minWidth: 0, paddingTop: 8 },
  ticketIcon: { marginBottom: 18, transform: [{ translateY: -6 }, { rotate: "-12deg" }] },
  sectionTitle: { color: "#F5EBDC", fontSize: 23, fontWeight: "900" },
  inviteHint: { color: "#B3A3C7", fontSize: 11, lineHeight: 16, marginTop: 5, marginBottom: 14 },
  identityLine: { flexDirection: "row", alignItems: "center", gap: 7, marginBottom: 12 },
  playerNameText: { flex: 1, color: "#CDBFDF", fontSize: 17, fontWeight: "800" },
  fieldLabel: { color: "#B19DCB", fontSize: 9, letterSpacing: 1.3, textTransform: "uppercase", fontWeight: "900" },
  input: { width: "100%", minHeight: 52, paddingHorizontal: 0, paddingVertical: 6, marginBottom: 12, borderBottomWidth: 2, borderBottomColor: "#7AA5D5" },
  codeInput: { color: "#F4ECDD", fontSize: 32, fontWeight: "900", letterSpacing: 6, textAlign: "left" },
  browseHeading: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  refreshButton: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  searchRow: { flexDirection: "row", alignItems: "center", gap: 8, borderBottomWidth: 1, borderBottomColor: "rgba(181,164,205,0.28)", marginBottom: 8 },
  searchInput: { flex: 1, minWidth: 0, color: theme.text, backgroundColor: "transparent", paddingHorizontal: 0, paddingVertical: 9, fontSize: 12 },
  filterRow: { width: "100%", flexDirection: "row", gap: 18, marginBottom: 4 },
  filterChip: { minWidth: 45, alignItems: "center", justifyContent: "center", paddingHorizontal: 3, paddingVertical: 7, borderBottomWidth: 2, borderBottomColor: "transparent" },
  filterChipSelected: { borderBottomColor: "#BA8BE8" },
  filterText: { color: "#9986AE", fontSize: 11, fontWeight: "800" },
  filterTextSelected: { color: "#F0DCF9" },
  roomList: { flex: 1, minHeight: 0, width: "100%" },
  roomListContent: { paddingBottom: 6 },
  emptyList: { flexGrow: 1, justifyContent: "center" },
  emptyText: { color: theme.textDim, textAlign: "center", fontSize: 13 },
  roomRow: { minHeight: 76, flexDirection: "row", alignItems: "center", paddingHorizontal: 2, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "rgba(181,164,205,0.19)" },
  roomInfo: { flex: 1, minWidth: 0, paddingRight: 8 },
  roomModeLine: { flexDirection: "row", alignItems: "center", gap: 5, marginBottom: 4 },
  modeText: { color: "#95C4F2", fontSize: 9, letterSpacing: 1, textTransform: "uppercase", fontWeight: "900" },
  customModeText: { color: "#D5AFEF" },
  leaderName: { color: "#F5EBDC", fontSize: 15, fontWeight: "800" },
  roomMeta: { color: "#B09DBF", fontSize: 10, marginTop: 3 },
  joinRoomButton: { minWidth: 74, flexDirection: "row", gap: 7, paddingHorizontal: 6, paddingVertical: 12, alignItems: "center", justifyContent: "flex-end" },
  joinRoomText: { color: "#D7B9F5", fontSize: 12, fontWeight: "900" },
  disabled: { opacity: 0.4 },
  actionButton: { width: "100%", minWidth: 0, minHeight: 42, backgroundColor: "#42679C", paddingVertical: 9, borderRadius: 10 },
  error: { color: theme.danger, marginBottom: 4, fontSize: 11 },
});
