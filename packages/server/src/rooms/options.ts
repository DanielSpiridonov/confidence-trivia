import { DEFAULT_ROUND_COUNT, GameMode, Locale } from "@confidence-trivia/shared";

export interface JoinOptions {
  deviceId?: string;
  name?: string;
  accessToken?: string;
}

export interface CreateOptions extends JoinOptions {
  roundCount?: number;
  locale?: Locale;
  gameMode?: GameMode;
  excludeQuestionIds?: string[];
  visibility?: "private" | "public";
  damageWager?: number;
  challengeId?: string;
  friendsTeamMode?: "ffa" | "duos";
  friendCategories?: string[];
  customQuestions?: Array<{ question?: string; answer?: string }>;
}

// Types describe trusted code; matchmaking payloads are arbitrary JSON. Bound
// every collection before generating questions or touching room state.
export function normalizeCreateOptions(input: unknown): CreateOptions {
  const value = input && typeof input === "object" && !Array.isArray(input)
    ? input as Record<string, unknown> : {};
  const strings = (items: unknown, max: number, length: number): string[] => Array.isArray(items)
    ? items.slice(0, max).filter((item): item is string => typeof item === "string" && item.length <= length) : [];
  return {
    roundCount: typeof value.roundCount === "number" && Number.isInteger(value.roundCount)
      && value.roundCount >= 1 && value.roundCount <= 30 ? value.roundCount : DEFAULT_ROUND_COUNT,
    locale: value.locale === "bg" ? "bg" : "en",
    gameMode: value.gameMode === "ranked" || value.gameMode === "damage" || value.gameMode === "friends" ? value.gameMode : "classic",
    visibility: value.visibility === "public" ? "public" : "private",
    damageWager: typeof value.damageWager === "number" ? value.damageWager : undefined,
    challengeId: typeof value.challengeId === "string" ? value.challengeId : undefined,
    friendsTeamMode: value.friendsTeamMode === "duos" ? "duos" : "ffa",
    excludeQuestionIds: strings(value.excludeQuestionIds, 500, 128),
    friendCategories: strings(value.friendCategories, 20, 64),
    customQuestions: Array.isArray(value.customQuestions) ? value.customQuestions.slice(0, 10).flatMap((item) => {
      if (!item || typeof item !== "object" || typeof item.question !== "string" || typeof item.answer !== "string") return [];
      return [{ question: item.question.slice(0, 160), answer: item.answer.slice(0, 48) }];
    }) : [],
  };
}
