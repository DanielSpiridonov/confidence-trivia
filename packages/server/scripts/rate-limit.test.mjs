import assert from "node:assert/strict";
import test from "node:test";
import { authenticatedActorOrIpKey, createRateLimiter } from "../dist/rateLimit.js";

function responseDouble() {
  return {
    headers: new Map(), statusCode: 200, payload: null,
    setHeader(name, value) { this.headers.set(name, value); },
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.payload = payload; return this; },
  };
}

test("rate limiter permits the configured count and then returns 429", () => {
  const limit = createRateLimiter({ windowMs: 60_000, max: 2, message: "Slow down" });
  const request = { ip: "127.0.0.1", socket: {} };
  let accepted = 0;
  limit(request, responseDouble(), () => { accepted += 1; });
  limit(request, responseDouble(), () => { accepted += 1; });
  const rejected = responseDouble();
  limit(request, rejected, () => { accepted += 1; });
  assert.equal(accepted, 2);
  assert.equal(rejected.statusCode, 429);
  assert.equal(rejected.payload.error, "Slow down");
  assert.ok(rejected.headers.has("Retry-After"));
});

test("authenticated rate-limit keys never contain bearer tokens", () => {
  const token = "Bearer private-session-token";
  const key = authenticatedActorOrIpKey({ headers: { authorization: token }, ip: "127.0.0.1", socket: {} });
  assert.match(key, /^auth:[0-9a-f]{64}$/);
  assert.equal(key.includes(token), false);
});
