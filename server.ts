import type { ServerWebSocket } from 'bun';
import { addPlayer, applyAction, createRoom, viewRoom, type Action, type Command, type Message, type Room } from './src/game';
import { getDeck } from './src/decks';

type Client = { code?: string; playerId?: string };
type Session = { room: Room; tokens: Map<string, string>; touched: number };
const rooms = new Map<string, Session>();
const clients = new Map<string, Set<ServerWebSocket<Client>>>();
const ttl = 2 * 60 * 60_000;

function send(socket: ServerWebSocket<Client>, message: Message) {
  socket.send(JSON.stringify(message));
}

function error(socket: ServerWebSocket<Client>, message: string, reset = false) {
  send(socket, { type: 'error', message, reset });
}

function detach(socket: ServerWebSocket<Client>) {
  if (socket.data.code) clients.get(socket.data.code)?.delete(socket);
  socket.data = {};
}

function attach(socket: ServerWebSocket<Client>, session: Session, playerId: string) {
  const { code } = session.room;
  detach(socket);
  socket.data = { code, playerId };
  clients.get(code)!.add(socket);
  session.touched = Date.now();
}

function broadcast(session: Session) {
  session.touched = Date.now();
  for (const socket of clients.get(session.room.code)!) {
    send(socket, { type: 'state', room: viewRoom(session.room, socket.data.playerId!) });
  }
}

function newCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code: string;
  do {
    code = Array.from(crypto.getRandomValues(new Uint8Array(5)), (byte) => chars[byte % chars.length]).join('');
  } while (rooms.has(code));
  return code;
}

function roomCommand(socket: ServerWebSocket<Client>, command: Command) {
  if (command.type === 'leave') {
    const { code, playerId } = socket.data;
    detach(socket);
    const session = code ? rooms.get(code) : undefined;
    if (session?.room.phase === 'lobby' && playerId) {
      const { room, tokens } = session;
      for (const [token, id] of tokens) if (id === playerId) tokens.delete(token);
      room.players = room.players.filter((player) => player.id !== playerId);
      for (const peer of clients.get(room.code)!) {
        if (peer.data.playerId !== playerId) continue;
        detach(peer);
        error(peer, 'You left the room.', true);
      }
      if (room.players.length === 0) {
        clients.delete(room.code);
        rooms.delete(room.code);
      } else {
        if (room.host === playerId) room.host = room.players[0].id;
        broadcast(session);
      }
    } else if (session && session.room.host === playerId) {
      const connected = new Set([...clients.get(session.room.code)!].map((peer) => peer.data.playerId));
      const nextHost = session.room.players.find((player) => player.id !== playerId && connected.has(player.id))?.id;
      if (nextHost) {
        session.room.host = nextHost;
        broadcast(session);
      }
    }
    return;
  }
  if (command.type === 'create' || command.type === 'join' || command.type === 'resume') {
    if (typeof command.token !== 'string' || !/^[\w-]{20,150}$/.test(command.token)) {
      throw new Error('Invalid player session.');
    }
    if (command.type === 'create') {
      if (typeof command.name !== 'string' || !getDeck(command.deckId) ||
        (command.mode !== 'anonymous' && command.mode !== 'named')) throw new Error('Choose a deck and vote mode.');
      if (rooms.size >= 500) throw new Error('The server is full. Try again later.');
      const id = crypto.randomUUID();
      const code = newCode();
      const room = createRoom(code, id, command.name, command.deckId, command.mode);
      const session = { room, tokens: new Map([[command.token, id]]), touched: Date.now() };
      rooms.set(code, session);
      clients.set(code, new Set());
      attach(socket, session, id);
      broadcast(session);
      return;
    }
    if (typeof command.code !== 'string') throw new Error('Enter the room code.');
    const session = rooms.get(command.code.trim().toUpperCase());
    if (!session) return error(socket, 'This room could not be found.', command.type === 'resume');
    let id = session.tokens.get(command.token);
    if (!id) {
      if (command.type === 'resume') return error(socket, 'Your session has expired.', true);
      if (typeof command.name !== 'string') throw new Error('Enter your name.');
      id = crypto.randomUUID();
      addPlayer(session.room, id, command.name);
      session.tokens.set(command.token, id);
    }
    attach(socket, session, id);
    broadcast(session);
    return;
  }
  const { code, playerId } = socket.data;
  const session = code ? rooms.get(code) : undefined;
  if (!session || !playerId) return error(socket, 'Join the room first.', true);
  applyAction(session.room, playerId, command as Action);
  broadcast(session);
}

setInterval(() => {
  for (const [code, session] of rooms) {
    if (Date.now() - session.touched < ttl) continue;
    for (const socket of clients.get(code)!) {
      detach(socket);
      error(socket, 'This room has expired.', true);
    }
    clients.delete(code);
    rooms.delete(code);
  }
}, 60_000).unref();

const server = Bun.serve<Client>({
  hostname: '0.0.0.0',
  port: Number(process.env.PORT ?? 3000),
  async fetch(request, server) {
    const url = new URL(request.url);
    if (url.pathname === '/ws') {
      if (server.upgrade(request, { data: {} })) return;
      return new Response('Expected a WebSocket connection.', { status: 426 });
    }
    if (url.pathname === '/health') return new Response('ok');
    if (url.pathname.split('/').some((part) => part.startsWith('.') || part.includes('%'))) {
      return new Response('Not found', { status: 404 });
    }
    const file = Bun.file(url.pathname === '/' ? 'dist/index.html' : `dist${url.pathname}`);
    if (await file.exists()) return new Response(file);
    return new Response('Run bun run build:web to serve the app here.', { status: 404 });
  },
  websocket: {
    maxPayloadLength: 4096,
    close: detach,
    message(socket, raw) {
      try {
        const command = JSON.parse(raw.toString()) as Command;
        roomCommand(socket, command);
      } catch (cause) {
        error(socket, cause instanceof SyntaxError ? 'Invalid request.' :
          cause instanceof Error ? cause.message : 'Something went wrong.');
      }
    },
  },
});

console.log(`Blame Game listening at http://localhost:${server.port}`);
