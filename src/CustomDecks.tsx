import { useState } from 'react';
import { Image, View } from 'react-native';
import { CUSTOM_COVERS, MAX_CUSTOM_PROMPTS, MAX_CUSTOM_PROMPT_LENGTH, parseCustomDeck, type CustomDeck } from './customDeck';
import { deckArt } from './deckArt';
import { MAX_LOCAL_DECKS } from './useDeckLibrary';
import { Tabs, TabsList, TabsTrigger } from './beui/tabs';
import { Body, Button, Field, Label, Surface, Tap, Title } from './ui';

const coverOptions = Object.keys(CUSTOM_COVERS) as CustomDeck['cover'][];

export function CustomDecks({ saved, loaded, saveDecks, onHost }: {
  saved: CustomDeck[];
  loaded: boolean;
  saveDecks: (decks: CustomDeck[], baseDecks: CustomDeck[]) => Promise<void>;
  onHost: (deck: CustomDeck) => void;
}) {
  const [editing, setEditing] = useState<number | null>(null);
  const [name, setName] = useState('');
  const [cover, setCover] = useState<CustomDeck['cover']>('group-chat');
  const [kind, setKind] = useState<'pick' | 'write'>('pick');
  const [prompts, setPrompts] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  function edit(index: number) {
    const deck = saved[index];
    setName(deck?.name ?? '');
    setCover(deck?.cover ?? 'group-chat');
    setKind(deck?.cards[0].kind ?? 'pick');
    setPrompts(deck?.cards.map(({ question }) => question).join('\n') ?? '');
    setError('');
    setEditing(index);
  }

  async function persist(next: CustomDeck[]) {
    setBusy(true);
    setError('');
    try {
      await saveDecks(next, saved);
      setEditing(null);
    } catch {
      setError('Couldn’t update your decks. Try again.');
    } finally {
      setBusy(false);
    }
  }

  function save() {
    const questions = prompts.split(/\r?\n/).map((question) => question.trim()).filter(Boolean);
    const deck = parseCustomDeck({ name, cover, cards: questions.map((question) => ({ kind, question })) });
    if (!deck) {
      setError(`Give your deck a name and enter 1–${MAX_CUSTOM_PROMPTS} different prompts, up to ${MAX_CUSTOM_PROMPT_LENGTH} characters each.`);
      return;
    }
    const next = [...saved];
    next[editing!] = deck;
    void persist(next);
  }

  return (
    <Surface className="gap-4 p-4">
      {editing === null ? (
        <>
          <Title className="text-[28px] leading-8">Your decks</Title>
          <Body className="text-sm text-muted">Write prompts for your group. Decks are saved on this device.</Body>
          {saved.map((deck, index) => (
            <View key={index} className="gap-2 rounded-[16px] bg-canvas p-3">
              <View className="flex-row items-center gap-2">
                <Image source={deckArt[deck.cover]} style={{ width: 48, height: 48 }} resizeMode="contain" accessible={false} />
                <Body className="flex-1 font-boldface">{deck.name}</Body>
                <Button tone="quiet" arrow={false} label={`Edit ${deck.name}`} onPress={() => edit(index)}>Edit</Button>
              </View>
              <Button onPress={() => onHost(deck)} label={`Host with ${deck.name}`}>Host with deck</Button>
            </View>
          ))}
          <Button tone="secondary" disabled={!loaded || saved.length >= MAX_LOCAL_DECKS} onPress={() => edit(saved.length)}>Create a deck</Button>
          {saved.length >= MAX_LOCAL_DECKS && <Body className="text-sm text-muted">You can save up to {MAX_LOCAL_DECKS} decks on this device.</Body>}
        </>
      ) : (
        <>
          <Title className="text-[28px] leading-8">{editing < saved.length ? 'Edit deck' : 'Create a deck'}</Title>
          <Field label="Deck name" value={name} onChangeText={setName} maxLength={40} placeholder="e.g. The usual suspects" />
          <Tabs value={kind} values={['pick', 'write']} onValueChange={(value) => setKind(value === 'write' ? 'write' : 'pick')}>
            <TabsList accessibilityLabel="Prompt type">
              <TabsTrigger value="pick">Vote for someone</TabsTrigger>
              <TabsTrigger value="write">Write answers</TabsTrigger>
            </TabsList>
          </Tabs>
          <Field label="Prompts · one per line" multiline value={prompts} onChangeText={setPrompts}
            maxLength={MAX_CUSTOM_PROMPTS * (MAX_CUSTOM_PROMPT_LENGTH + 1)}
            style={{ minHeight: 112 }}
            placeholder={kind === 'pick' ? 'Who would accidentally start a group tradition?' : 'What should our group’s fake band be called?'} />
          <Label>Cover art</Label>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {coverOptions.map((option) => (
              <Tap key={option} label={CUSTOM_COVERS[option]} selected={option === cover} onPress={() => setCover(option)}
                className={`items-center border ${option === cover ? 'border-lime-strong bg-lime/40' : 'border-line'}`}
                style={{ width: 62, height: 62 }}>
                <Image source={deckArt[option]} resizeMode="contain" style={{ width: 46, height: 46 }} accessible={false} />
              </Tap>
            ))}
          </View>
          <Button disabled={busy} onPress={save}>Save deck</Button>
          <View className="flex-row justify-between">
            <Button disabled={busy} tone="quiet" arrow={false} onPress={() => { setEditing(null); setError(''); }}>Cancel</Button>
            {editing < saved.length && <Button disabled={busy} tone="quiet" arrow={false} onPress={() => void persist(saved.filter((_, index) => index !== editing))}>Delete deck</Button>}
          </View>
        </>
      )}
      {!!error && <Body accessibilityRole="alert" className="text-sm text-peach">{error}</Body>}
    </Surface>
  );
}
