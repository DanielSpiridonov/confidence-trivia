import React, { useEffect, useRef, useState } from "react";
import { Text, StyleSheet } from "react-native";
import { theme } from "./ui";
import { playSound } from "../audio/sounds";

/**
 * Renders a countdown purely from the server's `phaseEndsAt` timestamp.
 * The server owns when the phase actually ends (see GameRoom.setPhase) —
 * this component never decides that itself, it only displays it, per the
 * "server-authoritative timing" requirement.
 */
export function PhaseTimer({ phaseEndsAt }: { phaseEndsAt: number }) {
  const secondsLeft = usePhaseSecondsLeft(phaseEndsAt);
  const countdownPlayed = useRef(false);

  useEffect(() => {
    countdownPlayed.current = false;
  }, [phaseEndsAt]);

  useEffect(() => {
    if (secondsLeft !== 5 || countdownPlayed.current) return;
    countdownPlayed.current = true;
    playSound("gameCountdown");
  }, [secondsLeft]);

  return (
    <Text
      style={[
        styles.timer,
        secondsLeft <= 3 && styles.timerUrgent,
      ]}
    >
      {secondsLeft}s
    </Text>
  );
}

export function usePhaseSecondsLeft(phaseEndsAt: number) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, []);

  return Math.max(0, Math.ceil((phaseEndsAt - now) / 1000));
}

const styles = StyleSheet.create({
  timer: {
    position: "absolute",
    color: theme.textDim,
    fontSize: 22,
    fontWeight: "800",
    textAlign: "left",
    top: 12,
    left: 12,
    zIndex: 1,
  },
  timerUrgent: {
    color: theme.danger,
  },
});
