export { GameRoom } from './room-hub.js';

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const ROOM_CODE_PATTERN = /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{5}$/;

function newCode() {
  return Array.from(crypto.getRandomValues(new Uint8Array(5)), (byte) => CODE_CHARS[byte % CODE_CHARS.length]).join('');
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/health') return new Response('ok');

    let code;
    let creating = false;
    if (url.pathname === '/ws/new') {
      code = newCode();
      creating = true;
    } else {
      const match = /^\/ws\/([^/]+)$/.exec(url.pathname);
      if (!match) {
        if (url.pathname === '/ws' || url.pathname.startsWith('/ws/')) return new Response('Not found', { status: 404 });
        return env.ASSETS.fetch(request);
      }
      code = match[1].toUpperCase();
      if (!ROOM_CODE_PATTERN.test(code)) return new Response('Not found', { status: 404 });
    }

    if (request.headers.get('upgrade')?.toLowerCase() !== 'websocket') {
      return new Response('Expected a WebSocket connection.', { status: 426 });
    }

    const headers = new Headers(request.headers);
    headers.set('x-blame-room-code', code);
    headers.set('x-blame-room-create', creating ? '1' : '0');
    const routedRequest = new Request(request, { headers });
    const id = env.GAME_ROOM.idFromName(`room-${code}`);
    return env.GAME_ROOM.get(id).fetch(routedRequest);
  },
};
