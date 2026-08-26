import { QuestionType } from "../types";
/**
 * Default correctness check for question types whose correctness can be
 * decided from one answer in isolation. `closest_answer` is resolved from
 * the full round's submissions in the server room flow instead.
 */
export declare function isAnswerCorrect(type: QuestionType, value: unknown, correctAnswer: unknown): boolean;
