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
  panel: { width: "68%", maxWidth: 480, minHeight: 164, paddingHorizontal: 22, paddingTop: 22, paddingBottom: 17, overflow: "hidden", borderRadius: 8, alignItems: "center", backgroundColor: "#211A36", borderWidth: 1, borderColor: "rgba(185,176,214,0.32)", shadowColor: "#000", shadowOpacity: 0.3, shadowRadius: 12 },
  accent: { position: "absolute", top: 0, left: 0, right: 0, height: 2, backgroundColor: "rgba(185,170,255,0.72)" },
  title: { color: "#FFF", fontSize: 19, fontWeight: "900", textAlign: "center" },
  message: { maxWidth: 410, color: theme.textDim, fontSize: 12, lineHeight: 17, fontWeight: "700", textAlign: "center", marginTop: 7 },
  actions: { width: "100%", flexDirection: "row", justifyContent: "center", gap: 9, marginTop: 18 },
  button: { minWidth: 124, minHeight: 38, paddingHorizontal: 17, borderRadius: 6, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  cancelButton: { backgroundColor: "rgba(255,255,255,0.035)", borderColor: "rgba(185,176,214,0.28)" },
  confirmButton: { backgroundColor: "rgba(124,92,255,0.24)", borderColor: "rgba(185,170,255,0.72)" },
  destructiveButton: { backgroundColor: "rgba(169,54,76,0.72)", borderColor: "rgba(255,138,155,0.78)" },
  cancelText: { color: "#C9C1DA", fontSize: 12, fontWeight: "800" }, confirmText: { color: "#F4F1FF", fontSize: 12, fontWeight: "900" },
  pressed: { opacity: 0.72, transform: [{ scale: 0.98 }] },
});
