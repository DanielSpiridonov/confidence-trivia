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
const port = Number(process.env.PORT ?? 2567);
const app = (0, express_1.default)();
app.use(express_1.default.json());
app.get("/health", async (_req, res) => {
    const database = await (0, database_1.getDatabaseStatus)();
    res.json({ ok: true, database });
});
app.get("/players/:deviceId/points", async (req, res) => {
    const deviceId = req.params.deviceId;
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(deviceId)) {
        res.status(400).json({ error: "Invalid device ID" });
        return;
    }
    const lifetimePoints = await (0, database_1.getPlayerLifetimePoints)(deviceId);
    if (lifetimePoints === null) {
        res.status(503).json({ error: "Points are temporarily unavailable" });
        return;
    }
    res.json({ lifetimePoints });
});
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
