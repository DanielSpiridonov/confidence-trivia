import React, { useState } from "react";
import { LayoutChangeEvent, View, Text, Pressable, StyleSheet, TextStyle, ViewStyle, StyleProp, Keyboard, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { playSound, SoundEffect } from "../audio/sounds";

const CONTROL_WIDTH = "100%";
const CONTENT_WIDTH = "100%";
export const GAME_BACKGROUND = require("../../assets/game-background.png");
const ANDROID_DESIGN_WIDTH = 844;
const ANDROID_DESIGN_HEIGHT = 390;
const ANDROID_UI_SCALE = 0.94;
export const ANDROID_MENU_UI_SCALE = ANDROID_UI_SCALE * 0.95;
export const ANDROID_COMPACT_MENU_UI_SCALE = ANDROID_MENU_UI_SCALE * 0.95;
export const ANDROID_GAME_UI_SCALE = 0.82;

function AndroidDesignCanvas({ children, style, uiScale }: { children: React.ReactNode; style?: ViewStyle; uiScale: number }) {
  const [viewport, setViewport] = useState({ width: ANDROID_DESIGN_WIDTH, height: ANDROID_DESIGN_HEIGHT });
  const scale = Math.min(
    1,
    viewport.width / ANDROID_DESIGN_WIDTH,
    viewport.height / ANDROID_DESIGN_HEIGHT,
  ) * uiScale;

  function measureViewport(event: LayoutChangeEvent) {
    const { width, height } = event.nativeEvent.layout;
    setViewport((current) => current.width === width && current.height === height ? current : { width, height });
  }

  return (
    <SafeAreaView style={styles.androidSafeArea}>
      <View style={styles.androidViewport} onLayout={measureViewport}>
        <View style={[styles.androidCanvas, { transform: [{ scale }] }]}>
          <View style={[styles.content, style]}>{children}</View>
        </View>
      </View>
    </SafeAreaView>
  );
}

export function Screen({ children, style, androidScale = ANDROID_UI_SCALE }: { children: React.ReactNode; style?: ViewStyle; androidScale?: number }) {
  const iosContent = (
    <SafeAreaView style={styles.safeArea}>
      <View style={[styles.content, style]}>
        {children}
      </View>
    </SafeAreaView>
  );

  return (
    <View
      onTouchStart={Keyboard.dismiss}
      style={styles.screen}
      accessible={false}
    >
      {Platform.OS === "android" ? (
        <View style={styles.background}>
          <AndroidDesignCanvas style={style} uiScale={androidScale}>{children}</AndroidDesignCanvas>
        </View>
      ) : (
        <View style={styles.background}>{iosContent}</View>
      )}
    </View>
  );
}

export function BigButton({
  label,
  onPress,
  variant = "primary",
  disabled = false,
  style,
  textStyle,
  soundEffect = "button",
}: {
  label: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "danger";
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  soundEffect?: SoundEffect;
}) {
  function handlePress() {
    playSound(soundEffect);
    onPress();
  }

  return (
    <Pressable
      onPress={handlePress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        style,
        variant === "secondary" && styles.buttonSecondary,
        variant === "danger" && styles.buttonDanger,
        disabled && styles.buttonDisabled,
        pressed && !disabled && styles.buttonPressed,
      ]}
    >
      <Text style={[styles.buttonText, variant === "secondary" && styles.buttonTextSecondary, textStyle]}>
        {label}
      </Text>
    </Pressable>
  );
}

export function Title({ children }: { children: React.ReactNode }) {
  return <Text style={styles.title}>{children}</Text>;
}

export function Subtitle({ children }: { children: React.ReactNode }) {
  return <Text style={styles.subtitle}>{children}</Text>;
}

export function BackIconButton({ label, onPress, disabled = false }: { label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      hitSlop={10}
      onPress={onPress}
      style={({ pressed }) => [
        styles.backIconButton,
        disabled && styles.buttonDisabled,
        pressed && !disabled && styles.backIconButtonPressed,
      ]}
    >
      <Text style={styles.backIconText}>←</Text>
    </Pressable>
  );
}

const COLORS = {
  bg: "#14101F",
  surface: "#1F1A33",
  primary: "#7C5CFF",
  primaryPressed: "#6647E0",
  text: "#FFFFFF",
  textDim: "#B9B0D6",
  danger: "#FF5C7A",
};

export const theme = COLORS;

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    width: "100%",
    justifyContent: "center",
    backgroundColor: "transparent",
  },
  background: {
    flex: 1,
    width: "100%",
  },
  safeArea: {
    flex: 1,
    width: "100%",
    paddingVertical: 20,
    justifyContent: "center",
  },
  androidSafeArea: {
    flex: 1,
    width: "100%",
  },
  androidViewport: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-start",
    overflow: "hidden",
  },
  androidCanvas: {
    width: ANDROID_DESIGN_WIDTH,
    height: ANDROID_DESIGN_HEIGHT,
    transformOrigin: "top center",
  },
  content: {
    flex: 1,
    width: CONTENT_WIDTH,
    alignSelf: "center",
    maxWidth: Platform.OS === "android" ? 820 : 720,
    paddingHorizontal: Platform.OS === "android" ? 10 : 18,
    paddingVertical: 20,
    justifyContent: "center",
  },
  title: {
    width: "100%",
    fontSize: Platform.OS === "android" ? 23 : 28,
    fontWeight: "800",
    color: COLORS.text,
    marginBottom: 8,
    textAlign: "center",
  },
  subtitle: {
    width: "100%",
    fontSize: 15,
    color: COLORS.textDim,
    marginBottom: 24,
    textAlign: "center",
  },
  backIconButton: {
    position: "absolute",
    top: 10,
    left: 12,
    zIndex: 10,
    width: Platform.OS === "android" ? 46 : 38,
    height: Platform.OS === "android" ? 46 : 38,
    alignItems: "center",
    justifyContent: "center",
  },
  backIconButtonPressed: { opacity: 0.65 },
  backIconText: {
    color: COLORS.text,
    fontSize: Platform.OS === "android" ? 38 : 28,
    lineHeight: Platform.OS === "android" ? 40 : 30,
    fontWeight: "700",
  },
  button: {
    backgroundColor: COLORS.primary,
    paddingVertical: Platform.OS === "android" ? 12 : 16,
    borderRadius: 14,
    alignItems: "center",
    marginTop: 12,
    width: CONTROL_WIDTH,
    maxWidth: Platform.OS === "android" ? 380 : 420,
    alignSelf: "center",
  },
  buttonSecondary: {
    backgroundColor: "transparent",
    borderWidth: 2,
    borderColor: COLORS.primary,
  },
  buttonDanger: {
    backgroundColor: COLORS.danger,
  },
  buttonPressed: {
    backgroundColor: COLORS.primaryPressed,
  },
  buttonDisabled: {
    opacity: 0.4,
  },
  buttonText: {
    color: COLORS.text,
    fontSize: Platform.OS === "android" ? 15 : 17,
    fontWeight: "700",
    textAlign: "center",
    flexShrink: 1,
    paddingHorizontal: 12,
  },
  buttonTextSecondary: {
    color: COLORS.primary,
  },
});
