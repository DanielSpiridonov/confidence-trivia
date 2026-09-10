import "react-native-url-polyfill/auto";
import * as SecureStore from "expo-secure-store";
import * as WebBrowser from "expo-web-browser";
import * as AppleAuthentication from "expo-apple-authentication";
import * as Crypto from "expo-crypto";
import { makeRedirectUri } from "expo-auth-session";
import { createClient, Session } from "@supabase/supabase-js";

WebBrowser.maybeCompleteAuthSession();

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? "";
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";
export const authConfigured = Boolean(supabaseUrl && supabaseKey);

const secureStorage = {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
};

export const supabase = createClient(
  supabaseUrl || "https://configuration-required.supabase.co",
  supabaseKey || "configuration-required",
  { auth: { storage: secureStorage, persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, flowType: "pkce" } },
);

export async function signInWithSocialProvider(provider: "google" | "apple"): Promise<Session> {
  if (!authConfigured) throw new Error("auth_not_configured");
  const redirectTo = makeRedirectUri({ scheme: "confidence-trivia", path: "auth/callback" });
  const { data, error } = await supabase.auth.signInWithOAuth({ provider, options: { redirectTo, skipBrowserRedirect: true } });
  if (error || !data.url) throw error ?? new Error("auth_url_missing");
  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type !== "success") throw new Error(result.type === "cancel" ? "auth_cancelled" : "auth_failed");
  const callbackUrl = new URL(result.url);
  const code = callbackUrl.searchParams.get("code");
  if (!code) throw new Error("auth_code_missing");
  const { data: sessionData, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
  if (exchangeError || !sessionData.session) throw exchangeError ?? new Error("auth_session_missing");
  return sessionData.session;
}

export async function signInWithApple(): Promise<Session> {
  if (!authConfigured) throw new Error("auth_not_configured");
  if (!await AppleAuthentication.isAvailableAsync()) throw new Error("apple_auth_unavailable");

  const rawNonce = Crypto.randomUUID();
  const hashedNonce = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, rawNonce);
  try {
    const credential = await AppleAuthentication.signInAsync({
      nonce: hashedNonce,
      requestedScopes: [AppleAuthentication.AppleAuthenticationScope.FULL_NAME, AppleAuthentication.AppleAuthenticationScope.EMAIL],
    });
    if (!credential.identityToken) throw new Error("apple_identity_token_missing");
    const { data, error } = await supabase.auth.signInWithIdToken({ provider: "apple", token: credential.identityToken, nonce: rawNonce });
    if (error || !data.session) throw error ?? new Error("auth_session_missing");

    if (credential.fullName?.givenName || credential.fullName?.familyName) {
      const fullName = AppleAuthentication.formatFullName(credential.fullName).trim();
      if (fullName) await supabase.auth.updateUser({ data: { full_name: fullName } });
    }
    return data.session;
  } catch (error) {
    if (typeof error === "object" && error && "code" in error && error.code === "ERR_REQUEST_CANCELED") throw new Error("auth_cancelled");
    throw error;
  }
}

export async function getLinkedProviders(): Promise<string[]> {
  if (!authConfigured) return [];
  const { data, error } = await supabase.auth.getUserIdentities();
  if (error) throw error;
  return [...new Set(data.identities.map((identity) => identity.provider))];
}

export async function linkGoogleIdentity(): Promise<void> {
  if (!authConfigured) throw new Error("auth_not_configured");
  const redirectTo = makeRedirectUri({ scheme: "confidence-trivia", path: "auth/callback" });
  const { data, error } = await supabase.auth.linkIdentity({ provider: "google", options: { redirectTo, skipBrowserRedirect: true } });
  if (error || !data.url) throw error ?? new Error("auth_url_missing");
  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type !== "success") throw new Error(result.type === "cancel" ? "auth_cancelled" : "auth_failed");
  const callbackUrl = new URL(result.url);
  const code = callbackUrl.searchParams.get("code");
  if (!code) throw new Error("auth_code_missing");
  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
  if (exchangeError) throw exchangeError;
}

export async function linkAppleIdentity(): Promise<void> {
  if (!authConfigured) throw new Error("auth_not_configured");
  if (!await AppleAuthentication.isAvailableAsync()) throw new Error("apple_auth_unavailable");

  const rawNonce = Crypto.randomUUID();
  const hashedNonce = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, rawNonce);
  try {
    const credential = await AppleAuthentication.signInAsync({
      nonce: hashedNonce,
      requestedScopes: [AppleAuthentication.AppleAuthenticationScope.EMAIL],
    });
    if (!credential.identityToken) throw new Error("apple_identity_token_missing");
    const { error } = await supabase.auth.linkIdentity({ provider: "apple", token: credential.identityToken, nonce: rawNonce });
    if (error) throw error;
  } catch (error) {
    if (typeof error === "object" && error && "code" in error && error.code === "ERR_REQUEST_CANCELED") throw new Error("auth_cancelled");
    throw error;
  }
}

export async function getStoredSession(): Promise<Session | null> {
  if (!authConfigured) return null;
  const { data } = await supabase.auth.getSession();
  return data.session;
}

export async function getAccessToken(): Promise<string | null> {
  return (await getStoredSession())?.access_token ?? null;
}

export async function signOutAccount() {
  if (authConfigured) await supabase.auth.signOut();
}

export function subscribeToAuthChanges(onSignedOut: () => void): () => void {
  if (!authConfigured) return () => undefined;
  const { data } = supabase.auth.onAuthStateChange((event) => {
    if (event === "SIGNED_OUT") onSignedOut();
  });
  return () => data.subscription.unsubscribe();
}
