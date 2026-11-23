import { parseCustomDeck } from '../../src/customDeck.ts';

const PAGE_SIZE = 12;
const MAX_OWNER_DECKS = 5;
const MAX_SEARCH_LENGTH = 60;
const MAX_BODY_BYTES = 12_000;

function json(data, status = 200, cacheControl = 'no-store') {
  return Response.json(data, { status, headers: { 'Cache-Control': cacheControl } });
}

async function fingerprint(deck) {
  const bytes = new TextEncoder().encode(JSON.stringify(deck));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export class CommunityCatalog {
  constructor(ctx) {
    this.ctx = ctx;
    this.sql = ctx.storage.sql;
    this.sql.exec(`CREATE TABLE IF NOT EXISTS community_decks (
      id TEXT PRIMARY KEY,
      owner_hash TEXT NOT NULL,
      fingerprint TEXT NOT NULL,
      name TEXT NOT NULL,
      cover TEXT NOT NULL,
      cards TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      UNIQUE(owner_hash, fingerprint)
    )`);
    this.sql.exec('CREATE INDEX IF NOT EXISTS community_decks_created ON community_decks(created_at DESC, id DESC)');
    this.sql.exec('CREATE INDEX IF NOT EXISTS community_decks_fingerprint ON community_decks(fingerprint)');
  }

  async fetch(request) {
    const url = new URL(request.url);
    const ownerId = request.headers.get('x-blame-owner-id');
    const resourceId = request.headers.get('x-blame-community-id');
    if (request.method === 'GET') {
      if (url.searchParams.get('mine') === '1') {
        if (!ownerId) return json({ error: 'Sign in to view your public decks.' }, 401);
        return this.listMine(ownerId);
      }
      return this.list(url);
    }
    if (request.method === 'DELETE' && ownerId && resourceId) return this.unpublish(ownerId, resourceId);
    if (request.method !== 'POST' || !ownerId) return new Response('Not found.', { status: 404 });
    const size = Number(request.headers.get('content-length') ?? 0);
    if (size > MAX_BODY_BYTES) return json({ error: 'Request is too large.' }, 413);
    let input;
    try {
      const text = await request.text();
      if (new TextEncoder().encode(text).byteLength > MAX_BODY_BYTES) return json({ error: 'Request is too large.' }, 413);
      input = JSON.parse(text);
    } catch {
      return json({ error: 'Invalid JSON.' }, 400);
    }
    const deck = parseCustomDeck(input?.deck);
    if (!deck) return json({ error: 'This deck is invalid.' }, 400);

    const fp = await fingerprint(deck);
    const ownerHash = await fingerprint({ ownerId });
    const existing = this.sql.exec(
      'SELECT id, name, cover, cards FROM community_decks WHERE owner_hash = ? AND fingerprint = ? LIMIT 1',
      ownerHash, fp,
    ).toArray()[0];
    if (existing) return json({ deck: this.toDeck(existing), id: existing.id, duplicate: true });

    const count = this.sql.exec('SELECT COUNT(*) AS count FROM community_decks WHERE owner_hash = ?', ownerHash).toArray()[0]?.count ?? 0;
    if (count >= MAX_OWNER_DECKS) return json({ error: `You can publish up to ${MAX_OWNER_DECKS} decks. Unpublish one to make room.` }, 409);

    const id = crypto.randomUUID();
    const createdAt = Date.now();
    this.sql.exec(
      'INSERT INTO community_decks (id, owner_hash, fingerprint, name, cover, cards, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      id, ownerHash, fp, deck.name, deck.cover, JSON.stringify(deck.cards), createdAt,
    );
    return json({ deck, id, duplicate: false }, 201);
  }

  async unpublish(ownerId, id) {
    const ownerHash = await fingerprint({ ownerId });
    const existing = this.sql.exec(
      'SELECT id FROM community_decks WHERE id = ? AND owner_hash = ? LIMIT 1', id, ownerHash,
    ).toArray()[0];
    if (!existing) return json({ error: 'That public deck was not found.' }, 404);
    this.sql.exec('DELETE FROM community_decks WHERE id = ? AND owner_hash = ?', id, ownerHash);
    return json({ deleted: true });
  }

  list(url) {
    const search = (url.searchParams.get('search') ?? '').trim().slice(0, MAX_SEARCH_LENGTH);
    const rawCursor = url.searchParams.get('cursor') ?? '0';
    if (!/^\d{1,8}$/.test(rawCursor)) return json({ error: 'Invalid page cursor.' }, 400);
    const offset = Number(rawCursor);
    const rows = search
      ? this.sql.exec(
        'SELECT id, name, cover, cards FROM community_decks WHERE name LIKE ? ESCAPE \'\\\' ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?',
        `%${search.replace(/[\\%_]/g, '\\$&')}%`, PAGE_SIZE + 1, offset,
      ).toArray()
      : this.sql.exec(
        'SELECT id, name, cover, cards FROM community_decks ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?',
        PAGE_SIZE + 1, offset,
      ).toArray();
    const hasMore = rows.length > PAGE_SIZE;
    const items = rows.slice(0, PAGE_SIZE).map((row) => ({ id: row.id, deck: this.toDeck(row) }));
    return json({ items, nextCursor: hasMore ? String(offset + PAGE_SIZE) : null }, 200, 'public, max-age=30');
  }

  async listMine(ownerId) {
    const ownerHash = await fingerprint({ ownerId });
    const rows = this.sql.exec(
      'SELECT id, name, cover, cards FROM community_decks WHERE owner_hash = ? ORDER BY created_at DESC, id DESC LIMIT ?',
      ownerHash, MAX_OWNER_DECKS,
    ).toArray();
    return json({ items: rows.map((row) => ({ id: row.id, deck: this.toDeck(row) })) });
  }

  toDeck(row) {
    try {
      return parseCustomDeck({ name: row.name, cover: row.cover, cards: JSON.parse(row.cards) });
    } catch {
      return null;
    }
  }
}
