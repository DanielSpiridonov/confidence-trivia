import http from "http";
import express from "express";
import { Server } from "colyseus";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { GameRoom } from "./rooms/GameRoom";
import { anonymizePlayerAccount, claimAllFriendGifts, claimDailyReward, claimFriendGift, createPlayerChallenge, equipFreeAvatar, equipFreeFrame, equipFreeNameColor, getAccountProfile, getDailyRewardStatus, getDatabaseStatus, getNewsPosts, getPlayerChallenges, getPlayerCustomization, getPlayerStars, getRankedLeaderboard, isAuthenticatedPlayer, linkPlayerAccount, listFriends, redeemPromoCode, respondToFriendRequest, respondToPlayerChallenge, searchFriendPlayers, sendFriendGift, sendFriendRequest, submitPlayerReport, suggestFriendPlayers, updateAccountDisplayName, updateFriendRelationship, updatePlayerPresence } from "./database";
import { deleteSupabaseIdentity, verifySupabaseIdentity } from "./auth";
import { isDamageWager, isOffensivePlayerName } from "@confidence-trivia/shared";

const port = Number(process.env.PORT ?? 2567);
const app = express();
app.use(express.json());

app.get("/health", async (_req, res) => {
  const database = await getDatabaseStatus();
  res.json({ ok: true, database });
});

app.get("/news", async (req, res) => {
  const locale = req.query.locale === "bg" ? "bg" : "en";
  const posts = await getNewsPosts(locale);
  if (!posts) { res.status(503).json({ error: "News is temporarily unavailable" }); return; }
  res.json(posts);
});

app.post("/promo-codes/redeem", async (req, res) => {
  const playerId = typeof req.body?.playerId === "string" ? req.body.playerId : "";
  const code = typeof req.body?.code === "string" ? req.body.code : "";
  if (!isDeviceId(playerId) || !await requestOwnsRegisteredPlayer(playerId, req.headers.authorization)) { res.status(403).json({ error: "Sign in to redeem codes" }); return; }
  const result = await redeemPromoCode(playerId, code);
  if (!result.ok) { res.status(409).json({ error: result.error }); return; }
  res.json(result);
});

app.post("/player-reports", async (req, res) => {
  const reporterId = typeof req.body?.reporterId === "string" ? req.body.reporterId : "";
  const reportedName = typeof req.body?.reportedName === "string" ? req.body.reportedName.trim() : "";
  const description = typeof req.body?.description === "string" ? req.body.description.trim() : "";
  if (!isDeviceId(reporterId) || !await requestOwnsRegisteredPlayer(reporterId, req.headers.authorization)) { res.status(403).json({ error: "Sign in to report a player" }); return; }
  if (!/^[\p{L}\p{N} _-]{3,20}$/u.test(reportedName)) { res.status(400).json({ error: "Enter the player's exact name" }); return; }
  if (description.length < 10 || description.length > 500) { res.status(400).json({ error: "Description must be between 10 and 500 characters" }); return; }
  const result = await submitPlayerReport(reporterId, reportedName, description);
  if (!result.ok) { res.status(409).json({ error: result.error }); return; }
  res.status(201).json({ ok: true });
});

