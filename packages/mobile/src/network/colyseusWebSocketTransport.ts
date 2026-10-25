import { WebSocketTransport as BaseTransport } from "colyseus-native-websocket-base";

export function normalizeSocketError(event: any) {
  const native = event?.nativeEvent ?? event;
  const code = Number.isFinite(event?.code) ? event.code : Number.isFinite(native?.code) ? native.code : 1006;
  const reason = [event?.reason, native?.reason, event?.message, native?.message].find(value => typeof value === "string" && value.trim())
    ?? "The room connection failed. Check your network and whether the game server is reachable.";
  return { code, reason };
}

// Colyseus 0.15 expects CloseEvent fields even for React Native's error events.
// Normalize only errors; keep the upstream transport and its wire behavior.
export class WebSocketTransport extends BaseTransport {
  constructor(events: ConstructorParameters<typeof BaseTransport>[0]) {
    super(new Proxy(events, {
      get(target, property, receiver) {
        if (property === "onerror") return (event: unknown) => target.onerror?.(normalizeSocketError(event));
        return Reflect.get(target, property, receiver);
      },
    }));
  }
}
