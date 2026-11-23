import { useEffect, useState } from 'react';
import { Platform, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { HugeiconsIcon } from '@hugeicons/react-native';
import { Check } from 'lucide-react-native';
import EyeIcon from '@hugeicons/core-free-icons/EyeIcon';
import LockKeyIcon from '@hugeicons/core-free-icons/LockKeyIcon';
import { RecapCard } from './RecapCard';
import { getDeck } from './decks';
import { useAppearance } from './appearance';
import type { Action, RoomView } from './game';
import { Body, Button, Field, hapticSelect, Label, PresenceAvatar, PromptCard, Surface, Tap, Title } from './ui';

export function RoundScreen({ room, host, act, leave, disabled }: {
  room: RoomView;
  host: boolean;
  act: (action: Action) => void;
  leave: () => void;
  disabled: boolean;
}) {
  const { colors } = useAppearance();
  const [choice, setChoice] = useState('');
  const [answer, setAnswer] = useState('');
  const [committing, setCommitting] = useState(false);
  const deck = room.customDeck ?? getDeck(room.deckId)!;
  const recapDeck = room.customDeck ? getDeck(room.customDeck.cover) : getDeck(room.deckId);
  const recapColor = recapDeck && 'color' in recapDeck ? recapDeck.color : '#c8adff';
  const card = room.card!;
  const offlineCount = room.players.filter((person) => person.online === false).length;

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
        <Title>Game recap</Title>
        <View className="gap-2">
          {room.recap?.map((item, index) => (
            <RecapCard key={index} room={room} item={item} index={index} deckName={deck.name} color={recapColor} />
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

      <PromptCard question={card.question} color={'color' in deck ? deck.color : undefined} label={card.kind === 'pick' ? 'Most likely to' : 'Spotlight round'} />

      {room.phase === 'reveal' ? (
        <View className="shrink-0 gap-5">
          <Reveal room={room} />
          {host
            ? <Button onPress={() => act({ type: 'next' })} disabled={disabled}>{room.round === room.total ? 'See recap' : 'Next round'}</Button>
            : <Body className="text-center text-muted">Waiting for the host to continue.</Body>}
        </View>
      ) : (
        <View className="gap-4">
          {room.hasSubmitted ? (
            <Surface className="gap-2 p-5">
              <Check size={28} color={colors.limeStrong} strokeWidth={2} />
              <Title className="text-[34px] leading-[36px]" accessibilityLiveRegion="polite">Locked in.</Title>
              <Body className="text-muted">Answers stay sealed until the reveal.</Body>
            </Surface>
          ) : (
            <>
              {card.kind === 'pick' ? (
                <View className="gap-2">
                  <Label>Pick one person</Label>
                  {room.players.filter((person) => room.allowSelfVote || person.id !== room.me).map((person) => (
                    <Tap key={person.id} label={`${person.name}${person.id === room.me ? ' (you)' : ''}${person.online === false ? ' (offline)' : ''}`} selected={choice === person.id} onPress={() => { hapticSelect(); setChoice(person.id); }} disabled={disabled}>
                      <View className={`flex-row items-center gap-3 rounded-[16px] border px-3 py-2.5 ${choice === person.id ? 'border-lime-strong bg-lime/15' : 'border-line bg-panel'}`}>
                        <PresenceAvatar player={person} />
                        <View className="flex-1">
                          <Body>{person.name}{person.id === room.me && person.name !== 'You' ? ' (you)' : ''}</Body>
                          {person.online === false && <Label className="text-peach">Offline</Label>}
                        </View>
                        {choice === person.id && <Check size={22} color={colors.limeStrong} />}
                      </View>
                    </Tap>
                  ))}
                </View>
              ) : (
                <View className="gap-2">
                  <Field
                    label="Your answer"
                    accessibilityLabel="Your answer"
                    value={answer}
                    onChangeText={setAnswer}
                    maxLength={120}
                    multiline
                    editable={!disabled}
                    placeholder="A short answer works best"
                    className="min-h-28 rounded-[18px] p-4 align-top leading-6"
                  />
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
              {offlineCount > 0 && ` · ${offlineCount} offline`}
            </Label>
            {host && (room.canReveal ?? room.submitted > 0) && (
              <Button tone={room.hasSubmitted ? 'primary' : 'secondary'} onPress={() => act({ type: 'reveal' })} disabled={disabled}>Reveal results</Button>
            )}
          </View>
        </View>
      )}
    </View>
  );
}

function Reveal({ room }: { room: RoomView }) {
  const player = (id: string) => room.players.find((person) => person.id === id)!;
  const { picks, answers } = room.result!;
  const leaders = picks.filter((pick) => pick.count === picks[0]?.count);

  return (
    <View className="shrink-0 gap-3">
      {!!picks.length && (
        <>
          <Label className="text-lime-strong">{leaders.length > 1 ? 'It’s a tie' : 'Most blamed'}</Label>
          <Title className="text-[43px] leading-[45px]">{leaders.map((pick) => player(pick.playerId).name).join(' & ')}</Title>
          <View className="gap-2">
            {picks.map((pick) => {
              const person = player(pick.playerId);
              return (
                <Surface key={pick.playerId} className="gap-2 p-3">
                  <View className="flex-row items-center gap-3">
                    <PresenceAvatar player={person} />
                    <View className="flex-1">
                      <Body>{person.name}</Body>
                      {person.online === false && <Label className="text-peach">Offline</Label>}
                    </View>
                    <Text className="font-boldface text-sm text-lilac-strong">{pick.count} {pick.count === 1 ? 'vote' : 'votes'}</Text>
                  </View>
                  <View className="h-1.5 overflow-hidden rounded-full bg-line">
                    <View className="h-full rounded-full bg-lilac" style={{ width: `${(pick.count / room.players.length) * 100}%` }} />
                  </View>
                  {pick.voters && <Body className="text-sm leading-5 text-muted">Picked by {pick.voters.map((id) => player(id).name).join(', ')}</Body>}
                </Surface>
              );
            })}
          </View>
        </>
      )}
      {!!answers.length && (
        <>
          <Label className="text-lime-strong">What the room said</Label>
          {answers.map((answer, index) => (
            <Surface key={index} className="gap-1 p-4">
              <Body>{answer.text}</Body>
              {!!answer.author && <Label className="tracking-[1px] text-lilac-strong">{player(answer.author).name}</Label>}
            </Surface>
          ))}
        </>
      )}
      {!picks.length && !answers.length && <Body className="text-muted">No responses this round.</Body>}
    </View>
  );
}
