import React from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";
import { theme } from "./ui";

export interface GameDialogOptions {
  title: string;
  message?: string;
  confirmLabel: string;
  cancelLabel: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel?: () => void;
}

export function useGameDialog() {
  const [dialog, setDialog] = React.useState<GameDialogOptions | null>(null);
  const dialogRef = React.useRef<GameDialogOptions | null>(null);
  const showDialog = React.useCallback((options: GameDialogOptions) => { dialogRef.current = options; setDialog(options); }, []);
  const dismissDialog = React.useCallback(() => {
    const current = dialogRef.current; dialogRef.current = null; setDialog(null); current?.onCancel?.();
  }, []);
  const confirmDialog = React.useCallback(() => {
    const current = dialogRef.current; dialogRef.current = null; setDialog(null); current?.onConfirm();
  }, []);
  return { dialog, showDialog, dismissDialog, confirmDialog };
}

export function GameDialog({ dialog, onCancel, onConfirm }: { dialog: GameDialogOptions | null; onCancel: () => void; onConfirm: () => void }) {
  const opacity = React.useRef(new Animated.Value(0)).current;
  const scale = React.useRef(new Animated.Value(0.92)).current;
  React.useEffect(() => {
    if (!dialog) return;
    opacity.setValue(0); scale.setValue(0.92);
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 150, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, damping: 17, stiffness: 230, useNativeDriver: true }),
    ]).start();
  }, [dialog, opacity, scale]);
  if (!dialog) return null;
  return <Animated.View style={[styles.backdrop, { opacity }]}>
    <Pressable onPress={onCancel} style={StyleSheet.absoluteFillObject} />
    <Animated.View style={[styles.panel, { transform: [{ scale }] }]}>
      <View style={styles.accent} />
      <Text style={styles.title}>{dialog.title}</Text>
      {dialog.message ? <Text style={styles.message}>{dialog.message}</Text> : null}
      <View style={styles.actions}>
        <Pressable onPress={onCancel} style={({ pressed }) => [styles.button, styles.cancelButton, pressed && styles.pressed]}><Text style={styles.cancelText}>{dialog.cancelLabel}</Text></Pressable>
        <Pressable onPress={onConfirm} style={({ pressed }) => [styles.button, dialog.destructive ? styles.destructiveButton : styles.confirmButton, pressed && styles.pressed]}><Text style={styles.confirmText}>{dialog.confirmLabel}</Text></Pressable>
      </View>
    </Animated.View>
  </Animated.View>;
}

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, zIndex: 150, elevation: 20, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(5,3,12,0.78)" },
  panel: { width: "72%", maxWidth: 520, minHeight: 178, paddingHorizontal: 24, paddingTop: 24, paddingBottom: 18, overflow: "hidden", borderRadius: 18, alignItems: "center", backgroundColor: "#211A36", borderWidth: 2, borderColor: "#7C5CFF", shadowColor: "#7C5CFF", shadowOpacity: 0.35, shadowRadius: 16 },
  accent: { position: "absolute", top: 0, left: "18%", right: "18%", height: 3, borderBottomLeftRadius: 3, borderBottomRightRadius: 3, backgroundColor: "#B9AAFF" },
  title: { color: "#FFF", fontSize: 21, fontWeight: "900", textAlign: "center" },
  message: { maxWidth: 430, color: theme.textDim, fontSize: 12, lineHeight: 17, fontWeight: "700", textAlign: "center", marginTop: 8 },
  actions: { width: "100%", flexDirection: "row", justifyContent: "center", gap: 11, marginTop: 20 },
  button: { minWidth: 132, minHeight: 43, paddingHorizontal: 18, borderRadius: 11, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  cancelButton: { backgroundColor: "rgba(79,71,99,0.72)", borderColor: "rgba(185,176,214,0.35)" },
  confirmButton: { backgroundColor: theme.primary, borderColor: "#B9AAFF" },
  destructiveButton: { backgroundColor: "#A9364C", borderColor: "#FF8A9B" },
  cancelText: { color: "#D5CEE6", fontSize: 13, fontWeight: "900" }, confirmText: { color: "#FFF", fontSize: 13, fontWeight: "900" },
  pressed: { opacity: 0.78, transform: [{ scale: 0.97 }] },
});
