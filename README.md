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

## Fast Expo Go testing with Docker

For quick testing with Expo Go, run the backend container and an Expo tunnel
container together:

```bash
EXPO_PUBLIC_SERVER_URL=ws://<docker-host-LAN-IP>:2567 \
  docker compose -f docker-compose.testing.yml up --build
```

Scan the Expo QR code from the `expo` container logs. If friends are on the
same Wi-Fi network, use the Docker host's LAN IP for `EXPO_PUBLIC_SERVER_URL`.
If friends are not on the same network, expose the backend separately with a
public `wss://` URL and use that URL instead.

This setup is for development only. For real distribution, build the iOS app
with EAS/TestFlight and keep only the backend Docker image hosted.

## Shared test server with Expo Go

Use the Render Blueprint in `render.yaml` when testers are not on the same
network. In Render, create a new Blueprint, connect this repository, and deploy
the `confidence-trivia-test` web service. Render builds `Dockerfile.server`,
checks `/health`, and provides an HTTPS/WSS URL.

Copy `packages/mobile/.env.example` to `packages/mobile/.env.local` and set the
deployed URL using `wss://`:

```dotenv
EXPO_PUBLIC_SERVER_URL=wss://confidence-trivia-test.onrender.com
```

Restart Expo after changing an `EXPO_PUBLIC_` variable. For testers outside
your local network, start Expo in tunnel mode and share its QR code:

```bash
npm run dev:mobile:tunnel
```

The `.env.local` file is ignored by Git, so each developer can switch between
a LAN server and the shared server without changing committed configuration.

The free Render instance is suitable for testing but can take roughly a minute
to wake after being idle. Open `https://confidence-trivia-test.onrender.com/health`
before a test session to wake it and confirm that it returns `{ "ok": true }`.

The game server currently stores active rooms in memory. Keep the test service
at one instance, and avoid deploying during a game because a restart ends all
active rooms. This constraint can be addressed with shared state and presence
when production scaling is needed.

## Supabase player persistence

The server can persist each installation's device ID and latest player name in
Supabase PostgreSQL. Active games and scores remain in Colyseus memory.

1. Create a Supabase project in a region close to the Render service.
2. Run the SQL files in `supabase/migrations` in filename order in the
   Supabase SQL Editor. Already-applied migrations do not need to be rerun.
3. In the Supabase project's **Connect** panel, copy the **Session pooler** URI
   and replace its password placeholder with the database password.
4. In Render, add that complete URI as the secret environment variable
   `DATABASE_URL`, then redeploy the service.

Render is IPv4-only, so use the Session pooler URI rather than Supabase's
IPv6-only direct connection. Never put `DATABASE_URL` or a database password in
an `EXPO_PUBLIC_` variable or commit it to Git.

The database integration is optional locally. Without `DATABASE_URL`, the
server runs normally but skips player persistence.
