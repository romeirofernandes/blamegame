import { describe, expect, test } from 'bun:test';
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

describe('RoomHub WebSocket protocol', () => {
  test('persists private room state and resumes the same player after hibernation', async () => {
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
      name: 'Maya', deckId: 'group-chat', mode: 'anonymous', token: token('a'),
    }));
    const code = host.lastState().code;
    await hub.webSocketMessage(guest, command('join', { name: 'Jules', code, token: token('b') }));
    await hub.webSocketMessage(third, command('join', { name: 'Sam', code, token: token('c') }));
    await hub.webSocketMessage(host, command('start'));
    await hub.webSocketMessage(guest, command('submit', {
      round: 1, submission: { kind: 'pick', value: host.lastState().me },
    }));

    expect(host.lastState()).toMatchObject({ phase: 'vote', submitted: 1, hasSubmitted: false });
    expect(guest.lastState()).toMatchObject({ phase: 'vote', hasSubmitted: true });
    expect(host.lastState().result).toBeUndefined();

    const resumed = new FakeSocket();
    const recoveredState = new FakeState(storage);
    recoveredState.sockets.add(resumed);
    const recoveredHub = new GameRoom(recoveredState, {});
    await recoveredHub.ready;
    route(resumed, code, false, guest.attachment.authUid);
    await recoveredHub.webSocketMessage(resumed, command('resume', { code, token: token('b') }));

    expect(resumed.lastState()).toMatchObject({ code, me: guest.lastState().me, phase: 'vote', hasSubmitted: true });
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
});
