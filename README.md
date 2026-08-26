# Confidence Trivia

A real-time multiplayer party trivia game where knowing the answer is only
half the game — knowing how confident to be is the other half.

## Structure

- `packages/shared` — pure game logic: types, scoring config, scoring functions.
  No UI, no server-only code. Both the server and any future client import this.
- `packages/server` — authoritative Colyseus game server. Owns room state,
  round timing, validation, and scoring.
- `packages/mobile` — Expo (React Native) client for iOS/Android.

## Phase 1 scope (this build)

Room create/join, lobby, multiple-choice questions, confidence, side bets,
reveal, leaderboard, 10-round game, winner screen. Streaks, extra question
types, and localization land in later phases per the project spec.

## Running locally

```bash
npm install
npm run dev:server     # starts the Colyseus server on :2567
npm run dev:mobile     # starts Expo — scan the QR with Expo Go
```

Set the mobile app's server URL through `EXPO_PUBLIC_SERVER_URL`. Copy
`packages/mobile/.env.example` to `packages/mobile/.env` and replace the
example address with your server's LAN IP. A physical phone cannot use
`localhost` to reach another machine.

## Running the server with Docker

Build and run the production server from the repository root:

```bash
docker build -t confidence-trivia-server .
docker run --name confidence-trivia-server --restart unless-stopped \
  -p 2567:2567 confidence-trivia-server
```

The health endpoint is available at `http://localhost:2567/health`. Devices on
the same network connect to `ws://<docker-host-LAN-IP>:2567`; for example,
`ws://192.168.1.23:2567`.

When moving the container to a home server, rebuild or transfer the image, run
the same command there, and update `EXPO_PUBLIC_SERVER_URL` to that server's
address. If clients will connect over the public internet, also configure port
forwarding and a firewall. A domain with a TLS reverse proxy is recommended so
the app can use `wss://` instead of an unencrypted public WebSocket connection.
