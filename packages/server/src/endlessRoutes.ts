import { Router } from "express";
import { ENDLESS_PROTOCOL_VERSION } from "@confidence-trivia/shared";
import { verifySupabaseIdentity } from "./auth";
import { isAuthenticatedPlayer } from "./database";
import { endlessAction, EndlessError, endlessLeaderboard } from "./endless";
import { EndlessCommand } from "./endlessEngine";
import { logServerError } from "./logging";

const uuid = (v: unknown): v is string => typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
export function parseEndlessCommand(body: any): EndlessCommand {
  if (body?.type === "start" && uuid(body.requestId)) return { type: "start", requestId: body.requestId };
  if ((body?.type === "heartbeat" || body?.type === "abandon") && uuid(body.runId)) return { type: body.type, runId: body.runId };
  if ((body?.type === "answer" || body?.type === "next") && uuid(body.runId) && uuid(body.token)) {
    if (body.type === "next") return { type: "next", runId: body.runId, token: body.token };
    if (body.answer === null || (Number.isInteger(body.answer) && body.answer >= 0 && body.answer <= 3)) return { type: "answer", runId: body.runId, token: body.token, answer: body.answer };
  }
  throw new EndlessError(400, "Invalid Endless action.");
}
export const endlessRouter = Router();
endlessRouter.use(async (req, res, next) => {
  res.set("X-Endless-Protocol", String(ENDLESS_PROTOCOL_VERSION));
  try {
    const playerId = req.query.playerId;
    const identity = await verifySupabaseIdentity(req.headers.authorization);
    if (!uuid(playerId) || !identity) throw new EndlessError(401, "Your session expired. Please sign in again.");
    // State/actions validate ownership and moderation under their transaction's
    // player lock. Only the read-only board needs a separate ownership query.
    if (req.path === "/leaderboard" && !await isAuthenticatedPlayer(playerId, identity.userId)) throw new EndlessError(403, "This account cannot access Endless.");
    res.locals.endlessIdentity = { playerId, userId: identity.userId };
    next();
  } catch (error) { next(error); }
});
endlessRouter.get("/leaderboard", async (_req, res, next) => {
  try { res.set("Cache-Control", "no-store").json(await endlessLeaderboard(res.locals.endlessIdentity.playerId)); }
  catch (error) { next(error); }
});
endlessRouter.get("/state", async (_req, res, next) => {
  try { const { playerId, userId } = res.locals.endlessIdentity; res.set("Cache-Control", "no-store").json(await endlessAction(playerId, userId, { type: "sync" })); }
  catch (error) { next(error); }
});
endlessRouter.post("/action", async (req, res, next) => {
  try { const command = parseEndlessCommand(req.body); const { playerId, userId } = res.locals.endlessIdentity; res.set("Cache-Control", "no-store").json(await endlessAction(playerId, userId, command)); }
  catch (error) { next(error); }
});
endlessRouter.use(((error, _req, res, _next) => {
  if (error instanceof EndlessError) { res.status(error.status).json({ error: error.message }); return; }
  logServerError("Endless request failed", error);
  res.status(503).json({ error: "Endless could not confirm the action. The connection window and question timer keep running." });
}) as import("express").ErrorRequestHandler);
