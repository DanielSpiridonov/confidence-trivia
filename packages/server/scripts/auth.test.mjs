import test from "node:test";
import assert from "node:assert/strict";
import { verifySupabaseIdentity } from "../dist/auth.js";

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
  try { assert.deepEqual(await verifySupabaseIdentity("Bearer valid-token"), { userId: "user-1", provider: "google", email: "player@example.com" }); }
  finally { globalThis.fetch = originalFetch; }
});

test("rejects an upstream-invalid token", async () => {
  process.env.SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_PUBLISHABLE_KEY = "publishable";
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response("unauthorized", { status: 401 });
  try { assert.equal(await verifySupabaseIdentity("Bearer bad-token"), null); }
  finally { globalThis.fetch = originalFetch; }
});
