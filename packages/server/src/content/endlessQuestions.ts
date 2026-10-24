import { EndlessDifficulty, type VisualPresentation } from "@confidence-trivia/shared";
import { QUESTIONS } from "./questions";

export interface EndlessContent {
  answerType?: "multiple_choice" | "word" | "estimate";
  correctAnswer?: unknown;
  presentation?: VisualPresentation;
  id: string;
  text: string;
  options: string[];
  correctIndex: number;
  difficulty: EndlessDifficulty;
  category: string;
}

// Keep the existing editorial difficulty labels. Never infer difficulty from
// question ID, category, answer position, or the stage at which it is drawn.
const existing: EndlessContent[] = QUESTIONS.flatMap((q) => {
  if (!["easy", "medium", "hard"].includes(q.difficulty)) return [];
  const t = q.translations.en;
  if (q.presentation && (q.type === "multiple_choice" || q.type === "word" || q.type === "estimate")) {
    return [{ id: q.id, text: t.text, options: [...(t.options ?? [])], correctIndex: q.type === "multiple_choice" ? Number(q.correctAnswer) : -1, correctAnswer: q.correctAnswer, answerType: q.type, presentation: q.presentation, difficulty: q.difficulty, category: q.category }];
  }
  if (q.type === "multiple_choice" && t.options?.length === 4 && Number.isInteger(q.correctAnswer)) {
    return [{ id: q.id, text: t.text, options: [...t.options], correctIndex: Number(q.correctAnswer), difficulty: q.difficulty, category: q.category }];
  }
  // Exact numeric and existing approximate facts can also be presented as four
  // choices without changing their stored answer or editorial difficulty.
  // Integer distractors remain distinct and sufficiently far from approximations.
  if ((q.type === "estimate" || q.type === "closest_answer") && typeof q.correctAnswer === "number" && Number.isFinite(q.correctAnswer)) {
    const answer = q.correctAnswer;
    const step = Math.max(2, Math.round(Math.abs(answer) * 0.15));
    return [{ id: q.id, text: t.text.replace(/\s*Closest answer wins\.?$/i, ""), options: [answer, answer + step, answer - step, answer + step * 2].map(String), correctIndex: 0, difficulty: q.difficulty, category: q.category }];
  }
  return [];
});

// Original Expert material with mechanically verifiable answer keys. Rubric:
// combinations require factorial cancellation; modular powers require repeated
// reduction; square sums require a multi-step identity. These are explicitly
// classified by the required reasoning, rather than relabelling Easy content.
function numeric(id: string, text: string, answer: number, distractors: number[]): EndlessContent {
  const options = [answer, ...distractors].map(String);
  if (new Set(options).size !== 4) throw new Error(`Duplicate Endless options: ${id}`);
  return { id, text, options, correctIndex: 0, category: "math", difficulty: "expert" };
}
const experts: EndlessContent[] = [];
for (let n = 8; n <= 31; n++) {
  const answer = n * (n - 1) * (n - 2) / 6;
  experts.push(numeric(`endless_combinations_${n}`, `How many different groups of 3 can be chosen from ${n} people?`, answer, [answer + n, answer - n, answer * 3]));
}
for (let n = 11; n <= 34; n++) {
  const answer = n * (n + 1) * (2 * n + 1) / 6;
  experts.push(numeric(`endless_squares_${n}`, `What is 1² + 2² + 3² + … + ${n}²?`, answer, [answer + n * n, answer - n * n, answer + n]));
}
for (let base = 2; base <= 9; base++) {
  for (let exponent = 5; exponent <= 7; exponent++) {
    const answer = base ** exponent % 11;
    const others = Array.from({ length: 11 }, (_, i) => i).filter((i) => i !== answer);
    experts.push(numeric(`endless_remainder_${base}_${exponent}`, `What is the remainder when ${base}^${exponent} is divided by 11?`, answer, [others[0], others[4], others[8]]));
  }
}

export const ENDLESS_QUESTIONS: EndlessContent[] = [...existing, ...experts];
const ids = new Set<string>();
const texts = new Set<string>();
for (const q of ENDLESS_QUESTIONS) {
  const fingerprint = `${q.text.toLowerCase()}:${q.presentation?.assetId ?? ""}`;
  const choice = !q.answerType || q.answerType === "multiple_choice";
  if (ids.has(q.id) || texts.has(fingerprint) || (choice && (q.options.length !== 4 || q.correctIndex < 0 || q.correctIndex > 3)) || !["easy", "medium", "hard", "expert"].includes(q.difficulty)) throw new Error(`Invalid Endless content: ${q.id}`);
  ids.add(q.id);
  texts.add(fingerprint);
}
