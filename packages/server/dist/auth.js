"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifySupabaseIdentity = verifySupabaseIdentity;
exports.deleteSupabaseIdentity = deleteSupabaseIdentity;
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
        return typeof user.id === "string"
            ? { userId: user.id, provider: typeof user.app_metadata?.provider === "string" ? user.app_metadata.provider : "social", email: typeof user.email === "string" ? user.email : null }
            : null;
    }
    catch {
        return null;
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
