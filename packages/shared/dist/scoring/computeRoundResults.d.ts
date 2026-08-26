import { PlayerAnswer, SideBet, RoundResult } from "../types";
interface ComputeInput {
    correctAnswer: unknown;
    basePoints?: number;
    answers: PlayerAnswer[];
    sideBets: SideBet[];
    currentStreaks: Record<string, number>;
    isAnswerCorrect: (value: unknown, correctAnswer: unknown) => boolean;
}
/**
 * Pure function: given the round's submissions and the correct answer,
 * returns every score event and the updated streak values. No I/O, no
 * randomness, no server/framework dependency — safe to unit test directly
 * and safe for the server to call at reveal without duplicating logic
 * anywhere else.
 */
export declare function computeRoundResults(input: ComputeInput): RoundResult;
export {};
