# Blame Game

a live party game for the group chat. pick a deck, blame a friend, and see where everyone landed once the host opens the votes.

## try it in a browser

```sh
bun install --frozen-lockfile
bun run build:web
bun run server
```

open [localhost:3000](http://localhost:3000) and tap **Try a solo demo**. you can play all five rounds yourself. the Spotlight deck is for written answers about your friends.

to play with a group, host a room and share the code or invite link with at least two other players. with everyone on the same Wi-Fi, open `http://<your-computer-ip>:3000` on the other devices. on one computer, use three fresh tabs and paste the invite URL into each guest tab. the browser keeps your spot if you reload a tab.

## try it on an iPhone or Android

keep `bun run server` running and start Expo in another terminal.

```sh
bun run start --go
```

install [Expo Go for SDK 58](https://expo.dev/go) on your phone and join the same Wi-Fi as your computer. scan the terminal QR with the iPhone camera or the Android Expo Go scanner. run a room with **Anonymous** selected, then another with **Named**. try backgrounding your phone after locking a vote and check that it still says **Locked in.** when you return.

for standalone installs, deploy the Bun service behind HTTPS with WebSocket upgrades enabled and set `EXPO_PUBLIC_SERVER_URL` to its public URL when building. the [EAS preview profile](./eas.json) makes an Android APK or an iOS internal distribution build with a registered test device and Apple signing credentials.

```sh
EXPO_PUBLIC_SERVER_URL=https://your-server.example bun x eas-cli build --profile preview --platform all
```

rooms expire after two hours of inactivity and clear if the Bun process restarts. use the [spec](./SPEC.md) to see what to look for in the first playtest.

## checks

```sh
bun run check
bun test
```
