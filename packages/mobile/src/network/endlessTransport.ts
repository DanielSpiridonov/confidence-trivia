import { ENDLESS_PROTOCOL_VERSION, type EndlessLeaderboard, type EndlessState } from "@confidence-trivia/shared";

export type EndlessFailureKind = "connection" | "server" | "protocol" | "auth" | "invalid-action";
export class EndlessRequestError extends Error {
  constructor(public readonly kind: EndlessFailureKind, message: string, public readonly status?: number) {
    super(message);
    this.name = "EndlessRequestError";
  }
}
const UPDATE_MESSAGE = "Endless is being updated. Please try again shortly.";

export function asEndlessRequestError(error: unknown): EndlessRequestError {
  return error instanceof EndlessRequestError ? error : new EndlessRequestError("connection", "Couldn’t reach Endless. Please try again.");
}

function checkState(payload: any): asserts payload is EndlessState {
  if (!payload || payload.protocolVersion !== ENDLESS_PROTOCOL_VERSION || !Number.isFinite(payload.serverNow) ||
    (payload.run && payload.run.phase !== "finished" && !Number.isFinite(payload.run.connectionDeadline))) {
    throw new EndlessRequestError("protocol", UPDATE_MESSAGE);
  }
}

/** Check the server contract before caching snapshots or enabling gameplay. */
export function createEndlessTransport({ baseUrl, getAccessToken, fetch: fetchRequest = fetch, requestTimeoutMs = 12_000, heartbeatTimeoutMs = 3_000 }: {
  baseUrl: string;
  getAccessToken: () => Promise<string | null>;
  fetch?: typeof fetch;
  requestTimeoutMs?: number;
  heartbeatTimeoutMs?: number;
}) {
  async function request<T>(playerId: string, path: string, command?: object): Promise<T> {
    const controller = new AbortController();
    const type = (command as { type?: string } | undefined)?.type;
    const timeout = setTimeout(() => controller.abort(), type === "heartbeat" ? heartbeatTimeoutMs : requestTimeoutMs);
    try {
      const accessToken = await getAccessToken();
      if (!accessToken) throw new EndlessRequestError("auth", "Your session expired. Please sign in again.", 401);
      const response = await fetchRequest(`${baseUrl}/endless/${path}?playerId=${encodeURIComponent(playerId)}`, {
        method: command ? "POST" : "GET", signal: controller.signal,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        ...(command ? { body: JSON.stringify(command) } : {}),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        if (response.status === 401 || response.status === 403) throw new EndlessRequestError("auth", payload?.error ?? "Please sign in again.", response.status);
        if (response.status === 400 && (type === "heartbeat" || type === "abandon") && response.headers.get("X-Endless-Protocol") !== String(ENDLESS_PROTOCOL_VERSION)) {
          throw new EndlessRequestError("protocol", UPDATE_MESSAGE, response.status);
        }
        throw new EndlessRequestError(response.status >= 500 || response.status === 429 ? "server" : "invalid-action", payload?.error ?? "Endless is temporarily unavailable.", response.status);
      }
      if (path === "state" || path === "action") checkState(payload);
      return payload as T;
    } catch (error) {
      throw asEndlessRequestError(error);
    } finally { clearTimeout(timeout); }
  }
  return {
    state: (playerId: string) => request<EndlessState>(playerId, "state"),
    action: (playerId: string, command: object) => request<EndlessState>(playerId, "action", command),
    leaderboard: (playerId: string) => request<EndlessLeaderboard>(playerId, "leaderboard"),
  };
}
