import { QuestionType } from "../types";

/**
 * Default correctness check for question types whose correctness can be
 * decided from one answer in isolation. `closest_answer` is resolved from
 * the full round's submissions in the server room flow instead.
 */
export function isAnswerCorrect(
  type: QuestionType,
  value: unknown,
  correctAnswer: unknown
): boolean {
  const normalizeText = (input: unknown) => String(input ?? "").trim().toLowerCase().replace(/\s+/g, " ");

  switch (type) {
    case "multiple_choice":
    case "true_false":
      return String(value) === String(correctAnswer);
    case "ordering": {
      const submitted = Array.isArray(value) ? value.map((item) => String(item)) : [];
      const correct = Array.isArray(correctAnswer) ? correctAnswer.map((item) => String(item)) : [];
      return submitted.length > 0
        && submitted.length === correct.length
        && submitted.every((item, index) => item === correct[index]);
    }
    case "word":
      return (Array.isArray(correctAnswer) ? correctAnswer : [correctAnswer])
        .some((acceptedAnswer) => normalizeText(value) === normalizeText(acceptedAnswer));
    case "estimate":
    case "closest_answer":
      return Number(value) === Number(correctAnswer);
    default:
      // Phase 2 will add ordering/visual comparisons.
      return String(value) === String(correctAnswer);
  }
}
