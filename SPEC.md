# Blame Game

Blame Game turns a group-chat poll into a live party game. The payoff is finding out what your friends think when everyone answers the same question. A good prompt sounds like a story the group already wants to tell.

## First playtest

- A host picks a five-round deck and a vote mode, creates a private room, and shares a code or invite link. Players join with a nickname. A room holds 3–12 players and locks when the host starts.
- Voting decks ask everyone to pick one player. The Spotlight deck asks for short answers about a different player each round. Everyone may submit once or pass. The host can reveal after at least one submission or pass, and advances the next round. If the host leaves, another connected player takes over.
- Before the reveal, everyone sees the submission count and their own submission status. Anonymous mode shows totals and unattributed answers after the reveal, including for the host. Named mode also shows who picked each player or wrote each answer.
- Players can try a solo demo with simulated friends. The final round ends with a session recap and a way home.

## Decks

Start with **Group Chat** for playful, recognizable habits. **Chaos Mode** covers harmless hypotheticals, **Soft Launch** covers affectionate takes, and **Spotlight** collects short answers about one player at a time. Playtest for questions that split the room, get a laugh, or start a story. Replace questions that produce the same winner every time. Custom cards and asynchronous play are candidates after the live loop gets repeat use.

## Screen and motion

Use [Quiplash 3](https://www.jackboxgames.com/games/quiplash-3) as the reference for the rhythm of one big prompt and a distinct reveal. Blame Game uses lilac question cards, acid-lime actions, and original chat doodles across light and dark themes. Appearance follows the device by default. Use 24-point page gutters, 12-point gaps within groups, and 24–32 points between groups. Use a bold condensed display face for prompts with a separate, readable body face. Press feedback is brief. Haptics confirm a locked submission, and subtle entrance motion marks the reveal with support for Reduce Motion. Follow Emil Kowalski's [Animate Expo](https://github.com/emilkowalski/skills/tree/main/skills/animate-expo) and [Mobile Native](https://github.com/emilkowalski/skills/tree/main/skills/mobile-native) guidance.

## Implementation

Expo React Native runs on iOS, Android, and the browser. NativeWind provides shared styling. A Cloudflare Worker serves the app and routes WebSockets to a SQLite-backed Durable Object per room, following Typiks. The Durable Object owns room membership, the host role, round transitions, and a separate view of state for each player. Hidden submissions are excluded from broadcast data. An opaque player token resumes a room following a reconnect or app restart. Rooms expire after two hours of inactivity. Firebase provides optional email and guest accounts, and the Worker verifies Firebase ID tokens for signed-in connections. A public release needs a deployed HTTPS/WSS endpoint and signed native builds.

## Playtest questions

- Does a group understand how to join, vote, and find out who was picked without help?
- Does the reveal get people talking? Which question did it?
- Would the host run another deck with the same group?
