import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Share, Text, TextInput, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import * as Clipboard from 'expo-clipboard';
import * as Linking from 'expo-linking';
import { BarlowCondensed_900Black } from '@expo-google-fonts/barlow-condensed/900Black';
import { DMSans_500Medium } from '@expo-google-fonts/dm-sans/500Medium';
import { DMSans_700Bold } from '@expo-google-fonts/dm-sans/700Bold';
import { HugeiconsIcon } from '@hugeicons/react-native';
import ArrowLeft01Icon from '@hugeicons/core-free-icons/ArrowLeft01Icon';
import ArrowUpRight01Icon from '@hugeicons/core-free-icons/ArrowUpRight01Icon';
import CheckmarkCircle02Icon from '@hugeicons/core-free-icons/CheckmarkCircle02Icon';
import Copy01Icon from '@hugeicons/core-free-icons/Copy01Icon';
import EyeIcon from '@hugeicons/core-free-icons/EyeIcon';
import FlashIcon from '@hugeicons/core-free-icons/FlashIcon';
import LockKeyIcon from '@hugeicons/core-free-icons/LockKeyIcon';
import Message01Icon from '@hugeicons/core-free-icons/Message01Icon';
import PlayIcon from '@hugeicons/core-free-icons/PlayIcon';
import UserGroupIcon from '@hugeicons/core-free-icons/UserGroupIcon';
import VoteIcon from '@hugeicons/core-free-icons/VoteIcon';
import PencilEdit01Icon from '@hugeicons/core-free-icons/PencilEdit01Icon';
import { decks, getDeck } from './decks';
import { DEMO_PLAYER, demoAction, newDemo } from './demo';
import { MIN_PLAYERS, viewRoom, type Action, type Mode, type Room, type RoomView } from './game';
import { Avatar, Body, Button, hapticSelect, Label, PromptCard, Tap, Title } from './ui';
import { useRoom, webOrigin } from './useRoom';
import { RoundScreen } from './RoundScreen';
import { DecksScreen, GameTabBar, SettingsScreen, type GameDestination } from './navigation';
import { AppearanceProvider, DoodleWallpaper, useAppearance } from './appearance';
import { BrandMark } from './BrandMark';
import { AuthProvider, useAuth } from './auth';
import { AccountScreen } from './AccountScreen';

type Page = 'home' | 'host' | 'join' | 'account';
const inputStyle = 'min-h-14 rounded-[16px] border border-line bg-panel px-4 py-3 font-body text-base text-cloud';

export default function App() {
  const [loaded, error] = useFonts({ BarlowCondensed_900Black, DMSans_500Medium, DMSans_700Bold });
  return (
    <SafeAreaProvider>
      <AppearanceProvider>
        <AuthProvider>
          {loaded || error ? <GameApp /> : <View className="flex-1 bg-canvas" />}
        </AuthProvider>
      </AppearanceProvider>
    </SafeAreaProvider>
  );
}

