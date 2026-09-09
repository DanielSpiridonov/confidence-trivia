import React from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";
import { theme } from "./ui";

export type FeedbackKind = "error" | "success" | "info";
export interface FeedbackNotice { id: number; title: string; message?: string; kind: FeedbackKind; }

export function useFeedbackPopup() {
  const [notice, setNotice] = React.useState<FeedbackNotice | null>(null);
  const showFeedback = React.useCallback((title: string, message?: string, kind: FeedbackKind = "error") => setNotice({ id: Date.now(), title, message, kind }), []);
  const clearFeedback = React.useCallback(() => setNotice(null), []);
  return { notice, showFeedback, clearFeedback };
}

export function FeedbackPopup({ notice, onDismiss }: { notice: FeedbackNotice | null; onDismiss: () => void }) {
  const opacity = React.useRef(new Animated.Value(0)).current;
  const translateY = React.useRef(new Animated.Value(-8)).current;

  React.useEffect(() => {
    if (!notice) return;
    opacity.setValue(0); translateY.setValue(-8);
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 160, useNativeDriver: true }),
      Animated.spring(translateY, { toValue: 0, damping: 18, stiffness: 240, useNativeDriver: true }),
    ]).start();
    const timer = setTimeout(() => Animated.timing(opacity, { toValue: 0, duration: 240, useNativeDriver: true }).start(onDismiss), notice.kind === "error" ? 4_500 : 3_000);
    return () => clearTimeout(timer);
  }, [notice?.id, notice?.kind, onDismiss, opacity, translateY]);

  if (!notice) return null;
  return <Animated.View style={[styles.popup, styles[notice.kind], { opacity, transform: [{ translateY }] }]}>
    <View style={styles.copy}><Text style={styles.title}>{notice.title}</Text>{notice.message ? <Text style={styles.message}>{notice.message}</Text> : null}</View>
    <Pressable accessibilityRole="button" onPress={onDismiss} hitSlop={8}><Text style={styles.close}>×</Text></Pressable>
  </Animated.View>;
}

const styles = StyleSheet.create({
  popup: { position: "absolute", top: 66, right: 18, zIndex: 100, elevation: 12, width: 292, minHeight: 58, paddingHorizontal: 13, paddingVertical: 10, borderRadius: 12, flexDirection: "row", alignItems: "flex-start", gap: 9, backgroundColor: "rgba(31,26,51,0.98)", borderWidth: 1 },
  error: { borderColor: "#FF7587" }, success: { borderColor: "#63D991" }, info: { borderColor: theme.primary },
  copy: { flex: 1 }, title: { color: "#FFF", fontSize: 13, fontWeight: "900" }, message: { color: theme.textDim, fontSize: 10, lineHeight: 14, fontWeight: "700", marginTop: 3 },
  close: { color: theme.textDim, fontSize: 20, lineHeight: 21, fontWeight: "700" },
});
