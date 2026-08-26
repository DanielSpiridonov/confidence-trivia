import http from "http";
import express from "express";
import { Server } from "colyseus";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { GameRoom } from "./rooms/GameRoom";

const port = Number(process.env.PORT ?? 2567);
const app = express();
app.use(express.json());

app.get("/health", (_req, res) => res.json({ ok: true }));

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
