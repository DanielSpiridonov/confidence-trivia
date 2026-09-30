import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const errors = [];
const config = JSON.parse(readFileSync(resolve(root, "app.json"), "utf8")).expo;
const eas = JSON.parse(readFileSync(resolve(root, "eas.json"), "utf8"));

// Expo reads local dotenv files; mirror that behavior without echoing their values.
const env = {};
for (const name of [".env", ".env.local"]) {
  const path = resolve(root, name);
  if (!existsSync(path)) continue;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z_0-9]*)\s*=\s*(.*?)\s*$/);
    if (!match) continue;
    env[match[1]] = match[2].replace(/^(['"])(.*)\1$/, "$2");
  }
}
Object.assign(env, process.env);

const server = env.EXPO_PUBLIC_SERVER_URL;
const supabase = env.EXPO_PUBLIC_SUPABASE_URL;
const key = env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
if (!server || !/^wss:\/\/[^\s/]+/i.test(server)) errors.push("EXPO_PUBLIC_SERVER_URL must be a wss:// URL");
if (!supabase || !/^https:\/\/[^\s/]+/i.test(supabase)) errors.push("EXPO_PUBLIC_SUPABASE_URL must be an https:// URL");
if (!key || !key.startsWith("sb_publishable_")) errors.push("EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY must be a publishable key");

for (const [label, asset] of [
  ["app icon", config.icon],
  ["splash", config.splash?.image],
  ["Android adaptive icon", config.android?.adaptiveIcon?.foregroundImage],
]) {
  if (!asset || !existsSync(resolve(root, asset))) errors.push(`${label} asset is missing: ${asset ?? "not configured"}`);
}
for (const profile of ["preview", "production"]) {
  if (eas.build?.[profile]?.environment !== profile) errors.push(`${profile} EAS build profile must select the ${profile} environment`);
}

if (errors.length) {
  for (const error of errors) console.error(`FAIL: ${error}`);
  process.exitCode = 1;
} else {
  console.log("Release config preflight passed (local values and app assets). Confirm EAS environment variables separately before building.");
}
