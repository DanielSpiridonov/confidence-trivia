export type ConfidenceValue = "none" | 1 | 3 | 5 | 6;
export declare const CONFIDENCE_VALUES: ConfidenceValue[];
export type QuestionType = "multiple_choice" | "true_false" | "estimate" | "closest_answer" | "ordering" | "word" | "visual";
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
    options?: string[];
    media?: string;
    basePoints: number;
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
export type RoundPhase = "lobby" | "starting" | "question" | "confidence" | "board_sidebet" | "reveal" | "final_results";
export interface PlayerScoreEvent {
    playerId: string;
    reason: "answer" | "sidebet" | "streak_bonus";
    delta: number;
    detail: string;
}
export interface RoundResult {
    correctAnswer: unknown;
    answers: PlayerAnswer[];
    sideBets: SideBet[];
    scoreEvents: PlayerScoreEvent[];
    streakUpdates: Record<string, number>;
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
