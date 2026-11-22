import { useEffect, useState } from 'react';
import { Platform, Text, TextInput, View } from 'react-native';
import Animated, { Easing, FadeIn, FadeInDown, useReducedMotion } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { HugeiconsIcon } from '@hugeicons/react-native';
import CheckmarkCircle02Icon from '@hugeicons/core-free-icons/CheckmarkCircle02Icon';
import EyeIcon from '@hugeicons/core-free-icons/EyeIcon';
import LockKeyIcon from '@hugeicons/core-free-icons/LockKeyIcon';
import PartyIcon from '@hugeicons/core-free-icons/PartyIcon';
import { getDeck } from './decks';
import { useAppearance } from './appearance';
import type { Action, RoomView } from './game';
import { Avatar, Body, Button, hapticSelect, Label, PromptCard, Tap, Title } from './ui';

const easeOut = Easing.bezier(0.23, 1, 0.32, 1);
const revealIn = FadeInDown.duration(250).easing(easeOut).withInitialValues({ transform: [{ translateY: 8 }] });
const revealReduced = FadeIn.duration(140).easing(easeOut);

export function RoundScreen({ room, host, demo, act, leave, disabled }: {
  room: RoomView;
  host: boolean;
  demo: boolean;
  act: (action: Action) => void;
  leave: () => void;
  disabled: boolean;
}) {
  const { colors } = useAppearance();
  const [choice, setChoice] = useState('');
  const [answer, setAnswer] = useState('');
  const [committing, setCommitting] = useState(false);
  const deck = getDeck(room.deckId)!;
  const card = room.card!;
  const player = (id: string) => room.players.find((person) => person.id === id)!;

  useEffect(() => {
    if (!committing || !room.hasSubmitted) return;
    if (Platform.OS !== 'web') void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  }, [committing, room.hasSubmitted]);

  function submit(pass = false) {
    setCommitting(true);
    act({
      type: 'submit', round: room.round,
      submission: pass ? { kind: 'pass' } : { kind: card.kind, value: card.kind === 'pick' ? choice : answer },
    });
  }

  if (room.phase === 'recap') {
    return (
      <View className="gap-6">
        <View className="gap-2">
          <HugeiconsIcon icon={PartyIcon} color={colors.limeStrong} size={38} strokeWidth={1.8} />
          <Title>Case closed.</Title>
          <Body className="text-muted">{room.total} rounds of {deck.name} in the books.</Body>
        </View>
        <View className="gap-2">
          {room.recap?.map((item) => (
            <View key={item.question} className="gap-1 rounded-[18px] border border-line bg-panel p-4">
              <Body>{item.question}</Body>
              {item.leaders.length > 0 && <Label className="tracking-[1px] text-lilac-strong">{item.leaders.map((id) => player(id).name).join(' & ')}</Label>}
            </View>
          ))}
        </View>
        <Button onPress={leave}>Back to home</Button>
      </View>
    );
  }

  return (
    <View className="gap-5">
      <View className="gap-3">
        <View className="flex-row flex-wrap items-center justify-between gap-2">
          <Label className="tracking-[1px] text-lilac-strong">{deck.name} · Round {room.round}/{room.total}</Label>
          <View className="flex-row items-center gap-1.5">
            <HugeiconsIcon icon={room.mode === 'anonymous' ? LockKeyIcon : EyeIcon} color={colors.muted} size={15} />
            <Label className="tracking-[1px]">{room.mode}</Label>
          </View>
        </View>
        <View className="flex-row gap-1.5" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          {Array.from({ length: room.total }, (_, index) => (
            <View key={index} className={`h-1 flex-1 rounded-full ${index < room.round ? 'bg-lime' : 'bg-line'}`} />
          ))}
        </View>
      </View>

      <PromptCard question={card.question} color={deck.color} label={card.kind === 'pick' ? 'Most likely to' : 'Spotlight round'} />

      {room.phase === 'reveal' ? (
        <View className="gap-5">
          <Reveal room={room} />
          {host
            ? <Button onPress={() => act({ type: 'next' })} disabled={disabled}>{room.round === room.total ? 'See recap' : 'Next round'}</Button>
            : <Body className="text-center text-muted">Waiting for the host to continue.</Body>}
        </View>
      ) : (
        <View className="gap-4">
          {room.hasSubmitted ? (
            <View className="gap-2 rounded-[20px] border border-line bg-panel p-5">
              <HugeiconsIcon icon={CheckmarkCircle02Icon} size={28} color={colors.limeStrong} strokeWidth={2} />
              <Title className="text-[34px] leading-[36px]" accessibilityLiveRegion="polite">Locked in.</Title>
              <Body className="text-muted">{demo ? 'Your demo friends have answered, too.' : 'Answers stay sealed until the reveal.'}</Body>
            </View>
          ) : (
            <>
              {card.kind === 'pick' ? (
                <View className="gap-2">
                  <Label>Pick one person</Label>
                  {room.players.map((person) => (
                    <Tap key={person.id} label={person.id === room.me ? `${person.name} (you)` : person.name} selected={choice === person.id} onPress={() => { hapticSelect(); setChoice(person.id); }} disabled={disabled}>
                      <View className={`flex-row items-center gap-3 rounded-[16px] border px-3 py-2.5 ${choice === person.id ? 'border-lime-strong bg-lime/15' : 'border-line bg-panel'}`}>
                        <Avatar player={person} />
                        <Body className="flex-1">{person.name}{person.id === room.me && person.name !== 'You' ? ' (you)' : ''}</Body>
                        {choice === person.id && <HugeiconsIcon icon={CheckmarkCircle02Icon} size={22} color={colors.limeStrong} />}
                      </View>
                    </Tap>
                  ))}
                </View>
              ) : (
                <View className="gap-2">
                  <Label>Your answer</Label>
                  <TextInput accessibilityLabel="Your answer" value={answer} onChangeText={setAnswer} maxLength={120}
                    multiline editable={!disabled} placeholder="A short answer works best" placeholderTextColor={colors.muted}
                    className="min-h-28 rounded-[18px] border border-line bg-panel p-4 align-top font-body text-base leading-6 text-cloud" />
                  <Label className="text-right tracking-[0px]">{answer.length}/120</Label>
                </View>
              )}
              <View>
                <Button disabled={disabled || !(card.kind === 'pick' ? choice : answer.trim())} onPress={() => submit()}>
                  {card.kind === 'pick' ? 'Lock in vote' : 'Lock in answer'}
                </Button>
                <Button disabled={disabled} tone="quiet" arrow={false} onPress={() => submit(true)}>Pass this round</Button>
              </View>
            </>
          )}
          <View className="gap-2">
            <Label className="text-center tracking-[1px]" accessibilityLiveRegion="polite">
              {room.submitted} of {room.players.length} ready
            </Label>
            {host && room.submitted > 0 && (
              <Button tone={room.hasSubmitted ? 'primary' : 'secondary'} onPress={() => act({ type: 'reveal' })} disabled={disabled}>Reveal results</Button>
            )}
          </View>
        </View>
      )}
    </View>
  );
}

