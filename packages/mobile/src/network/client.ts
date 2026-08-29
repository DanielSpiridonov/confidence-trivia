import { Client, Room } from "colyseus.js";
import { useEffect, useRef, useState } from "react";

// Set this through EXPO_PUBLIC_SERVER_URL. Use the Docker host's LAN IP when
// testing on a physical device; localhost only reaches the device itself.
export const SERVER_URL =
  process.env.EXPO_PUBLIC_SERVER_URL ?? "ws://localhost:2567";
const HTTP_SERVER_URL = SERVER_URL.replace(/^ws/, "http").replace(/\/$/, "");
const ROOM_REQUEST_TIMEOUT_MS = 10_000;

let client: Client | null = null;
export function getClient(): Client {
  if (!client) client = new Client(SERVER_URL);
  return client;
}

export async function getPlayerStars(deviceId: string): Promise<number | null> {
  try {
    const response = await fetch(`${HTTP_SERVER_URL}/players/${encodeURIComponent(deviceId)}/stars`);
    if (!response.ok) return null;
    const payload = await response.json() as { stars?: unknown };
    return typeof payload.stars === "number" ? payload.stars : null;
  } catch {
    return null;
  }
}

export interface PlayerCustomization {
  nameColorId: string;
  nameColor: string;
}

export async function getPlayerCustomization(deviceId: string): Promise<PlayerCustomization | null> {
  try {
    const response = await fetch(`${HTTP_SERVER_URL}/players/${encodeURIComponent(deviceId)}/customization`);
    if (!response.ok) return null;
    return await response.json() as PlayerCustomization;
  } catch {
    return null;
  }
}

export async function equipNameColor(deviceId: string, displayName: string, cosmeticId: string): Promise<PlayerCustomization | null> {
  try {
    const response = await fetch(`${HTTP_SERVER_URL}/players/${encodeURIComponent(deviceId)}/customization/name-color`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ displayName, cosmeticId }),
    });
    if (!response.ok) return null;
    return await response.json() as PlayerCustomization;
  } catch {
    return null;
  }
}

export interface DailyRewardStatus {
  stars: number;
  available: boolean;
  amount: number;
  streakDay: number;
  nextClaimAt: string;
}

export async function getDailyRewardStatus(deviceId: string): Promise<DailyRewardStatus | null> {
  try {
    const response = await fetch(`${HTTP_SERVER_URL}/players/${encodeURIComponent(deviceId)}/daily-reward`);
    if (!response.ok) return null;
    return await response.json() as DailyRewardStatus;
  } catch {
    return null;
  }
}

export async function claimDailyReward(deviceId: string, displayName: string): Promise<DailyRewardStatus | null> {
  try {
    const response = await fetch(`${HTTP_SERVER_URL}/players/${encodeURIComponent(deviceId)}/daily-reward/claim`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ displayName }),
    });
    if (!response.ok) return null;
    return await response.json() as DailyRewardStatus;
  } catch {
    return null;
  }
}

export interface RankedLeaderboardEntry {
  playerId: string;
  displayName: string;
  lp: number;
  rankKey: string;
  wins: number;
  position: number | null;
  placementMatches: number;
}

export interface RankedLeaderboardResponse {
  top: RankedLeaderboardEntry[];
  currentPlayer: RankedLeaderboardEntry | null;
}

export async function getRankedLeaderboard(deviceId: string): Promise<RankedLeaderboardResponse | null> {
  try {
    const response = await fetch(`${HTTP_SERVER_URL}/ranked/leaderboard?deviceId=${encodeURIComponent(deviceId)}`);
    if (!response.ok) return null;
    return await response.json() as RankedLeaderboardResponse;
  } catch {
    return null;
  }
}

async function withRoomRequestTimeout<T>(promise: Promise<T>): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  const timeoutPromise = new Promise<T>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`Server did not respond within ${ROOM_REQUEST_TIMEOUT_MS / 1000}s. Check the server and SERVER_URL.`));
    }, ROOM_REQUEST_TIMEOUT_MS);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

export async function createRoom(
  deviceId: string,
  playerName: string,
  roundCount: number,
  locale: "en" | "bg",
  gameMode: "classic" | "ranked" | "damage",
  excludeQuestionIds: string[] = [],
  visibility: "private" | "public" = "private",
  damageWager = 5,
) {
  const room = await withRoomRequestTimeout(
    getClient().create("confidence_trivia", {
      roundCount,
      locale,
      gameMode,
      excludeQuestionIds,
      deviceId,
      name: playerName,
      visibility,
      damageWager,
    })
  );
  return room;
}

export async function joinRoom(roomCode: string, deviceId: string, playerName: string) {
  const room = await withRoomRequestTimeout(getClient().joinById(roomCode, { deviceId, name: playerName }));
  return room;
}

export interface PublicRoomListing {
  roomId: string;
  leaderName: string;
  playerCount: number;
  maxClients: number;
  roundCount: number;
  locale: "en" | "bg";
  gameMode: "classic" | "friends" | "ranked" | "damage";
}

interface PublicRoomMetadata {
  leaderName?: string;
  playerCount?: number;
  roundCount?: number;
  locale?: "en" | "bg";
  gameMode?: "classic" | "friends" | "ranked" | "damage";
}

export async function listPublicRooms(): Promise<PublicRoomListing[]> {
  const rooms = await withRoomRequestTimeout(
    getClient().getAvailableRooms<PublicRoomMetadata>("confidence_trivia"),
  );
  return rooms
    .filter((room) => (
      room.clients > 0
      && room.clients < room.maxClients
      && (room.metadata?.playerCount ?? 0) > 0
      && Boolean(room.metadata?.leaderName)
    ))
    .map((room) => ({
      roomId: room.roomId,
      leaderName: room.metadata?.leaderName ?? "",
      playerCount: room.clients,
      maxClients: room.maxClients,
      roundCount: room.metadata?.roundCount ?? 0,
      locale: room.metadata?.locale ?? "en",
      gameMode: room.metadata?.gameMode ?? "classic",
    }));
}

export async function joinPublicRoom(roomId: string, deviceId: string, playerName: string) {
  return withRoomRequestTimeout(getClient().joinById(roomId, { deviceId, name: playerName }));
}

export async function reconnectRoom(reconnectionToken: string) {
  const room = await withRoomRequestTimeout(getClient().reconnect(reconnectionToken));
  return room;
}

/**
 * Subscribes a component to a Colyseus room's synced state. Colyseus
 * mutates the same state object in place and emits onChange — we clone
 * into a plain object on every change so React's shallow-compare re-render
 * behaves predictably.
 */
export function useRoomState<T>(room: Room | null): T | null {
  const [, forceRender] = useState(0);
  const stateRef = useRef<T | null>(null);

  useEffect(() => {
    if (!room) {
      stateRef.current = null;
      return;
    }

    const syncState = (nextState = room.state) => {
      stateRef.current = nextState ? nextState as unknown as T : null;
      forceRender((n) => n + 1);
    };

    const onChange = (nextState: unknown) => syncState(nextState);
    room.onStateChange(onChange);
    // Close the render-to-effect race if the initial snapshot arrived just
    // before this listener was attached.
    syncState();
    return () => {
      room.onStateChange.remove(onChange);
    };
  }, [room]);

  if (room?.state) stateRef.current = room.state as unknown as T;
  return stateRef.current;
}
