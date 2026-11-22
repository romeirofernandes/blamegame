import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Image, PanResponder, Text, View, type PressableProps } from 'react-native';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { decks } from './decks';
import { deckArt } from './deckArt';
import { useReducedMotionPreference } from './beui/useReducedMotion';
import { Body, Tap } from './ui';

type Deck = (typeof decks)[number];
const spring = { stiffness: 420, damping: 34, mass: 0.7 } as const;

function orderFromDeck(order: string[], deckId: string) {
  const index = order.indexOf(deckId);
  return index > 0 ? [...order.slice(index), ...order.slice(0, index)] : order;
}

function DeckFace({ deck }: { deck: Deck }) {
  return (
    <View className="flex-1 justify-between overflow-hidden rounded-[25px] border border-ink/15 p-5" style={{ backgroundColor: deck.color }}>
      <View className="flex-row items-start justify-between gap-3">
        <View className="rounded-full border border-ink/50 px-3 py-1.5">
          <Text className="font-boldface text-[11px] tracking-[1.4px] text-ink">{deck.label}</Text>
        </View>
      </View>
      <Image
        source={deckArt[deck.id]}
        accessible={false}
        accessibilityElementsHidden
        importantForAccessibility="no"
        pointerEvents="none"
        resizeMode="contain"
        style={{ position: 'absolute', right: 16, top: 48, width: 104, height: 104 }}
      />
      <View className="max-w-[60%] gap-2">
        <Text accessibilityRole="header" className="font-display text-[34px] leading-[38px] tracking-[-1px] text-ink">
          {deck.name}
        </Text>
        <Body className="max-w-[250px] text-sm leading-5 text-ink/75">{deck.description}</Body>
      </View>
    </View>
  );
}

export function PromptDeckStack({ selectedDeckId, onSelect }: { selectedDeckId: string; onSelect: (deckId: string) => void }) {
  const reducedMotion = useReducedMotionPreference();
  const translateX = useSharedValue(0);
  const tuckX = useSharedValue(0);
  const isLeaving = useRef(false);
  const suppressSwipeClick = useRef(false);
  const [order, setOrder] = useState(() => {
    const selectedIndex = decks.findIndex((deck) => deck.id === selectedDeckId);
    return selectedIndex > 0 ? [...decks.slice(selectedIndex), ...decks.slice(0, selectedIndex)].map(({ id }) => id) : decks.map(({ id }) => id);
  });
  // Make the externally selected deck authoritative during render. The layout
  // effect below persists this order, but the selected card must already lead
  // on the first render after navigation/remount.
  const displayedOrder = orderFromDeck(order, selectedDeckId);
  const activeDeck = decks.find((deck) => deck.id === displayedOrder[0]) ?? decks[0];

  useLayoutEffect(() => {
    setOrder((current) => orderFromDeck(current, selectedDeckId));
    translateX.value = 0;
    isLeaving.current = false;
  }, [selectedDeckId, translateX]);

  const sendToBack = useCallback(
    (exit: number) => {
      const nextDeckId = displayedOrder[1] ?? displayedOrder[0];
      if (!reducedMotion) {
        tuckX.value = exit;
        tuckX.value = withSpring(0, spring);
      }
      setOrder((current) => {
        const aligned = orderFromDeck(current, selectedDeckId);
        return [...aligned.slice(1), aligned[0]];
      });
      onSelect(nextDeckId);
    },
    [displayedOrder, onSelect, reducedMotion, selectedDeckId, tuckX],
  );

  const cycle = useCallback(
    (direction: number) => {
      if (isLeaving.current) return;
      isLeaving.current = true;
      if (reducedMotion) {
        sendToBack(0);
        return;
      }
      const exit = direction > 0 ? -520 : 520;
      translateX.value = withTiming(exit, { duration: 170 }, (finished) => {
        if (!finished) return;
        runOnJS(sendToBack)(exit);
      });
    },
    [reducedMotion, sendToBack, translateX],
  );

  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }, { rotate: `${translateX.value / 55}deg` }],
  }));
  const tuckStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: tuckX.value }, { translateY: 25 }, { scale: 0.91 }, { rotate: '2deg' }],
  }));
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponderCapture: (_event, { dx, dy }) => !isLeaving.current && Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy) * 1.1,
        onPanResponderMove: (_event, gesture) => {
          if (!reducedMotion && !isLeaving.current) translateX.value = gesture.dx;
        },
        onPanResponderRelease: (_event, gesture) => {
          suppressSwipeClick.current = true;
          if (isLeaving.current) return;
          const flicked = Math.abs(gesture.vx) > 0.65 && Math.sign(gesture.vx) === Math.sign(gesture.dx);
          if ((Math.abs(gesture.dx) > 64 || flicked) && Math.abs(gesture.dx) > Math.abs(gesture.dy)) {
            cycle(gesture.dx < 0 ? 1 : -1);
          } else if (!reducedMotion) translateX.value = withSpring(0, spring);
        },
        onPanResponderTerminate: () => {
          if (!reducedMotion && !isLeaving.current) translateX.value = withSpring(0, spring);
        },
      }),
    [cycle, reducedMotion, translateX],
  );

  function handleKeyDown(event: Parameters<NonNullable<PressableProps['onKeyDown']>>[0]) {
    suppressSwipeClick.current = false;
    if (event.nativeEvent.key === 'ArrowLeft' || event.nativeEvent.key === 'ArrowRight') {
      event.preventDefault();
      cycle(event.nativeEvent.key === 'ArrowRight' ? 1 : -1);
    }
  }

  return (
    <View className="relative min-h-[240px]" style={{ flexGrow: 1, maxHeight: 330, marginTop: -5 }}>
      {displayedOrder.slice(1).map((id, index) => {
        const deck = decks.find((item) => item.id === id) ?? decks[0];
        const depth = Math.min(index + 1, 5);
        return (
          <Animated.View
            key={`${deck.id}:${depth === displayedOrder.length - 1}`}
            pointerEvents="none"
            aria-hidden
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            className="absolute inset-x-2 bottom-0 top-0"
            style={[
              { zIndex: displayedOrder.length - depth },
              depth === displayedOrder.length - 1
                ? tuckStyle
                : {
                    transform: [{ translateY: depth * 5 }, { scale: 1 - depth * 0.018 }, { rotate: `${depth % 2 ? 2 : -2}deg` }],
                  },
            ]}
          >
            <DeckFace deck={deck} />
          </Animated.View>
        );
      })}
      <View {...panResponder.panHandlers} className="absolute inset-x-0 bottom-0 top-0 web:[touch-action:pan-y]" style={{ zIndex: displayedOrder.length }}>
        <Animated.View className="flex-1" style={cardStyle}>
          <Tap
            label={`${activeDeck.name} deck. Activate to move it to the back.`}
            accessibilityHint="Swipe left or right to browse decks. On a keyboard, use the arrow keys."
            accessibilityRole="button"
            onPress={() => {
              if (!suppressSwipeClick.current) cycle(1);
            }}
            onPressIn={() => {
              suppressSwipeClick.current = false;
            }}
            onKeyDown={handleKeyDown}
            className="absolute inset-0 min-h-0 items-stretch justify-start p-0"
          >
            <DeckFace deck={activeDeck} />
          </Tap>
        </Animated.View>
      </View>
    </View>
  );
}
