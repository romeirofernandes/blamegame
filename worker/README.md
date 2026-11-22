# Cloudflare Worker backend

This Worker keeps the Bun command payloads and stores each room snapshot and its reconnect tokens in a SQLite-backed Durable Object. Each object accepts hibernatable WebSockets and expires its room after two hours without a room command. Bun runs the local Wrangler development command.

## Local development

```sh
bun run build:web
cd worker
bun install
bun run dev
```

The client opens `/ws/new` for room creation. The Worker mints a five-character code and routes that connection to the Durable Object named `room-<code>`; the existing `create` command payload is unchanged. Join and resume clients open `/ws/<code>` and send the existing `join` or `resume` command. A rare code collision returns an error with `reset: true` and closes the socket, so the client should reconnect to `/ws/new` and retry create. The current app's invite links use `/?room=<code>`; Workers Assets serves the Expo export at that URL.

Set `FIREBASE_PROJECT_ID` in `.dev.vars` to enable authenticated connections. Guests can use the Worker without that setting. Firebase clients send `{"type":"authenticate","idToken":"<Firebase ID token>"}` first, wait for `{"type":"authenticated"}`, then send `create`, `join`, or `resume`. Send authentication again on each new socket before resuming an authenticated room. A bad or unverifiable token closes the connection. The Worker verifies the signed token's issuer and audience against `FIREBASE_PROJECT_ID`; the token's verified Firebase `sub` is bound to the reconnect token and never comes from a client-supplied UID.

Run the focused Durable Object protocol check with `bun run test`.

## Deploy

Set the Firebase project ID as a Worker secret when authenticated play is enabled, then deploy:

```sh
bun run build:web
cd worker
bun install
bunx wrangler secret put FIREBASE_PROJECT_ID
bun run deploy
```

Without Firebase auth, omit the secret. The Worker serves the Expo app and handles `/health`, `/ws/new`, and `/ws/<code>` on the same origin. Configure the app's `EXPO_PUBLIC_SERVER_URL` with the deployed Worker origin.
