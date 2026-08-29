import React from "react";
import { Platform, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { theme } from "./ui";

export function DamageHud({ state, myPlayerId }: { state: any; myPlayerId: string }) {
  const { t } = useTranslation();
  if (state?.gameMode !== "damage") return null;
  const players = [...state.players.values()] as any[];

  return (
    <View style={styles.hud}>
      {players.map((player, index) => (
        <React.Fragment key={player.id}>
          {index === 1 ? <Text style={styles.vs}>VS</Text> : null}
          <View style={styles.fighter}>
            {(() => {
              const shieldReady = player.shieldPending || player.shield > 0;
              return <>
            <View style={styles.header}>
              <Text numberOfLines={1} style={[styles.name, { color: player.nameColor || theme.text }]}>{player.name}{player.id === myPlayerId ? ` (${t("common.you")})` : ""}</Text>
              <Text style={styles.healthText}>{player.health}/15 HP</Text>
            </View>
            <View style={[styles.healthTrack, shieldReady && styles.healthTrackShielded]}>
              <View style={[styles.healthFill, shieldReady && player.health >= 15 && styles.healthFillShielded, { width: `${Math.max(0, Math.min(100, player.health / 15 * 100))}%` }]} />
            </View>
            <View style={styles.statusRow}>
              <Text style={[styles.shield, shieldReady && styles.shieldReady]}>{t("damage.shield")}: {shieldReady ? t("damage.ready") : t("damage.notReady")}</Text>
              <Text style={styles.streak}>{t("damage.streak", { count: player.damageStreak })}</Text>
            </View>
              </>;
            })()}
          </View>
        </React.Fragment>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  hud: { width: Platform.OS === "android" ? "90%" : "78%", maxWidth: Platform.OS === "android" ? 720 : 620, alignSelf: "center", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, marginBottom: 5 },
  fighter: { flex: 1, minWidth: 0 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 },
  name: { color: theme.text, flex: 1, fontSize: 11, fontWeight: "800" },
  healthText: { color: "#FF8096", fontSize: 11, fontWeight: "900" },
  healthTrack: { width: "100%", height: 8, borderRadius: 4, overflow: "hidden", backgroundColor: "rgba(255,255,255,0.12)", marginTop: 3 },
  healthFill: { height: "100%", backgroundColor: "#FF5C7A" },
  healthTrackShielded: { backgroundColor: "#7CCBFF" },
  healthFillShielded: { backgroundColor: "#7CCBFF" },
  statusRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 2 },
  shield: { color: "#7CCBFF", fontSize: 9, fontWeight: "800" },
  shieldReady: { color: "#A8DEFF" },
  streak: { color: "#FFD166", fontSize: 9, fontWeight: "800" },
  vs: { color: theme.textDim, fontSize: 10, fontWeight: "900" },
});
