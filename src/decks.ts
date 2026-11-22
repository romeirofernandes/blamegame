export type Card = { kind: 'pick' | 'write'; question: string };

export const decks = [
  {
    id: 'group-chat', name: 'Group Chat', description: 'Read receipts, road trips, and lore.',
    label: 'THE CLASSIC', color: '#c8adff',
    cards: [
      { kind: 'pick', question: 'Who would live-text their own surprise party?' },
      { kind: 'pick', question: 'Who says “five minutes” while still in bed?' },
      { kind: 'pick', question: 'Who says “quick story” and starts at the beginning of their life?' },
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
      { kind: 'pick', question: 'Who would agree to be a magician’s assistant without asking what the trick is?' },
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
      { kind: 'pick', question: 'Who knows exactly what to order for everyone at the table?' },
      { kind: 'pick', question: 'Who would show up at the airport with snacks and a handmade sign?' },
      { kind: 'pick', question: 'Who would you trust to plan a day that feels exactly like you?' },
    ],
  },
  {
    id: 'shared-holiday', name: 'Shared Holiday', description: 'One booking, six opinions, and the wrong gate.',
    label: 'TRIP LORE', color: '#a9cdfd',
    cards: [
      { kind: 'pick', question: 'Who would book the perfect Airbnb for the wrong weekend?' },
      { kind: 'pick', question: 'Who would pack three outfits for the flight and forget their charger?' },
      { kind: 'pick', question: 'Who would come back from a souvenir shop with the owner’s entire life story?' },
      { kind: 'pick', question: 'Who would say “we can walk it” and accidentally make it a hike?' },
      { kind: 'pick', question: 'Who would make the trip spreadsheet and still be last to the gate?' },
    ],
  },
  {
    id: 'fake-jobs', name: 'Fake Jobs', description: 'Give your friends jobs they’d be suspiciously good at.',
    label: 'WEIRDLY QUALIFIED', color: '#ffe184',
    cards: [
      { kind: 'pick', question: 'Who could get a refund from a vending machine?' },
      { kind: 'pick', question: 'Who would be the best at naming nail polish shades?' },
      { kind: 'pick', question: 'Who would last the longest as a museum guard in a room full of buttons marked “Do not touch”?' },
      { kind: 'pick', question: 'Who would run a lost-and-found and come away with three new friends?' },
      { kind: 'pick', question: 'Who could write a five-star review for a genuinely terrible chair?' },
    ],
  },
  {
    id: 'spotlight', name: 'Spotlight', description: 'Write the line only your group would get.',
    label: 'WRITE AN ANSWER', color: '#a7e7d8',
    cards: [
      { kind: 'write', question: 'What would {player} get unexpectedly famous for?' },
      { kind: 'write', question: 'What would the title of {player}’s group chat memoir be?' },
      { kind: 'write', question: 'What very specific thing would {player} teach a masterclass on?' },
      { kind: 'write', question: 'What sentence would give away that a mystery text came from {player}?' },
      { kind: 'write', question: 'What oddly specific award would you give {player}?' },
    ],
  },
] satisfies { id: string; name: string; description: string; label: string; color: string; cards: Card[] }[];

export function getDeck(id: string) {
  return decks.find((deck) => deck.id === id);
}
