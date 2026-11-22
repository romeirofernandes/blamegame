# Blame Game

a live party game for the group chat. pick a deck, blame a friend, and see where everyone landed once the host opens the votes.

## try it in a browser

```sh
bun install --frozen-lockfile
bun install --cwd worker --frozen-lockfile
bun run build:web
bun run server
```

open [localhost:3000](http://localhost:3000) and tap **Try a solo demo**. for written answers, open **Decks**, find **Spotlight**, and tap **Try solo**.

to play with a group, host a room and send the code or invite link to at least two other players. on the same Wi-Fi, friends can open `http://<your-computer-ip>:3000` to join. on one computer, use three fresh tabs.

## try it on an iPhone or Android

keep `bun run server` running and start Expo in another terminal.

```sh
bun run start --go
```

install [Expo Go for SDK 58](https://expo.dev/go) on your phone and join the same Wi-Fi as your computer. scan the terminal QR with the iPhone camera or the Android Expo Go scanner. try an anonymous room and a named one, then try backgrounding your phone after locking a vote and check that it still says **Locked in.** when you return.

## turn on accounts

create a Firebase project for Blame Game, add a Firebase web app, and enable **Email/Password** and **Anonymous** under Authentication → Sign-in method. copy `.env.example` to `.env.local` and fill in the public configuration for your Firebase web app. copy `worker/dev.vars.example` to `worker/.dev.vars` and set the same Firebase project ID there. then rebuild the web app and restart the Worker.

sign in from **Settings → Account**. nickname play still works without Firebase. a live room resumes on the same device or tab with the original session.

## deploy the Worker and build the app

the Worker serves both the web app and the WebSocket endpoint. each room has its own SQLite-backed Durable Object, with hibernation and a two-hour idle expiry. set `FIREBASE_PROJECT_ID` for the deployed Worker if you're turning on accounts.

```sh
bun run --cwd worker wrangler secret put FIREBASE_PROJECT_ID
bun run deploy:worker
```

set `EXPO_PUBLIC_SERVER_URL` to the Worker’s public HTTPS origin when building a standalone app. the [EAS preview profile](./eas.json) makes an Android APK or an iOS internal distribution build with a registered test device and Apple signing credentials.

```sh
EXPO_PUBLIC_SERVER_URL=https://your-worker.example bun x eas-cli build --profile preview --platform all
```

## checks

```sh
bun run check
bun test
```

there's more about the first playtest in the [spec](./SPEC.md), and a backlog of questions in [deck directions](./DECKS.md).
