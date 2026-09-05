import React, { useCallback, useEffect, useMemo, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
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
  const [modeFilter, setModeFilter] = useState<"all" | "classic" | "ranked" | "damage">("all");
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
    <Screen style={styles.screen} androidScale={ANDROID_MENU_UI_SCALE}>
      <BackIconButton label={t("common.back")} onPress={onBack} disabled={Boolean(joiningRoomId)} />
      <Title>{t("home.joinGame")}</Title>
      <View style={styles.columns}>
        <View style={styles.leftColumn}>
          <View style={styles.input}><Text numberOfLines={1} style={styles.playerNameText}>{initialName}</Text></View>
          <TextInput
            style={[styles.input, styles.codeInput]}
            placeholder={t("join.roomCode") as string}
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
          <TextInput
            style={styles.searchInput}
            placeholder={t("join.searchLeader") as string}
            placeholderTextColor={theme.textDim}
            value={search}
            onChangeText={setSearch}
          />
          <View style={styles.filterRow}>
            {(["all", "classic", "ranked", "damage"] as const).map((mode) => {
              const selected = modeFilter === mode;
              return (
                <Pressable key={mode} onPress={() => setModeFilter(mode)} style={[styles.filterChip, selected && styles.filterChipSelected]}>
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
                  <Text numberOfLines={1} style={styles.leaderName}>{item.leaderName}</Text>
                  <Text style={styles.roomMeta}>{item.gameMode === "damage"
                    ? t("join.damageRoomMeta", { players: item.playerCount, max: item.maxClients })
                    : t("join.roomMeta", { players: item.playerCount, max: item.maxClients, rounds: item.roundCount })}</Text>
                </View>
                <Pressable
                  onPress={() => void joinListedRoom(item.roomId)}
                  disabled={!trimmedName || Boolean(joiningRoomId)}
                  style={[styles.joinRoomButton, (!trimmedName || Boolean(joiningRoomId)) && styles.disabled]}
                >
                  <Text style={styles.joinRoomText}>{joiningRoomId === item.roomId ? t("join.joining") : t("join.join")}</Text>
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
  columns: { flex: 1, minHeight: 0, width: "100%", flexDirection: "row", gap: 24, alignItems: "stretch" },
  leftColumn: { width: "38%", minWidth: 0, justifyContent: "center" },
  rightColumn: { flex: 1, minWidth: 0 },
  input: { width: "100%", minHeight: 54, backgroundColor: theme.surface, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 13, marginBottom: 10, justifyContent: "center" },
  playerNameText: { color: theme.text, fontSize: 15, fontWeight: "800" },
  codeInput: { letterSpacing: 2, textAlign: "center" },
  searchInput: { width: "100%", color: theme.text, backgroundColor: "transparent", paddingHorizontal: 4, paddingVertical: 8, fontSize: 14, marginBottom: 4 },
  filterRow: { width: "100%", flexDirection: "row", gap: 6, marginBottom: 7 },
  filterChip: { flex: 1, minWidth: 0, alignItems: "center", justifyContent: "center", paddingHorizontal: 5, paddingVertical: 6, borderRadius: 8, backgroundColor: "rgba(31, 26, 51, 0.78)", borderWidth: 1, borderColor: "rgba(185, 176, 214, 0.22)" },
  filterChipSelected: { backgroundColor: "rgba(124, 92, 255, 0.25)", borderColor: theme.primary },
  filterText: { color: theme.textDim, fontSize: 10, fontWeight: "800" },
  filterTextSelected: { color: theme.text },
  roomList: { flex: 1, minHeight: 0, width: "100%" },
  roomListContent: { paddingBottom: 6 },
  emptyList: { flexGrow: 1, justifyContent: "center" },
  emptyText: { color: theme.textDim, textAlign: "center", fontSize: 14 },
  roomRow: { minHeight: 54, flexDirection: "row", alignItems: "center", backgroundColor: theme.surface, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7, marginBottom: 7 },
  roomInfo: { flex: 1, minWidth: 0, paddingRight: 12 },
  leaderName: { color: theme.text, fontSize: 15, fontWeight: "800" },
  roomMeta: { color: theme.textDim, fontSize: 11, marginTop: 2 },
  joinRoomButton: { minWidth: 92, backgroundColor: theme.primary, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 9, alignItems: "center" },
  joinRoomText: { color: theme.text, fontSize: 13, fontWeight: "800" },
  disabled: { opacity: 0.4 },
  actionButton: { width: "100%", minWidth: 0 },
  error: { color: theme.danger, marginBottom: 2, textAlign: "center", fontSize: 12 },
});
