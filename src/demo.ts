import { addPlayer, applyAction, createRoom, type Action, type Room } from './game';

export const DEMO_PLAYER = 'you';
const friends = ['Maya', 'Jules', 'Sam', 'Alex'];

export function newDemo() {
  const room = createRoom('DEMO', DEMO_PLAYER, 'You', 'group-chat', 'anonymous');
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
      const value = kind === 'pick'
        ? friends[(round - 1 + (index === 3 ? 1 : 0)) % friends.length]
        : ['Accidentally starting a neighborhood parade.', 'A seven-part voice note that becomes a podcast.',
          'Finding the best fries in every city.', 'That one photo nobody can explain.'][index];
      applyAction(next, name, { type: 'submit', round, submission: { kind, value } });
    });
  }
  return next;
}
