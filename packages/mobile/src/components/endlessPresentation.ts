import type { EndlessRun } from "@confidence-trivia/shared";

type Feedback = EndlessRun["feedback"];
export type EndlessOptionState = "idle" | "pending" | "muted" | "correct" | "wrong" | "revealed";

export function getEndlessOptionState(index: number, selected: number | null, feedback: Feedback): EndlessOptionState {
  if (feedback) {
    if (index === feedback.selectedIndex) return feedback.correct && !feedback.timedOut ? "correct" : "wrong";
    if (index === feedback.correctIndex) return "revealed";
    return "muted";
  }
  if (selected !== null) return index === selected ? "pending" : "muted";
  return "idle";
}

export function getEndlessOutcome(feedback: Feedback) {
  if (!feedback) return null;
  if (feedback.timedOut) return { kind: "timeout", title: "Time’s up · −1 life", icon: "time-outline", color: "#F2B987" } as const;
  if (!feedback.correct) return { kind: "wrong", title: "Incorrect · −1 life", icon: "close-circle", color: "#FF9FAD" } as const;
  return { kind: "correct", title: "Correct · +1 point", icon: "checkmark-circle", color: "#A8DCC3" } as const;
}
