import { describe, expect, test } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { addPlayer, applyAction, createRoom } from '../../src/game.ts';
import { getDeck } from '../../src/decks.ts';
import { ditherAvatar } from '../../src/dither-avatar.ts';
import { GameRoom } from '../src/room-hub.js';

class MemoryStorage {
  values = new Map();
  alarmAt = null;

  async get(key) { return this.values.get(key); }
  async put(key, value) { this.values.set(key, structuredClone(value)); }
  async delete(key) { this.values.delete(key); }
  async setAlarm(timestamp) { this.alarmAt = timestamp; }
  async deleteAlarm() { this.alarmAt = null; }
}

class FakeState {
  sockets = new Set();

  constructor(storage = new MemoryStorage()) { this.storage = storage; }
  blockConcurrencyWhile(callback) { return callback(); }
  getWebSockets() { return [...this.sockets]; }
  acceptWebSocket(socket) { this.sockets.add(socket); }
}

class FakeSocket {
  attachment = {};
  messages = [];
  readyState = 1;
  closed = false;

  serializeAttachment(value) { this.attachment = structuredClone(value); }
  deserializeAttachment() { return structuredClone(this.attachment); }
  send(value) { this.messages.push(JSON.parse(value)); }
  close() { this.closed = true; this.readyState = 3; }
  lastState() { return this.messages.filter((message) => message.type === 'state').at(-1)?.room; }
}

const token = (letter) => letter.repeat(32);
const command = (type, extra = {}) => JSON.stringify({ type, ...extra });
const route = (socket, code, creating = false, authUid = crypto.randomUUID()) =>
  socket.serializeAttachment({ code, creating, authUid });

test('automatic dither avatars stay distinct and keep their assignment on resume', async () => {
  const state = new FakeState();
  const host = new FakeSocket();
  const guest = new FakeSocket();
  const custom = new FakeSocket();
  for (const socket of [host, guest, custom]) state.sockets.add(socket);
  const hub = new GameRoom(state, {});
  await hub.ready;
  const code = 'ABCDE';
  route(host, code, true);
  route(guest, code);
  route(custom, code);
  const avatarSeed = 'a'.repeat(32);
  const avatarVariant = 0;
  const avatarKey = (player) => ditherAvatar(player.avatarSeed ?? player.id, player.avatarVariant ?? 0);

  await hub.webSocketMessage(host, command('create', {
    name: 'Maya', deckId: 'group-chat', mode: 'anonymous', token: token('a'), avatarSeed, avatarVariant,
  }));
  await hub.webSocketMessage(guest, command('join', {
    name: 'Jules', code, token: token('b'), avatarSeed, avatarVariant,
  }));
  const hostPlayer = host.lastState().players.find((player) => player.id === host.lastState().me);
  const guestPlayer = guest.lastState().players.find((player) => player.id === guest.lastState().me);
  expect(avatarKey(guestPlayer)).not.toEqual(avatarKey(hostPlayer));

  await hub.webSocketMessage(custom, command('join', {
    name: 'Sam', code, token: token('c'), avatarSeed, avatarVariant, avatarCustom: true,
  }));
  expect(custom.lastState().players.find((player) => player.id === custom.lastState().me))
    .toMatchObject({ avatarSeed, avatarVariant });

  const guestUid = guest.attachment.authUid;
  guest.readyState = 3;
  await hub.webSocketClose(guest);
  const resumed = new FakeSocket();
  state.sockets.add(resumed);
  route(resumed, code, false, guestUid);
  await hub.webSocketMessage(resumed, command('resume', { code, token: token('b') }));
  const resumedPlayer = resumed.lastState().players.find((player) => player.id === resumed.lastState().me);
  expect(resumedPlayer).toEqual({ ...guestPlayer, online: true });
});

