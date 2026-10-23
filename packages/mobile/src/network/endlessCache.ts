import type { EndlessState } from "@confidence-trivia/shared";

/** Display snapshots only; no local scoring or run mutation. */
export function createEndlessCache(now: () => number = Date.now) {
  const snapshots = new Map<string, { state: EndlessState; receivedAt: number }>();
  const reads = new Map<string, Promise<EndlessState>>();
  function remember(playerId: string, state: EndlessState): EndlessState {
    const previous = snapshots.get(playerId);
    if (!previous || state.serverNow >= previous.state.serverNow) snapshots.set(playerId, { state, receivedAt: now() });
    return state;
  }
  return {
    remember,
    peek(playerId: string): EndlessState | null {
      const cached = snapshots.get(playerId);
      return cached ? { ...cached.state, serverNow: cached.state.serverNow + Math.max(0, now() - cached.receivedAt) } : null;
    },
    read(playerId: string, load: () => Promise<EndlessState>): Promise<EndlessState> {
      const pending = reads.get(playerId);
      if (pending) return pending;
      const request = load().then((state) => remember(playerId, state)).finally(() => reads.delete(playerId));
      reads.set(playerId, request);
      return request;
    },
  };
}
