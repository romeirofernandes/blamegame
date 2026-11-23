import { useCallback, useEffect, useRef, useState } from 'react';
import { Image, Platform, View } from 'react-native';
import { useAuth } from './auth';
import { CUSTOM_COVERS, type CustomDeck } from './customDeck';
import { deckArt } from './deckArt';
import { webOrigin } from './useRoom';
import { Body, Button, Field, Label, Surface, Title } from './ui';

type CommunityItem = { id: string; deck: CustomDeck };
type CatalogPage = { items: CommunityItem[]; nextCursor: string | null; error?: string };
type OwnerPage = { items: CommunityItem[]; error?: string };

function communityOrigin() {
  const configured = process.env.EXPO_PUBLIC_SERVER_URL?.replace(/\/$/, '');
  if (configured) return configured;
  if (Platform.OS === 'web' && typeof location !== 'undefined' && location.port === '3001' && ['localhost', '127.0.0.1'].includes(location.hostname)) {
    return `${location.protocol}//${location.hostname}:8787`;
  }
  return webOrigin();
}

function deckKey(deck: CustomDeck) {
  return JSON.stringify({
    name: deck.name.trim().toLocaleLowerCase(),
    cover: deck.cover,
    cards: deck.cards.map(({ kind, question }) => ({ kind, question: question.trim().toLocaleLowerCase() })),
  });
}

async function loadPage(search: string, cursor: string | null): Promise<CatalogPage> {
  const query = new URLSearchParams();
  if (search.trim()) query.set('search', search.trim());
  if (cursor) query.set('cursor', cursor);
  const response = await fetch(`${communityOrigin()}/api/community?${query.toString()}`);
  const result = await response.json();
  if (!response.ok) throw new Error(result.error ?? 'Couldn’t load community decks.');
  return result as CatalogPage;
}

