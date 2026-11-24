import { Text, View } from 'react-native';
import { decks, type Card } from './decks';
import { Body, Button, Label, PromptCard, Surface, Tap, Title } from './ui';

const sampleDeck = decks[0];
const pickPrompt = sampleDeck.cards.find((card) => card.kind === 'pick')!;
const writePrompt = decks.map((deck) => deck.cards as Card[]).flat().find((card) => card.kind === 'write');

function Callout({ children }: { children: string }) {
  return (
    <View className="ml-3 self-start pt-1.5">
      <View className="rounded-[14px] border border-lilac-strong/60 bg-prompt-stack px-3 py-2.5">
        <Body className="text-sm leading-5">{children}</Body>
      </View>
      <View
        aria-hidden
        className="absolute left-4 top-[1px] size-2.5 rotate-45 border-l border-t border-lilac-strong/60 bg-prompt-stack"
      />
    </View>
  );
}

function DeckAndRoomMock() {
  return (
    <View className="gap-3 rounded-[24px] border border-line bg-canvas p-4">
      <Label className="text-lilac-strong">PICK A DECK</Label>
      <Surface className="gap-1 rounded-[16px] border border-lilac/60 bg-panel p-3">
        <Label>{sampleDeck.label}</Label>
        <Text className="font-display text-xl text-cloud">{sampleDeck.name}</Text>
        <Body className="text-sm text-muted">{sampleDeck.description}</Body>
      </Surface>
      <Callout>Pick a deck that fits your group. Everyone in the room plays from the same deck.</Callout>
      <View className="gap-2">
        <View className="min-h-11 items-center justify-center rounded-[14px] border border-ink bg-lime px-3">
          <Text className="font-boldface text-sm text-ink">Host a game</Text>
        </View>
        <View className="min-h-11 items-center justify-center rounded-[14px] border border-line bg-panel px-3">
          <Text className="font-boldface text-sm text-cloud">Join with a code</Text>
        </View>
      </View>
      <Callout>The host shares a room code or invite link. Once at least 3 players join, the host can start.</Callout>
    </View>
  );
}

function AnswerMock() {
  return (
    <View className="gap-3">
      <PromptCard question={pickPrompt.question} label="Most likely to" color={sampleDeck.color} />
      <View className="gap-2">
        {['Maya', 'Jules', 'Sam'].map((name, index) => (
          <Surface key={name} className={`rounded-[14px] border px-3 py-2.5 ${index === 1 ? 'border-ink bg-lime' : 'border-line bg-panel'}`}>
            <Body className={index === 1 ? 'text-ink' : undefined}>{name}{index === 1 ? '  ✓' : ''}</Body>
          </Surface>
        ))}
      </View>
      <View className="min-h-11 items-center justify-center rounded-[14px] border border-ink bg-lime px-3">
        <Text className="font-boldface text-sm text-ink">Lock in vote</Text>
      </View>
      <Callout>For “Most likely to” prompts, pick one person and lock in your vote.</Callout>
      {writePrompt && (
        <View className="gap-0">
          <Surface className="gap-2 rounded-[16px] border border-line bg-panel p-3">
            <Label>RIGHT ANSWERS · YOUR ANSWER</Label>
            <Body className="rounded-[12px] border border-line bg-canvas p-3 text-muted">A short answer works best</Body>
            <Label>Voting starts when the answers are in</Label>
          </Surface>
          <Callout>In Right Answers, everyone writes a short answer, then votes for a favorite from the anonymous options.</Callout>
        </View>
      )}
    </View>
  );
}

function RevealMock() {
  return (
    <View className="gap-3 rounded-[24px] border border-line bg-canvas p-4">
      <Label className="text-cloud">MOST BLAMED</Label>
      <Title className="text-[36px] leading-[40px]">Jules</Title>
      <Surface className="gap-2 rounded-[16px] border border-line bg-panel p-3">
        <View className="flex-row items-center justify-between gap-3">
          <Body>Jules</Body>
          <Label className="text-lilac-strong">3 votes</Label>
        </View>
        <View className="h-1.5 rounded-full bg-lilac" />
      </Surface>
      <Callout>Results appear when everyone locks in. Right Answers also reveals who wrote and voted for each answer.</Callout>
      <View className="min-h-11 items-center justify-center rounded-[14px] border border-ink bg-lime px-3">
        <Text className="font-boldface text-sm text-ink">Next round</Text>
      </View>
      <Callout>The host starts the next round. After the last one, the group gets a recap of the leading picks.</Callout>
    </View>
  );
}

const slides = [
  {
    title: 'Get everyone in the room',
    description: 'Choose a deck, then host a room or join one with a code.',
    mock: <DeckAndRoomMock />,
  },
  {
    title: 'Vote or write an answer',
    description: 'A new prompt appears each round. Everyone answers privately.',
    mock: <AnswerMock />,
  },
  {
    title: 'Reveal, then keep going',
    description: 'See what the room decided, then move on together.',
    mock: <RevealMock />,
  },
];

export const howToPlaySlideCount = slides.length;

export function HowToPlayScreen({ slideIndex }: { slideIndex: number }) {
  const slide = slides[slideIndex];

  return (
    <View className="gap-5">
      <View className="gap-2">
        <Label className="text-cloud">HOW TO PLAY · {slideIndex + 1} OF {slides.length}</Label>
        <Title className="text-[38px] leading-display">{slide.title}</Title>
        <Body className="text-muted">{slide.description}</Body>
      </View>
      <View accessibilityLiveRegion="polite">{slide.mock}</View>
    </View>
  );
}

export function HowToPlayControls({ slideIndex, onMove, onDone }: {
  slideIndex: number;
  onMove: (offset: number) => void;
  onDone: () => void;
}) {
  const lastSlide = slideIndex === slides.length - 1;
  return (
    <View className="flex-row items-center justify-between gap-3 border-t border-line bg-canvas px-6 py-3">
      <Tap
        label="Previous slide"
        onPress={() => onMove(-1)}
        disabled={slideIndex === 0}
        className={`min-h-12 rounded-full border border-line bg-panel px-4 ${slideIndex === 0 ? 'opacity-45' : ''}`}
      >
        <Text className="font-boldface text-sm text-cloud">Previous</Text>
      </Tap>
      {lastSlide ? (
        <Button onPress={onDone} label="Done with how to play">Done</Button>
      ) : (
        <Button onPress={() => onMove(1)} label="Next slide">Next</Button>
      )}
    </View>
  );
}
