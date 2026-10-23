export type EndlessDifficulty = "easy" | "medium" | "hard" | "expert";
export declare const ENDLESS_TIMERS: Record<EndlessDifficulty, number>;
export declare const ENDLESS_FEEDBACK_MS = 1600;
export declare const ENDLESS_MILESTONES: readonly [{
    readonly score: 10;
    readonly stars: 10;
}, {
    readonly score: 25;
    readonly stars: 15;
}, {
    readonly score: 50;
    readonly stars: 20;
}, {
    readonly score: 75;
    readonly stars: 25;
}, {
    readonly score: 100;
    readonly stars: 30;
}, {
    readonly score: 150;
    readonly stars: 35;
}, {
    readonly score: 200;
    readonly stars: 40;
}, {
    readonly score: 250;
    readonly stars: 50;
}, {
    readonly score: 300;
    readonly stars: 55;
}];
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
    endReason: "lives" | "exhausted" | null;
    question: EndlessQuestion | null;
    feedback: {
        correctIndex: number;
        selectedIndex: number | null;
        correct: boolean;
        timedOut: boolean;
        readyAt: number;
    } | null;
    rewards: Array<{
        score: number;
        stars: number;
    }>;
}
export interface EndlessState {
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
