export type Card = { kind: 'pick' | 'write'; question: string };

export const decks = [
  {
    id: 'group-chat', name: 'Group Chat', description: 'Voice notes, screenshots, and the lore behind them.',
    label: 'THE CLASSIC', color: '#c8adff',
    cards: [
      { kind: 'pick', question: 'Who reads 83 messages and still asks “what time?”' },
      { kind: 'pick', question: 'Who sends “on my way” while looking for their socks?' },
      { kind: 'pick', question: 'Who says “quick story” and starts with “when I was born”?' },
      { kind: 'pick', question: 'Who revives a dead group chat with one photo?' },
      { kind: 'pick', question: 'Who would send a screenshot straight to the person in it?' },
    ],
  },
  {
    id: 'chaos', name: 'Chaos Mode', description: 'Questionable plans. Excellent stories.',
    label: 'UNHINGED', color: '#ffb199',
    cards: [
      { kind: 'pick', question: 'Who would volunteer as a magician’s assistant before hearing the trick?' },
      { kind: 'pick', question: 'Who would accidentally join a parade and end up carrying the banner?' },
      { kind: 'pick', question: 'Who would get a whole wedding dancing before the DJ arrives?' },
      { kind: 'pick', question: 'Who would walk into the wrong birthday party and stay for cake?' },
      { kind: 'pick', question: 'Who would take a free haircut without asking who’s holding the scissors?' },
    ],
  },
  {
    id: 'soft-launch', name: 'Soft Launch', description: 'Small acts of care that say a lot.',
    label: 'WHOLESOME', color: '#ffb9da',
    cards: [
      { kind: 'pick', question: 'Who makes a new person feel welcome without making a fuss?' },
      { kind: 'pick', question: 'Who remembers the little thing you mentioned months ago?' },
      { kind: 'pick', question: 'Who notices you’re quiet and checks in later?' },
      { kind: 'pick', question: 'Who would show up at the airport with snacks and a handmade sign?' },
      { kind: 'pick', question: 'Who could plan a day that feels exactly like you?' },
    ],
  },
  {
    id: 'shared-holiday', name: 'Shared Holiday', description: 'Flights, packing lists, and one wrong turn.',
    label: 'TRIP LORE', color: '#a9cdfd',
    cards: [
      { kind: 'pick', question: 'Who would book the perfect rental for the wrong weekend?' },
      { kind: 'pick', question: 'Who packs for every forecast but forgets a charger?' },
      { kind: 'pick', question: 'Who leaves the souvenir shop knowing the owner’s life story?' },
      { kind: 'pick', question: 'Who says “we can walk it” and accidentally plans a hike?' },
      { kind: 'pick', question: 'Who makes the trip spreadsheet and still arrives at the gate last?' },
    ],
  },
  {
    id: 'fake-jobs', name: 'Fake Jobs', description: 'Give your friends jobs they’d be suspiciously good at.',
    label: 'WEIRDLY QUALIFIED', color: '#ffe184',
    cards: [
      { kind: 'pick', question: 'Who could talk a vending machine into refunding their money?' },
      { kind: 'pick', question: 'Who’d be hired to name nail polish shades?' },
      { kind: 'pick', question: 'Who would last a full shift guarding a button marked “Do not press”?' },
      { kind: 'pick', question: 'Who could identify someone from one shoe in the lost-and-found?' },
      { kind: 'pick', question: 'Who could write a five-star review for a chair that broke under them?' },
    ],
  },
  {
    id: 'spotlight', name: 'Spotlight', description: 'Write the answer only your group could give.',
    label: 'WRITE AN ANSWER', color: '#a7e7d8',
    cards: [
      { kind: 'write', question: 'What would {player} get unexpectedly famous for?' },
      { kind: 'write', question: 'What should {player} call their group-chat memoir?' },
      { kind: 'write', question: 'What very specific skill could {player} teach a masterclass on?' },
      { kind: 'write', question: 'What one-line text could only have come from {player}?' },
      { kind: 'write', question: 'What oddly specific award should {player} win?' },
    ],
  },
] satisfies { id: string; name: string; description: string; label: string; color: string; cards: Card[] }[];

export function getDeck(id: string) {
  return decks.find((deck) => deck.id === id);
}
