import { Database } from 'bun:sqlite';
import { describe, expect, test } from 'bun:test';
import { CommunityCatalog } from '../src/community-catalog.js';
import worker from '../src/index.js';

function makeCatalog() {
  const db = new Database(':memory:');
  return new CommunityCatalog({ storage: { sql: {
    exec(statement, ...params) {
      if (/^\s*SELECT/i.test(statement)) {
        const rows = db.query(statement).all(...params);
        return { toArray: () => rows };
      }
      db.query(statement).run(...params);
      return { toArray: () => [] };
    },
  } } });
}

const sampleDeck = (name = 'After hours') => ({
  name,
  cover: 'chaos',
  cards: [{ kind: 'pick', question: 'Who starts one more story at midnight?' }],
});

function request(method, body, ownerId, path = '/api/community') {
  const headers = new Headers({ 'content-type': 'application/json' });
  if (ownerId) headers.set('x-blame-owner-id', ownerId);
  if (path !== '/api/community') headers.set('x-blame-community-id', path.split('/').at(-1));
  return new Request(`https://worker.test${path}`, { method, headers, ...(body ? { body: JSON.stringify(body) } : {}) });
}

describe('CommunityCatalog', () => {
  test('answers Expo localhost preflight with the required CORS headers', async () => {
    const response = await worker.fetch(new Request('http://localhost:8787/api/community', {
      method: 'OPTIONS',
      headers: { Origin: 'http://localhost:3001', 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'authorization,content-type' },
    }), {});
    expect(response.status).toBe(204);
    expect(response.headers.get('access-control-allow-origin')).toBe('http://localhost:3001');
    expect(response.headers.get('access-control-allow-methods')).toContain('DELETE');
    expect(response.headers.get('access-control-allow-headers')).toContain('Authorization');
  });

  test('validates, publishes idempotently, and does not expose owner identity', async () => {
    const catalog = makeCatalog();
    const published = await catalog.fetch(request('POST', { deck: sampleDeck() }, 'owner-secret'));
    expect(published.status).toBe(201);
    const duplicate = await catalog.fetch(request('POST', { deck: sampleDeck() }, 'owner-secret'));
    expect((await duplicate.json()).duplicate).toBe(true);
    const invalid = await catalog.fetch(request('POST', { deck: { name: 'bad' } }, 'owner-secret'));
    expect(invalid.status).toBe(400);
    const publicList = await catalog.fetch(new Request('https://worker.test/api/community'));
    const result = await publicList.json();
    expect(result.items).toHaveLength(1);
    expect(result.items[0].ownerId).toBeUndefined();
    expect(publicList.headers.get('cache-control')).toBe('public, max-age=30');
    const search = await catalog.fetch(new Request('https://worker.test/api/community?search=After'));
    expect((await search.json()).items).toHaveLength(1);
  });

  test('keeps owner listings private and enforces the owner cap and ownership on removal', async () => {
    const catalog = makeCatalog();
    const ids = [];
    for (let index = 0; index < 5; index++) {
      const response = await catalog.fetch(request('POST', { deck: sampleDeck(`Deck ${index}`) }, 'owner-a'));
      ids.push((await response.json()).id);
    }
    expect((await catalog.fetch(request('POST', { deck: sampleDeck('Sixth') }, 'owner-a'))).status).toBe(409);
    const mine = await catalog.fetch(new Request('https://worker.test/api/community?mine=1', { headers: { 'x-blame-owner-id': 'owner-a' } }));
    expect((await mine.json()).items).toHaveLength(5);
    const denied = await catalog.fetch(request('DELETE', null, 'owner-b', `/api/community/${ids[0]}`));
    expect(denied.status).toBe(404);
    const removed = await catalog.fetch(request('DELETE', null, 'owner-a', `/api/community/${ids[0]}`));
    expect(removed.status).toBe(200);
    expect((await (await catalog.fetch(new Request('https://worker.test/api/community?mine=1', { headers: { 'x-blame-owner-id': 'owner-a' } }))).json()).items).toHaveLength(4);
  });
});
