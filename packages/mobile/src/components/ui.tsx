import React from "react";
import { View, Text, Pressable, StyleSheet, TextStyle, ViewStyle, StyleProp, Keyboard, Platform, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { playSound, SoundEffect } from "../audio/sounds";
import { menuTap } from "./menuHaptics";
import { getDesignCanvasLayout } from "./designCanvasLayout";

const CONTROL_WIDTH = "100%";
const CONTENT_WIDTH = "100%";
export const GAME_BACKGROUND = require("../../assets/game-background.png");
const ANDROID_DESIGN_WIDTH = 844;
const ANDROID_DESIGN_HEIGHT = 390;
// Fit the landscape layout as a whole, keeping controls and absolute-positioned
// decorations in the same proportions on phones, tablets, and resized windows.
const ANDROID_UI_SCALE = 1.126026;
export const ANDROID_MENU_UI_SCALE = ANDROID_UI_SCALE * 0.95;
export const ANDROID_COMPACT_MENU_UI_SCALE = ANDROID_MENU_UI_SCALE * 0.95;
export const ANDROID_GAME_UI_SCALE = 0.982278;
export const ScreenScaleContext = React.createContext(1);

function DesignCanvas({ children, style, uiScale, overflowScale }: { children: React.ReactNode; style?: ViewStyle; uiScale: number; overflowScale: number }) {
  const insets = useSafeAreaInsets();
  const window = useWindowDimensions();
  const [bounds, setBounds] = React.useState<{ width: number; height: number } | null>(null);
  const layout = getDesignCanvasLayout(bounds?.width ?? window.width, bounds?.height ?? window.height, insets, Platform.OS === "ios", uiScale, overflowScale);
  const { scale, paddingLeft, paddingRight, paddingTop, paddingBottom } = layout;

  return (
    <View onLayout={(event) => setBounds(event.nativeEvent.layout)} style={[styles.androidSafeArea, { paddingLeft, paddingRight, paddingTop, paddingBottom }]}>
      <View style={styles.androidViewport}>
        <View style={[styles.androidCanvas, { width: layout.canvasWidth, height: layout.canvasHeight, transform: [{ scale }] }]}>
          <ScreenScaleContext.Provider value={scale}>
            <View style={[styles.content, style]}>{children}</View>
          </ScreenScaleContext.Provider>
        </View>
      </View>
    </View>
  );
}

export function Screen({ children, style, androidScale = ANDROID_UI_SCALE, androidOverflowScale = 1 }: { children: React.ReactNode; style?: ViewStyle; androidScale?: number; androidOverflowScale?: number }) {
  return (
    <View
      onTouchStart={Keyboard.dismiss}
      style={styles.screen}
      accessible={false}
    >
      <View style={styles.background}>
        <DesignCanvas style={style} uiScale={Platform.OS === "android" ? androidScale : 1} overflowScale={Platform.OS === "android" ? androidOverflowScale : 1}>{children}</DesignCanvas>
      </View>
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
  lobbyHaptic = false,
}: {
  label: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "danger";
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  soundEffect?: SoundEffect;
  lobbyHaptic?: boolean;
}) {
  function handlePress() {
    menuTap(lobbyHaptic);
    playSound(soundEffect);
    onPress();
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
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
      <Text maxFontSizeMultiplier={1.35} style={[styles.buttonText, variant === "secondary" && styles.buttonTextSecondary, textStyle]}>
        {label}
      </Text>
    </Pressable>
  );
}

export function Title({ children }: { children: React.ReactNode }) {
  return <Text maxFontSizeMultiplier={1.3} style={styles.title}>{children}</Text>;
}

export function Subtitle({ children }: { children: React.ReactNode }) {
  return <Text maxFontSizeMultiplier={1.4} style={styles.subtitle}>{children}</Text>;
}

export function BackIconButton({ label, onPress, disabled = false }: { label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      hitSlop={10}
      onPress={() => { menuTap(); onPress(); }}
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
  androidSafeArea: {
    flex: 1,
    width: "100%",
  },
  androidViewport: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  androidCanvas: {
    width: ANDROID_DESIGN_WIDTH,
    height: ANDROID_DESIGN_HEIGHT,
    transformOrigin: "center",
  },
  content: {
    flex: 1,
    width: CONTENT_WIDTH,
    alignSelf: "center",
    maxWidth: Platform.OS === "android" ? 820 : undefined,
    paddingHorizontal: Platform.OS === "android" ? 10 : 12,
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
