import assert from "node:assert/strict";
import test from "node:test";
import express from "express";
import { asyncRoute, httpErrorHandler } from "../dist/httpSafety.js";

test("async route failures and malformed JSON return safe responses and leave the server usable", async (t) => {
  const app = express();
  app.use(express.json({ limit: "1kb" }));
  app.get("/failure", asyncRoute(async () => { throw new Error("private database connection details"); }));
  app.post("/json", asyncRoute(async (_req, res) => { res.json({ ok: true }); }));
  app.get("/ok", asyncRoute(async (_req, res) => { res.json({ ok: true }); }));
  app.use(httpErrorHandler);
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  t.mock.method(console, "error", () => {});
  const url = `http://127.0.0.1:${server.address().port}`;
  try {
    const failure = await fetch(`${url}/failure`);
    assert.equal(failure.status, 503);
    assert.deepEqual(await failure.json(), { error: "Service is temporarily unavailable" });
    const malformed = await fetch(`${url}/json`, { method: "POST", headers: { "Content-Type": "application/json" }, body: '{"private":' });
    assert.equal(malformed.status, 400);
    assert.deepEqual(await malformed.json(), { error: "Invalid JSON request" });
    const oversized = await fetch(`${url}/json`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: "x".repeat(2000) }) });
    assert.equal(oversized.status, 413);
    assert.deepEqual(await oversized.json(), { error: "Request is too large" });
    assert.deepEqual(await (await fetch(`${url}/ok`)).json(), { ok: true });
  } finally { await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())); }
});