app.post("/accounts/link", async (req, res) => {
  const guestPlayerId = typeof req.body?.guestPlayerId === "string" ? req.body.guestPlayerId : "";
  const displayName = typeof req.body?.displayName === "string" ? req.body.displayName.trim().slice(0, 20) : "Guest";
  if (!isDeviceId(guestPlayerId)) {
    res.status(400).json({ error: "Invalid guest player ID" });
    return;
  }
  const identity = await verifySupabaseIdentity(req.headers.authorization);
  if (!identity) {
    res.status(401).json({ error: "Invalid or expired account session" });
    return;
  }
  const account = await linkPlayerAccount(guestPlayerId, displayName, identity.userId, identity.provider);
  if (!account) {
    res.status(503).json({ error: "Account linking is temporarily unavailable" });
    return;
  }
  res.json(account);
});
app.get("/accounts/me", async (req, res) => {
  const playerId = typeof req.query.playerId === "string" ? req.query.playerId : "";
  const identity = await verifySupabaseIdentity(req.headers.authorization);
  if (!isDeviceId(playerId) || !identity) { res.status(401).json({ error: "Invalid or expired account session" }); return; }
  const profile = await getAccountProfile(playerId, identity.userId);
  if (!profile) { res.status(404).json({ error: "Account profile not found" }); return; }
  res.json({ ...profile, email: identity.email });
});
app.patch("/accounts/me/name", async (req, res) => {
  const playerId = typeof req.body?.playerId === "string" ? req.body.playerId : "";
  const displayName = typeof req.body?.displayName === "string" ? req.body.displayName.trim() : "";
  const identity = await verifySupabaseIdentity(req.headers.authorization);
  if (!isDeviceId(playerId) || !identity) { res.status(401).json({ error: "Invalid or expired account session" }); return; }
  if (!/^[\p{L}\p{N} _-]{3,20}$/u.test(displayName)) { res.status(400).json({ error: "Name must be 3-20 characters using letters, numbers, spaces, _ or -" }); return; }
  if (isOffensivePlayerName(displayName)) { res.status(400).json({ error: "Offensive language is not allowed in player names" }); return; }
  const profile = await updateAccountDisplayName(playerId, identity.userId, displayName);
  if (profile === "taken") { res.status(409).json({ error: "That name is already taken" }); return; }
  if (!profile) { res.status(503).json({ error: "Could not update profile" }); return; }
  res.json({ ...profile, email: identity.email });
});
app.delete("/accounts/me", async (req, res) => {
  const playerId = typeof req.body?.playerId === "string" ? req.body.playerId : "";
  const identity = await verifySupabaseIdentity(req.headers.authorization);
  if (!isDeviceId(playerId) || !identity || !await isAuthenticatedPlayer(playerId, identity.userId)) { res.status(401).json({ error: "Invalid or expired account session" }); return; }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) { res.status(503).json({ error: "Account deletion is not configured" }); return; }
  if (!await deleteSupabaseIdentity(identity.userId)) { res.status(503).json({ error: "Could not delete the authentication account" }); return; }
  if (!await anonymizePlayerAccount(playerId)) { res.status(503).json({ error: "Authentication was deleted, but game data cleanup needs support" }); return; }
  res.status(204).end();
});
app.get("/players/:deviceId/stars", async (req, res) => {
  const deviceId = req.params.deviceId;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(deviceId)) {
    res.status(400).json({ error: "Invalid device ID" });
    return;
  }

  const stars = await getPlayerStars(deviceId);
  if (stars === null) {
    res.status(503).json({ error: "Stars are temporarily unavailable" });
    return;
  }
  res.json({ stars });
});

app.get("/players/:deviceId/customization", async (req, res) => {
  if (!isDeviceId(req.params.deviceId)) {
    res.status(400).json({ error: "Invalid device ID" });
    return;
  }
  const customization = await getPlayerCustomization(req.params.deviceId);
  if (!customization) {
    res.status(503).json({ error: "Customization is temporarily unavailable" });
    return;
  }
  res.json(customization);
});

app.post("/players/:deviceId/customization/name-color", async (req, res) => {
  if (!isDeviceId(req.params.deviceId)) {
    res.status(400).json({ error: "Invalid device ID" });
    return;
  }
  if (!await requestOwnsRegisteredPlayer(req.params.deviceId, req.headers.authorization)) {
    res.status(403).json({ error: "Sign in to access the shop" });
    return;
  }
  const cosmeticId = typeof req.body?.cosmeticId === "string" ? req.body.cosmeticId : "";
  const displayName = typeof req.body?.displayName === "string" ? req.body.displayName.trim().slice(0, 20) : "Player";
  const customization = await equipFreeNameColor(req.params.deviceId, cosmeticId, displayName);
  if (!customization) {
    res.status(400).json({ error: "Could not equip that name color" });
    return;
  }
  res.json(customization);
});

