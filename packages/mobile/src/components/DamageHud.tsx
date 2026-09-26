import React from "react";
import { Animated, Platform, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { theme } from "./ui";

const shieldStateCache = new Map<string, boolean>();

export function DamageHud({ state, myPlayerId }: { state: any; myPlayerId: string }) {
  const { t } = useTranslation();
  if (state?.gameMode !== "damage") return null;
  const allPlayers = [...state.players.values()] as any[];
  const players = [
    allPlayers.find((player) => player.id === myPlayerId),
    ...allPlayers.filter((player) => player.id !== myPlayerId),
  ].filter(Boolean) as any[];

  return (
    <View style={styles.hud}>
      {players.map((player, index) => (
        <React.Fragment key={player.id}>
          {index === 1 ? (
            <View style={styles.centerResult}>
              <Text style={styles.vs}>VS</Text>
            </View>
          ) : null}
          <FighterStatus player={player} opponent={index === 1} isMe={player.id === myPlayerId} />
        </React.Fragment>
      ))}
    </View>
  );
}

function FighterStatus({ player, opponent, isMe }: { player: any; opponent: boolean; isMe: boolean }) {
  const { t } = useTranslation();
  const shieldReady = Boolean(player.shieldPending || player.shield > 0);
  const healthPercent = Math.max(0, Math.min(100, player.health / 15 * 100));
  const wasShieldReady = shieldStateCache.get(player.id) ?? false;
  const fill = React.useRef(new Animated.Value(shieldReady && wasShieldReady ? 1 : 0)).current;
  const glow = React.useRef(new Animated.Value(0.48)).current;

  React.useEffect(() => {
    shieldStateCache.set(player.id, shieldReady);
    if (!shieldReady) {
      fill.setValue(0);
      glow.setValue(0.48);
      return;
    }
    const fillAnimation = Animated.timing(fill, { toValue: 1, duration: wasShieldReady ? 0 : 650, useNativeDriver: true });
    const glowAnimation = Animated.loop(Animated.sequence([
      Animated.timing(glow, { toValue: 0.88, duration: 850, useNativeDriver: true }),
      Animated.timing(glow, { toValue: 0.48, duration: 850, useNativeDriver: true }),
    ]));
    fillAnimation.start();
    glowAnimation.start();
    return () => { fillAnimation.stop(); glowAnimation.stop(); };
  }, [fill, glow, player.id, shieldReady, wasShieldReady]);

  return <View style={styles.fighter}>
    <View style={styles.header}>
      <Text numberOfLines={1} style={[styles.name, { color: player.nameColor || theme.text }]}>{player.name}{isMe ? ` (${t("common.you")})` : ""}</Text>
      <Text style={styles.healthText}>{player.health}/15 HP</Text>
    </View>
    <View style={[styles.healthTrack, shieldReady && styles.healthTrackShielded]}>
      <View style={[styles.healthFill, opponent && styles.healthFillOpponent, { width: `${healthPercent}%` }]} />
      {shieldReady ? <Animated.View style={[
        styles.shieldFill,
        healthPercent >= 100 ? styles.shieldFillFull : { left: `${healthPercent}%` },
        opponent && healthPercent < 100 ? { left: 0, right: `${healthPercent}%` } : null,
        { opacity: glow, transform: [{ scaleX: fill }] },
      ]} /> : null}
    </View>
    <View style={styles.statusRow}>
      <Text style={[styles.shield, shieldReady && styles.shieldReady]}>{t("damage.shield")}: {shieldReady ? t("damage.ready") : t("damage.notReady")}</Text>
      <Text style={styles.streak}>{t("damage.streak", { count: player.damageStreak })}</Text>
    </View>
  </View>;
}

const styles = StyleSheet.create({
  hud: { width: Platform.OS === "android" ? "90%" : "78%", maxWidth: Platform.OS === "android" ? 720 : 620, alignSelf: "center", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, marginBottom: 5 },
  fighter: { flex: 1, minWidth: 0 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 },
  name: { color: theme.text, flex: 1, fontSize: 11, fontWeight: "800" },
  healthText: { color: "#FF8096", fontSize: 11, fontWeight: "900" },
  healthTrack: { width: "100%", height: 8, borderRadius: 4, overflow: "hidden", backgroundColor: "rgba(255,255,255,0.12)", marginTop: 3 },
  healthFill: { height: "100%", backgroundColor: "#FF5C7A" },
  healthFillOpponent: { alignSelf: "flex-end" },
  healthTrackShielded: { backgroundColor: "rgba(124,203,255,.2)", shadowColor: "#7CCBFF", shadowOpacity: .65, shadowRadius: 5, elevation: 3 },
  shieldFill: { position: "absolute", top: 0, right: 0, bottom: 0, backgroundColor: "#7CCBFF" },
  shieldFillFull: { left: 0 },
  statusRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 2 },
  shield: { color: "#7CCBFF", fontSize: 9, fontWeight: "800" },
  shieldReady: { color: "#A8DEFF" },
  streak: { color: "#FFD166", fontSize: 9, fontWeight: "800" },
  vs: { color: theme.textDim, fontSize: 10, fontWeight: "900" },
  centerResult: { width: 42, alignItems: "center", justifyContent: "center" },
});
