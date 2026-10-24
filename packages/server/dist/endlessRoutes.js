"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.endlessRouter = void 0;
exports.parseEndlessCommand = parseEndlessCommand;
const express_1 = require("express");
const shared_1 = require("@confidence-trivia/shared");
const auth_1 = require("./auth");
const database_1 = require("./database");
const endless_1 = require("./endless");
const logging_1 = require("./logging");
const uuid = (v) => typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
function parseEndlessCommand(body) {
    if (body?.type === "start" && uuid(body.requestId))
        return { type: "start", requestId: body.requestId };
    if ((body?.type === "heartbeat" || body?.type === "abandon") && uuid(body.runId))
        return { type: body.type, runId: body.runId };
    if ((body?.type === "ready" || body?.type === "visualFailed") && uuid(body.runId) && uuid(body.token))
        return { type: body.type, runId: body.runId, token: body.token };
    if ((body?.type === "answer" || body?.type === "next") && uuid(body.runId) && uuid(body.token)) {
        if (body.type === "next")
            return { type: "next", runId: body.runId, token: body.token };
        if (body.answer === null || (typeof body.answer === "number" && Number.isFinite(body.answer)) || (typeof body.answer === "string" && body.answer.trim().length > 0 && body.answer.length <= 64))
            return { type: "answer", runId: body.runId, token: body.token, answer: body.answer };
    }
    throw new endless_1.EndlessError(400, "Invalid Endless action.");
}
exports.endlessRouter = (0, express_1.Router)();
exports.endlessRouter.use(async (req, res, next) => {
    res.set("X-Endless-Protocol", String(shared_1.ENDLESS_PROTOCOL_VERSION));
    try {
        const playerId = req.query.playerId;
        const identity = await (0, auth_1.verifySupabaseIdentity)(req.headers.authorization);
        if (!uuid(playerId) || !identity)
            throw new endless_1.EndlessError(401, "Your session expired. Please sign in again.");
        // State/actions validate ownership and moderation under their transaction's
        // player lock. Only the read-only board needs a separate ownership query.
        if (req.path === "/leaderboard" && !await (0, database_1.isAuthenticatedPlayer)(playerId, identity.userId))
            throw new endless_1.EndlessError(403, "This account cannot access Endless.");
        res.locals.endlessIdentity = { playerId, userId: identity.userId };
        next();
    }
    catch (error) {
        next(error);
    }
});
exports.endlessRouter.get("/leaderboard", async (_req, res, next) => {
    try {
        res.set("Cache-Control", "no-store").json(await (0, endless_1.endlessLeaderboard)(res.locals.endlessIdentity.playerId));
    }
    catch (error) {
        next(error);
    }
});
exports.endlessRouter.get("/state", async (_req, res, next) => {
    try {
        const { playerId, userId } = res.locals.endlessIdentity;
        res.set("Cache-Control", "no-store").json(await (0, endless_1.endlessAction)(playerId, userId, { type: "sync" }));
    }
    catch (error) {
        next(error);
    }
});
exports.endlessRouter.post("/action", async (req, res, next) => {
    try {
        const command = parseEndlessCommand(req.body);
        const { playerId, userId } = res.locals.endlessIdentity;
        res.set("Cache-Control", "no-store").json(await (0, endless_1.endlessAction)(playerId, userId, command));
    }
    catch (error) {
        next(error);
    }
});
exports.endlessRouter.use(((error, _req, res, _next) => {
    if (error instanceof endless_1.EndlessError) {
        res.status(error.status).json({ error: error.message });
        return;
    }
    (0, logging_1.logServerError)("Endless request failed", error);
    res.status(503).json({ error: "Endless could not confirm the action. The connection window and question timer keep running." });
}));
