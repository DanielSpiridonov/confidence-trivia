"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const http_1 = __importDefault(require("http"));
const express_1 = __importDefault(require("express"));
const colyseus_1 = require("colyseus");
const ws_transport_1 = require("@colyseus/ws-transport");
const GameRoom_1 = require("./rooms/GameRoom");
const database_1 = require("./database");
const auth_1 = require("./auth");
const port = Number(process.env.PORT ?? 2567);
const app = (0, express_1.default)();
app.use(express_1.default.json());
app.get("/health", async (_req, res) => {
    const database = await (0, database_1.getDatabaseStatus)();
    res.json({ ok: true, database });
});
app.post("/accounts/link", async (req, res) => {
    const guestPlayerId = typeof req.body?.guestPlayerId === "string" ? req.body.guestPlayerId : "";
    const displayName = typeof req.body?.displayName === "string" ? req.body.displayName.trim().slice(0, 20) : "Guest";
    if (!isDeviceId(guestPlayerId)) {
        res.status(400).json({ error: "Invalid guest player ID" });
        return;
    }
    const identity = await (0, auth_1.verifySupabaseIdentity)(req.headers.authorization);
    if (!identity) {
        res.status(401).json({ error: "Invalid or expired account session" });
        return;
    }
    const account = await (0, database_1.linkPlayerAccount)(guestPlayerId, displayName, identity.userId, identity.provider);
    if (!account) {
        res.status(503).json({ error: "Account linking is temporarily unavailable" });
        return;
    }
    res.json(account);
});
app.get("/accounts/me", async (req, res) => {
    const playerId = typeof req.query.playerId === "string" ? req.query.playerId : "";
    const identity = await (0, auth_1.verifySupabaseIdentity)(req.headers.authorization);
    if (!isDeviceId(playerId) || !identity) {
        res.status(401).json({ error: "Invalid or expired account session" });
        return;
    }
    const profile = await (0, database_1.getAccountProfile)(playerId, identity.userId);
    if (!profile) {
        res.status(404).json({ error: "Account profile not found" });
        return;
    }
    res.json({ ...profile, email: identity.email });
});
app.patch("/accounts/me/name", async (req, res) => {
    const playerId = typeof req.body?.playerId === "string" ? req.body.playerId : "";
    const displayName = typeof req.body?.displayName === "string" ? req.body.displayName.trim() : "";
    const identity = await (0, auth_1.verifySupabaseIdentity)(req.headers.authorization);
    if (!isDeviceId(playerId) || !identity) {
        res.status(401).json({ error: "Invalid or expired account session" });
        return;
    }
    if (!/^[\p{L}\p{N} _-]{3,20}$/u.test(displayName)) {
        res.status(400).json({ error: "Name must be 3-20 characters using letters, numbers, spaces, _ or -" });
        return;
    }
    const profile = await (0, database_1.updateAccountDisplayName)(playerId, identity.userId, displayName);
    if (profile === "taken") {
        res.status(409).json({ error: "That name is already taken" });
        return;
    }
    if (!profile) {
        res.status(503).json({ error: "Could not update profile" });
        return;
    }
    res.json({ ...profile, email: identity.email });
});
app.get("/players/:deviceId/stars", async (req, res) => {
    const deviceId = req.params.deviceId;
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(deviceId)) {
        res.status(400).json({ error: "Invalid device ID" });
        return;
    }
    const stars = await (0, database_1.getPlayerStars)(deviceId);
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
    const customization = await (0, database_1.getPlayerCustomization)(req.params.deviceId);
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
    const customization = await (0, database_1.equipFreeNameColor)(req.params.deviceId, cosmeticId, displayName);
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
    const customization = await (0, database_1.equipFreeAvatar)(req.params.deviceId, cosmeticId, displayName);
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
    const customization = await (0, database_1.equipFreeFrame)(req.params.deviceId, cosmeticId, displayName);
    if (!customization) {
        res.status(400).json({ error: "Could not equip that frame" });
        return;
    }
    res.json(customization);
});
function isDeviceId(value) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
app.get("/players/:deviceId/daily-reward", async (req, res) => {
    if (!isDeviceId(req.params.deviceId)) {
        res.status(400).json({ error: "Invalid device ID" });
        return;
    }
    const status = await (0, database_1.getDailyRewardStatus)(req.params.deviceId);
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
    const status = await (0, database_1.claimDailyReward)(req.params.deviceId, displayName);
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
    const leaderboard = await (0, database_1.getRankedLeaderboard)(deviceId);
    if (!leaderboard) {
        res.status(503).json({ error: "Ranked leaderboard is temporarily unavailable" });
        return;
    }
    res.json(leaderboard);
});
async function requestOwnsRegisteredPlayer(playerId, authorization) {
    const identity = await (0, auth_1.verifySupabaseIdentity)(authorization);
    return Boolean(identity && await (0, database_1.isAuthenticatedPlayer)(playerId, identity.userId));
}
const httpServer = http_1.default.createServer(app);
const gameServer = new colyseus_1.Server({
    transport: new ws_transport_1.WebSocketTransport({ server: httpServer }),
});
// "confidence_trivia" is the room type name the client requests by;
// each call to joinOrCreate/create spins up a new authoritative GameRoom
// instance with its own room code.
gameServer.define("confidence_trivia", GameRoom_1.GameRoom);
httpServer.listen(port, () => {
    console.log(`Confidence Trivia server listening on ws://0.0.0.0:${port}`);
});
