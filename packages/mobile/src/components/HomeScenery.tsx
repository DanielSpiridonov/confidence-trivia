import React from "react";
import { Image, StyleProp, StyleSheet, View, ViewStyle } from "react-native";
import Svg, { Defs, Ellipse, RadialGradient, Stop } from "react-native-svg";
import { GAME_BACKGROUND, ScreenFrameContext } from "./ui";

export const HOME_SCENE_BACKGROUND = GAME_BACKGROUND;
const LEFT_FOREGROUND = require("../../assets/left-side-clump.png");
const RIGHT_FOREGROUND = require("../../assets/right-side-clump.png");

function MutedSceneArtwork({ source, style }: { source: number; style: StyleProp<ViewStyle> }) {
  return <View style={[s.artwork, style]}>
    <Image accessible={false} source={source} defaultSource={source} fadeDuration={0} resizeMode="contain" style={s.artworkImage} />
    {/* The grey pass follows the PNG's alpha, softening color without tinting
        the transparent space around it or requiring platform-specific filters. */}
    <Image accessible={false} source={source} defaultSource={source} fadeDuration={0} resizeMode="contain" style={[s.artworkImage, s.artworkTone]} />
  </View>;
}

// Scene elements attach to the full app frame; safe-area padding applies to
// controls, not the scenery. Both source cutouts are 1448 × 1086 RGBA PNGs.
export const HomeScenery = React.memo(function HomeScenery() {
  const id = React.useId().replace(/[^a-zA-Z0-9]/g, "");
  return <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={s.scene}>
    <Svg width="100%" height="100%" viewBox="0 0 844 390" preserveAspectRatio="none" accessible={false}>
      <Defs>
        <RadialGradient id={`${id}purple`}><Stop offset="0" stopColor="#8234D6" stopOpacity="0.28" /><Stop offset="0.5" stopColor="#7130AA" stopOpacity="0.12" /><Stop offset="1" stopColor="#7130AA" stopOpacity="0" /></RadialGradient>
        <RadialGradient id={`${id}blue`}><Stop offset="0" stopColor="#2B65BC" stopOpacity="0.15" /><Stop offset="1" stopColor="#2B65BC" stopOpacity="0" /></RadialGradient>
        <RadialGradient id={`${id}gold`}><Stop offset="0" stopColor="#E69229" stopOpacity="0.27" /><Stop offset="0.5" stopColor="#BA6315" stopOpacity="0.11" /><Stop offset="1" stopColor="#BA6315" stopOpacity="0" /></RadialGradient>
      </Defs>
      <Ellipse cx="235" cy="280" rx="230" ry="175" fill={`url(#${id}purple)`} />
      <Ellipse cx="445" cy="245" rx="160" ry="165" fill={`url(#${id}blue)`} />
      <Ellipse cx="680" cy="285" rx="210" ry="165" fill={`url(#${id}gold)`} />
    </Svg>
  </View>;
});

export const HomeForeground = React.memo(function HomeForeground() {
  const frame = React.useContext(ScreenFrameContext);
  const leftWidth = Math.min(frame.width * 0.36, frame.height * 0.85) * 0.85;
  const rightWidth = Math.min(frame.width * 0.46, frame.height * 1.15) * 0.85;
  return <View testID="home-foreground" pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[s.foreground, frame]}>
    <MutedSceneArtwork source={LEFT_FOREGROUND} style={[s.left, {width:leftWidth,height:leftWidth * 0.75}]} />
    <MutedSceneArtwork source={RIGHT_FOREGROUND} style={[s.right, {width:rightWidth,height:rightWidth * 0.75,bottom:-frame.height * 0.085,right:-frame.width * 0.03825}]} />
  </View>;
});

const s = StyleSheet.create({
  scene: { ...StyleSheet.absoluteFillObject, overflow: "hidden", opacity: 0.55 },
  foreground: { position: "absolute", overflow: "hidden", zIndex: 3 },
  artwork: { opacity: 0.84 },
  artworkImage: { ...StyleSheet.absoluteFillObject, width: "100%", height: "100%" },
  artworkTone: { opacity: 0.22, tintColor: "#403C49" },
  left: { position: "absolute", left: 0, bottom: 0 },
  right: { position: "absolute", right: 0, bottom: 0 },
});
