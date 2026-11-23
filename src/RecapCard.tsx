import { useRef, useState } from "react";
import {
  Image,
  Platform,
  StyleSheet,
  Text,
  View,
  type ViewInstance,
} from "react-native";
import { getDeckArt } from "./deckArt";
import type { RoomView } from "./game";
import { shareRecap } from "./shareRecap";
import { Body, Button } from "./ui";

type RoundRecap = NonNullable<RoomView["recap"]>[number];

export function RecapCard({
  room,
  item,
  index,
  deckName,
  color,
}: {
  room: RoomView;
  item: RoundRecap;
  index: number;
  deckName: string;
  color: string;
}) {
  const card = useRef<ViewInstance>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const names = new Map(room.players.map(({ id, name }) => [id, name]));
  const leaders = item.leaders.map((id) => names.get(id) ?? "A player");
  const isWrite = item.kind === "write" || item.answers !== undefined;
  const art = room.customDeck?.cover ?? room.deckId;

  async function share() {
    if (!card.current || busy) return;
    setBusy(true);
    setError(false);
    try {
      await shareRecap(card.current, `blame-game-round-${index + 1}.png`);
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <View className="gap-2">
      <View
        ref={card}
        collapsable={false}
        style={[styles.card, { backgroundColor: color }]}
      >
        <View style={styles.top}>
          <Text style={styles.brand}>{deckName.toUpperCase()}</Text>
          <Text style={styles.round}>ROUND {index + 1}</Text>
        </View>
        <View style={styles.promptRow}>
          <View style={styles.promptCopy}>
            <Text style={styles.promptLabel}>
              {isWrite ? "SPOTLIGHT ROUND" : "MOST LIKELY TO"}
            </Text>
            <Text style={styles.question}>{item.question}</Text>
          </View>
          <Image source={getDeckArt(art)} style={styles.artAccent} />
        </View>
        {isWrite ? (
          item.answers?.length ? (
            <View style={styles.answerList}>
              {item.answers.map((answer, answerIndex) => (
                <View
                  key={`${answerIndex}-${answer.text}`}
                  style={styles.answer}
                >
                  <Text style={styles.answerText}>“{answer.text}”</Text>
                  {!!answer.author && (
                    <Text style={styles.author}>
                      {names.get(answer.author) ?? "A player"}
                    </Text>
                  )}
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.empty}>No answers shared this round.</Text>
          )
        ) : leaders.length ? (
          <View style={styles.result}>
            <Text style={styles.resultLabel}>
              {leaders.length > 1 ? "TIED TOP VOTE GETTERS" : "TOP VOTE GETTER"}
            </Text>
            <Text style={styles.resultName}>{leaders.join(" & ")}</Text>
            {typeof item.leaderVotes === "number" && (
              <Text style={styles.voteCount}>
                {item.leaderVotes} {item.leaderVotes === 1 ? "vote" : "votes"}
                {leaders.length > 1 ? " each" : ""}
              </Text>
            )}
          </View>
        ) : (
          <Text style={styles.empty}>
            {item.passCount === room.players.length
              ? "Everyone passed."
              : item.responseCount === 0
                ? "No responses this round."
                : "No votes cast."}
          </Text>
        )}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            BLAME GAME · blame-game.theromeirofernandes.workers.dev
          </Text>
        </View>
      </View>
      <Button tone="secondary" disabled={busy} onPress={() => void share()}>
        {busy
          ? "Making image…"
          : Platform.OS === "web"
            ? "Share / download card"
            : "Share card"}
      </Button>
      {error && (
        <Body accessibilityRole="alert" className="text-sm text-peach">
          Couldn’t share the card. Try again.
        </Body>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 22, padding: 20, gap: 10 },
  top: { flexDirection: "row", alignItems: "center", gap: 8 },
  brand: {
    fontFamily: "SpaceGrotesk_700Bold",
    color: "#15131d",
    fontSize: 12,
    letterSpacing: 1.5,
    flex: 1,
  },
  round: {
    fontFamily: "DMSans_700Bold",
    color: "#271c3f",
    fontSize: 10,
    letterSpacing: 1,
  },
  promptLabel: {
    fontFamily: "DMSans_700Bold",
    fontSize: 10,
    letterSpacing: 1.4,
    color: "#35274c",
    marginTop: 7,
  },
  promptRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  promptCopy: { flex: 1, gap: 10 },
  artAccent: { width: 52, height: 52 },
  question: {
    fontFamily: "GeistPixelSquare",
    fontSize: 25,
    lineHeight: 31,
    color: "#15131d",
  },
  result: {
    backgroundColor: "#e2fc67",
    borderRadius: 13,
    padding: 13,
    marginTop: 3,
    gap: 4,
  },
  resultLabel: {
    fontFamily: "DMSans_700Bold",
    fontSize: 10,
    letterSpacing: 1,
    color: "#15131d",
  },
  resultName: {
    fontFamily: "SpaceGrotesk_700Bold",
    fontSize: 21,
    lineHeight: 26,
    color: "#15131d",
  },
  voteCount: { fontFamily: "DMSans_700Bold", fontSize: 13, color: "#35274c" },
  empty: {
    fontFamily: "DMSans_500Medium",
    fontSize: 15,
    color: "#271c3f",
    paddingVertical: 8,
  },
  answerList: { gap: 7, marginTop: 2 },
  answer: { backgroundColor: "#fff8", borderRadius: 12, padding: 11, gap: 4 },
  answerText: {
    fontFamily: "DMSans_500Medium",
    fontSize: 15,
    lineHeight: 21,
    color: "#15131d",
  },
  author: {
    fontFamily: "DMSans_700Bold",
    fontSize: 10,
    letterSpacing: 0.8,
    color: "#49316d",
    textTransform: "uppercase",
  },
  footer: {
    borderTopWidth: 1,
    borderTopColor: "#15131d33",
    paddingTop: 8,
    marginTop: 3,
    alignItems: "flex-end",
  },
  footerText: {
    fontFamily: "DMSans_700Bold",
    fontSize: 8,
    letterSpacing: 0.25,
    color: "#49316d",
  },
});