app.post("/players/:deviceId/customization/avatar", async (req, res) => {
  if (!isDeviceId(req.params.deviceId)) {
    res.status(400).json({ error: "Invalid device ID" });
    return;
  }
  if (!await requestOwnsRegisteredPlayer(req.params.deviceId, req.headers.authorization)) {
    res.status(403).json({ error: "Sign in to access the shop" });
    return;
  }
  const cosmeticId = typeof req.body?.cosmeticId === "string" ? req.body.cosmeticId : "";
  const displayName = typeof req.body?.displayName === "string" ? req.body.displayName.trim().slice(0, 20) : "Player";
  const customization = await equipFreeAvatar(req.params.deviceId, cosmeticId, displayName);
  if (!customization) {
    res.status(400).json({ error: "Could not equip that avatar" });
    return;
  }
  res.json(customization);
});

app.post("/players/:deviceId/customization/frame", async (req, res) => {
  if (!isDeviceId(req.params.deviceId)) {
    res.status(400).json({ error: "Invalid device ID" });
    return;
  }
  if (!await requestOwnsRegisteredPlayer(req.params.deviceId, req.headers.authorization)) {
    res.status(403).json({ error: "Sign in to access the shop" });
    return;
  }
  const cosmeticId = typeof req.body?.cosmeticId === "string" ? req.body.cosmeticId : "";
  const displayName = typeof req.body?.displayName === "string" ? req.body.displayName.trim().slice(0, 20) : "Player";
  const customization = await equipFreeFrame(req.params.deviceId, cosmeticId, displayName);
  if (!customization) {
    res.status(400).json({ error: "Could not equip that frame" });
    return;
  }
  res.json(customization);
});

