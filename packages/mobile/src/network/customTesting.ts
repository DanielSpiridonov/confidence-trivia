/** Check the connected backend, rather than assuming an Expo reload updated it. */
export async function requireSoloCustomServer(serverUrl: string, request: typeof fetch = fetch): Promise<void> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const base = serverUrl.replace(/^ws/, "http").replace(/\/$/, "");
    const response = await request(`${base}/health`, { signal: controller.signal, cache: "no-store" });
    if (!response.ok) throw new Error("Could not check the game server. Please try again.");
    const health = await response.json();
    if (health?.customSoloTesting !== true) throw new Error("This server needs an update before solo Custom can start. After the update, leave and create a new room.");
  } catch (error) {
    if (controller.signal.aborted) throw new Error("The game server did not respond. Please try again.");
    throw error;
  } finally { clearTimeout(timeout); }
}
