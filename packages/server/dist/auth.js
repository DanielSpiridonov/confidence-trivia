"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifySupabaseIdentity = verifySupabaseIdentity;
exports.revokeAppleAuthorization = revokeAppleAuthorization;
exports.deleteSupabaseIdentity = deleteSupabaseIdentity;
const crypto_1 = require("crypto");
const fs_1 = require("fs");
async function verifySupabaseIdentity(authorization) {
    const accessToken = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
    const supabaseUrl = process.env.SUPABASE_URL;
    const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_ANON_KEY;
    if (!accessToken || !supabaseUrl || !publishableKey)
        return null;
    try {
        const response = await fetch(`${supabaseUrl.replace(/\/$/, "")}/auth/v1/user`, {
            headers: { Authorization: `Bearer ${accessToken}`, apikey: publishableKey },
        });
        if (!response.ok)
            return null;
        const user = await response.json();
        const appleIdentity = user.identities?.find((identity) => identity.provider === "apple");
        const appleUserId = typeof appleIdentity?.identity_data?.sub === "string"
            ? appleIdentity.identity_data.sub
            : typeof appleIdentity?.id === "string" ? appleIdentity.id : null;
        return typeof user.id === "string"
            ? { userId: user.id, provider: typeof user.app_metadata?.provider === "string" ? user.app_metadata.provider : "social", email: typeof user.email === "string" ? user.email : null, appleUserId }
            : null;
    }
    catch {
        return null;
    }
}
function base64Url(value) {
    return Buffer.from(value).toString("base64url");
}
function readApplePrivateKey() {
    if (process.env.APPLE_PRIVATE_KEY)
        return process.env.APPLE_PRIVATE_KEY.replace(/\\n/g, "\n");
    if (!process.env.APPLE_PRIVATE_KEY_PATH)
        return null;
    try {
        return (0, fs_1.readFileSync)(process.env.APPLE_PRIVATE_KEY_PATH, "utf8");
    }
    catch {
        return null;
    }
}
function createAppleClientSecret() {
    const teamId = process.env.APPLE_TEAM_ID;
    const keyId = process.env.APPLE_KEY_ID;
    const clientId = process.env.APPLE_CLIENT_ID;
    const privateKey = readApplePrivateKey();
    if (!teamId || !keyId || !clientId || !privateKey)
        return null;
    const issuedAt = Math.floor(Date.now() / 1000);
    const header = base64Url(JSON.stringify({ alg: "ES256", kid: keyId, typ: "JWT" }));
    const claims = base64Url(JSON.stringify({ iss: teamId, iat: issuedAt, exp: issuedAt + 300, aud: "https://appleid.apple.com", sub: clientId }));
    const signingInput = `${header}.${claims}`;
    try {
        const signer = (0, crypto_1.createSign)("SHA256");
        signer.update(signingInput);
        signer.end();
        const signature = signer.sign({ key: (0, crypto_1.createPrivateKey)(privateKey), dsaEncoding: "ieee-p1363" });
        return `${signingInput}.${base64Url(signature)}`;
    }
    catch {
        return null;
    }
}
function decodeJwtPayload(token) {
    const payload = token.split(".")[1];
    if (!payload)
        return null;
    try {
        return JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    }
    catch {
        return null;
    }
}
async function revokeAppleAuthorization(authorizationCode, expectedAppleUserId) {
    const clientId = process.env.APPLE_CLIENT_ID;
    const clientSecret = createAppleClientSecret();
    if (!clientId || !clientSecret || !authorizationCode || !expectedAppleUserId)
        return false;
    try {
        const tokenResponse = await fetch("https://appleid.apple.com/auth/token", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, code: authorizationCode, grant_type: "authorization_code" }),
        });
        if (!tokenResponse.ok)
            return false;
        const tokens = await tokenResponse.json();
        const idTokenClaims = typeof tokens.id_token === "string" ? decodeJwtPayload(tokens.id_token) : null;
        if (idTokenClaims?.sub !== expectedAppleUserId || idTokenClaims?.aud !== clientId)
            return false;
        const token = typeof tokens.refresh_token === "string" ? tokens.refresh_token : typeof tokens.access_token === "string" ? tokens.access_token : null;
        if (!token)
            return false;
        const revokeResponse = await fetch("https://appleid.apple.com/auth/revoke", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, token, token_type_hint: typeof tokens.refresh_token === "string" ? "refresh_token" : "access_token" }),
        });
        return revokeResponse.ok;
    }
    catch {
        return false;
    }
}
async function deleteSupabaseIdentity(userId) {
    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceRoleKey)
        return false;
    try {
        const response = await fetch(`${supabaseUrl.replace(/\/$/, "")}/auth/v1/admin/users/${encodeURIComponent(userId)}`, {
            method: "DELETE",
            headers: { Authorization: `Bearer ${serviceRoleKey}`, apikey: serviceRoleKey },
        });
        return response.ok || response.status === 404;
    }
    catch {
        return false;
    }
}
