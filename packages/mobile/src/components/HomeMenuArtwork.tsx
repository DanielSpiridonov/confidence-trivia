import React from "react";
import Svg, { ClipPath, Defs, Ellipse, G, LinearGradient, Path, RadialGradient, Stop } from "react-native-svg";

export type HomeMode = "create" | "join" | "endless";
export const HOME_MODE_COLORS = {
  create: { accent: "#AB63F5", light: "#DFC5FF", ink: "#21132F", edge: "#7138BA" },
  join: { accent: "#448FEB", light: "#B3DDFF", ink: "#101F35", edge: "#265DAA" },
  endless: { accent: "#F8AC35", light: "#FFE3A0", ink: "#2E1D10", edge: "#B66E1D" },
} as const;

// Repeatable dry-chalk fibers, generated once, rather than a filter or animation
// running over a full-screen texture on every frame.
function chalkFibers() {
  let seed = 47291;
  const random = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  return Array.from({ length: 170 }, (_, index) => {
    const x = random() * 240, y = random() * 350;
    return { d: `M${x.toFixed(1)} ${y.toFixed(1)}l${(3 + random() * 23).toFixed(1)} ${(-1 - random() * 8).toFixed(1)}`, opacity: 0.025 + random() * 0.075, width: index % 7 === 0 ? 2.5 : 0.7 };
  });
}
const FIBERS = chalkFibers();
const BOARD = "M13 17 38 14 45 18 84 12 122 15 156 10 181 14 222 12 224 38 229 59 225 91 230 115 226 144 230 168 226 199 231 226 226 258 230 277 224 302 225 330 199 328 180 335 154 331 124 335 100 331 73 335 51 330 22 333 24 314 16 297 20 269 15 242 20 217 15 192 19 163 14 140 19 115 14 88 19 63 15 42Z";
const CHALK_EDGE = "M20 23 51 21 72 17 105 20 131 17 164 19 192 16 218 19 216 50 222 76 218 104 222 131 219 157 224 189 220 216 224 245 220 273 223 297 218 323 195 324 172 329 146 324 118 329 92 325 66 329 43 325 26 327 28 303 22 284 27 258 21 231 25 206 21 181 25 156 20 130 25 107 20 80 25 55Z";

export const HomeCardGlow = React.memo(function HomeCardGlow({ mode }: { mode: HomeMode }) {
  const id = React.useId().replace(/[^a-zA-Z0-9]/g, "");
  const color = HOME_MODE_COLORS[mode].accent;
  return <Svg width="100%" height="100%" viewBox="0 0 320 430" preserveAspectRatio="none" accessible={false}>
    <Defs><RadialGradient id={id} cx="50%" cy="50%" rx="50%" ry="50%"><Stop offset="0" stopColor={color} stopOpacity="0.38" /><Stop offset="0.3" stopColor={color} stopOpacity="0.2" /><Stop offset="0.65" stopColor={color} stopOpacity="0.07" /><Stop offset="1" stopColor={color} stopOpacity="0" /></RadialGradient></Defs>
    <Ellipse cx="45" cy="212" rx="44" ry="192" fill={`url(#${id})`} />
    <Ellipse cx="275" cy="212" rx="44" ry="192" fill={`url(#${id})`} />
    <Ellipse cx="160" cy="383" rx="156" ry="44" fill={`url(#${id})`} />
    <Ellipse cx="160" cy="38" rx="137" ry="32" fill={`url(#${id})`} opacity="0.6" />
  </Svg>;
});

