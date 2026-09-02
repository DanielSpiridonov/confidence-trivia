export async function verifySupabaseIdentity(authorization: string | undefined): Promise<{ userId: string; provider: string; email: string | null } | null> {
  const accessToken = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
  const supabaseUrl = process.env.SUPABASE_URL;
  const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_ANON_KEY;
  if (!accessToken || !supabaseUrl || !publishableKey) return null;
  try {
    const response = await fetch(`${supabaseUrl.replace(/\/$/, "")}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${accessToken}`, apikey: publishableKey },
    });
    if (!response.ok) return null;
    const user = await response.json() as { id?: unknown; email?: unknown; app_metadata?: { provider?: unknown } };
    return typeof user.id === "string"
      ? { userId: user.id, provider: typeof user.app_metadata?.provider === "string" ? user.app_metadata.provider : "social", email: typeof user.email === "string" ? user.email : null }
      : null;
  } catch {
    return null;
  }
}
