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

test("unverified bearer tokens share the IP budget", async () => {
  const token = "Bearer private-session-token";
  const previousUrl = process.env.SUPABASE_URL;
  delete process.env.SUPABASE_URL;
  try {
    const key = await authenticatedActorOrIpKey({ headers: { authorization: token }, ip: "127.0.0.1", socket: {} });
    assert.equal(key, "ip:127.0.0.1");
    const other = await authenticatedActorOrIpKey({ headers: { authorization: "Bearer other" }, ip: "127.0.0.1", socket: {} });
    assert.equal(other, key);
  } finally { if (previousUrl) process.env.SUPABASE_URL = previousUrl; }
});

test("refreshed tokens for one verified account share one rate-limit budget", async (t) => {
  t.mock.method(globalThis, "fetch", async () => new Response(JSON.stringify({ id: "same-user" }), { status: 200 }));
  const oldUrl = process.env.SUPABASE_URL, oldKey = process.env.SUPABASE_PUBLISHABLE_KEY;
  process.env.SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_PUBLISHABLE_KEY = "public-test-key";
  try {
    const key = (token) => authenticatedActorOrIpKey({ headers: { authorization: `Bearer ${token}` }, ip: "127.0.0.1", socket: {} });
    const first = await key("token-one"), refreshed = await key("token-two");
    assert.equal(first, refreshed);
    assert.match(first, /^auth:[0-9a-f]{64}$/);
    assert.equal(first.includes("token"), false);
    assert.equal(first.includes("same-user"), false);
  } finally {
    if (oldUrl === undefined) delete process.env.SUPABASE_URL; else process.env.SUPABASE_URL = oldUrl;
    if (oldKey === undefined) delete process.env.SUPABASE_PUBLISHABLE_KEY; else process.env.SUPABASE_PUBLISHABLE_KEY = oldKey;
  }
});

test("async rate-limit keys enforce the limit and forward failures", async () => {
  const limit = createRateLimiter({ windowMs: 60_000, max: 1, message: "Slow down", key: async () => "verified-user" });
  let accepted = 0;
  const first = responseDouble(), second = responseDouble();
  limit({}, first, () => { accepted++; });
  limit({}, second, () => { accepted++; });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(accepted, 1);
  assert.equal(second.statusCode, 429);
  const error = new Error("key lookup failed");
  const broken = createRateLimiter({ windowMs: 60_000, max: 1, message: "Slow down", key: async () => { throw error; } });
  await new Promise((resolve) => broken({}, responseDouble(), (value) => { assert.equal(value, error); resolve(); }));
});