describe('RoomHub WebSocket protocol', () => {
  test('persists private room state and resumes the same player after hibernation', async () => {
    const validAvatar = `data:image/jpeg;base64,${Buffer.from(await readFile(new URL('./fixtures/player-avatar.jpg', import.meta.url))).toString('base64')}`;
    const storage = new MemoryStorage();
    const state = new FakeState(storage);
    const host = new FakeSocket();
    const guest = new FakeSocket();
    const third = new FakeSocket();
    state.sockets.add(host);
    state.sockets.add(guest);
    state.sockets.add(third);
    const hub = new GameRoom(state, {});
    await hub.ready;
    route(host, 'ABCDE', true);
    route(guest, 'ABCDE');
    route(third, 'ABCDE');

    await hub.webSocketMessage(host, command('create', {
      name: 'Maya', deckId: 'group-chat', mode: 'anonymous', token: token('a'), roundCount: 8,
    }));
    const code = host.lastState().code;
    await hub.webSocketMessage(guest, command('join', { name: 'Jules', code, token: token('b'), avatar: validAvatar }));
    await hub.webSocketMessage(third, command('join', { name: 'Sam', code, token: token('c'), avatar: 'data:image/png;base64,ZmFrZQ==' }));
    expect(host.lastState().allowSelfVote).toBe(false);
    expect(host.lastState().allowPass).toBe(false);
    expect(host.lastState().players.find((player) => player.name === 'Sam').avatar).toBeUndefined();
    await hub.webSocketMessage(host, command('start'));
    await hub.webSocketMessage(guest, command('submit', {
      round: 1, submission: { kind: 'pick', value: host.lastState().me },
    }));

    expect(host.lastState()).toMatchObject({ phase: 'vote', total: 8, submitted: 1, hasSubmitted: false });
    expect(guest.lastState()).toMatchObject({ phase: 'vote', hasSubmitted: true });
    expect(host.lastState().result).toBeUndefined();

    const resumed = new FakeSocket();
    const recoveredState = new FakeState(storage);
    recoveredState.sockets.add(resumed);
    const recoveredHub = new GameRoom(recoveredState, {});
    await recoveredHub.ready;
    route(resumed, code, false, guest.attachment.authUid);
    await recoveredHub.webSocketMessage(resumed, command('resume', { code, token: token('b') }));

    expect(resumed.lastState()).toMatchObject({ code, me: guest.lastState().me, phase: 'vote', total: 8, hasSubmitted: true });
    expect(resumed.lastState().players.find((player) => player.id === guest.lastState().me).avatar).toBe(validAvatar);
    expect(resumed.lastState().result).toBeUndefined();
  });

  test('hands the host role to a connected player when the host leaves mid-game', async () => {
    const state = new FakeState();
    const host = new FakeSocket();
    const guest = new FakeSocket();
    const third = new FakeSocket();
    state.sockets.add(host);
    state.sockets.add(guest);
    state.sockets.add(third);
    const hub = new GameRoom(state, {});
    await hub.ready;
    route(host, 'FGHJK', true);
    route(guest, 'FGHJK');
    route(third, 'FGHJK');

    await hub.webSocketMessage(host, command('create', {
      name: 'Maya', deckId: 'group-chat', mode: 'named', token: token('a'),
    }));
    const code = host.lastState().code;
    await hub.webSocketMessage(guest, command('join', { name: 'Jules', code, token: token('b') }));
    await hub.webSocketMessage(third, command('join', { name: 'Sam', code, token: token('c') }));
    await hub.webSocketMessage(host, command('start'));
    await hub.webSocketMessage(host, command('leave'));

    expect(guest.lastState().host).toBe(guest.lastState().me);
  });

  test('accepts the host self-vote setting when creating a room', async () => {
    const state = new FakeState();
    const host = new FakeSocket();
    state.sockets.add(host);
    const hub = new GameRoom(state, {});
    await hub.ready;
    route(host, 'UVWXY', true);

    await hub.webSocketMessage(host, command('create', {
      name: 'Maya', deckId: 'group-chat', mode: 'anonymous', token: token('h'),
      allowSelfVote: true, allowPass: true, roundCount: 12,
    }));

    expect(host.lastState()).toMatchObject({ allowSelfVote: true, allowPass: true, total: 12 });
  });

  test('keeps the original prompt order for clients that omit roundCount', async () => {
    const state = new FakeState();
    const host = new FakeSocket();
    const guest = new FakeSocket();
    const third = new FakeSocket();
    state.sockets.add(host);
    state.sockets.add(guest);
    state.sockets.add(third);
    const hub = new GameRoom(state, {});
    await hub.ready;
    route(host, 'RSTUV', true);
    route(guest, 'RSTUV');
    route(third, 'RSTUV');

    await hub.webSocketMessage(host, command('create', {
      name: 'Maya', deckId: 'group-chat', mode: 'anonymous', token: token('r'),
    }));
    const code = host.lastState().code;
    await hub.webSocketMessage(guest, command('join', { name: 'Jules', code, token: token('s') }));
    await hub.webSocketMessage(third, command('join', { name: 'Sam', code, token: token('t') }));
    await hub.webSocketMessage(host, command('start'));

    expect(host.lastState()).toMatchObject({ total: 5, card: { question: getDeck('group-chat').cards[0].question } });
  });

  test('resumes an older saved room with its original five prompts in order', async () => {
    const authUid = crypto.randomUUID();
    const oldRoom = createRoom('ABCDE', 'old-host', 'Maya', 'group-chat', 'anonymous');
    addPlayer(oldRoom, 'old-one', 'Jules');
    addPlayer(oldRoom, 'old-two', 'Sam');
    applyAction(oldRoom, 'old-host', { type: 'start' });
    delete oldRoom.cards;
    delete oldRoom.totalRounds;
    delete oldRoom.allowPass;
    const storage = new MemoryStorage();
    const oldToken = token('o');
    await storage.put('room', {
      room: oldRoom,
      tokens: new Map([[oldToken, { playerId: 'old-host', authUid }]]),
      touched: Date.now(),
    });

    const state = new FakeState(storage);
    const host = new FakeSocket();
    state.sockets.add(host);
    const hub = new GameRoom(state, {});
    await hub.ready;
    route(host, 'ABCDE', false, authUid);
    await hub.webSocketMessage(host, command('resume', { code: 'ABCDE', token: oldToken }));

    expect(host.lastState()).toMatchObject({ phase: 'vote', total: 5, round: 1 });
    await hub.webSocketMessage(host, command('submit', { round: 1, submission: { kind: 'pass' } }));
    await hub.webSocketMessage(host, command('reveal'));
    await hub.webSocketMessage(host, command('next'));
    expect(host.lastState()).toMatchObject({ phase: 'vote', total: 5, round: 2 });
  });

  test('requires three online players to start and permits the start after reconnect', async () => {
    const state = new FakeState();
    const host = new FakeSocket();
    const guest = new FakeSocket();
    const third = new FakeSocket();
    state.sockets.add(host);
    state.sockets.add(guest);
    state.sockets.add(third);
    const hub = new GameRoom(state, {});
    await hub.ready;
    route(host, 'Z2345', true);
    route(guest, 'Z2345');
    route(third, 'Z2345');

    await hub.webSocketMessage(host, command('create', {
      name: 'Maya', deckId: 'group-chat', mode: 'anonymous', token: token('l'),
    }));
    const code = host.lastState().code;
    await hub.webSocketMessage(guest, command('join', { name: 'Jules', code, token: token('m') }));
    await hub.webSocketMessage(third, command('join', { name: 'Sam', code, token: token('n') }));
    await hub.webSocketClose(third);

    await hub.webSocketMessage(host, command('start'));
    expect(host.messages.at(-1)).toMatchObject({ type: 'error', message: 'You need at least 3 players online.' });
    expect(host.lastState().phase).toBe('lobby');

    const resumedThird = new FakeSocket();
    state.sockets.add(resumedThird);
    route(resumedThird, code, false, third.attachment.authUid);
    await hub.webSocketMessage(resumedThird, command('resume', { code, token: token('n') }));
    expect(host.lastState().players[2].online).toBe(true);
    await hub.webSocketMessage(host, command('start'));
    expect(host.lastState().phase).toBe('vote');
  });

  test('marks disconnected nonvoters and lets the host reveal an empty round', async () => {
    const state = new FakeState();
    const host = new FakeSocket();
    const guest = new FakeSocket();
    const third = new FakeSocket();
    state.sockets.add(host);
    state.sockets.add(guest);
    state.sockets.add(third);
    const hub = new GameRoom(state, {});
    await hub.ready;
    route(host, 'PQRST', true);
    route(guest, 'PQRST');
    route(third, 'PQRST');

    await hub.webSocketMessage(host, command('create', {
      name: 'Maya', deckId: 'group-chat', mode: 'anonymous', token: token('e'),
    }));
    const code = host.lastState().code;
    await hub.webSocketMessage(guest, command('join', { name: 'Jules', code, token: token('f') }));
    await hub.webSocketMessage(third, command('join', { name: 'Sam', code, token: token('g') }));
    await hub.webSocketMessage(host, command('start'));

    expect(host.lastState().canReveal).toBe(false);
    await hub.webSocketMessage(host, command('reveal'));
    expect(host.lastState().phase).toBe('vote');
    expect(host.messages.at(-1)).toMatchObject({
      type: 'error', message: 'That action is unavailable right now.',
    });

    await hub.webSocketClose(third);
    expect(host.lastState()).toMatchObject({
      phase: 'vote', submitted: 0, canReveal: true,
      players: [{ online: true }, { online: true }, { online: false }],
    });
    await hub.webSocketMessage(host, command('reveal'));
    expect(host.lastState().result).toEqual({ picks: [], answers: [] });

    await hub.webSocketClose(host);
    expect(guest.lastState().host).toBe(guest.lastState().me);
    expect(guest.lastState().players[0].online).toBe(false);
  });

  test('rejects a code collision so the client can reconnect to /ws/new', async () => {
    const state = new FakeState();
    const host = new FakeSocket();
    const collision = new FakeSocket();
    state.sockets.add(host);
    state.sockets.add(collision);
    const hub = new GameRoom(state, {});
    await hub.ready;
    route(host, 'ABCDE', true);
    route(collision, 'ABCDE', true);

    await hub.webSocketMessage(host, command('create', {
      name: 'Maya', deckId: 'group-chat', mode: 'anonymous', token: token('a'),
    }));
    await hub.webSocketMessage(collision, command('create', {
      name: 'Jules', deckId: 'group-chat', mode: 'anonymous', token: token('b'),
    }));

    expect(collision.messages.at(-1)).toMatchObject({
      type: 'error',
      message: 'Could not claim a room code. Try creating the room again.',
      retryCreate: true,
    });
    expect(collision.closed).toBe(true);
    expect(hub.session.room.players).toHaveLength(1);
  });

  test('requires a signed-in player before creating a room', async () => {
    const state = new FakeState();
    const socket = new FakeSocket();
    const hub = new GameRoom(state, {});
    socket.serializeAttachment({ code: 'LMNPQ', creating: true });

    await hub.webSocketMessage(socket, command('create', {
      name: 'Guest', deckId: 'group-chat', mode: 'anonymous', token: token('d'),
    }));

    expect(socket.messages.at(-1)).toMatchObject({ type: 'error', message: 'Sign in to play.', reset: true });
    expect(socket.closed).toBe(true);
    expect(hub.session).toBeNull();
  });

  test('expires idle rooms and rejects unverifiable Firebase identities', async () => {
    const state = new FakeState();
    const socket = new FakeSocket();
    state.sockets.add(socket);
    const hub = new GameRoom(state, {});
    await hub.ready;
    await hub.webSocketMessage(socket, command('authenticate', { idToken: 'not-a-token' }));
    expect(socket.messages.at(-1)).toMatchObject({ type: 'error', reset: true });
    expect(socket.closed).toBe(true);

    const guest = new FakeSocket();
    state.sockets.add(guest);
    route(guest, 'LMNPQ', true);
    await hub.webSocketMessage(guest, command('create', {
      name: 'Guest', deckId: 'group-chat', mode: 'anonymous', token: token('d'),
    }));
    const session = hub.session;
    session.touched -= 2 * 60 * 60_000;
    await hub.alarm();

    expect(hub.session).toBeNull();
    expect(guest.messages.at(-1)).toMatchObject({ type: 'error', message: 'This room has expired.', reset: true });
  });

  test('shares selected generated avatar variants with the room', async () => {
    const state = new FakeState();
    const host = new FakeSocket();
    const guest = new FakeSocket();
    state.sockets.add(host);
    state.sockets.add(guest);
    const hub = new GameRoom(state, {});
    await hub.ready;
    route(host, 'ABCDE', true);
    route(guest, 'ABCDE');
    const hostAvatarSeed = 'a'.repeat(32);
    const guestAvatarSeed = 'b'.repeat(32);

    await hub.webSocketMessage(host, command('create', {
      name: 'Maya', deckId: 'group-chat', mode: 'anonymous', token: token('a'),
      avatarSeed: hostAvatarSeed, avatarVariant: 3,
    }));
    const code = host.lastState().code;
    await hub.webSocketMessage(guest, command('join', {
      name: 'Jules', code, token: token('b'), avatarSeed: guestAvatarSeed, avatarVariant: 6,
    }));

    expect(host.lastState().players.find((player) => player.name === 'Maya')).toMatchObject({
      avatarSeed: hostAvatarSeed,
      avatarVariant: 3,
    });
    expect(guest.lastState().players.find((player) => player.name === 'Jules')).toMatchObject({
      avatarSeed: guestAvatarSeed,
      avatarVariant: 6,
    });
  });

  test('reveals a pick round automatically when every connected player submits', async () => {
    const state = new FakeState();
    const [host, one, two] = [new FakeSocket(), new FakeSocket(), new FakeSocket()];
    state.sockets.add(host);
    state.sockets.add(one);
    state.sockets.add(two);
    const hub = new GameRoom(state, {});
    await hub.ready;
    route(host, 'ABCDE', true);
    route(one, 'ABCDE');
    route(two, 'ABCDE');

    await hub.webSocketMessage(host, command('create', {
      name: 'Maya', deckId: 'group-chat', mode: 'anonymous', token: token('a'),
    }));
    const code = host.lastState().code;
    await hub.webSocketMessage(one, command('join', { name: 'Jules', code, token: token('b') }));
    await hub.webSocketMessage(two, command('join', { name: 'Sam', code, token: token('c') }));
    await hub.webSocketMessage(host, command('start'));
    await hub.webSocketMessage(host, command('submit', { round: 1, submission: { kind: 'pick', value: one.lastState().me } }));
    await hub.webSocketMessage(one, command('submit', { round: 1, submission: { kind: 'pick', value: host.lastState().me } }));
    await hub.webSocketMessage(two, command('submit', { round: 1, submission: { kind: 'pick', value: host.lastState().me } }));

    expect(host.lastState()).toMatchObject({ phase: 'reveal', submitted: 3, canReveal: false });
    expect(host.lastState().result.picks).toEqual([
      { playerId: host.lastState().me, count: 2 },
      { playerId: one.lastState().me, count: 1 },
    ]);
  });

  test('collects Right Answers anonymously, rejects self votes, and reveals voter attribution', async () => {
    const state = new FakeState();
    const [host, one, two] = [new FakeSocket(), new FakeSocket(), new FakeSocket()];
    state.sockets.add(host);
    state.sockets.add(one);
    state.sockets.add(two);
    const hub = new GameRoom(state, {});
    await hub.ready;
    route(host, 'FGHJK', true);
    route(one, 'FGHJK');
    route(two, 'FGHJK');

    await hub.webSocketMessage(host, command('create', {
      name: 'Maya', deckId: 'spotlight', mode: 'anonymous', token: token('d'), roundCount: 1,
    }));
    const code = host.lastState().code;
    await hub.webSocketMessage(one, command('join', { name: 'Jules', code, token: token('e') }));
    await hub.webSocketMessage(two, command('join', { name: 'Sam', code, token: token('f') }));
    await hub.webSocketMessage(host, command('start'));
    expect(host.lastState().phase).toBe('answer');

    for (const [socket, value] of [[host, 'Mangoes.'], [one, 'Pineapples.'], [two, 'Peaches.']]) {
      await hub.webSocketMessage(socket, command('submit', { round: 1, submission: { kind: 'write', value } }));
    }
    expect(host.lastState()).toMatchObject({ phase: 'vote', submitted: 0, hasSubmitted: false });
    expect(host.lastState().answerOptions.every((option) => !Object.hasOwn(option, 'author'))).toBe(true);
    expect(host.lastState().answerOptions.filter((option) => option.isOwn)).toHaveLength(1);

    const ownOption = host.lastState().answerOptions.find((option) => option.isOwn);
    await hub.webSocketMessage(host, command('submit', {
      round: 1, submission: { kind: 'answer-vote', value: ownOption.id },
    }));
    expect(host.messages.at(-1)).toMatchObject({ type: 'error', message: "You can't vote for your own answer." });
    expect(host.lastState().hasSubmitted).toBe(false);

    for (const socket of [host, one, two]) {
      const option = socket.lastState().answerOptions.find((item) => !item.isOwn);
      await hub.webSocketMessage(socket, command('submit', {
        round: 1, submission: { kind: 'answer-vote', value: option.id },
      }));
    }
    expect(host.lastState().phase).toBe('reveal');
    expect(host.lastState().result.picks).toEqual([]);
    expect(host.lastState().result.answers).toContainEqual(expect.objectContaining({
      text: 'Mangoes.', author: host.lastState().me, count: 2,
    }));
  });
});
