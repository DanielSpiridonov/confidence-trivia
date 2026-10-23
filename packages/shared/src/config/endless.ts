export type EndlessDifficulty = "easy" | "medium" | "hard" | "expert";
export const ENDLESS_TIMERS: Record<EndlessDifficulty, number> = { easy: 30, medium: 25, hard: 20, expert: 15 };
export const ENDLESS_FEEDBACK_MS = 1600;
export const ENDLESS_RECONNECT_MS = 10_000;
export const ENDLESS_HEARTBEAT_MS = 2_000;
export const ENDLESS_PROTOCOL_VERSION = 2;
// A finite, deliberately modest road: 280 Stars total, below four max-streak daily rewards.
// Threshold is a permanent identity. Never reuse one for a different reward.
export const ENDLESS_MILESTONES = [
  { score: 10, stars: 10 }, { score: 25, stars: 15 }, { score: 50, stars: 20 },
  { score: 75, stars: 25 }, { score: 100, stars: 30 }, { score: 150, stars: 35 },
  { score: 200, stars: 40 }, { score: 250, stars: 50 }, { score: 300, stars: 55 },
] as const;

export interface EndlessQuestion {
  token: string;
  number: number;
  text: string;
  options: string[];
  category: string;
  difficulty: EndlessDifficulty;
  duration: number;
  deadline: number;
}
export interface EndlessRun {
  id: string;
  score: number;
  lives: number;
  previousBest: number;
  phase: "question" | "feedback" | "finished";
  endReason: "lives" | "exhausted" | "abandoned" | null;
  connectionDeadline: number;
  question: EndlessQuestion | null;
  feedback: { correctIndex: number; selectedIndex: number | null; correct: boolean; timedOut: boolean; readyAt: number } | null;
  rewards: Array<{ score: number; stars: number }>;
}
export interface EndlessState {
  protocolVersion: number;
  serverNow: number;
  personalBest: number;
  stars: number;
  claimed: number[];
  run: EndlessRun | null;
}
export interface EndlessLeaderboardEntry {
  playerId: string;
  displayName: string;
  avatarId: string;
  score: number;
  position: number;
}
export interface EndlessLeaderboard {
  top: EndlessLeaderboardEntry[];
  currentPlayer: EndlessLeaderboardEntry | null;
}
