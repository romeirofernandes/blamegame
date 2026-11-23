import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Share, Text, View, type ScrollViewInstance } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import * as Clipboard from 'expo-clipboard';
import * as Linking from 'expo-linking';
import GeistPixelSquare from '../assets/fonts/GeistPixel-Square.ttf';
import { SpaceGrotesk_700Bold } from '@expo-google-fonts/space-grotesk/700Bold';
import { DMSans_500Medium } from '@expo-google-fonts/dm-sans/500Medium';
import { DMSans_700Bold } from '@expo-google-fonts/dm-sans/700Bold';
import { HugeiconsIcon } from '@hugeicons/react-native';
import ArrowLeft01Icon from '@hugeicons/core-free-icons/ArrowLeft01Icon';
import ArrowUpRight01Icon from '@hugeicons/core-free-icons/ArrowUpRight01Icon';
import Copy01Icon from '@hugeicons/core-free-icons/Copy01Icon';
import UserGroupIcon from '@hugeicons/core-free-icons/UserGroupIcon';
import LogOutIcon from '@hugeicons/core-free-icons/LogOutIcon';
import { decks, getDeck } from './decks';
import { MIN_PLAYERS, MIN_ROUNDS, type Mode, type RoomView } from './game';
import { Body, Button, Field, GameSwitch, hapticSelect, Label, PresenceAvatar, Surface, Tap, Title } from './ui';
import { PromptDeckStack } from './PromptDeckStack';
import { useRoom, webOrigin } from './useRoom';
import { RoundScreen } from './RoundScreen';
import { DecksScreen, GameTabBar, SettingsScreen, type GameDestination } from './navigation';
import { AppearanceProvider, DoodleWallpaper, useAppearance } from './appearance';
import { BrandMark } from './BrandMark';
import { AuthProvider, useAuth } from './auth';
import { AccountScreen } from './AccountScreen';
import { PlayerAvatarOptions, usePlayerAvatar } from './PlayerAvatarOptions';
import { SoundEffectsProvider, useSoundEffects } from './soundEffects';
import { HowToPlayControls, HowToPlayScreen, howToPlaySlideCount } from './HowToPlayScreen';

type Page = 'home' | 'host' | 'join' | 'account' | 'guide';

export default function App() {
  const [loaded, error] = useFonts({ GeistPixelSquare, SpaceGrotesk_700Bold, DMSans_500Medium, DMSans_700Bold });
  return (
    <SafeAreaProvider>
      <AppearanceProvider>
        <SoundEffectsProvider>
          <AuthProvider>
            {loaded || error ? <GameApp /> : <View className="flex-1 bg-canvas" />}
          </AuthProvider>
        </SoundEffectsProvider>
      </AppearanceProvider>
    </SafeAreaProvider>
  );
}

