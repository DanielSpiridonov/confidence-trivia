import React, { useEffect, useRef, useState } from "react";
import { Platform, Text, StyleSheet } from "react-native";
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
  const getSecondsLeft = () => Math.max(0, Math.ceil((phaseEndsAt - Date.now()) / 1000));
  const [secondsLeft, setSecondsLeft] = useState(getSecondsLeft);

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout> | undefined;

    const tick = () => {
      const remaining = Math.max(0, phaseEndsAt - Date.now());
      setSecondsLeft(Math.ceil(remaining / 1000));
      if (remaining <= 0) return;

      // Wake just after the next displayed-second boundary instead of
      // re-rendering the entire gameplay screen four times per second.
      const untilBoundary = remaining % 1000 || 1000;
      timeout = setTimeout(tick, untilBoundary + 16);
    };

    tick();
    return () => {
      if (timeout) clearTimeout(timeout);
    };
  }, [phaseEndsAt]);

  return secondsLeft;
}

const styles = StyleSheet.create({
  timer: {
    position: "absolute",
    color: theme.textDim,
    fontSize: 22,
    fontWeight: "800",
    textAlign: "left",
    top: 12,
    left: Platform.OS === "android" ? -10 : 12,
    zIndex: 1,
  },
  timerUrgent: {
    color: theme.danger,
  },
});
