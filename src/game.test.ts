/// <reference types="bun" />
import { expect, test } from 'bun:test';
import { addPlayer, applyAction, createRoom, type Mode, viewRoom } from './game';
import { DEMO_PLAYER, demoAction, newDemo } from './demo';

function started(mode: Mode, deckId = 'group-chat', allowSelfVote = false) {
  const room = createRoom('ABCDE', 'host', 'Maya', deckId, mode, allowSelfVote);
  addPlayer(room, 'guest-one', 'Jules');
  addPlayer(room, 'guest-two', 'Sam');
  applyAction(room, 'host', { type: 'start' });
  return room;
}

for (const mode of ['anonymous', 'named'] as const) {
  test(`${mode} mode keeps picks and answers private until the host reveals`, () => {
    const room = started(mode);
    expect(viewRoom(room, 'host').canReveal).toBe(false);
    applyAction(room, 'guest-one', { type: 'submit', round: 1, submission: { kind: 'pick', value: 'guest-two' } });
    applyAction(room, 'guest-one', { type: 'submit', round: 1, submission: { kind: 'pick', value: 'host' } });
    expect(viewRoom(room, 'host')).toMatchObject({ submitted: 1, hasSubmitted: false, canReveal: true });
    expect(viewRoom(room, 'host').result).toBeUndefined();
    expect(viewRoom(room, 'guest-one').hasSubmitted).toBe(true);
    expect(() => applyAction(room, 'guest-two', { type: 'reveal' })).toThrow('Only the host');
    applyAction(room, 'host', { type: 'reveal' });
    expect(viewRoom(room, 'host').result?.picks).toEqual([
      mode === 'anonymous'
        ? { playerId: 'guest-two', count: 1 }
        : { playerId: 'guest-two', count: 1, voters: ['guest-one'] },
    ]);

    applyAction(room, 'host', { type: 'next' });
    expect(() => applyAction(room, 'guest-two', { type: 'submit', round: 1, submission: { kind: 'pass' } })).toThrow('round is closed');
    applyAction(room, 'guest-two', { type: 'submit', round: 2, submission: { kind: 'pass' } });
    const spotlight = started(mode, 'spotlight');
    expect(viewRoom(spotlight, 'host').card?.question).toBe('What would Maya get unexpectedly famous for?');
    const text = 'The world’s largest stack of pancakes.';
    applyAction(spotlight, 'guest-two', { type: 'submit', round: 1, submission: { kind: 'write', value: text } });
    expect(JSON.stringify(viewRoom(spotlight, 'host'))).not.toContain(text);
    applyAction(spotlight, 'host', { type: 'reveal' });
    expect(viewRoom(spotlight, 'host').result?.answers).toEqual([
      mode === 'anonymous' ? { text } : { text, author: 'guest-two' },
    ]);
  });
}

test('late joins and invalid submissions leave the round intact', () => {
  const room = started('anonymous');
  expect(() => addPlayer(room, 'late', 'Alex')).toThrow('already started');
  expect(() => applyAction(room, 'guest-two', { type: 'submit', round: 1, submission: { kind: 'pick', value: 'missing' } })).toThrow('someone in the room');
  expect(viewRoom(room, 'host')).toMatchObject({ phase: 'vote', submitted: 0 });
});

test('self votes are disabled by default and can be enabled by the host', () => {
  const room = started('anonymous');
  expect(viewRoom(room, 'guest-one').allowSelfVote).toBe(false);
  expect(() => applyAction(room, 'guest-one', {
    type: 'submit', round: 1, submission: { kind: 'pick', value: 'guest-one' },
  })).toThrow("can't vote for yourself");

  const enabledRoom = started('anonymous', 'group-chat', true);
  expect(viewRoom(enabledRoom, 'guest-one').allowSelfVote).toBe(true);
  expect(() => applyAction(enabledRoom, 'guest-one', {
    type: 'submit', round: 1, submission: { kind: 'pick', value: 'guest-one' },
  })).not.toThrow();
});

test('host can reveal an empty round when a player disconnects', () => {
  const room = started('anonymous');
  const view = viewRoom(room, 'host', ['host', 'guest-one']);
  expect(view.players.map(({ id, online }) => [id, online])).toEqual([
    ['host', true], ['guest-one', true], ['guest-two', false],
  ]);
  expect(view.canReveal).toBe(true);

  applyAction(room, 'host', { type: 'reveal' });
  expect(viewRoom(room, 'host').result).toEqual({ picks: [], answers: [] });
});

test('passes count as ready but do not create vote or answer results', () => {
  const room = started('anonymous');
  applyAction(room, 'guest-one', { type: 'submit', round: 1, submission: { kind: 'pass' } });
  expect(viewRoom(room, 'host').submitted).toBe(1);
  applyAction(room, 'host', { type: 'reveal' });
  expect(viewRoom(room, 'host').result).toEqual({ picks: [], answers: [] });
});

test('demo friends do not cast self votes when self-voting is disabled', () => {
  let room = newDemo();
  for (let round = 1; round <= viewRoom(room, DEMO_PLAYER).total; round++) {
    const card = room.rounds.at(-1)!.card;
    const submission = card.kind === 'pick'
      ? { kind: 'pick' as const, value: room.players.find((player) => player.id !== DEMO_PLAYER)!.id }
      : { kind: 'write' as const, value: 'A short demo answer.' };
    room = demoAction(room, { type: 'submit', round, submission });
    expect(viewRoom(room, DEMO_PLAYER).submitted).toBe(room.players.length);
    room = demoAction(room, { type: 'reveal' });
    room = demoAction(room, { type: 'next' });
  }
});
