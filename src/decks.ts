export type Card = { kind: 'pick' | 'write'; question: string };

export const decks = [
  {
    id: 'group-chat', name: 'Group Chat', description: 'Read receipts, road trips, and lore.',
    label: 'THE CLASSIC', color: '#c8adff',
    cards: [
      { kind: 'pick', question: 'Who would go viral for the wrong reason?' },
      { kind: 'pick', question: 'Who says “five minutes” while still in bed?' },
      { kind: 'write', question: 'What would {player} get famous for?' },
      { kind: 'pick', question: 'Who could turn a grocery run into a three-hour side quest?' },
      { kind: 'pick', question: 'Who is most likely to accidentally send the screenshot to the person in it?' },
    ],
  },
  {
    id: 'chaos', name: 'Chaos Mode', description: 'Bad plans and excellent stories.',
    label: 'UNHINGED', color: '#ffb199',
    cards: [
      { kind: 'pick', question: 'Who would get an entire wedding to dance on the tables?' },
      { kind: 'pick', question: 'Who would accidentally join a parade and finish it?' },
      { kind: 'write', question: 'What ridiculous thing would {player} put on a billboard?' },
      { kind: 'pick', question: 'Who could talk their way backstage with a library card?' },
      { kind: 'pick', question: 'Who is most likely to start a rumor about themselves just to see where it goes?' },
    ],
  },
  {
    id: 'soft-launch', name: 'Soft Launch', description: 'A little sappy. Still very revealing.',
    label: 'WHOLESOME', color: '#ffb9da',
    cards: [
      { kind: 'pick', question: 'Who makes a stranger feel like part of the group the fastest?' },
      { kind: 'pick', question: 'Who remembers the tiny thing you mentioned six months ago?' },
      { kind: 'write', question: 'What small thing makes {player} a good friend?' },
      { kind: 'pick', question: 'Who would show up at the airport with snacks and a handmade sign?' },
      { kind: 'pick', question: 'Who would you trust to plan a day that feels exactly like you?' },
    ],
  },
] satisfies { id: string; name: string; description: string; label: string; color: string; cards: Card[] }[];

export function getDeck(id: string) {
  return decks.find((deck) => deck.id === id);
}
