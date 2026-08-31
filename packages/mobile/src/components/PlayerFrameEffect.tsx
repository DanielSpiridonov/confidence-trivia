import React from "react";
import { Animated, StyleSheet, View, ViewStyle } from "react-native";

const PARTICLE_POSITIONS = [8, 27, 50, 73, 92] as const;
type EffectFrameId = "flame" | "water" | "leaves" | "frost" | "lightning" | "ice";

const EFFECTS: Record<EffectFrameId, { border: string; glow: string; duration: number }> = {
  flame: { border: "#FF8A32", glow: "#FF3D1F", duration: 1_150 },
  water: { border: "#55D9FF", glow: "#168BFF", duration: 1_650 },
  leaves: { border: "#73D85B", glow: "#2C9B45", duration: 1_850 },
  frost: { border: "#C9F5FF", glow: "#83DFFF", duration: 1_550 },
  lightning: { border: "#FFE75C", glow: "#A879FF", duration: 900 },
  ice: { border: "#8ADFFF", glow: "#D9FAFF", duration: 2_050 },
};

function isEffectFrame(frameId?: string): frameId is EffectFrameId {
  return Boolean(frameId && frameId in EFFECTS);
}

export function PlayerFrameEffect({ frameId }: { frameId?: string }) {
  const glow = React.useRef(new Animated.Value(0.42)).current;
  const motion = React.useRef(new Animated.Value(0)).current;
  const effect = isEffectFrame(frameId) ? EFFECTS[frameId] : null;

  React.useEffect(() => {
    if (!effect) return;
    const glowLoop = Animated.loop(Animated.sequence([
      Animated.timing(glow, { toValue: 1, duration: frameId === "lightning" ? 130 : 560, useNativeDriver: true }),
      Animated.timing(glow, { toValue: 0.42, duration: frameId === "lightning" ? 680 : 700, useNativeDriver: true }),
    ]));
    const particleLoop = Animated.loop(Animated.timing(motion, { toValue: 1, duration: effect.duration, useNativeDriver: true }));
    glowLoop.start();
    particleLoop.start();
    return () => {
      glowLoop.stop();
      particleLoop.stop();
      glow.setValue(0.42);
      motion.setValue(0);
    };
  }, [effect, frameId, glow, motion]);

  if (!effect || !isEffectFrame(frameId)) return null;

  return (
    <View pointerEvents="none" style={styles.frame}>
      <Animated.View style={[styles.glowBorder, { borderColor: effect.border, shadowColor: effect.glow, opacity: glow }]} />
      {PARTICLE_POSITIONS.map((left, index) => {
        const isLeaves = frameId === "leaves";
        const isCrystal = frameId === "frost" || frameId === "ice";
        return (
          <Animated.View
            key={left}
            style={[
              styles.particle,
              getParticleStyle(frameId, index),
              {
                left: `${left}%`,
                opacity: motion.interpolate({ inputRange: [0, 0.16, 0.78, 1], outputRange: [0, 1, 0.82, 0] }),
                transform: [
                  { translateX: motion.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, isLeaves ? (index % 2 ? 6 : -6) : 0, isLeaves ? (index % 2 ? -4 : 4) : 0] }) },
                  { translateY: motion.interpolate({ inputRange: [0, 1], outputRange: isLeaves ? [-9 - index, 14 + (index % 2) * 5] : [5 + (index % 3) * 2, -12 - (index % 2) * 6] }) },
                  { rotate: motion.interpolate({ inputRange: [0, 1], outputRange: ["0deg", isLeaves ? `${220 + index * 25}deg` : isCrystal ? "180deg" : frameId === "lightning" ? "18deg" : "0deg"] }) },
                  { scale: motion.interpolate({ inputRange: [0, 0.45, 1], outputRange: [0.55, 1.12, 0.35] }) },
                ],
              },
            ]}
          />
        );
      })}
    </View>
  );
}

function getParticleStyle(frameId: EffectFrameId, index: number): ViewStyle {
  switch (frameId) {
    case "flame": return { width: 5, height: 7, borderRadius: 4, backgroundColor: index % 2 ? "#FF4B27" : "#FFD34E" };
    case "water": return { width: 7, height: 7, borderRadius: 4, borderWidth: 1.5, borderColor: index % 2 ? "#E0FAFF" : "#55D9FF", backgroundColor: "rgba(46, 157, 255, 0.22)" };
    case "leaves": return { width: 8, height: 5, borderTopLeftRadius: 6, borderBottomRightRadius: 6, backgroundColor: index % 2 ? "#A8E85B" : "#3EAD55" };
    case "frost": return { width: 5, height: 5, borderRadius: 1, backgroundColor: index % 2 ? "#FFFFFF" : "#BCEEFF" };
    case "lightning": return { width: 3, height: 10, borderRadius: 1, backgroundColor: index % 2 ? "#FFF7A5" : "#D5B4FF" };
    case "ice": return { width: 7, height: 7, borderRadius: 1, borderWidth: 1, borderColor: "#FFFFFF", backgroundColor: index % 2 ? "#7CD8FF" : "#D9FAFF" };
  }
}

const styles = StyleSheet.create({
  frame: { ...StyleSheet.absoluteFillObject, zIndex: 2, overflow: "visible" },
  glowBorder: { ...StyleSheet.absoluteFillObject, borderRadius: 8, borderWidth: 3, backgroundColor: "transparent", shadowOpacity: 0.95, shadowRadius: 6, shadowOffset: { width: 0, height: 0 }, elevation: 3 },
  particle: { position: "absolute", bottom: -1, marginLeft: -3 },
});