function isDeviceId(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

app.get("/players/:deviceId/daily-reward", async (req, res) => {
  if (!isDeviceId(req.params.deviceId)) {
    res.status(400).json({ error: "Invalid device ID" });
    return;
  }
  const status = await getDailyRewardStatus(req.params.deviceId);
  if (!status) {
    res.status(503).json({ error: "Daily reward is temporarily unavailable" });
    return;
  }
  res.json(status);
});

app.post("/players/:deviceId/daily-reward/claim", async (req, res) => {
  if (!isDeviceId(req.params.deviceId)) {
    res.status(400).json({ error: "Invalid device ID" });
    return;
  }
  const displayName = typeof req.body?.displayName === "string" ? req.body.displayName.trim().slice(0, 20) : "";
  const status = await claimDailyReward(req.params.deviceId, displayName);
  if (!status) {
    res.status(503).json({ error: "Daily reward is temporarily unavailable" });
    return;
  }
  res.json(status);
});

app.get("/ranked/leaderboard", async (req, res) => {
  const deviceId = typeof req.query.deviceId === "string" ? req.query.deviceId : "";
  if (!isDeviceId(deviceId)) {
    res.status(400).json({ error: "Invalid device ID" });
    return;
  }
  if (!await requestOwnsRegisteredPlayer(deviceId, req.headers.authorization)) {
    res.status(403).json({ error: "Sign in to access Ranked" });
    return;
  }
  const leaderboard = await getRankedLeaderboard(deviceId);
  if (!leaderboard) {
    res.status(503).json({ error: "Ranked leaderboard is temporarily unavailable" });
    return;
  }
  res.json(leaderboard);
});

app.get("/friends", async (req, res) => {
  const playerId = typeof req.query.playerId === "string" ? req.query.playerId : "";
  if (!isDeviceId(playerId) || !await requestOwnsRegisteredPlayer(playerId, req.headers.authorization)) { res.status(403).json({ error: "Sign in to access Friends" }); return; }
  const friends = await listFriends(playerId);
  if (!friends) { res.status(503).json({ error: "Friends are temporarily unavailable" }); return; }
  res.json(friends);
});

app.get("/friends/search", async (req, res) => {
  const playerId = typeof req.query.playerId === "string" ? req.query.playerId : "";
  const query = typeof req.query.query === "string" ? req.query.query.trim().slice(0, 20) : "";
  if (!isDeviceId(playerId) || !await requestOwnsRegisteredPlayer(playerId, req.headers.authorization)) { res.status(403).json({ error: "Sign in to access Friends" }); return; }
  if (query.length < 2) { res.json([]); return; }
  const results = await searchFriendPlayers(playerId, query);
  if (!results) { res.status(503).json({ error: "Player search is temporarily unavailable" }); return; }
  res.json(results);
});

app.get("/friends/suggestions", async (req, res) => {
  const playerId = typeof req.query.playerId === "string" ? req.query.playerId : "";
  if (!isDeviceId(playerId) || !await requestOwnsRegisteredPlayer(playerId, req.headers.authorization)) { res.status(403).json({ error: "Sign in to access Friends" }); return; }
  const results = await suggestFriendPlayers(playerId);
  if (!results) { res.status(503).json({ error: "Friend suggestions are temporarily unavailable" }); return; }
  res.json(results);
});

app.post("/friends/requests", async (req, res) => {
  const playerId = typeof req.body?.playerId === "string" ? req.body.playerId : "";
  const targetPlayerId = typeof req.body?.targetPlayerId === "string" ? req.body.targetPlayerId : "";
  if (!isDeviceId(playerId) || !isDeviceId(targetPlayerId) || !await requestOwnsRegisteredPlayer(playerId, req.headers.authorization)) { res.status(403).json({ error: "Sign in to access Friends" }); return; }
  sendFriendActionResponse(res, await sendFriendRequest(playerId, targetPlayerId));
});

app.patch("/friends/requests/:friendshipId", async (req, res) => {
  const playerId = typeof req.body?.playerId === "string" ? req.body.playerId : "";
  const action = req.body?.action;
  if (!isDeviceId(playerId) || !isDeviceId(req.params.friendshipId) || !["accept", "reject"].includes(action) || !await requestOwnsRegisteredPlayer(playerId, req.headers.authorization)) { res.status(403).json({ error: "Invalid friend request" }); return; }
  sendFriendActionResponse(res, await respondToFriendRequest(playerId, req.params.friendshipId, action === "accept"));
});

app.patch("/friends/:friendshipId", async (req, res) => {
  const playerId = typeof req.body?.playerId === "string" ? req.body.playerId : "";
  const action = req.body?.action;
  if (!isDeviceId(playerId) || !isDeviceId(req.params.friendshipId) || !["remove", "block", "unblock"].includes(action) || !await requestOwnsRegisteredPlayer(playerId, req.headers.authorization)) { res.status(403).json({ error: "Invalid friendship action" }); return; }
  sendFriendActionResponse(res, await updateFriendRelationship(playerId, req.params.friendshipId, action));
});

app.post("/friends/:friendshipId/gifts", async (req, res) => {
  const playerId = typeof req.body?.playerId === "string" ? req.body.playerId : "";
  if (!isDeviceId(playerId) || !isDeviceId(req.params.friendshipId) || !await requestOwnsRegisteredPlayer(playerId, req.headers.authorization)) { res.status(403).json({ error: "Invalid gift action" }); return; }
  sendFriendActionResponse(res, await sendFriendGift(playerId, req.params.friendshipId));
});

app.post("/friends/gifts/claim-all", async (req, res) => {
  const playerId = typeof req.body?.playerId === "string" ? req.body.playerId : "";
  if (!isDeviceId(playerId) || !await requestOwnsRegisteredPlayer(playerId, req.headers.authorization)) { res.status(403).json({ error: "Invalid blessing claim" }); return; }
  sendFriendActionResponse(res, await claimAllFriendGifts(playerId));
});

app.post("/friends/gifts/:giftId/claim", async (req, res) => {
  const playerId = typeof req.body?.playerId === "string" ? req.body.playerId : "";
  if (!isDeviceId(playerId) || !isDeviceId(req.params.giftId) || !await requestOwnsRegisteredPlayer(playerId, req.headers.authorization)) { res.status(403).json({ error: "Invalid gift claim" }); return; }
  sendFriendActionResponse(res, await claimFriendGift(playerId, req.params.giftId));
});

app.post("/presence", async (req, res) => {
  const playerId = typeof req.body?.playerId === "string" ? req.body.playerId : "";
  const available = req.body?.available === true;
  if (!isDeviceId(playerId) || !await requestOwnsRegisteredPlayer(playerId, req.headers.authorization)) { res.status(403).json({ error: "Invalid presence update" }); return; }
  if (!await updatePlayerPresence(playerId, available)) { res.status(503).json({ error: "Presence is temporarily unavailable" }); return; }
  res.json({ ok: true });
});

app.get("/challenges", async (req, res) => {
  const playerId = typeof req.query.playerId === "string" ? req.query.playerId : "";
  if (!isDeviceId(playerId) || !await requestOwnsRegisteredPlayer(playerId, req.headers.authorization)) { res.status(403).json({ error: "Invalid challenge request" }); return; }
  const challenges = await getPlayerChallenges(playerId);
  if (!challenges) { res.status(503).json({ error: "Challenges are temporarily unavailable" }); return; }
  res.json(challenges);
});

app.post("/challenges", async (req, res) => {
  const playerId = typeof req.body?.playerId === "string" ? req.body.playerId : "";
  const challengedId = typeof req.body?.challengedId === "string" ? req.body.challengedId : "";
  const damageWager = Number(req.body?.damageWager);
  if (!isDeviceId(playerId) || !isDeviceId(challengedId) || !isDamageWager(damageWager) || !await requestOwnsRegisteredPlayer(playerId, req.headers.authorization)) { res.status(403).json({ error: "Invalid challenge" }); return; }
  sendFriendActionResponse(res, await createPlayerChallenge(playerId, challengedId, damageWager));
});

app.patch("/challenges/:challengeId", async (req, res) => {
  const playerId = typeof req.body?.playerId === "string" ? req.body.playerId : "";
  const action = req.body?.action;
  if (!isDeviceId(playerId) || !isDeviceId(req.params.challengeId) || !["accept", "decline"].includes(action) || !await requestOwnsRegisteredPlayer(playerId, req.headers.authorization)) { res.status(403).json({ error: "Invalid challenge response" }); return; }
  sendFriendActionResponse(res, await respondToPlayerChallenge(playerId, req.params.challengeId, action === "accept"));
});

function sendFriendActionResponse(res: express.Response, result: { ok: boolean; error?: string; stars?: number }) {
  if (!result.ok) { res.status(409).json({ error: result.error ?? "Action unavailable" }); return; }
  res.json(result);
}

async function requestOwnsRegisteredPlayer(playerId: string, authorization: string | undefined): Promise<boolean> {
  const identity = await verifySupabaseIdentity(authorization);
  return Boolean(identity && await isAuthenticatedPlayer(playerId, identity.userId));
}

const httpServer = http.createServer(app);
const gameServer = new Server({
  transport: new WebSocketTransport({ server: httpServer }),
});

// "confidence_trivia" is the room type name the client requests by;
// each call to joinOrCreate/create spins up a new authoritative GameRoom
// instance with its own room code.
gameServer.define("confidence_trivia", GameRoom).filterBy(["gameMode", "damageWager", "locale", "challengeId"]);

httpServer.listen(port, () => {
  console.log(`Confidence Trivia server listening on ws://0.0.0.0:${port}`);
});
