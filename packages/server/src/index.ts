import http from "http";
import express from "express";
import { Server } from "colyseus";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { GameRoom } from "./rooms/GameRoom";
import { getDatabaseStatus, getPlayerStars } from "./database";

const port = Number(process.env.PORT ?? 2567);
const app = express();
app.use(express.json());

app.get("/health", async (_req, res) => {
  const database = await getDatabaseStatus();
  res.json({ ok: true, database });
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

const httpServer = http.createServer(app);
const gameServer = new Server({
  transport: new WebSocketTransport({ server: httpServer }),
});

// "confidence_trivia" is the room type name the client requests by;
// each call to joinOrCreate/create spins up a new authoritative GameRoom
// instance with its own room code.
gameServer.define("confidence_trivia", GameRoom);

httpServer.listen(port, () => {
  console.log(`Confidence Trivia server listening on ws://0.0.0.0:${port}`);
});