function GameApp() {
  const { colors, theme } = useAppearance();
  const { user, loading, configured, signOut } = useAuth();
  const player = !loading && user && !user.isAnonymous ? user : null;
  const online = useRoom(player, !loading);
  const avatarOptions = usePlayerAvatar(player?.uid);
  const [page, setPage] = useState<Page>('home');
  const [guideIndex, setGuideIndex] = useState(0);
  const [destination, setDestination] = useState<GameDestination>('play');
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [deck, setDeck] = useState(decks[0].id);
  const [mode, setMode] = useState<Mode>('anonymous');
  const [allowSelfVote, setAllowSelfVote] = useState(false);
  const [roundCount, setRoundCount] = useState(10);
  const scrollRef = useRef<ScrollViewInstance>(null);
  const [signOutBusy, setSignOutBusy] = useState(false);
  const [signOutError, setSignOutError] = useState('');
  const needsSignIn = !player && (page === 'host' || page === 'join');
  const room = player ? online.room : null;
  const host = !!room && room.host === room.me;
  const showTabs = !room && !needsSignIn && page === 'home';
  const pickRounds = getDeck(deck)?.cards.some((card) => card.kind === 'pick');

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
    if (page === 'account' && !room) {
      setPage('home');
      setDestination('settings');
      return;
    }
    online.leave();
    navigate('home');
  }

  async function signOutFromSettings() {
    setSignOutError('');
    setSignOutBusy(true);
    try {
      await signOut();
    } catch {
      setSignOutError('Unable to sign out. Check your connection and try again.');
    } finally {
      setSignOutBusy(false);
    }
  }

  return (
    <SafeAreaView
      edges={showTabs ? ['top', 'left', 'right'] : undefined}
      className="flex-1 bg-canvas"
      style={{ flex: 1 }}
    >
      <StatusBar style={theme === 'dark' ? 'light' : 'dark'} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1">
        <View className="mx-auto w-full max-w-[480px] flex-1 bg-canvas web:border-x web:border-line/50">
          <DoodleWallpaper />
          <ScrollView
            ref={scrollRef}
            key={room ? `${room.code}:${room.phase}:${room.round}` : `${destination}:${page}`}
            keyboardShouldPersistTaps="handled"
            className="flex-1"
            showsVerticalScrollIndicator={false}
            contentContainerClassName={`grow shrink-0 px-6 pt-5 ${showTabs && destination === 'play' ? 'pb-2' : 'pb-8'}`}
          >
            <View className={`min-h-12 flex-row items-center justify-between gap-3 ${showTabs && destination === 'play' ? 'mb-5' : 'mb-7'}`}>
              {page !== 'home' || room || needsSignIn ? (
                <Tap label={room ? 'Leave game' : page === 'account' ? 'Back to settings' : needsSignIn ? 'Back' : 'Back to home'} onPress={goHome} disabled={!room && online.pending} className="w-12 border border-line bg-panel">
                  <View className="items-center">
                    <HugeiconsIcon icon={ArrowLeft01Icon} color={colors.cloud} size={22} strokeWidth={2} />
                  </View>
                </Tap>
              ) : <BrandMark color={colors.cloud} />}
              {room ? (
                <View className="flex-row items-center gap-2 rounded-full border border-line px-3 py-2">
                  <View className={`size-1.5 rounded-full ${online.connected ? 'bg-lime-strong' : 'bg-peach-fill'}`} />
                  <Label className="tracking-[1px]">{online.connected ? `Room ${room.code}` : 'Reconnecting'}</Label>
                </View>
              ) : showTabs && destination === 'play' ? (
                <View className="flex-row items-center gap-1.5 rounded-full border border-line px-3 py-2">
                  <HugeiconsIcon icon={UserGroupIcon} size={15} color={colors.muted} strokeWidth={1.8} />
                  <Label className="tracking-[0.7px]">3–12 players</Label>
                </View>
              ) : page !== 'home' ? <BrandMark color={colors.cloud} /> : null}
            </View>

            {!!online.error && destination === 'play' && (
              <Body accessibilityRole="alert" className="mb-4 rounded-xl border border-peach/40 bg-panel p-3 text-peach">{online.error}</Body>
            )}
            {room ? (
              room.phase === 'lobby'
                ? <Lobby room={room} host={host} disabled={!online.connected || online.pending} start={() => online.send({ type: 'start' })} />
                : <RoundScreen room={room} host={host} act={online.send} leave={goHome}
                    disabled={!online.connected || online.pending} />
            ) : needsSignIn ? (
              <AccountScreen forPlay onAuthenticated={() => navigate('home')} />
            ) : showTabs && destination === 'decks' ? (
              <DecksScreen onHost={(deckId) => { setDeck(deckId); navigate('host'); }} />
            ) : showTabs && destination === 'settings' ? (
              <SettingsScreen
                appearanceSlot={<AppearanceOptions />}
                avatarSlot={player ? (
                  <PlayerAvatarOptions
                    key={player.uid}
                    seed={avatarOptions.avatarSeed ?? player.uid}
                    avatar={avatarOptions.avatar}
                    hasPhoto={avatarOptions.hasPhoto}
                    avatarVariant={avatarOptions.avatarVariant}
                    mode={avatarOptions.mode}
                    ready={avatarOptions.ready}
                    update={avatarOptions.update}
                    selectGeneratedAvatar={avatarOptions.selectGeneratedAvatar}
                    useSavedPhoto={avatarOptions.useSavedPhoto}
                  />
                ) : undefined}
                accountSlot={
                  <View className="gap-3">
                    <Body className="text-muted">
                      {loading ? 'Restoring your account…' : user?.email ?? (user?.isAnonymous ? 'Signed in as a guest' : 'Sign in to play.')}
                    </Body>
                    {user && !user.isAnonymous ? (
                      <Tap
                        label="Sign out"
                        accessibilityState={{ busy: signOutBusy }}
                        onPress={() => void signOutFromSettings()}
                        disabled={loading || signOutBusy}
                      >
                        <View className="min-h-14 flex-row items-center justify-center gap-2 rounded-[18px] bg-peach-fill px-4 py-3">
                          <HugeiconsIcon icon={LogOutIcon} color={colors.ink} size={20} strokeWidth={1.9} />
                          <Text className="font-boldface text-base text-ink">
                            {signOutBusy ? 'Signing out…' : 'Sign out'}
                          </Text>
                        </View>
                      </Tap>
                    ) : (
                      <Button tone="secondary" onPress={() => setPage('account')} disabled={loading}>
                        {user?.isAnonymous ? 'Save guest account' : configured ? 'Sign in or create account' : 'Account setup'}
                      </Button>
                    )}
                    {signOutError ? (
                      <Body accessibilityRole="alert" className="text-sm text-peach">{signOutError}</Body>
                    ) : null}
                  </View>
                }
              />
            ) : page === 'account' ? (
              <AccountScreen onAuthenticated={() => navigate('home')} />
            ) : page === 'guide' ? (
              <HowToPlayScreen slideIndex={guideIndex} />
            ) : page === 'home' ? (
              <View className="grow justify-between">
                <View className="mb-5">
                  <Title className="text-[56px] leading-[1.1]">WHO, ME?</Title>
                  <Body className="mt-2 max-w-[300px] text-muted">Pick the friend who fits the prompt, then let the group explain itself.</Body>
                </View>
                <PromptDeckStack selectedDeckId={deck} onSelect={setDeck} />
                <View className="gap-2.5 pt-6">
                  <Button className="border border-ink" onPress={() => navigate('host')}>Host a game</Button>
                  <Button tone="secondary" onPress={() => navigate('join')} arrow={false}>Join with a code</Button>
                  <Tap label="How to play" onPress={() => { setGuideIndex(0); navigate('guide'); }} className="min-h-12 rounded-full">
                    <Text className="text-center font-boldface text-sm text-lilac-strong">How to play</Text>
                  </Tap>
                </View>
              </View>
            ) : (
              <View className="gap-6">
                <View>
                  <Title>{page === 'host' ? 'Host a game' : 'Join a game'}</Title>
                  <Body className="mt-2 text-muted">{page === 'host' ? 'Set the round count and what everyone sees at the reveal.' : 'Ask your host for the five-character room code.'}</Body>
                </View>
                {page === 'join' && (
                  <Field label="Room code" className="tracking-[4px]" value={code}
                    onChangeText={(value) => setCode(value.toUpperCase().replace(/[^A-HJ-NP-Z2-9]/g, ''))}
                    placeholder="ABCDE" autoCapitalize="characters" autoCorrect={false} maxLength={5} />
                )}
                <Field label="Your name" value={name} onChangeText={setName}
                  placeholder="e.g. Maya" autoCorrect={false} maxLength={24} />
                {page === 'host' && (
                  <>
                    <Surface className="flex-row items-center gap-3 rounded-[18px] border border-line bg-panel p-4">
                      <View className="flex-1 gap-1">
                        <Text className="font-boldface text-base text-cloud">{pickRounds ? 'Anonymous votes' : 'Anonymous answers'}</Text>
                        <Body className="text-sm leading-5 text-muted">
                          {pickRounds ? 'Hide who voted for whom at reveal.' : 'Hide who wrote each answer at reveal.'}
                        </Body>
                      </View>
                      <GameSwitch
                        accessibilityLabel={pickRounds ? 'Anonymous votes' : 'Anonymous answers'}
                        value={mode === 'anonymous'}
                        onValueChange={(anonymous) => { hapticSelect(); setMode(anonymous ? 'anonymous' : 'named'); }}
                      />
                    </Surface>
                    <Surface className="gap-3 rounded-[18px] border border-line bg-panel p-4">
                      <View className="flex-row items-center justify-between gap-3">
                        <View className="flex-1 gap-1">
                          <Text className="font-boldface text-base text-cloud">Rounds</Text>
                          <Body className="text-sm leading-5 text-muted">Prompts are drawn without repeats.</Body>
                        </View>
                        <View className="flex-row items-center gap-3">
                          <Tap
                            label="Fewer rounds"
                            disabled={roundCount <= MIN_ROUNDS}
                            onPress={() => setRoundCount((count) => Math.max(MIN_ROUNDS, count - 1))}
                            className="size-11 rounded-full border border-line bg-canvas"
                          >
                            <Text className="text-center font-boldface text-2xl text-cloud">−</Text>
                          </Tap>
                          <View className="min-w-12 items-center" accessibilityLiveRegion="polite">
                            <Text className="font-display text-2xl text-cloud">{roundCount}</Text>
                            <Label>rounds</Label>
                          </View>
                          <Tap
                            label="More rounds"
                            disabled={roundCount >= (getDeck(deck)?.cards.length ?? 1)}
                            onPress={() => setRoundCount((count) => Math.min(getDeck(deck)?.cards.length ?? count, count + 1))}
                            className="size-11 rounded-full border border-line bg-canvas"
                          >
                            <Text className="text-center font-boldface text-2xl text-cloud">+</Text>
                          </Tap>
                        </View>
                      </View>
                      <Label>Choose 1–{getDeck(deck)?.cards.length ?? 0} rounds</Label>
                    </Surface>
                    {pickRounds && (
                      <Surface className="flex-row items-center gap-3 rounded-[18px] border border-line bg-panel p-4">
                        <View className="flex-1 gap-1">
                          <Text className="font-boldface text-base text-cloud">Allow self-votes</Text>
                          <Body className="text-sm leading-5 text-muted">Let players pick themselves in voting rounds.</Body>
                        </View>
                        <GameSwitch
                          accessibilityLabel="Allow self-votes"
                          value={allowSelfVote}
                          onValueChange={(value) => { hapticSelect(); setAllowSelfVote(value); }}
                        />
                      </Surface>
                    )}
                  </>
                )}
                {!online.available && <Body className="text-muted">This build has no room server, so online rooms are unavailable.</Body>}
                <Button disabled={!online.ready || !avatarOptions.ready || !name.trim() || online.pending || (page === 'join' && code.length !== 5)}
                  onPress={() => online.send(page === 'host'
                    ? { type: 'create', name, deckId: deck, mode, allowSelfVote, avatar: avatarOptions.avatar, avatarSeed: avatarOptions.avatarSeed, avatarVariant: avatarOptions.avatarVariant, roundCount }
                    : { type: 'join', name, code, avatar: avatarOptions.avatar, avatarSeed: avatarOptions.avatarSeed, avatarVariant: avatarOptions.avatarVariant })}>
                  {online.pending ? 'Connecting…' : page === 'host' ? 'Create room' : 'Join room'}
                </Button>
              </View>
            )}
          </ScrollView>
          {page === 'guide' && !room && (
            <HowToPlayControls
              slideIndex={guideIndex}
              onMove={(offset) => {
                setGuideIndex((index) => Math.min(howToPlaySlideCount - 1, Math.max(0, index + offset)));
                scrollRef.current?.scrollTo({ y: 0, animated: false });
              }}
              onDone={() => navigate('home')}
            />
          )}
          {showTabs && <GameTabBar active={destination} onChange={setDestination} />}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}


