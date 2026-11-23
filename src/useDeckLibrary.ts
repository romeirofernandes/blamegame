import { useCallback, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { parseCustomDeck, type CustomDeck } from './customDeck';

export const DECK_LIBRARY_STORAGE_KEY = 'blame-game:custom-decks';
export const MAX_LOCAL_DECKS = 12;

type DeckRecord = { id: string; deck: CustomDeck };
type StoredLibrary = { version: 1; decks: DeckRecord[] };

function newDeckId() {
  return `local-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

function deckKey(deck: CustomDeck) {
  return JSON.stringify({
    name: deck.name.trim().toLocaleLowerCase(),
    cover: deck.cover,
    cards: deck.cards.map(({ kind, question }) => ({ kind, question: question.trim().toLocaleLowerCase() })),
  });
}

function parseRecords(value: unknown): DeckRecord[] | null {
  if (Array.isArray(value)) {
    const decks = value.map(parseCustomDeck);
    return decks.some((deck) => !deck) ? null : decks.map((deck) => ({ id: newDeckId(), deck: deck! }));
  }
  if (!value || typeof value !== 'object') return null;
  const stored = value as Partial<StoredLibrary>;
  if (stored.version !== 1 || !Array.isArray(stored.decks)) return null;
  const records: DeckRecord[] = [];
  for (const item of stored.decks) {
    if (!item || typeof item !== 'object' || typeof item.id !== 'string' || !item.id) return null;
    const deck = parseCustomDeck(item.deck);
    if (!deck) return null;
    records.push({ id: item.id, deck });
  }
  return records;
}

export function useDeckLibrary() {
  const [records, setRecords] = useState<DeckRecord[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState('');
  const recordsRef = useRef(records);
  const loadedRef = useRef(false);
  const pendingWrite = useRef(Promise.resolve());
  const localDecks = records.map(({ deck }) => deck);
  const localDeckIds = records.map(({ id }) => id);

  const commit = useCallback((makeNext: (current: DeckRecord[]) => DeckRecord[]) => {
    const write = pendingWrite.current.then(async () => {
      if (!loadedRef.current) throw new Error('Your deck library is still loading.');
      const next = makeNext(recordsRef.current);
      await AsyncStorage.setItem(DECK_LIBRARY_STORAGE_KEY, JSON.stringify({ version: 1, decks: next } satisfies StoredLibrary));
      recordsRef.current = next;
      setRecords(next);
    });
    pendingWrite.current = write.catch(() => undefined);
    return write;
  }, []);

  useEffect(() => {
    let active = true;
    void AsyncStorage.getItem(DECK_LIBRARY_STORAGE_KEY).then(async (value) => {
      if (!value) return [];
      const parsed: unknown = JSON.parse(value);
      const next = parseRecords(parsed);
      if (!next || next.length > MAX_LOCAL_DECKS) throw new Error('Couldn’t read your saved decks.');
      if (Array.isArray(parsed)) {
        await AsyncStorage.setItem(DECK_LIBRARY_STORAGE_KEY, JSON.stringify({ version: 1, decks: next } satisfies StoredLibrary));
      }
      return next;
    }).then((next) => {
      if (!active) return;
      recordsRef.current = next;
      setRecords(next);
      loadedRef.current = true;
      setLoaded(true);
    }).catch(() => {
      if (active) setLoadError('Couldn’t load your saved decks. Try reopening the library.');
    });
    return () => { active = false; };
  }, []);

  const saveDecks = useCallback((decks: CustomDeck[], baseDecks: CustomDeck[]) => {
    const parsed = decks.map(parseCustomDeck);
    const parsedBase = baseDecks.map(parseCustomDeck);
    if (decks.length > MAX_LOCAL_DECKS || parsed.some((deck) => !deck) || parsedBase.some((deck) => !deck)) return Promise.reject(new Error('Couldn’t save these decks.'));
    const valid = parsed as CustomDeck[];
    const base = parsedBase as CustomDeck[];
    return commit((previous) => {
      const unused = new Set(previous.map((record) => record.id));
      const next = valid.map((deck, index) => {
        const key = deckKey(deck);
        const exact = previous.find((record) => unused.has(record.id) && deckKey(record.deck) === key);
        const originalKey = base[index] ? deckKey(base[index]) : undefined;
        const original = originalKey ? previous.find((record) => unused.has(record.id) && deckKey(record.deck) === originalKey) : undefined;
        const match = exact ?? original;
        if (match) unused.delete(match.id);
        return { id: match?.id ?? newDeckId(), deck };
      });
      const baseKeys = new Set(base.map(deckKey));
      const keys = new Set(next.map(({ deck }) => deckKey(deck)));
      for (const record of previous) {
        const key = deckKey(record.deck);
        if (!baseKeys.has(key) && !keys.has(key)) {
          next.push(record);
          keys.add(key);
        }
      }
      if (next.length > MAX_LOCAL_DECKS) throw new Error(`You can save up to ${MAX_LOCAL_DECKS} decks on this device.`);
      return next;
    });
  }, [commit]);

  const addDeck = useCallback((value: CustomDeck) => {
    const deck = parseCustomDeck(value);
    if (!deck) return Promise.reject(new Error('This deck is invalid.'));
    return commit((previous) => {
      if (previous.some((record) => deckKey(record.deck) === deckKey(deck))) return previous;
      if (previous.length >= MAX_LOCAL_DECKS) throw new Error(`You can save up to ${MAX_LOCAL_DECKS} decks on this device.`);
      return [...previous, { id: newDeckId(), deck }];
    });
  }, [commit]);

  return { localDecks, localDeckIds, loaded, loadError, saveDecks, addDeck };
}
