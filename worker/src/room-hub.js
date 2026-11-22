import { addPlayer, applyAction, createRoom, viewRoom } from '../../src/game.ts';
import { getDeck } from '../../src/decks.ts';
import { verifyFirebaseIdToken } from './firebase-auth.js';

const ROOM_STATE_KEY = 'room';
const ROOM_TTL_MS = 2 * 60 * 60_000;
const MAX_MESSAGE_BYTES = 9_216;

function socketData(socket) {
  try {
    return socket.deserializeAttachment() ?? {};
  } catch {
    return {};
  }
}

function setSocketData(socket, data) {
  socket.serializeAttachment(data);
}

function decodeMessage(raw) {
  if (typeof raw === 'string') return raw;
  if (raw instanceof ArrayBuffer) return new TextDecoder().decode(raw);
  if (ArrayBuffer.isView(raw)) return new TextDecoder().decode(raw);
  throw new Error('Invalid request.');
}

function validCode(code) {
  return typeof code === 'string' && /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{5}$/.test(code);
}

function validToken(token) {
  return typeof token === 'string' && /^[\w-]{20,150}$/.test(token);
}

export class GameRoom {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.code = null;
    this.session = null;
    this.queue = Promise.resolve();
    this.ready = state.blockConcurrencyWhile
      ? state.blockConcurrencyWhile(() => this.load())
      : this.load();
  }

  async load() {
    this.session = (await this.state.storage.get(ROOM_STATE_KEY)) ?? null;
    this.code = this.session?.room.code ?? null;
    if (this.session) await this.state.storage.setAlarm(this.session.touched + ROOM_TTL_MS);
  }

  async fetch(request) {
    await this.ready;
    const code = request.headers.get('x-blame-room-code');
    if (!validCode(code)) return new Response('Invalid room code.', { status: 400 });
    if (this.code && this.code !== code) return new Response('Room routing mismatch.', { status: 404 });
    this.code = code;

    if (request.headers.get('upgrade')?.toLowerCase() !== 'websocket') {
      return new Response('Expected a WebSocket connection.', { status: 426 });
    }

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    setSocketData(server, { code, creating: request.headers.get('x-blame-room-create') === '1' });
    this.state.acceptWebSocket(server);
    return new Response(null, { status: 101, webSocket: client });
  }

  webSocketMessage(socket, raw) {
    this.queue = this.queue.catch(() => {}).then(() => this.handleMessage(socket, raw));
    return this.queue;
  }

  async handleMessage(socket, raw) {
    await this.ready;
    try {
      const body = decodeMessage(raw);
      if (new TextEncoder().encode(body).byteLength > MAX_MESSAGE_BYTES) throw new Error('Request is too large.');
      const command = JSON.parse(body);
      if (!command || typeof command !== 'object' || typeof command.type !== 'string') {
        throw new Error('Invalid request.');
      }
      await this.handleCommand(socket, command);
    } catch (cause) {
      this.sendError(socket, cause instanceof Error ? cause.message : 'Something went wrong.');
    }
  }

  async handleCommand(socket, command) {
    if (command.type === 'authenticate') {
      try {
        const uid = await verifyFirebaseIdToken(command.idToken, this.env.FIREBASE_PROJECT_ID);
        const current = socketData(socket);
        if (current.authUid && current.authUid !== uid) throw new Error('This connection is already authenticated.');
        if (current.playerId && current.authUid !== uid) throw new Error('Sign in with the account used to join this room.');
        setSocketData(socket, { ...current, authUid: uid });
        this.send(socket, { type: 'authenticated' });
      } catch {
        this.sendError(socket, 'Could not verify your sign-in.', true);
        try { socket.close(1008, 'Authentication failed'); } catch {}
      }
      return;
    }

    if (!socketData(socket).authUid) {
      this.sendError(socket, 'Sign in to play.', true);
      try { socket.close(1008, 'Sign-in required'); } catch {}
      return;
    }

    if (command.type === 'leave') {
      await this.leave(socket);
      return;
    }

    if (command.type === 'create' || command.type === 'join' || command.type === 'resume') {
      await this.enter(socket, command);
      return;
    }

    const { code, playerId } = socketData(socket);
    if (!this.session || code !== this.session.room.code || !playerId) {
      this.sendError(socket, 'Join the room first.', true);
      return;
    }
    applyAction(this.session.room, playerId, command);
    this.session.touched = Date.now();
    await this.persistAndSchedule();
    this.broadcast();
  }

  async enter(socket, command) {
    const current = socketData(socket);
    const code = current.code;
    const authUid = current.authUid;
    if (!validCode(code)) throw new Error('This room could not be found.');
    if (!validToken(command.token)) throw new Error('Invalid player session.');

    if (command.type === 'create') {
      if (!current.creating) throw new Error('Create a room from a new connection.');
      if (this.session) {
        this.send(socket, {
          type: 'error', message: 'Could not claim a room code. Try creating the room again.', retryCreate: true,
        });
        try { socket.close(1013, 'Room code collision'); } catch {}
        return;
      }
      if (typeof command.name !== 'string' || !getDeck(command.deckId) ||
        (command.mode !== 'anonymous' && command.mode !== 'named')) {
        throw new Error('Choose a deck and vote mode.');
      }
      const id = crypto.randomUUID();
      const room = createRoom(code, id, command.name, command.deckId, command.mode);
      this.session = { room, tokens: new Map([[command.token, { playerId: id, authUid }]]), touched: Date.now() };
      this.attach(socket, id, authUid);
      await this.persistAndSchedule();
      this.broadcast();
      return;
    }

    if (current.creating) throw new Error('Join with a room code.');
    if (typeof command.code !== 'string') throw new Error('Enter the room code.');
    if (command.code.trim().toUpperCase() !== code) throw new Error('This socket is connected to a different room.');
    if (!this.session) {
      this.sendError(socket, command.type === 'resume' ? 'Your session has expired.' : 'This room could not be found.', command.type === 'resume');
      return;
    }

    const saved = this.session.tokens.get(command.token);
    if (command.type === 'resume' && !saved) {
      this.sendError(socket, 'Your session has expired.', true);
      return;
    }
    if (saved && saved.authUid !== authUid) {
      throw new Error('Sign in with the account used to join this room.');
    }

    let playerId = saved?.playerId;
    if (!playerId) {
      if (command.type === 'resume') {
        this.sendError(socket, 'Your session has expired.', true);
        return;
      }
      if (typeof command.name !== 'string') throw new Error('Enter your name.');
      playerId = crypto.randomUUID();
      addPlayer(this.session.room, playerId, command.name);
      this.session.tokens.set(command.token, { playerId, authUid });
    }

    this.attach(socket, playerId, authUid);
    this.session.touched = Date.now();
    await this.persistAndSchedule();
    this.broadcast();
  }

  attach(socket, playerId, authUid) {
    setSocketData(socket, { code: this.session.room.code, playerId, authUid });
  }

  async leave(socket) {
    const { code, playerId, authUid } = socketData(socket);
    setSocketData(socket, { authUid: authUid ?? null });
    if (!this.session || code !== this.session.room.code || !playerId) return;

    if (this.session.room.phase === 'lobby') {
      for (const [token, saved] of this.session.tokens) {
        if (saved.playerId === playerId) this.session.tokens.delete(token);
      }
      this.session.room.players = this.session.room.players.filter((player) => player.id !== playerId);
      for (const peer of this.state.getWebSockets()) {
        const data = socketData(peer);
        if (data.code !== code || data.playerId !== playerId) continue;
        setSocketData(peer, { authUid: data.authUid ?? null });
        this.sendError(peer, 'You left the room.', true);
      }
      if (this.session.room.players.length === 0) this.session = null;
      else {
        if (this.session.room.host === playerId) this.session.room.host = this.session.room.players[0].id;
        this.session.touched = Date.now();
      }
      await this.persistAndSchedule();
      this.broadcast();
      return;
    }

    if (this.session.room.host === playerId) {
      const connected = new Set(this.state.getWebSockets()
        .map((peer) => socketData(peer))
        .filter((data) => data.code === code && data.playerId)
        .map((data) => data.playerId));
      const nextHost = this.session.room.players.find((player) => player.id !== playerId && connected.has(player.id))?.id;
      if (nextHost) {
        this.session.room.host = nextHost;
        this.session.touched = Date.now();
        await this.persistAndSchedule();
        this.broadcast();
      }
    }
  }

  broadcast() {
    if (!this.session) return;
    for (const socket of this.state.getWebSockets()) {
      const { code, playerId, authUid } = socketData(socket);
      if (code !== this.session.room.code || !playerId || !authUid) continue;
      this.send(socket, { type: 'state', room: viewRoom(this.session.room, playerId) });
    }
  }

  send(socket, message) {
    try { socket.send(JSON.stringify(message)); } catch {}
  }

  sendError(socket, message, reset = false) {
    this.send(socket, { type: 'error', message, reset });
  }

  async persistAndSchedule() {
    if (this.session) {
      await this.state.storage.put(ROOM_STATE_KEY, this.session);
      await this.state.storage.setAlarm(this.session.touched + ROOM_TTL_MS);
    } else {
      await this.state.storage.delete(ROOM_STATE_KEY);
      await this.state.storage.deleteAlarm();
    }
  }

  async alarm() {
    await this.ready;
    this.queue = this.queue.catch(() => {}).then(async () => {
      if (!this.session) return;
      const remaining = this.session.touched + ROOM_TTL_MS - Date.now();
      if (remaining > 0) {
        await this.state.storage.setAlarm(this.session.touched + ROOM_TTL_MS);
        return;
      }
      for (const socket of this.state.getWebSockets()) {
        const data = socketData(socket);
        if (data.code !== this.session.room.code) continue;
        setSocketData(socket, { authUid: data.authUid ?? null });
        this.sendError(socket, 'This room has expired.', true);
      }
      this.session = null;
      await this.persistAndSchedule();
    });
    return this.queue;
  }
}
