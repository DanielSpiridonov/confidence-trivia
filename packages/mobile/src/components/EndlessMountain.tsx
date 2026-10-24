import React from "react";
import Svg, { G, Path } from "react-native-svg";

/** Inline artwork: no image request, bitmap decode, or delayed placeholder. */
export function EndlessMountain() {
  return <Svg accessible={false} width="100%" height="100%" viewBox="0 0 360 250">
    <G strokeLinecap="round" strokeLinejoin="round">
      <Path d="M12 227 72 157 99 182 169 65 184 49 246 157 268 138 346 231Z" fill="#21152F" />
      <Path d="M23 228 72 159 94 184M84 200 145 99 182 49 245 159M207 199 267 138 339 229" fill="none" stroke="#B79ACF" strokeWidth="2.5" />
      <Path d="M91 184 147 97 184 51 246 160M13 227 70 157 99 183M246 168 268 141 347 231" fill="none" stroke="#EEDDF8" strokeWidth="1.3" />
      <Path d="m148 98 13-8 7 5 15-43 12 27 9 5 16 35-20-15-9-19-7 4-10-11-7 18-10-3-12 13Z" fill="#EAD6F5" opacity="0.88" />
      <Path d="m72 159 8 19-9-7-8 13M268 142l15 35-15-17-9 10M100 182l-12 26M245 160l-16 22" fill="none" stroke="#DDC3EF" strokeWidth="2" />
      <Path d="m180 57-30 48m32-36-20 35m29-23 16 29m-14-16 20 28m-67-3-27 44m25-31-24 42m13-6-31 42m38-39-22 32m91-58 17 36m-9-10 17 34m-9-5 14 25m35-47 20 42m-12-12 15 31m-43-36-12 22m-178-3-15 22m24-25-16 31m42-8-19 28m33-27-14 25m110-26 15 21m11-17 12 22m-103-11-11 17m118-16 13 22" fill="none" stroke="#9970B9" strokeWidth="1.5" opacity="0.8" />
      <Path d="M184 88c-32 25 30 17 7 37-15 12-37 11-40 22-6 15 56 9 58 27 3 18-91 23-83 41 5 11 70 9 104 29" fill="none" stroke="#F1DEFA" strokeWidth="5" />
      <Path d="M180 92c-23 21 30 18 6 35-17 11-42 14-31 24 13 11 57 9 51 25-9 18-90 21-75 39 10 11 69 10 92 28" fill="none" stroke="#B89ACF" strokeWidth="1.4" />
      <Path d="m121 217 11-3m-8 9 20-6m-4 13 16-8m0 14 19-10m-2 16 17-11m2 14 14-8" stroke="#F1DEFA" strokeWidth="1.5" />
      <Path d="M183 50V13" stroke="#F3E5FF" strokeWidth="2.5" />
      <Path d="M186 14c12-8 20 13 41 5-11 16-26 4-41 14Z" fill="#9D5BDA" stroke="#DFC2FA" strokeWidth="1.4" />
      <Path d="m191 18 8 2m-7 5 18 1m-9-7 8 4" stroke="#E6C6FF" strokeWidth="1" />
      <Path d="m124 50 9 14m-22 20 15 8m112-41-9 14m22 19-15 8m-102 33-8 2m108-5 9 2" stroke="#E9C778" strokeWidth="2.5" />
      <Path d="M16 120c-5-9 7-17 15-10-1-20 27-22 32-5 16-7 28 14 12 18H19m257-32c-3-10 9-17 16-10 1-19 28-18 30-2 16-6 27 12 13 16h-55" fill="none" stroke="#795495" strokeWidth="2" />
      <Path d="m17 233 52-8 32 7m138-3 42 5 60-2M45 238l31-4m190 7 40-5" stroke="#745086" strokeWidth="1.5" />
    </G>
  </Svg>;
}