export const HomeChalkBoard = React.memo(function HomeChalkBoard({ mode, highlighted = false }: { mode: HomeMode; highlighted?: boolean }) {
  const id = React.useId().replace(/[^a-zA-Z0-9]/g, "");
  const c = HOME_MODE_COLORS[mode];
  return <Svg width="100%" height="100%" viewBox="0 0 240 350" preserveAspectRatio="none" accessible={false}>
    <Defs>
      <LinearGradient id={`${id}fill`} x1="0%" y1="0%" x2="100%" y2="100%"><Stop offset="0" stopColor={c.edge} stopOpacity="0.8" /><Stop offset="0.25" stopColor={c.ink} /><Stop offset="0.7" stopColor="#100E19" /><Stop offset="1" stopColor={c.edge} stopOpacity="0.8" /></LinearGradient>
      <RadialGradient id={`${id}bloom`} cx="80%" cy="94%" rx="85%" ry="70%"><Stop offset="0" stopColor={c.accent} stopOpacity="0.2" /><Stop offset="1" stopColor={c.accent} stopOpacity="0" /></RadialGradient>
      <LinearGradient id={`${id}rim`} x1="0%" y1="0%" x2="100%" y2="0%"><Stop offset="0" stopColor={c.accent} stopOpacity="0.28" /><Stop offset="0.12" stopColor={c.accent} stopOpacity="0" /><Stop offset="0.88" stopColor={c.accent} stopOpacity="0" /><Stop offset="1" stopColor={c.accent} stopOpacity="0.3" /></LinearGradient>
      <ClipPath id={`${id}clip`}><Path d={BOARD} /></ClipPath>
    </Defs>
    <Path d={BOARD} fill="none" stroke={c.accent} strokeWidth="22" opacity="0.06" />
    <Path d={BOARD} fill="none" stroke={c.accent} strokeWidth="13" opacity="0.12" />
    <Path d={BOARD} fill="#090810" transform="translate(3 5)" opacity="0.8" />
    <Path d={BOARD} fill={`url(#${id}fill)`} stroke={c.edge} strokeWidth="6" />
    <Path d={BOARD} fill={`url(#${id}bloom)`} />
    <Path d={BOARD} fill={`url(#${id}rim)`} />
    <G clipPath={`url(#${id}clip)`}>
      <Path d="m-7 66 70-63m-57 92L103-2M151 361l98-98m-73 100 80-77" stroke={c.accent} strokeWidth="23" opacity="0.09" />
      {FIBERS.map((fiber, i) => <Path key={i} d={fiber.d} stroke={i % 3 ? c.light : c.accent} strokeWidth={fiber.width} opacity={fiber.opacity} strokeLinecap="round" />)}
      <Path d="m13 48 33-27m-25 43 42-41m-44 56 39-35m133 279 32-32m-14 36 16-16" stroke={c.accent} opacity="0.3" strokeWidth="2" />
    </G>
    <Path d={CHALK_EDGE} fill="none" stroke={highlighted ? c.light : c.accent} strokeWidth="4" strokeLinejoin="bevel" opacity={highlighted ? 1 : 0.85} />
    <Path d="m26 33-2 48 3 20-2 23m-1 98 2 35-1 24 6 37 34 3 22-2m25 4 42-2 19 3 40-4m2-14 3-35-3-22m-2-48 3-49-3-22 1-42-4-53-31-1-27 3-38-2-24 3-35-1" fill="none" stroke={c.light} strokeWidth="0.8" opacity="0.45" />
    <Path d="m17 16 4-6 7 7m42-2 4-6 8 5m77-1 7-7 9 9m49 83 7 4-5 12m1 77 9 7-7 9m-7 102 5 8-10 7m-68 4-10 6-6-5m-72 3-7 7-5-7m-20-35-7-5 6-9M17 172l-8-7 7-10" fill="none" stroke={c.accent} strokeWidth="3" opacity="0.7" />
  </Svg>;
});

const PEOPLE = "M48 68c-17-5-28 6-27 20 2 14 21 21 31 8 7-9 4-21-4-28ZM95 39c-22 0-32 17-27 35 4 17 28 22 41 9 16-16 10-44-14-44ZM148 67c-18-2-29 11-24 26 5 14 25 16 33 3 7-12 2-25-9-29ZM10 151c-1-32 12-49 35-46 9 1 16 5 19 13M55 154c-2-41 10-61 39-62 32-1 47 24 45 62M129 114c11-13 29-11 40 1 8 9 11 22 10 36";
const TICKET = "m15 61 145-32 5 21c-13 3-11 18 3 17l5 22c-12 3-10 17 4 16l4 19-146 31-5-19c13-4 9-18-4-16l-5-20c14-4 10-19-3-17Z";
const INFINITY = "M96 94C74 67 58 42 35 44 8 46 6 89 26 106c24 21 49-17 70-39 20-22 43-36 61-15 15 18 12 48-4 55-20 10-37-14-57-40";
const CROSS_HATCH = Array.from({ length: 28 }, (_, i) => `M${12+i*6} 42l-52 114`).join(" ");

