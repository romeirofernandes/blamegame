/// <reference types="bun" />
import { expect, test } from 'bun:test';
import { addPlayer, applyAction, createRoom, type Mode, viewRoom } from './game';
import { decks, drawCards } from './decks';
import { DEMO_PLAYER, demoAction, newDemo } from './demo';
import { ditherAvatar } from './dither-avatar';

const legacyPrompts = [
  [
    'Who reads 83 messages and still asks “what time?”',
    'Who sends “on my way” while looking for their socks?',
    'Who says “quick story” and starts with “when I was born”?',
    'Who revives a dead group chat with one photo?',
    'Who would send a screenshot straight to the person in it?',
  ],
  [
    'Who would volunteer as a magician’s assistant before hearing the trick?',
    'Who would accidentally join a parade and end up carrying the banner?',
    'Who would get a whole wedding dancing before the DJ arrives?',
    'Who would walk into the wrong birthday party and stay for cake?',
    'Who would take a free haircut without asking who’s holding the scissors?',
  ],
  [
    'Who makes a new person feel welcome without making a fuss?',
    'Who remembers the little thing you mentioned months ago?',
    'Who notices you’re quiet and checks in later?',
    'Who would show up at the airport with snacks and a handmade sign?',
    'Who could plan a day that feels exactly like you?',
  ],
  [
    'Who would book the perfect rental for the wrong weekend?',
    'Who packs for every forecast but forgets a charger?',
    'Who leaves the souvenir shop knowing the owner’s life story?',
    'Who says “we can walk it” and accidentally plans a hike?',
    'Who makes the trip spreadsheet and still arrives at the gate last?',
  ],
  [
    'Who could talk a vending machine into refunding their money?',
    'Who’d be hired to name nail polish shades?',
    'Who would last a full shift guarding a button marked “Do not press”?',
    'Who could identify someone from one shoe in the lost-and-found?',
    'Who could write a five-star review for a chair that broke under them?',
  ],
  [
    'What would {player} get unexpectedly famous for?',
    'What should {player} call their group-chat memoir?',
    'What very specific skill could {player} teach a masterclass on?',
    'What one-line text could only have come from {player}?',
    'What oddly specific award should {player} win?',
  ],
];

function started(mode: Mode, deckId = 'group-chat', allowSelfVote = false) {
  const room = createRoom('ABCDE', 'host', 'Maya', deckId, mode, allowSelfVote, undefined, undefined, undefined, 5, () => 0);
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
    const spotlightQuestion = viewRoom(spotlight, 'host').card?.question;
    expect(spotlightQuestion).toContain('Maya');
    expect(decks[5].cards.some((card) => card.question.replace('{player}', 'Maya') === spotlightQuestion)).toBe(true);
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
  expect(() => applyAction(room, 'host', { type: 'reveal' }, new Set(['host', 'guest-one', 'guest-two'])))
    .toThrow('That action is unavailable right now.');
  const online = new Set(['host', 'guest-one']);
  const view = viewRoom(room, 'host', online);
  expect(view.players.map(({ id, online }) => [id, online])).toEqual([
    ['host', true], ['guest-one', true], ['guest-two', false],
  ]);
  expect(view.canReveal).toBe(true);

  applyAction(room, 'host', { type: 'reveal' }, online);
  expect(viewRoom(room, 'host').result).toEqual({ picks: [], answers: [] });
});

test('passes count as ready but do not create vote or answer results', () => {
  const room = started('anonymous');
  applyAction(room, 'guest-one', { type: 'submit', round: 1, submission: { kind: 'pass' } });
  expect(viewRoom(room, 'host').submitted).toBe(1);
  applyAction(room, 'host', { type: 'reveal' });
  expect(viewRoom(room, 'host').result).toEqual({ picks: [], answers: [] });
});

test('recap keeps tied vote counts and shares write answers with the room attribution mode', () => {
  const votes = createRoom('ABCDE', 'host', 'Maya', 'group-chat', 'anonymous', false, undefined, undefined, undefined, 1, () => 0);
  addPlayer(votes, 'one', 'Jules');
  addPlayer(votes, 'two', 'Sam');
  applyAction(votes, 'host', { type: 'start' });
  applyAction(votes, 'host', { type: 'submit', round: 1, submission: { kind: 'pick', value: 'one' } });
  applyAction(votes, 'one', { type: 'submit', round: 1, submission: { kind: 'pick', value: 'two' } });
  applyAction(votes, 'host', { type: 'reveal' });
  applyAction(votes, 'host', { type: 'next' });
  expect(viewRoom(votes, 'host').recap?.[0]).toMatchObject({
    kind: 'pick', leaders: ['one', 'two'], leaderVotes: 1,
  });

  const writes = createRoom('ABCDE', 'host', 'Maya', 'spotlight', 'anonymous', false, undefined, undefined, undefined, 1, () => 0);
  addPlayer(writes, 'one', 'Jules');
  addPlayer(writes, 'two', 'Sam');
  applyAction(writes, 'host', { type: 'start' });
  applyAction(writes, 'one', { type: 'submit', round: 1, submission: { kind: 'write', value: 'A tiny parade.' } });
  applyAction(writes, 'host', { type: 'reveal' });
  applyAction(writes, 'host', { type: 'next' });
  expect(viewRoom(writes, 'host').recap?.[0]).toMatchObject({
    kind: 'write', leaders: [], answers: [{ text: 'A tiny parade.' }],
  });

  const passed = createRoom('ABCDE', 'host', 'Maya', 'group-chat', 'anonymous', false, undefined, undefined, undefined, 1, () => 0);
  addPlayer(passed, 'one', 'Jules');
  addPlayer(passed, 'two', 'Sam');
  applyAction(passed, 'host', { type: 'start' });
  for (const id of ['host', 'one', 'two']) {
    applyAction(passed, id, { type: 'submit', round: 1, submission: { kind: 'pass' } });
  }
  applyAction(passed, 'host', { type: 'reveal' });
  applyAction(passed, 'host', { type: 'next' });
  expect(viewRoom(passed, 'host').recap?.[0]).toMatchObject({
    kind: 'pick', leaders: [], responseCount: 3, passCount: 3,
  });
});

