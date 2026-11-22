/// <reference types="bun" />
import { expect, test } from 'bun:test';
import { addPlayer, applyAction, createRoom, type Mode, viewRoom } from './game';

function started(mode: Mode, deckId = 'group-chat') {
  const room = createRoom('ABCDE', 'host', 'Maya', deckId, mode);
  addPlayer(room, 'guest-one', 'Jules');
  addPlayer(room, 'guest-two', 'Sam');
  applyAction(room, 'host', { type: 'start' });
  return room;
}

for (const mode of ['anonymous', 'named'] as const) {
  test(`${mode} mode keeps picks and answers private until the host reveals`, () => {
    const room = started(mode);
    applyAction(room, 'guest-one', { type: 'submit', round: 1, submission: { kind: 'pick', value: 'guest-two' } });
    applyAction(room, 'guest-one', { type: 'submit', round: 1, submission: { kind: 'pick', value: 'host' } });
    expect(viewRoom(room, 'host')).toMatchObject({ submitted: 1, hasSubmitted: false });
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