function Reveal({ room }: { room: RoomView }) {
  const reduced = useReducedMotion();
  const player = (id: string) => room.players.find((person) => person.id === id)!;
  const { picks, answers } = room.result!;
  const leaders = picks.filter((pick) => pick.count === picks[0]?.count);

  return (
    <Animated.View entering={reduced ? revealReduced : revealIn} className="gap-3">
      {!!picks.length && (
        <>
          <Label className="text-lime-strong">{leaders.length > 1 ? 'It’s a tie' : 'Most blamed'}</Label>
          <Title className="text-[43px] leading-[45px]">{leaders.map((pick) => player(pick.playerId).name).join(' & ')}</Title>
          <View className="gap-2">
            {picks.map((pick) => (
              <View key={pick.playerId} className="gap-2 rounded-[17px] border border-line bg-panel p-3">
                <View className="flex-row items-center gap-3">
                  <Avatar player={player(pick.playerId)} />
                  <Body className="flex-1">{player(pick.playerId).name}</Body>
                  <Text className="font-boldface text-sm text-lilac-strong">{pick.count} {pick.count === 1 ? 'vote' : 'votes'}</Text>
                </View>
                <View className="h-1.5 overflow-hidden rounded-full bg-line">
                  <View className="h-full rounded-full bg-lilac" style={{ width: `${(pick.count / room.players.length) * 100}%` }} />
                </View>
                {pick.voters && <Body className="text-sm leading-5 text-muted">Picked by {pick.voters.map((id) => player(id).name).join(', ')}</Body>}
              </View>
            ))}
          </View>
        </>
      )}
      {!!answers.length && (
        <>
          <Label className="text-lime-strong">What the room said</Label>
          {answers.map((answer, index) => (
            <View key={index} className="gap-1 rounded-[17px] border border-line bg-panel p-4">
              <Body>{answer.text}</Body>
              {!!answer.author && <Label className="tracking-[1px] text-lilac-strong">{player(answer.author).name}</Label>}
            </View>
          ))}
        </>
      )}
      {!picks.length && !answers.length && <Body className="text-muted">No responses this round.</Body>}
    </Animated.View>
  );
}