test('demo friends do not cast self votes when self-voting is disabled', () => {
  let room = newDemo();
  expect(room.rounds.map((round) => round.card.question)).toEqual(
    newDemo().rounds.map((round) => round.card.question),
  );
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

test('the spotlight demo answers every selected write prompt deterministically', () => {
  let room = newDemo('spotlight');
  const firstDraw = room.rounds.map((round) => round.card.question);
  expect(newDemo('spotlight').rounds.map((round) => round.card.question)).toEqual(firstDraw);

  for (let round = 1; round <= viewRoom(room, DEMO_PLAYER).total; round++) {
    room = demoAction(room, {
      type: 'submit', round,
      submission: { kind: 'write', value: 'A demo answer.' },
    });
    expect(viewRoom(room, DEMO_PLAYER).submitted).toBe(room.players.length);
    room = demoAction(room, { type: 'reveal' });
    expect(viewRoom(room, DEMO_PLAYER).result?.answers).toHaveLength(room.players.length);
    room = demoAction(room, { type: 'next' });
  }

  expect(viewRoom(room, DEMO_PLAYER).phase).toBe('recap');
});

test('each deck has 50 distinct prompts that preserve its pick or write format', () => {
  expect(decks).toHaveLength(6);
  for (const [index, deck] of decks.entries()) {
    expect(deck.cards.length).toBeGreaterThanOrEqual(50);
    expect(deck.cards.length).toBeLessThanOrEqual(60);
    expect(new Set(deck.cards.map((card) => card.question)).size).toBe(deck.cards.length);
    expect(deck.cards.every((card) => card.kind === (deck.id === 'spotlight' ? 'write' : 'pick'))).toBe(true);
    expect(deck.cards.slice(0, 5).map((card) => card.question)).toEqual(legacyPrompts[index]);
  }
});

test('a room draws its chosen number of prompts without repeats and ends on that round', () => {
  const room = createRoom('ABCDE', 'host', 'Maya', 'group-chat', 'anonymous', false, undefined, undefined, undefined, 13, () => 0);
  addPlayer(room, 'guest-one', 'Jules');
  addPlayer(room, 'guest-two', 'Sam');
  applyAction(room, 'host', { type: 'start' });
  const questions: string[] = [];

  for (let round = 1; round <= 13; round++) {
    questions.push(room.rounds.at(-1)!.card.question);
    applyAction(room, 'host', { type: 'submit', round, submission: { kind: 'pass' } });
    applyAction(room, 'host', { type: 'reveal' });
    applyAction(room, 'host', { type: 'next' });
  }

  expect(viewRoom(room, 'host')).toMatchObject({ phase: 'recap', round: 13, total: 13 });
  expect(new Set(questions).size).toBe(13);
  expect(drawCards('group-chat', 10, () => 0)).toEqual(drawCards('group-chat', 10, () => 0));
});

test('legacy rooms without a saved draw keep their original five-round order', () => {
  const room = started('anonymous');
  delete room.cards;
  delete room.totalRounds;
  room.rounds[0].card = { ...decks[0].cards[0] };
  const questions: string[] = [];
  expect(viewRoom(room, 'host').total).toBe(5);

  for (let round = 1; round <= 5; round++) {
    questions.push(room.rounds.at(-1)!.card.question);
    applyAction(room, 'host', { type: 'submit', round, submission: { kind: 'pass' } });
    applyAction(room, 'host', { type: 'reveal' });
    applyAction(room, 'host', { type: 'next' });
  }

  expect(questions).toEqual(legacyPrompts[0]);
  expect(viewRoom(room, 'host').phase).toBe('recap');
});

test('generated avatar seeds and variants are retained and validated', () => {
  const seed = 'a'.repeat(32);
  const room = createRoom('ABCDE', 'host', 'Maya', 'group-chat', 'anonymous', false, undefined, 3, seed);

  expect(viewRoom(room, 'host').players[0]).toMatchObject({ avatarSeed: seed, avatarVariant: 3 });
  expect(ditherAvatar(seed)).toEqual(ditherAvatar(seed, 0));
  expect(ditherAvatar(seed, 3)).not.toEqual(ditherAvatar(seed));

  const invalid = createRoom('FGHIJ', 'host-two', 'Maya', 'group-chat', 'anonymous', false, undefined, 12, 'not-a-seed');
  expect(invalid.players[0]).not.toHaveProperty('avatarVariant');
  expect(invalid.players[0]).not.toHaveProperty('avatarSeed');
});