function GameApp() {
  const { colors, theme } = useAppearance();
  const { user, loading, configured } = useAuth();
  const online = useRoom(user, !loading);
  const [page, setPage] = useState<Page>('home');
  const [destination, setDestination] = useState<GameDestination>('play');
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [deck, setDeck] = useState(decks[0].id);
  const [mode, setMode] = useState<Mode>('anonymous');
  const [demo, setDemo] = useState<Room | null>(null);
  const room = demo ? viewRoom(demo, DEMO_PLAYER) : online.room;
  const host = !!room && room.host === room.me;
  const showTabs = !room && page === 'home';

  useEffect(() => {
    function acceptInvite(url: string) {
      const code = Linking.parse(url).queryParams?.room;
      if (typeof code !== 'string' || !/^[a-hj-np-z2-9]{5}$/i.test(code)) return;
      setCode(code.toUpperCase());
      setDestination('play');
      setPage('join');
    }
    void Linking.getInitialURL().then((url) => { if (url) acceptInvite(url); }).catch(() => {});
    const subscription = Linking.addEventListener('url', ({ url }) => acceptInvite(url));
    return () => subscription.remove();
  }, []);

  function navigate(next: Page) {
    online.clearError();
    setDestination('play');
    setPage(next);
  }

  function goHome() {
    if (demo) {
      setDemo(null);
      return;
    }
    if (page === 'account' && !room) {
      setPage('home');
      setDestination('settings');
      return;
    }
    online.leave();
    navigate('home');
  }

  function startDemo(deckId = decks[0].id) {
    online.clearError();
    setDemo(newDemo(deckId));
  }

  function act(action: Action) {
    if (demo) setDemo(demoAction(demo, action));
    else online.send(action);
  }

  return (
    <SafeAreaView edges={showTabs ? ['top', 'left', 'right'] : undefined} className="flex-1 bg-canvas">
      <StatusBar style={theme === 'dark' ? 'light' : 'dark'} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1">
        <View className="mx-auto w-full max-w-[480px] flex-1 bg-canvas web:border-x web:border-line/50">
          <DoodleWallpaper />
          <ScrollView
            key={room ? `${room.code}:${room.phase}:${room.round}` : `${destination}:${page}`}
            keyboardShouldPersistTaps="handled"
            className="flex-1"
            showsVerticalScrollIndicator={false}
            contentContainerClassName="grow px-6 pb-8 pt-5"
          >
            <View className="mb-7 min-h-12 flex-row items-center justify-between gap-3">
              {page !== 'home' || room ? (
                <Tap label={room ? 'Leave game' : page === 'account' ? 'Back to settings' : 'Back to home'} onPress={goHome} disabled={!room && online.pending} className="w-12 bg-panel">
                  <View className="items-center">
                    <HugeiconsIcon icon={ArrowLeft01Icon} color={colors.cloud} size={22} strokeWidth={2} />
                  </View>
                </Tap>
              ) : <BrandMark color={colors.cloud} />}
              {room ? (
                <View className="flex-row items-center gap-2 rounded-full border border-line px-3 py-2">
                  <View className={`size-1.5 rounded-full ${demo || online.connected ? 'bg-lime-strong' : 'bg-peach-fill'}`} />
                  <Label className="tracking-[1px]">{demo ? 'Solo demo' : online.connected ? `Room ${room.code}` : 'Reconnecting'}</Label>
                </View>
              ) : showTabs && destination === 'play' ? (
                <View className="flex-row items-center gap-1.5 rounded-full border border-line px-3 py-2">
                  <HugeiconsIcon icon={UserGroupIcon} size={15} color={colors.muted} strokeWidth={1.8} />
                  <Label className="tracking-[0.7px]">3–12 players</Label>
                </View>
              ) : page !== 'home' ? <BrandMark color={colors.cloud} /> : null}
            </View>

            {!!online.error && !demo && destination === 'play' && (
              <Body accessibilityRole="alert" className="mb-4 rounded-xl border border-peach/40 bg-panel p-3 text-peach">{online.error}</Body>
            )}
            {room ? (
              room.phase === 'lobby'
                ? <Lobby room={room} host={host} disabled={!online.connected || online.pending} start={() => act({ type: 'start' })} />
                : <RoundScreen room={room} host={host} demo={!!demo} act={act} leave={goHome}
                    disabled={!demo && (!online.connected || online.pending)} />
            ) : showTabs && destination === 'decks' ? (
              <DecksScreen onTry={startDemo} onHost={(deckId) => { setDeck(deckId); navigate('host'); }} />
            ) : showTabs && destination === 'settings' ? (
              <SettingsScreen
                appearanceSlot={<AppearanceOptions />}
                accountSlot={
                  <View className="gap-3 rounded-[18px] border border-line bg-panel p-4">
                    <Body className="text-muted">
                      {loading ? 'Restoring your account…' : user?.email ?? (user?.isAnonymous ? 'Signed in as a guest' : 'Play with a nickname or sign in with an email address.')}
                    </Body>
                    <Button tone="secondary" onPress={() => setPage('account')} disabled={loading}>
                      {user ? 'Manage account' : configured ? 'Sign in or create account' : 'Account setup'}
                    </Button>
                  </View>
                }
              />
            ) : page === 'account' ? (
              <AccountScreen />
            ) : page === 'home' ? (
              <View className="grow">
                <View className="mb-7">
                  <Title className="text-[76px] leading-[71px]">WHO, ME?</Title>
                  <Body className="mt-2 max-w-[285px] text-muted">The party game where everyone in the group chat is a suspect.</Body>
                </View>
                <PromptCard hero label="From the Group Chat deck" question={decks[0].cards[0].question} />
                <View className="mb-6 mt-7 flex-row items-center justify-center gap-3">
                  <Label className="tracking-[1px]">Pick a friend</Label>
                  <View className="size-1 rounded-full bg-lilac" />
                  <Label className="tracking-[1px]">See who got blamed</Label>
                </View>
                <View className="gap-2.5">
                  <Button onPress={() => navigate('host')}>Host a game</Button>
                  <Button tone="secondary" onPress={() => navigate('join')} arrow={false}>Join with a code</Button>
                  <Tap onPress={() => startDemo()}>
                    <View className="flex-row items-center justify-center gap-2">
                      <HugeiconsIcon icon={PlayIcon} size={16} color={colors.lilacStrong} strokeWidth={2} />
                      <Text className="font-boldface text-sm text-lilac-strong">Try a solo demo</Text>
                    </View>
                  </Tap>
                </View>
              </View>
            ) : (
              <View className="gap-6">
                <View>
                  <Title>{page === 'host' ? 'Host a game' : 'Join a game'}</Title>
                  <Body className="mt-2 text-muted">{page === 'host' ? 'Pick the mood for your group.' : 'Ask your host for the five-character room code.'}</Body>
                </View>
                {page === 'join' && (
                  <View className="gap-2">
                    <Label>Room code</Label>
                    <TextInput accessibilityLabel="Room code" className={`${inputStyle} tracking-[4px]`} value={code}
                      onChangeText={(value) => setCode(value.toUpperCase().replace(/[^A-HJ-NP-Z2-9]/g, ''))}
                      placeholder="ABCDE" placeholderTextColor={colors.muted} autoCapitalize="characters" autoCorrect={false} maxLength={5} />
                  </View>
                )}
                <View className="gap-2">
                  <Label>Your name</Label>
                  <TextInput accessibilityLabel="Your name" className={inputStyle} value={name} onChangeText={setName}
                    placeholder="e.g. Maya" placeholderTextColor={colors.muted} autoCorrect={false} maxLength={24} />
                </View>
                {page === 'host' && (
                  <>
                    <View className="gap-2">
                      <Label>Question deck</Label>
                      {decks.map((item, index) => {
                        const active = item.id === deck;
                        const icon = [Message01Icon, FlashIcon, VoteIcon, PencilEdit01Icon][index];
                        return (
                          <Tap key={item.id} selected={active} onPress={() => { hapticSelect(); setDeck(item.id); }}>
                            <View className={`flex-row items-center gap-3 rounded-[18px] border p-3 ${active ? 'border-lilac-strong bg-prompt-stack' : 'border-line bg-panel'}`}>
                              <View className="size-10 items-center justify-center rounded-[13px]" style={{ backgroundColor: item.color }}>
                                <HugeiconsIcon icon={icon} color={colors.ink} size={22} strokeWidth={1.9} />
                              </View>
                              <View className="flex-1">
                                <Text className="font-boldface text-base text-cloud">{item.name}</Text>
                                <Body className="text-sm leading-5 text-muted">{item.description}</Body>
                              </View>
                              {active && <HugeiconsIcon icon={CheckmarkCircle02Icon} size={20} color={colors.lilacStrong} />}
                            </View>
                          </Tap>
                        );
                      })}
                    </View>
                    <View className="gap-2">
                      <Label>Vote visibility</Label>
                      <View className="flex-row gap-2">
                        {(['anonymous', 'named'] as const).map((item) => (
                          <Tap key={item} className="flex-1" selected={mode === item} onPress={() => { hapticSelect(); setMode(item); }}>
                            <View className={`min-h-12 flex-row flex-wrap items-center justify-center gap-2 rounded-[14px] border px-2 py-2 ${mode === item ? 'border-lime-strong bg-lime/15' : 'border-line bg-panel'}`}>
                              <HugeiconsIcon icon={item === 'anonymous' ? LockKeyIcon : EyeIcon} color={mode === item ? colors.limeStrong : colors.muted} size={17} />
                              <Text className={`font-boldface text-sm ${mode === item ? 'text-lime-strong' : 'text-muted'}`}>{item === 'anonymous' ? 'Anonymous' : 'Named'}</Text>
                            </View>
                          </Tap>
                        ))}
                      </View>
                      <Body className="text-sm leading-5 text-muted">
                        {mode === 'anonymous' ? 'Everyone sees the results. Voter names stay hidden.' : 'Everyone sees who voted for whom at the reveal.'}
                      </Body>
                    </View>
                  </>
                )}
                <Button disabled={!name.trim() || online.pending || (page === 'join' && code.length !== 5)}
                  onPress={() => online.send(page === 'host' ? { type: 'create', name, deckId: deck, mode } :
                    { type: 'join', name, code })}>
                  {online.pending ? 'Connecting…' : page === 'host' ? 'Create room' : 'Join room'}
                </Button>
              </View>
            )}
          </ScrollView>
          {showTabs && <GameTabBar active={destination} onChange={setDestination} />}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}


function AppearanceOptions() {
  const { preference, setPreference } = useAppearance();
  return (
    <View className="flex-row flex-wrap gap-2">
      {(['system', 'light', 'dark'] as const).map((item) => (
        <Tap
          key={item}
          label={item === 'system' ? 'System' : item === 'light' ? 'Light' : 'Dark'}
          className="min-w-[76px] flex-1"
          selected={preference === item}
          onPress={() => { hapticSelect(); setPreference(item); }}
        >
          <View className={`min-h-12 items-center justify-center rounded-[16px] border px-2 py-2 ${preference === item ? 'border-lilac-strong bg-prompt-stack' : 'border-line bg-panel'}`}>
            <Text className="text-center font-boldface text-sm capitalize text-cloud">{item}</Text>
          </View>
        </Tap>
      ))}
    </View>
  );
}

function Lobby({ room, host, disabled, start }: { room: RoomView; host: boolean; disabled: boolean; start: () => void }) {
  const { colors } = useAppearance();
  const deck = getDeck(room.deckId)!;
  const [feedback, setFeedback] = useState('');
  const link = webOrigin() ? `${webOrigin()}/?room=${room.code}` : `blamegame://join?room=${room.code}`;

  async function invite(copy: boolean) {
    const message = `Join my Blame Game room ${room.code}: ${link}`;
    try {
      if (copy) {
        if (!await Clipboard.setStringAsync(room.code)) throw new Error('Copy unavailable');
        setFeedback('Room code copied.');
      } else if (Platform.OS !== 'web') {
        await Share.share({ message });
      } else if (typeof navigator.share === 'function') {
        await navigator.share({ title: 'Blame Game', text: `Join room ${room.code}`, url: link });
      } else {
        if (!await Clipboard.setStringAsync(link)) throw new Error('Copy unavailable');
        setFeedback('Invite link copied.');
      }
    } catch (cause) {
      if (cause instanceof Error && cause.name === 'AbortError') return;
      setFeedback(`Share this room code with friends: ${room.code}`);
    }
  }

  return (
    <View className="gap-6">
      <View>
        <Label className="mb-2 text-lilac-strong">{deck.name} · {room.mode} votes</Label>
        <Title>The lobby</Title>
        <Body className="mt-2 text-muted">Send your friends the code or invite link.</Body>
      </View>
      <View className="gap-3 rounded-[24px] bg-lilac p-5">
        <Label className="text-ink">Room code</Label>
        <View className="flex-row items-center justify-between gap-2">
          <Text selectable className="shrink font-display text-[64px] leading-[63px] tracking-[4px] text-ink">{room.code}</Text>
          <Tap label="Copy room code" onPress={() => void invite(true)} className="w-12 bg-ink">
            <View className="items-center"><HugeiconsIcon icon={Copy01Icon} size={22} color={colors.lilac} /></View>
          </Tap>
        </View>
        <Tap onPress={() => void invite(false)}>
          <View className="min-h-12 flex-row items-center justify-center gap-2 rounded-[14px] border border-ink/60">
            <Text className="font-boldface text-sm text-ink">Share invite</Text>
            <HugeiconsIcon icon={ArrowUpRight01Icon} size={18} color={colors.ink} />
          </View>
        </Tap>
        {!!feedback && <Body accessibilityLiveRegion="polite" className="text-sm leading-5 text-ink">{feedback}</Body>}
      </View>
      <View className="gap-2.5">
        <Label>{room.players.length} {room.players.length === 1 ? 'player' : 'players'} in the room</Label>
        {room.players.map((player) => (
          <View key={player.id} className="flex-row items-center gap-3 rounded-[16px] border border-line bg-panel p-3">
            <Avatar player={player} />
            <Body className="flex-1">{player.name}{player.id === room.me ? ' (you)' : ''}</Body>
            {player.id === room.host && <Label className="text-lime-strong">Host</Label>}
          </View>
        ))}
      </View>
      {host ? (
        <View className="gap-2">
          <Button onPress={start} disabled={disabled || room.players.length < MIN_PLAYERS}>Start game</Button>
          {room.players.length < MIN_PLAYERS && <Body className="text-center text-sm text-muted">You need at least 3 players to start.</Body>}
        </View>
      ) : <Body className="text-center text-muted">Waiting for the host to start.</Body>}
    </View>
  );
}
