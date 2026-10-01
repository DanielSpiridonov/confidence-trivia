import test from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import { revokeAppleAuthorization, verifySupabaseIdentity } from "../dist/auth.js";

test("rejects missing bearer token", async () => {
  assert.equal(await verifySupabaseIdentity(undefined), null);
});

test("rejects when server auth configuration is missing", async () => {
  const previousUrl = process.env.SUPABASE_URL;
  delete process.env.SUPABASE_URL;
  assert.equal(await verifySupabaseIdentity("Bearer token"), null);
  if (previousUrl) process.env.SUPABASE_URL = previousUrl;
});

test("returns verified user identity, provider, and email", async () => {
  process.env.SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_PUBLISHABLE_KEY = "publishable";
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    assert.equal(url, "https://example.supabase.co/auth/v1/user");
    assert.equal(options.headers.Authorization, "Bearer valid-token");
    assert.equal(options.headers.apikey, "publishable");
    return new Response(JSON.stringify({ id: "user-1", email: "player@example.com", app_metadata: { provider: "google" } }), { status: 200 });
  };
  try { assert.deepEqual(await verifySupabaseIdentity("Bearer valid-token"), { userId: "user-1", provider: "google", email: "player@example.com", appleUserId: null }); }
  finally { globalThis.fetch = originalFetch; }
});

test("reads a linked Apple user id from a Supabase identity", async () => {
  process.env.SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_PUBLISHABLE_KEY = "publishable";
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({
    id: "user-1", app_metadata: { provider: "google" },
    identities: [{ provider: "apple", id: "apple-user", identity_data: { sub: "apple-user" } }],
  }), { status: 200 });
  try { assert.equal((await verifySupabaseIdentity("Bearer valid-token"))?.appleUserId, "apple-user"); }
  finally { globalThis.fetch = originalFetch; }
});

test("exchanges and revokes a fresh Apple authorization code", async () => {
  const { privateKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });
  process.env.APPLE_TEAM_ID = "TEAMID1234";
  process.env.APPLE_KEY_ID = "KEYID12345";
  process.env.APPLE_CLIENT_ID = "com.example.app";
  process.env.APPLE_PRIVATE_KEY = privateKey.export({ type: "pkcs8", format: "pem" }).toString();
  const appleIdToken = `header.${Buffer.from(JSON.stringify({ sub: "apple-user", aud: "com.example.app" })).toString("base64url")}.signature`;
  const originalFetch = globalThis.fetch;
  const requests = [];
  globalThis.fetch = async (url, options) => {
    requests.push({ url, body: String(options.body) });
    return requests.length === 1
      ? new Response(JSON.stringify({ id_token: appleIdToken, refresh_token: "refresh-token" }), { status: 200 })
      : new Response(null, { status: 200 });
  };
  try {
    assert.equal(await revokeAppleAuthorization("fresh-code", "apple-user"), true);
    assert.equal(requests[0].url, "https://appleid.apple.com/auth/token");
    assert.match(requests[0].body, /code=fresh-code/);
    assert.equal(requests[1].url, "https://appleid.apple.com/auth/revoke");
    assert.match(requests[1].body, /token=refresh-token/);
  } finally {
    globalThis.fetch = originalFetch;
    delete process.env.APPLE_PRIVATE_KEY;
  }
});

test("does not revoke an authorization code for a different Apple user", async () => {
  const { privateKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });
  process.env.APPLE_TEAM_ID = "TEAMID1234";
  process.env.APPLE_KEY_ID = "KEYID12345";
  process.env.APPLE_CLIENT_ID = "com.example.app";
  process.env.APPLE_PRIVATE_KEY = privateKey.export({ type: "pkcs8", format: "pem" }).toString();
  const otherIdToken = `header.${Buffer.from(JSON.stringify({ sub: "other-user", aud: "com.example.app" })).toString("base64url")}.signature`;
  const originalFetch = globalThis.fetch;
  let requestCount = 0;
  globalThis.fetch = async () => { requestCount += 1; return new Response(JSON.stringify({ id_token: otherIdToken, refresh_token: "refresh-token" }), { status: 200 }); };
  try {
    assert.equal(await revokeAppleAuthorization("fresh-code", "apple-user"), false);
    assert.equal(requestCount, 1);
  } finally {
    globalThis.fetch = originalFetch;
    delete process.env.APPLE_PRIVATE_KEY;
  }
});

test("rejects an upstream-invalid token", async () => {
  process.env.SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_PUBLISHABLE_KEY = "publishable";
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response("unauthorized", { status: 401 });
  try { assert.equal(await verifySupabaseIdentity("Bearer bad-token"), null); }
  finally { globalThis.fetch = originalFetch; }
});
