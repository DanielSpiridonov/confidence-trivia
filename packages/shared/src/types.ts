// Pure types shared by server and every client (mobile now, web later).
// Nothing in this file depends on React Native, Colyseus, or any transport.

export type ConfidenceValue = "none" | 1 | 3 | 5 | 6;

export const CONFIDENCE_VALUES: ConfidenceValue[] = ["none", 1, 3, 5, 6];

export type QuestionType =
  | "multiple_choice"
  | "true_false"
  | "estimate"
  | "closest_answer"
  | "ordering"
  | "word"
  | "visual";

export type Locale = "en" | "bg";
export type GameMode = "classic" | "friends" | "damage" | "ranked";

/** A single localized rendering of a question, sent to the client. */
export interface LocalizedQuestion {
  id: string;
  type: QuestionType;
  category: string;
  difficulty: "easy" | "medium" | "hard";
  locale: Locale;
  text: string;
  options?: string[]; // for multiple_choice / true_false / ordering candidates
  media?: string;
  basePoints: number; // usually 1, occasionally 2 for special questions
}

/** Full question record as stored server-side (never sent to the client
 * before reveal — contains the answer key). */
export interface QuestionRecord {
  id: string;
  type: QuestionType;
  category: string;
  difficulty: "easy" | "medium" | "hard";
  correctAnswer: unknown;
  basePoints: number;
  translations: Record<Locale, {
    text: string;
    options?: string[];
    correctAnswer?: unknown;
    explanation?: string;
  }>;
}

export type AnswerValue = string | number | string[] | number[];

export interface PlayerAnswer {
  playerId: string;
  value: AnswerValue;
  confidence: ConfidenceValue;
  submittedAt: number;
}

export interface SideBet {
  bettorId: string;
  targetId: string;
  prediction: "correct" | "wrong";
}

export type RoundPhase =
  | "lobby"
  | "starting"
  | "question"
  | "confidence"
  | "board_sidebet"
  | "reveal"
  | "final_results";

export interface PlayerScoreEvent {
  playerId: string;
  reason: "answer" | "sidebet" | "streak_bonus";
  delta: number;
  detail: string; // e.g. "Correct + Confidence 5", "John was wrong"
}

export interface RoundResult {
  correctAnswer: unknown;
  answers: PlayerAnswer[];
  sideBets: SideBet[];
  scoreEvents: PlayerScoreEvent[];
  streakUpdates: Record<string, number>; // playerId -> new streak value
}

export interface PublicPlayer {
  id: string;
  name: string;
  score: number;
  streak: number;
  connected: boolean;
  ready: boolean;
  isHost: boolean;
}