function AppearanceOptions() {
  const { theme, setPreference } = useAppearance();
  const { enabled, setEnabled } = useSoundEffects();
  return (
    <View className="gap-1">
      <View className="min-h-14 flex-row items-center justify-between gap-4">
        <Text className="font-boldface text-base text-cloud">Dark mode</Text>
        <GameSwitch
          accessibilityLabel="Dark mode"
          value={theme === 'dark'}
          onValueChange={(enabled) => { hapticSelect(); setPreference(enabled ? 'dark' : 'light'); }}
        />
      </View>
      <View className="min-h-14 flex-row items-center justify-between gap-4">
        <Text className="font-boldface text-base text-cloud">Sound effects</Text>
        <GameSwitch
          accessibilityLabel="Sound effects"
          silent
          value={enabled}
          onValueChange={(value) => { hapticSelect(); setEnabled(value); }}
        />
      </View>
    </View>
  );
}

function Lobby({ room, host, disabled, start }: { room: RoomView; host: boolean; disabled: boolean; start: () => void }) {
  const { colors } = useAppearance();
  const deck = getDeck(room.deckId)!;
  const [feedback, setFeedback] = useState('');
  const onlineCount = room.players.filter((player) => player.online !== false).length;
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
        <Label className="mb-2 text-lilac-strong">{deck.name} · {room.mode} · {room.total} rounds</Label>
        <Title>The lobby</Title>
        <Body className="mt-2 text-muted">Send your friends the code or invite link.</Body>
      </View>
      <Surface className="gap-3 rounded-[24px] bg-lilac p-5">
        <Label className="text-ink">Room code</Label>
        <View className="flex-row items-center justify-between gap-2">
          <Text selectable className="shrink font-code text-[52px] leading-[1.1] tracking-[4px] text-ink">{room.code}</Text>
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
      </Surface>
      <View className="gap-2.5">
        <Label>{onlineCount} {onlineCount === 1 ? 'player' : 'players'} online</Label>
        {room.players.map((player) => (
          <Surface key={player.id} className="flex-row items-center gap-3 rounded-[16px] border border-line bg-panel p-3">
            <PresenceAvatar player={player} />
            <Body className="flex-1">{player.name}{player.id === room.me ? ' (you)' : ''}</Body>
            {player.online === false && <Label>Reconnecting</Label>}
            {player.id === room.host && <Label className="text-lime-strong">Host</Label>}
          </Surface>
        ))}
      </View>
      {host ? (
        <View className="gap-2">
          <Button onPress={start} disabled={disabled || onlineCount < MIN_PLAYERS}>Start game</Button>
          {onlineCount < MIN_PLAYERS && <Body className="text-center text-sm text-muted">You need at least 3 players online to start.</Body>}
        </View>
      ) : <Body className="text-center text-muted">Waiting for the host to start.</Body>}
    </View>
  );
}
