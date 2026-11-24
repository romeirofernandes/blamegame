import { useCallback, useEffect, useRef, useState } from 'react';
import { Image, Platform, View } from 'react-native';
import { HugeiconsIcon } from '@hugeicons/react-native';
import Search01Icon from '@hugeicons/core-free-icons/Search01Icon';
import { useAuth } from './auth';
import { CUSTOM_COVERS, type CustomDeck } from './customDeck';
import { deckArt } from './deckArt';
import { webOrigin } from './useRoom';
import { Tabs, TabsList, TabsTrigger } from './beui/tabs';
import { Body, Button, Field, Label, Surface, Tap, Title } from './ui';
import { useAppearance } from './appearance';

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
  const { colors } = useAppearance();
  const [search, setSearch] = useState('');
  const [section, setSection] = useState<'browse' | 'your'>('browse');
  const [items, setItems] = useState<CommunityItem[]>([]);
  const [suggestionNames, setSuggestionNames] = useState<string[]>([]);
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
      if (!term.trim()) setSuggestionNames(page.items.map(({ deck }) => deck.name));
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
      if (!search.trim()) setSuggestionNames((current) => [...new Set([...current, ...page.items.map(({ deck }) => deck.name)])]);
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
      const result = await response.json() as { id?: string; duplicate?: boolean; error?: string };
      if (!response.ok) throw new Error(result.error ?? 'Couldn’t publish this deck.');
      if (!result.id) throw new Error('The deck was published, but its listing could not be confirmed.');
      setOwned((current) => current.some(({ id }) => id === result.id) ? current : [{ id: result.id!, deck }, ...current]);
      setPublished((current) => new Set(current).add(key));
      setNotice(result.duplicate ? 'This deck is already published.' : `${deck.name} is now in Community.`);
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
      setItems((current) => current.filter(({ id }) => id !== item.id));
      const key = deckKey(item.deck);
      if (!owned.some(({ id, deck }) => id !== item.id && deckKey(deck) === key)) {
        setPublished((current) => {
          const next = new Set(current);
          next.delete(key);
          return next;
        });
      }
      setNotice(`${item.deck.name} is no longer public.`);
    } catch (unpublishError) {
      setError(unpublishError instanceof Error ? unpublishError.message : 'Couldn’t unpublish this deck.');
    } finally {
      setBusyId(null);
    }
  }

  const savedKeys = new Set(localDecks.map(deckKey));
  const publishedKeys = new Set([...owned.map(({ deck }) => deckKey(deck)), ...published]);
  const searchTerm = search.trim().toLocaleLowerCase();
  const suggestions = searchTerm
    ? [...new Set(suggestionNames.filter((name) => name.toLocaleLowerCase() !== searchTerm && name.toLocaleLowerCase().includes(searchTerm)))].slice(0, 3)
    : [];
  return (
    <View className="gap-4 pb-6">
      <View>
        <Title className="text-[48px] leading-display">Community</Title>
        <Body className="mt-1 text-sm text-muted">Decks from players, made for your group.</Body>
      </View>
      <Tabs value={section} values={['browse', 'your']} onValueChange={(value) => setSection(value === 'your' ? 'your' : 'browse')}>
        <TabsList accessibilityLabel="Community sections">
          <TabsTrigger value="browse">Browse</TabsTrigger>
          <TabsTrigger value="your">Your decks</TabsTrigger>
        </TabsList>
      </Tabs>

      {!!libraryError && <Body accessibilityRole="alert" className="text-sm text-peach">{libraryError}</Body>}
      {!!notice && <Body accessibilityRole="status" className="text-sm text-cloud">{notice}</Body>}
      {!!error && <Body accessibilityRole="alert" className="text-sm text-peach">{error}</Body>}

      {section === 'browse' ? (
        <View className="gap-4">
          <Field label="Search decks" value={search} onChangeText={setSearch} maxLength={60} placeholder="Search community decks" returnKeyType="search"
            trailing={<HugeiconsIcon accessible={false} icon={Search01Icon} color={colors.muted} size={20} strokeWidth={1.9} />} />
          {!!suggestions.length && (
            <View className="gap-2">
              <Label>Suggestions</Label>
              <View className="flex-row flex-wrap gap-2">
                {suggestions.map((suggestion) => (
                  <Tap key={suggestion} label={`Search for ${suggestion}`} onPress={() => setSearch(suggestion)} className="border border-line bg-canvas px-3">
                    <Body className="text-sm">{suggestion}</Body>
                  </Tap>
                ))}
              </View>
            </View>
          )}
          {loading && <Body className="text-sm text-muted">Finding decks…</Body>}
          {!loading && !items.length && !error && <Body className="text-sm text-muted">{search.trim() ? 'No decks match that search.' : 'No public decks yet.'}</Body>}
          {items.map(({ id, deck }) => {
            const isSaved = savedKeys.has(deckKey(deck));
            return (
              <Surface key={id} className="gap-3 p-3">
                <View className="flex-row items-center gap-3">
                  <Image source={deckArt[deck.cover]} style={{ width: 54, height: 54 }} resizeMode="contain" accessible={false} />
                  <View className="min-w-0 flex-1 gap-1">
                    <Body className="font-boldface">{deck.name}</Body>
                    <Body className="text-xs text-muted">{deck.cards.length} prompts · {CUSTOM_COVERS[deck.cover]}</Body>
                  </View>
                </View>
                <Button tone={isSaved ? 'quiet' : 'secondary'} arrow={false} disabled={!libraryReady || isSaved || busyId !== null} onPress={() => void addDeck(deck, id)}>
                  {isSaved ? 'In your library' : busyId === id ? 'Adding…' : 'Add to your library'}
                </Button>
              </Surface>
            );
          })}
          {!!cursor && !loading && <Button tone="secondary" arrow={false} disabled={loadingMore} onPress={() => void loadMore()}>{loadingMore ? 'Loading…' : 'Load more decks'}</Button>}
        </View>
      ) : (
        <View className="gap-5">
          {localDecks.length > 0 ? (
            <View className="gap-3">
              <Label>Your saved decks</Label>
              {localDecks.map((deck, index) => {
                const key = deckKey(deck);
                const isPublished = publishedKeys.has(key);
                return (
                  <Surface key={`${key}-${index}`} className="gap-3 p-3">
                    <View className="flex-row items-center gap-3">
                      <Image source={deckArt[deck.cover]} style={{ width: 48, height: 48 }} resizeMode="contain" accessible={false} />
                      <View className="min-w-0 flex-1 gap-1">
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
          ) : <Body className="text-sm text-muted">Save a deck in Decks to publish it here.</Body>}
          {user && !user.isAnonymous && (
            <View className="gap-3">
              <Label>Published by you · {owned.length}/5</Label>
              {owned.map((item) => (
                <Surface key={item.id} className="flex-row items-center gap-3 p-3">
                  <Image source={deckArt[item.deck.cover]} style={{ width: 42, height: 42 }} resizeMode="contain" accessible={false} />
                  <View className="min-w-0 flex-1 gap-1">
                    <Body className="font-boldface">{item.deck.name}</Body>
                    <Body className="text-xs text-muted">Public</Body>
                  </View>
                  <Button tone="quiet" arrow={false} disabled={busyId !== null} onPress={() => void unpublish(item)}>
                    {busyId === item.id ? 'Removing…' : 'Unpublish'}
                  </Button>
                </Surface>
              ))}
              {owned.length >= 5 && <Body className="text-xs text-muted">Unpublish one before sharing another.</Body>}
            </View>
          )}
        </View>
      )}

      {!!pendingPublish && (
        <Surface className="gap-3 border border-lilac-strong p-4">
          <Title className="text-[23px] leading-7">Share this deck publicly?</Title>
          <Body className="text-sm">“{pendingPublish.deck.name}” and its prompts will be visible to anyone browsing Community. Your account identity will not be shown.</Body>
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
