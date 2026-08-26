import http from "http";
import express from "express";
import { Server } from "colyseus";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { GameRoom } from "./rooms/GameRoom";
import { getPlayerLifetimePoints } from "./database";

const port = Number(process.env.PORT ?? 2567);
const app = express();
app.use(express.json());

app.get("/health", (_req, res) => res.json({ ok: true }));
app.get("/players/:deviceId/points", async (req, res) => {
  const deviceId = req.params.deviceId;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(deviceId)) {
    res.status(400).json({ error: "Invalid device ID" });
    return;
  }

  const lifetimePoints = await getPlayerLifetimePoints(deviceId);
  if (lifetimePoints === null) {
    res.status(503).json({ error: "Points are temporarily unavailable" });
    return;
  }
  res.json({ lifetimePoints });
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
