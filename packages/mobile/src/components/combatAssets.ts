import type { ImageSourcePropType } from "react-native";

export const DAMAGE_AVATARS: Record<string, ImageSourcePropType> = {
  smart_owl: require("../../assets/combat-ios/smart-owl.png"),
  clever_fox: require("../../assets/combat-ios/fox.png"),
  quiz_bot: require("../../assets/combat-ios/quiz-bot.png"),
  omniscient_avatar: require("../../assets/combat-ios/omniscient.png"),
  trivia_wizard: require("../../assets/combat-ios/trivia-wizard.png"),
  detective_avatar: require("../../assets/combat-ios/detective.png"),
  living_globe: require("../../assets/combat-ios/globe.png"),
};
export const DEFEATED_DAMAGE_AVATARS: Record<string, ImageSourcePropType> = {
  smart_owl: require("../../assets/combat-ios-defeated/smart-owl.png"),
  clever_fox: require("../../assets/combat-ios-defeated/fox.png"),
  quiz_bot: require("../../assets/combat-ios-defeated/quiz-bot.png"),
  omniscient_avatar: require("../../assets/combat-ios-defeated/omniscient.png"),
  trivia_wizard: require("../../assets/combat-ios-defeated/trivia-wizard.png"),
  detective_avatar: require("../../assets/combat-ios-defeated/detective.png"),
  living_globe: require("../../assets/combat-ios-defeated/globe.png"),
};
export const DAMAGE_AVATAR_PLACEHOLDERS: Record<string, number> = {
  smart_owl: require("../../assets/avatar-thumbnails/smart-owl.png"),
  clever_fox: require("../../assets/avatar-thumbnails/fox.png"),
  quiz_bot: require("../../assets/avatar-thumbnails/quiz-bot.png"),
  omniscient_avatar: require("../../assets/avatar-thumbnails/omniscient.png"),
  trivia_wizard: require("../../assets/avatar-thumbnails/trivia-wizard.png"),
  detective_avatar: require("../../assets/avatar-thumbnails/detective.png"),
  living_globe: require("../../assets/avatar-thumbnails/globe.png"),
};
const QUIZ_BOT_CALCULATOR: ImageSourcePropType = require("../../assets/combat-ios/quiz-bot-calculator.png");
const SMART_OWL_BOOK: ImageSourcePropType = require("../../assets/combat-ios/smart-owl-book.png");
const FOX_LIGHTBULB: ImageSourcePropType = require("../../assets/combat-ios/fox-lightbulb.png");
const OMNISCIENT_EYE: ImageSourcePropType = require("../../assets/combat-ios/omniscient-eye.png");
const WIZARD_SPELL: ImageSourcePropType = require("../../assets/combat-ios/wizard-spell.png");
const DETECTIVE_MAGNIFIER: ImageSourcePropType = require("../../assets/combat-ios/detective-magnifier.png");
const GLOBE_EARTH: ImageSourcePropType = require("../../assets/combat-ios/globe-earth.png");
export const PROJECTILE_BY_AVATAR: Record<string, ImageSourcePropType> = {
  quiz_bot: QUIZ_BOT_CALCULATOR,
  smart_owl: SMART_OWL_BOOK,
  clever_fox: FOX_LIGHTBULB,
  omniscient_avatar: OMNISCIENT_EYE,
  trivia_wizard: WIZARD_SPELL,
  detective_avatar: DETECTIVE_MAGNIFIER,
  living_globe: GLOBE_EARTH,
};

export function combatImagesForPlayers(players: Iterable<{ avatarId?: string }>): number[] {
  const ids = [...new Set([...players].map(player => player.avatarId && DAMAGE_AVATARS[player.avatarId] ? player.avatarId : "smart_owl"))];
  // Fighters first; defeat art and projectiles follow. Never fetch unused characters.
  return [...new Set([DAMAGE_AVATARS, DEFEATED_DAMAGE_AVATARS, PROJECTILE_BY_AVATAR].flatMap(map => ids.map(id => map[id]).filter((source): source is number => typeof source === "number")))];
}
