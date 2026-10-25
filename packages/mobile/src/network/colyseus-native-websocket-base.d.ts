// Metro maps this alias to the installed Colyseus 0.15 transport. Keeping the
// alias explicit avoids bypassing package exports in application imports.
declare module "colyseus-native-websocket-base" {
  export class WebSocketTransport {
    constructor(events: { onopen?: ((event: any) => any) | null; onmessage?: ((event: any) => any) | null; onclose?: ((event: any) => any) | null; onerror?: ((event: any) => any) | null });
    connect(url: string, headers?: unknown): void;
    send(data: ArrayBuffer | number[]): void;
    close(code?: number, reason?: string): void;
    readonly isOpen: boolean;
  }
}