export function CommunityScreen({
  onAdd,
  localDecks,
  libraryReady,
  libraryError,
  onSignIn,
}: {
  onAdd: (deck: CustomDeck) => Promise<void>;
  localDecks: CustomDeck[];
  libraryReady: boolean;
  libraryError: string;
  onSignIn?: () => void;
}) {
  const { user, loading: authLoading } = useAuth();
  const [search, setSearch] = useState('');
  const [items, setItems] = useState<CommunityItem[]>([]);
  const [owned, setOwned] = useState<CommunityItem[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [published, setPublished] = useState<Set<string>>(new Set());
  const [pendingPublish, setPendingPublish] = useState<{ deck: CustomDeck; index: number } | null>(null);
  const requestId = useRef(0);

  const refresh = useCallback(async (term: string) => {
    const currentRequest = ++requestId.current;
    setLoading(true);
    setError('');
    try {
      const page = await loadPage(term, null);
      if (requestId.current !== currentRequest) return;
      setItems(page.items);
      setCursor(page.nextCursor);
    } catch (loadError) {
      if (requestId.current === currentRequest) setError(loadError instanceof Error ? loadError.message : 'Couldn’t load community decks.');
    } finally {
      if (requestId.current === currentRequest) setLoading(false);
    }
  }, []);

  useEffect(() => {
    ++requestId.current;
    setLoading(true);
    setCursor(null);
    setItems([]);
    const timer = setTimeout(() => { void refresh(search); }, 250);
    return () => clearTimeout(timer);
  }, [refresh, search]);

  const refreshOwned = useCallback(async () => {
    if (!user || user.isAnonymous) {
      setOwned([]);
      return;
    }
    const token = await user.getIdToken();
    const response = await fetch(`${communityOrigin()}/api/community?mine=1`, { headers: { Authorization: `Bearer ${token}` } });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error ?? 'Couldn’t load your public decks.');
    setOwned((result as OwnerPage).items);
  }, [user]);

  useEffect(() => {
    if (authLoading) return;
    void refreshOwned().catch((loadError) => {
      setError(loadError instanceof Error ? loadError.message : 'Couldn’t load your public decks.');
    });
  }, [authLoading, refreshOwned]);

  async function loadMore() {
    if (!cursor || loadingMore) return;
    const currentRequest = requestId.current;
    setLoadingMore(true);
    setError('');
    try {
      const page = await loadPage(search, cursor);
      if (requestId.current !== currentRequest) return;
      setItems((current) => [...current, ...page.items.filter((item) => !current.some(({ id }) => id === item.id))]);
      setCursor(page.nextCursor);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Couldn’t load more decks.');
    } finally {
      setLoadingMore(false);
    }
  }

  async function addDeck(deck: CustomDeck, id: string) {
    if (localDecks.some((saved) => deckKey(saved) === deckKey(deck))) {
      setNotice('You already have this deck in your library.');
      return;
    }
    setBusyId(id);
    setNotice('');
    try {
      await onAdd(deck);
      setNotice(`${deck.name} added to your library.`);
    } catch (addError) {
      setError(addError instanceof Error ? addError.message : 'Couldn’t add this deck. Try again.');
    } finally {
      setBusyId(null);
    }
  }

  async function publish(deck: CustomDeck, index: number) {
    const key = deckKey(deck);
    if (published.has(key)) return;
    if (!user || user.isAnonymous) {
      setError('Sign in with an account to publish a deck.');
      return;
    }
    const id = `local-${index}`;
    setBusyId(id);
    setError('');
    setNotice('');
    try {
      const token = await user.getIdToken();
      const response = await fetch(`${communityOrigin()}/api/community`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ deck }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? 'Couldn’t publish this deck.');
      setPublished((current) => new Set(current).add(key));
      setNotice(result.duplicate ? 'This deck is already published.' : `${deck.name} is now in Community.`);
      await refreshOwned().catch(() => setError('Published, but couldn’t refresh your public listings.'));
    } catch (publishError) {
      setError(publishError instanceof Error ? publishError.message : 'Couldn’t publish this deck.');
    } finally {
      setBusyId(null);
    }
  }

  async function unpublish(item: CommunityItem) {
    setBusyId(item.id);
    setError('');
    setNotice('');
    try {
      const token = await user!.getIdToken();
      const response = await fetch(`${communityOrigin()}/api/community/${encodeURIComponent(item.id)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? 'Couldn’t unpublish this deck.');
      setOwned((current) => current.filter(({ id }) => id !== item.id));
      const key = deckKey(item.deck);
      if (!owned.some(({ id, deck }) => id !== item.id && deckKey(deck) === key)) {
        setPublished((current) => {
          const next = new Set(current);
          next.delete(key);
          return next;
        });
      }
      setNotice(`${item.deck.name} is no longer public.`);
      await refresh(search);
    } catch (unpublishError) {
      setError(unpublishError instanceof Error ? unpublishError.message : 'Couldn’t unpublish this deck.');
    } finally {
      setBusyId(null);
    }
  }

  const savedKeys = new Set(localDecks.map(deckKey));
  const publishedKeys = new Set([...owned.map(({ deck }) => deckKey(deck)), ...published]);
  return (
    <View className="gap-5 pb-6">
      <View className="gap-2">
        <Label>Made by players</Label>
        <Title className="text-[34px] leading-10">Community decks</Title>
        <Body className="text-sm text-muted">Find a deck for your group, or share one you made.</Body>
      </View>
      <Field label="Search decks" value={search} onChangeText={setSearch} maxLength={60} placeholder="Try a deck name" returnKeyType="search" />

      {loading && <Body className="text-sm text-muted">Loading decks…</Body>}
      {!loading && !items.length && !error && <Body className="text-sm text-muted">No community decks found. Try another search.</Body>}
      {items.map(({ id, deck }) => {
        const isSaved = savedKeys.has(deckKey(deck));
        return (
          <Surface key={id} className="gap-3 p-3">
            <View className="flex-row items-center gap-3">
              <Image source={deckArt[deck.cover]} style={{ width: 54, height: 54 }} resizeMode="contain" accessible={false} />
              <View className="flex-1 gap-1">
                <Body className="font-boldface">{deck.name}</Body>
                <Body className="text-xs text-muted">{deck.cards.length} prompts · {CUSTOM_COVERS[deck.cover]}</Body>
              </View>
            </View>
            <Body className="text-sm text-muted" numberOfLines={2}>{deck.cards.slice(0, 2).map(({ question }) => question).join('  ·  ')}</Body>
            <Button tone={isSaved ? 'quiet' : 'secondary'} arrow={false} disabled={!libraryReady || isSaved || busyId !== null} onPress={() => void addDeck(deck, id)}>
              {isSaved ? 'In your library' : busyId === id ? 'Adding…' : 'Add to your library'}
            </Button>
          </Surface>
        );
      })}
      {!!cursor && !loading && <Button tone="secondary" arrow={false} disabled={loadingMore} onPress={() => void loadMore()}>{loadingMore ? 'Loading…' : 'Load more decks'}</Button>}
      {!!libraryError && <Body accessibilityRole="alert" className="text-sm text-peach">{libraryError}</Body>}
      {!!notice && <Body accessibilityRole="status" className="text-sm text-lime-strong">{notice}</Body>}
      {!!error && <Body accessibilityRole="alert" className="text-sm text-peach">{error}</Body>}

      {localDecks.length > 0 && (
        <View className="gap-3">
          <Label>Your decks</Label>
          {localDecks.map((deck, index) => {
            const key = deckKey(deck);
            const isPublished = publishedKeys.has(key);
            return (
              <Surface key={`${key}-${index}`} className="gap-3 p-3">
                <View className="flex-row items-center gap-3">
                  <Image source={deckArt[deck.cover]} style={{ width: 48, height: 48 }} resizeMode="contain" accessible={false} />
                  <View className="flex-1 gap-1">
                    <Body className="font-boldface">{deck.name}</Body>
                    <Body className="text-xs text-muted">{deck.cards.length} prompts · {CUSTOM_COVERS[deck.cover]}</Body>
                  </View>
                </View>
                <Button tone="secondary" arrow={false} disabled={busyId !== null || isPublished || authLoading || owned.length >= 5} onPress={() => {
                  if (!user || user.isAnonymous) {
                    if (onSignIn) onSignIn();
                    else setError('Sign in from Settings to publish a deck.');
                  } else setPendingPublish({ deck, index });
                }}>
                  {isPublished ? 'Published' : user && !user.isAnonymous ? 'Publish to Community' : 'Sign in to publish'}
                </Button>
              </Surface>
            );
          })}
        </View>
      )}
      {user && !user.isAnonymous && (
        <View className="gap-3">
          <Label>Your public decks · {owned.length}/5</Label>
          {owned.map((item) => (
            <Surface key={item.id} className="flex-row items-center gap-3 p-3">
              <Image source={deckArt[item.deck.cover]} style={{ width: 42, height: 42 }} resizeMode="contain" accessible={false} />
              <View className="flex-1 gap-1">
                <Body className="font-boldface">{item.deck.name}</Body>
                <Body className="text-xs text-muted">Visible to anyone browsing Community</Body>
              </View>
              <Button tone="quiet" arrow={false} disabled={busyId !== null} onPress={() => void unpublish(item)}>
                {busyId === item.id ? 'Removing…' : 'Unpublish'}
              </Button>
            </Surface>
          ))}
          {owned.length >= 5 && <Body className="text-xs text-muted">Unpublish a deck before sharing another.</Body>}
        </View>
      )}
      {!!pendingPublish && (
        <Surface className="gap-3 border border-lilac-strong p-4">
          <Title className="text-[23px] leading-7">Share this deck publicly?</Title>
          <Body className="text-sm">“{pendingPublish.deck.name}” and all its prompts will be visible to anyone browsing Community. Your account name and identity will not be shown. You can unpublish it later.</Body>
          <Button disabled={busyId !== null || owned.length >= 5} onPress={() => {
            const selected = pendingPublish;
            setPendingPublish(null);
            if (selected) void publish(selected.deck, selected.index);
          }}>Publish publicly</Button>
          <Button tone="quiet" arrow={false} onPress={() => setPendingPublish(null)}>Cancel</Button>
        </Surface>
      )}
    </View>
  );
}