export const HomeModeIllustration = React.memo(function HomeModeIllustration({ mode }: { mode: HomeMode }) {
  const c = HOME_MODE_COLORS[mode];
  const id = React.useId().replace(/[^a-zA-Z0-9]/g, "");
  const shape = mode === "create" ? PEOPLE : mode === "join" ? TICKET : INFINITY;
  return <Svg width="100%" height="100%" viewBox={mode === "endless" ? "0 8 190 140" : "0 0 190 175"} accessible={false}>
    <Defs><ClipPath id={id}><Path d={shape} strokeWidth={mode === "endless" ? 12 : undefined} stroke={mode === "endless" ? "white" : undefined} fill={mode === "endless" ? "none" : "white"} /></ClipPath></Defs>
    <G strokeLinecap="round" strokeLinejoin="round">
      {mode === "create" ? <>
        <Path d={PEOPLE} fill={c.accent} fillOpacity="0.2" stroke={c.accent} strokeWidth="7" opacity="0.35" />
        <Path d={CROSS_HATCH} clipPath={`url(#${id})`} stroke={c.accent} strokeWidth="2" opacity="0.9" />
        <Path d={PEOPLE} fill="none" stroke={c.light} strokeWidth="2.8" />
        <Path d="m76 30-5-23 14 9L94 2l10 14 15-12-5 25Z" fill="#D6A94E" fillOpacity="0.13" stroke="#F6CF71" strokeWidth="2.4" />
        <Path d="m25 123-4 21m52-38c-8 10-10 24-10 40m77-24 6 22M32 73c-8 1-11 9-8 15m51-29c-2-10 4-15 10-16" fill="none" stroke="#FFF6E6" strokeWidth="1.2" opacity="0.8" />
        <Path d="m15 78-8-6m57-25-4-12m73 17 9-10m25 33 12-4" stroke={c.accent} strokeWidth="3" />
      </> : mode === "join" ? <>
        <Path d={TICKET} fill="#21558D" fillOpacity="0.5" stroke={c.accent} strokeWidth="7" opacity="0.65" />
        <Path d={CROSS_HATCH} clipPath={`url(#${id})`} stroke={c.accent} strokeWidth="1.8" opacity="0.65" />
        <Path d={TICKET} fill="none" stroke={c.light} strokeWidth="2.8" />
        <Path d="m46 76 92-20 9 46-92 20Z" fill="#101D32" stroke={c.light} strokeWidth="2" />
        <Path d="m68 80 4 20m-13-7 22-5m-18-5 14 13m20-23 4 20m-13-7 22-5m-18-5 14 13m20-23 4 20m-13-7 22-5m-18-5 14 13" stroke="#DAE9FA" strokeWidth="1.8" />
        <Path d="m31 61 127-27m-120 117 140-30M20 63l4 12m6 64 5 12m129-96 4 8" stroke="#F1F6FC" strokeWidth="1" opacity="0.85" />
        <Path d="m31 40-6-12m23 9-2-12m100-7 9-8m-9 135 4 12m12-18 8 10" stroke={c.light} strokeWidth="2.5" />
      </> : <>
        <Path d={INFINITY} fill="none" stroke={c.accent} strokeWidth="18" opacity="0.12" />
        <Path d={INFINITY} fill="none" stroke={c.accent} strokeWidth="12" />
        <Path d={CROSS_HATCH} clipPath={`url(#${id})`} stroke="#FFF3CE" strokeWidth="1" opacity="0.85" />
        <Path d={INFINITY} fill="none" stroke={c.light} strokeWidth="1.6" transform="translate(-3 -3)" />
        <Path d={INFINITY} fill="none" stroke="#FFF4DD" strokeWidth="1" transform="translate(3 3)" opacity="0.7" />
        <Path d="m21 33-8-12m29 8-4-13m109 14 4-13m13 25 10-9M13 92 3 96m163-2 14 5m-43 27 6 11m-95-15-6 12" stroke={c.accent} strokeWidth="3" />
        <Path d="m19 21-5-12 6 3 5 10m147 9 6-15 4-1-5 18" fill={c.light} stroke={c.accent} strokeWidth="1.2" />
        <Path d="m33 156 24-4 35 2 35-3 31 2" fill="none" stroke={c.accent} strokeWidth="1.1" opacity="0.5" />
      </>}
      <Path d="m8 113-5 4m175 0 6 5" stroke="#F0C66D" strokeWidth="2.5" />
    </G>
  </Svg>;
});

