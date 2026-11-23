export { GameRoom } from './room-hub.js';
export { CommunityCatalog } from './community-catalog.js';
import { verifyFirebaseIdToken } from './firebase-auth.js';

const COMMUNITY_ORIGINS = new Set(['http://localhost:3001', 'http://127.0.0.1:3001']);

function communityCors(response, request) {
  const headers = new Headers(response.headers);
  headers.append('Vary', 'Origin');
  const origin = request.headers.get('origin');
  if (origin && COMMUNITY_ORIGINS.has(origin)) {
    headers.set('Access-Control-Allow-Origin', origin);
    headers.set('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    headers.set('Access-Control-Allow-Headers', 'Authorization, Content-Type');
    headers.set('Access-Control-Max-Age', '600');
  }
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const ROOM_CODE_PATTERN = /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{5}$/;

function newCode() {
  return Array.from(crypto.getRandomValues(new Uint8Array(5)), (byte) => CODE_CHARS[byte % CODE_CHARS.length]).join('');
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/health') return new Response('ok');

    const communityMatch = /^\/api\/community(?:\/([^/]+))?$/.exec(url.pathname);
    if (communityMatch) {
      if (request.method === 'OPTIONS') return communityCors(new Response(null, { status: 204 }), request);
      const resourceId = communityMatch[1];
      const mine = url.searchParams.get('mine') === '1';
      if (resourceId && !/^[\w-]{1,64}$/.test(resourceId)) return communityCors(new Response('Not found.', { status: 404 }), request);
      if (resourceId && request.method !== 'DELETE') return communityCors(new Response('Method not allowed.', { status: 405 }), request);
      if (!resourceId && !['GET', 'POST'].includes(request.method)) return communityCors(new Response('Method not allowed.', { status: 405 }), request);
      if (mine && (request.method !== 'GET' || resourceId)) return communityCors(new Response('Bad request.', { status: 400 }), request);
      const id = env.COMMUNITY_CATALOG.idFromName('public-community');
      const catalog = env.COMMUNITY_CATALOG.get(id);
      if (request.method === 'GET' && !mine) return communityCors(await catalog.fetch(request), request);
      let ownerId;
      try {
        const authorization = request.headers.get('authorization') ?? '';
        const match = /^Bearer (.+)$/.exec(authorization);
        ownerId = await verifyFirebaseIdToken(match?.[1], env.FIREBASE_PROJECT_ID);
      } catch (error) {
        return communityCors(Response.json({ error: error instanceof Error ? error.message : 'Sign in with an account to manage public decks.' }, { status: 401 }), request);
      }
      const headers = new Headers(request.headers);
      headers.set('x-blame-owner-id', ownerId);
      if (resourceId) headers.set('x-blame-community-id', resourceId);
      const routedRequest = new Request(request, { headers });
      return communityCors(await catalog.fetch(routedRequest), request);
    }

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
