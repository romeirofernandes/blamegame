import { addPlayer, applyAction, createRoom, type Action, type Room } from './game';

export const DEMO_PLAYER = 'you';
const friends = ['Maya', 'Jules', 'Sam', 'Alex'];
const sampleAnswers = [
  ['Starting a neighborhood parade by accident.', 'A seven-part voice note that becomes a podcast.',
    'Finding the best fries in every city.', 'That one photo nobody can explain.'],
  ['Wait, Who Added Me?', 'I Have the Screenshots.', 'Sorry, I Just Saw This.', 'Five Minutes Away.'],
  ['How to Pack Snacks for Every Outcome.', 'Turning One Errand Into a Day Trip.',
    'Finding a Power Outlet in Any Room.', 'How to Get the Good Table.'],
  ['Okay, tiny update. There are actually three updates.', 'I’m outside. Outside my house.',
    'Can everyone send me their photos in one place?', 'This reminded me of a dog I met in 2019.'],
  ['Best Performance in a Voice Note.', 'Most Likely to Have Tissues.',
    'Greatest Comeback From a Missed Train.', 'Outstanding Service to the Shared Playlist.'],
  ['The Scenic Route Was My Idea.', 'A Map, Three Snacks, and One Wrong Turn.',
    'Official Keeper of the Backup Charger.', 'Best Unexpected View From a Bus.'],
  ['Finding the One Good Table.', 'Turning a Quick Stop Into a Local Tour.',
    'Remembering Everyone’s Coffee Order.', 'Making Friends With the Hotel Cat.'],
  ['A Deeply Specific Guide to Voice Notes.', 'The Lost-and-Found Has a Witness.',
    'A Playlist for the Walk Home.', 'How to Make a Tiny Plan Feel Special.'],
  ['Most Likely to Bring an Extra Umbrella.', 'Best Supporting Snack.',
    'Lifetime Achievement in Checking In.', 'Outstanding Service to the Shared Blanket.'],
  ['The Unofficial Historian of This Group.', 'It Was Supposed to Be a Quick Errand.',
    'A Podcast About Things We Nearly Forgot.', 'Small Details, Big Feelings.'],
];

function demoRandom() {
  let seed = 42;
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 0x1_0000_0000;
  };
}

export function newDemo(deckId = 'group-chat', roundCount = 10) {
  const room = createRoom('DEMO', DEMO_PLAYER, 'Riley', deckId, 'anonymous', false, undefined, undefined, undefined, roundCount, demoRandom());
  for (const name of friends) addPlayer(room, name, name);
  applyAction(room, DEMO_PLAYER, { type: 'start' });
  return room;
}

export function demoAction(room: Room, action: Action) {
  const next: Room = {
    ...room,
    rounds: room.rounds.map((round) => ({ ...round, submissions: new Map(round.submissions) })),
  };
  applyAction(next, DEMO_PLAYER, action);
  if (action.type === 'submit') {
    const round = next.rounds.length;
    const kind = next.rounds.at(-1)!.card.kind;
    friends.forEach((name, index) => {
      const targetIndex = (round - 1 + (index === 3 ? 1 : 0)) % friends.length;
      const pickIndex = friends[targetIndex] === name ? (targetIndex + 1) % friends.length : targetIndex;
      const value = kind === 'pick'
        ? friends[pickIndex]
        : sampleAnswers[(round - 1) % sampleAnswers.length][index];
      applyAction(next, name, { type: 'submit', round, submission: { kind, value } });
    });
  }
  return next;
}
