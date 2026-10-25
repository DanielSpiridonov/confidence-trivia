import { Image } from "react-native";

// Use the native image cache, not offscreen images whose onLoadEnd also fires
// on failure. Retain successes across rounds and retry transient Metro failures.
const complete = new Set<string>();
const pending = new Set<string>();
const retryAfter = new Map<string, number>();
const queue: string[] = [];
let active = 0;

function drain() {
  while (active < 2 && queue.length) {
    const uri = queue.shift()!;
    active += 1;
    void (async () => {
      try {
        for (let attempt = 0; attempt < 3; attempt += 1) {
          try {
            if (await Image.prefetch(uri)) { complete.add(uri); return; }
          } catch { /* Retry a transient failed download. */ }
          if (attempt < 2) await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
        }
        retryAfter.set(uri, Date.now() + 30_000);
      } finally {
        pending.delete(uri);
        active -= 1;
        drain();
      }
    })();
  }
}

export function warmImageSources(sources: readonly number[]) {
  for (const source of sources) {
    const uri = Image.resolveAssetSource(source)?.uri;
    if (!uri || complete.has(uri) || pending.has(uri) || (retryAfter.get(uri) ?? 0) > Date.now()) continue;
    pending.add(uri);
    queue.push(uri);
  }
  drain();
}
