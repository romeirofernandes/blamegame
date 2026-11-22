import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PanResponder, View, type PressableProps } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { HugeiconsIcon } from '@hugeicons/react-native';
import ArrowLeft01Icon from '@hugeicons/core-free-icons/ArrowLeft01Icon';
import ArrowRight01Icon from '@hugeicons/core-free-icons/ArrowRight01Icon';
import { cycleDeckIndex, type decks } from './decks';
import { useAppearance } from './appearance';
import { useReducedMotionPreference } from './beui/useReducedMotion';
import { Body, Label, PromptCard, Tap } from './ui';

type Deck = (typeof decks)[number];

const spring = { stiffness: 420, damping: 34, mass: 0.7 } as const;
const exitDistance = 520;

export function PromptDeckStack({
  deck,
  hero = false,
}: {
  deck: Deck;
  hero?: boolean;
}) {
  const { colors } = useAppearance();
  const reducedMotion = useReducedMotionPreference();
  const translateX = useSharedValue(0);
  const suppressSwipeClick = useRef(false);
  const [selection, setSelection] = useState({ deckId: deck.id, index: 0 });
  const index = selection.deckId === deck.id ? selection.index % deck.cards.length : 0;
  const card = deck.cards[index];
  const question = card.question.replace('{player}', 'Maya');

  useEffect(() => {
    if (selection.deckId !== deck.id) {
      setSelection({ deckId: deck.id, index: 0 });
      translateX.value = 0;
    }
  }, [deck.id, selection.deckId, translateX]);

  const completeSwipe = useCallback((direction: number) => {
    setSelection((current) => {
      const currentIndex = current.deckId === deck.id ? current.index : 0;
      return {
        deckId: deck.id,
        index: cycleDeckIndex(currentIndex, direction, deck.cards.length),
      };
    });
  }, [deck.cards.length, deck.id]);

  const cycle = useCallback((direction: number) => {
    if (reducedMotion) {
      completeSwipe(direction);
      translateX.value = 0;
      return;
    }

    translateX.value = withTiming(direction > 0 ? -exitDistance : exitDistance, { duration: 180 }, (finished) => {
      if (!finished) return;
      translateX.value = direction > 0 ? exitDistance : -exitDistance;
      translateX.value = withSpring(0, spring);
      runOnJS(completeSwipe)(direction);
    });
  }, [completeSwipe, reducedMotion, translateX]);

  const cardStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { rotate: `${interpolate(translateX.value, [-180, 180], [-7, 7], Extrapolation.CLAMP)}deg` },
    ],
  }));

  const panResponder = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponderCapture: (_event, gesture) =>
      Math.abs(gesture.dx) > 8 && Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.1,
    onMoveShouldSetPanResponder: (_event, gesture) =>
      Math.abs(gesture.dx) > 8 && Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.1,
    onPanResponderMove: (_event, gesture) => {
      if (!reducedMotion) translateX.value = gesture.dx;
    },
    onPanResponderRelease: (_event, gesture) => {
      if (Math.abs(gesture.dx) > 58 && Math.abs(gesture.dx) > Math.abs(gesture.dy)) {
        suppressSwipeClick.current = true;
        cycle(gesture.dx < 0 ? 1 : -1);
      } else if (!reducedMotion) {
        translateX.value = withSpring(0, spring);
      }
    },
    onPanResponderTerminate: () => {
      if (!reducedMotion) translateX.value = withSpring(0, spring);
    },
  }), [cycle, reducedMotion, translateX]);

  function handleKeyDown(event: Parameters<NonNullable<PressableProps['onKeyDown']>>[0]) {
    if (event.nativeEvent.key === 'ArrowLeft') {
      event.preventDefault();
      cycle(-1);
    } else if (event.nativeEvent.key === 'ArrowRight') {
      event.preventDefault();
      cycle(1);
    }
  }

  return (
    <View className={hero ? 'mt-2' : ''}>
      <View className="relative mx-1 pb-2">
        <View
          pointerEvents="none"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          className="absolute inset-x-3 bottom-0 top-4 -rotate-4 rounded-[25px] border"
          style={{ borderColor: colors.promptBorder, backgroundColor: colors.promptStack }}
        />
        <View
          pointerEvents="none"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          className="absolute inset-x-2 bottom-1 top-2 rotate-3 rounded-[25px]"
          style={{ backgroundColor: colors.promptStackAccent }}
        />
        <View {...panResponder.panHandlers} className="web:[touch-action:pan-y]">
          <Animated.View style={cardStyle}>
            <Tap
              label={`Prompt ${index + 1} of ${deck.cards.length}: ${question} Tap or swipe to browse.`}
              className="items-stretch p-0"
              onPress={() => {
                // React Native Web can emit a click after the horizontal drag.
                if (suppressSwipeClick.current) return;
                cycle(1);
              }}
              onPressIn={() => { suppressSwipeClick.current = false; }}
              onKeyDown={(event) => {
                suppressSwipeClick.current = false;
                handleKeyDown(event);
              }}
            >
              <PromptCard
                hero={hero}
                question={question}
                label={`From the ${deck.name} deck`}
                color={deck.color}
              />
            </Tap>
          </Animated.View>
        </View>
      </View>

      <View className="mt-2 flex-row items-center justify-between">
        <Tap
          label={`Previous prompt in ${deck.name}`}
          onPress={() => cycle(-1)}
          className="size-12 min-h-12 rounded-full border border-line bg-panel p-0"
        >
          <HugeiconsIcon icon={ArrowLeft01Icon} size={18} color={colors.cloud} strokeWidth={1.9} />
        </Tap>
        <View className="items-center gap-0.5">
          <Label>Prompt {index + 1} of {deck.cards.length}</Label>
          <Body className="text-xs leading-4 text-muted">Swipe or use the arrows</Body>
        </View>
        <Tap
          label={`Next prompt in ${deck.name}`}
          onPress={() => cycle(1)}
          className="size-12 min-h-12 rounded-full border border-line bg-panel p-0"
        >
          <HugeiconsIcon icon={ArrowRight01Icon} size={18} color={colors.cloud} strokeWidth={1.9} />
        </Tap>
      </View>
    </View>
  );
}
