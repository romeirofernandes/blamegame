# Blame Game

a live party game for the group chat. pick a deck, blame a friend, and see where everyone landed once the host opens the votes.

## try it in a browser

```sh
bun install --frozen-lockfile
bun install --cwd worker --frozen-lockfile
bun run build:web
bun run server
```

set up Firebase below, then open [localhost:3000](http://localhost:3000) and tap **Try a solo demo**. for written answers, open **Decks**, find **Spotlight**, and tap **Try solo**.

to play with a group, host a room and send the code or invite link to at least two other players. on the same Wi-Fi, friends can open `http://<your-computer-ip>:3000` to join. on one computer, use three separate browser profiles and sign into a different account in each.

## try it on an iPhone or Android

keep `bun run server` running and start Expo in another terminal.

```sh
bun run start --go
```

install [Expo Go for SDK 58](https://expo.dev/go) on your phone and join the same Wi-Fi as your computer. scan the terminal QR with the iPhone camera or the Android Expo Go scanner. try an anonymous room and a named one, then try backgrounding your phone after locking a vote and check that it still says **Locked in.** when you return.

## turn on accounts

enable **Email/Password** under **Firebase Console → Authentication → Sign-in method**. put the Android config at `google-services.json` in the repo root. Expo reads it for the Android package `com.blame.game`. to supply Firebase web app settings instead, copy `.env.example` to `.env.local` and fill them in.

the Worker uses the Firebase project ID in `worker/wrangler.jsonc`. if you use a different project locally, set `FIREBASE_PROJECT_ID` in `worker/.dev.vars` to match. rebuild the web app and restart the Worker after changing the configuration.

you can sign in from **Settings → Account** or when you start playing. hosting, joining, and trying a solo demo all require an account. a live room resumes on the same device or tab when you sign in with the same account.

## deploy the Worker and build the app

the Worker serves both the web app and the WebSocket endpoint. each room has its own SQLite-backed Durable Object, with hibernation and a two-hour idle expiry. match `FIREBASE_PROJECT_ID` in `worker/wrangler.jsonc` to the app’s Firebase project.

```sh
bun run deploy:worker
```

set `EXPO_PUBLIC_SERVER_URL` to the Worker’s public HTTPS origin when building a standalone app. for an EAS cloud build, provide `google-services.json` as a file environment variable named `GOOGLE_SERVICES_JSON` in the build environment. the [EAS preview profile](./eas.json) makes an Android APK or an iOS internal distribution build with a registered test device and Apple signing credentials.

```sh
EXPO_PUBLIC_SERVER_URL=https://your-worker.example bun x eas-cli build --profile preview --platform all
```

## checks

```sh
bun run check
bun test
```

there's more about the first playtest in the [spec](./SPEC.md), and a backlog of questions in [deck directions](./DECKS.md).
