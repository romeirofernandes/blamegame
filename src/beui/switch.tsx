// Adapted from beUI Native Switch (MIT).
// Source: https://github.com/starc007/beui-native/tree/main/src/components/switch
import { useEffect, type Ref } from 'react';
import {
  I18nManager,
  Pressable,
  type PressableProps,
  StyleSheet,
  type ViewInstance,
} from 'react-native';
import Animated, {
  cancelAnimation,
  interpolateColor,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useAppearance } from '../appearance';
import { useReducedMotionPreference } from './useReducedMotion';

const THUMB_SPRING = { stiffness: 800, damping: 80, mass: 4, reduceMotion: ReduceMotion.System } as const;
const TRACK_FADE = { duration: 200, reduceMotion: ReduceMotion.System };
const SIZE = { width: 48, height: 28, padding: 4, thumb: 20, stretch: 4 } as const;

export type GameSwitchProps = Omit<PressableProps, 'children' | 'disabled' | 'onPress' | 'style'> & {
  value: boolean;
  onValueChange: (value: boolean) => void;
  accessibilityLabel: string;
  disabled?: boolean;
  className?: string;
  style?: PressableProps['style'];
  ref?: Ref<ViewInstance>;
};

export function GameSwitch({
  value,
  onValueChange,
  accessibilityLabel,
  disabled = false,
  className = '',
  style,
  accessibilityState,
  onPressIn,
  onPressOut,
  ref,
  ...props
}: GameSwitchProps) {
  const { colors } = useAppearance();
  const reducedMotion = useReducedMotionPreference();
  const animate = !reducedMotion;
  const direction = I18nManager.isRTL ? -1 : 1;
  const travel = SIZE.width - SIZE.padding * 2 - SIZE.thumb;
  const position = useSharedValue(value ? 1 : 0);
  const track = useSharedValue(value ? 1 : 0);
  const press = useSharedValue(0);

  useEffect(() => {
    const target = value ? 1 : 0;
    position.value = animate ? withSpring(target, THUMB_SPRING) : target;
    track.value = animate ? withTiming(target, TRACK_FADE) : target;
  }, [animate, position, track, value]);

  useEffect(() => {
    if (!animate || disabled) {
      cancelAnimation(press);
      press.value = 0;
    }
  }, [animate, disabled, press]);

  const trackStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(track.value, [0, 1], [colors.line, colors.lime]),
  }), [colors.line, colors.lime]);
  const thumbStyle = useAnimatedStyle(() => {
    const stretch = SIZE.stretch * press.value;
    return {
      width: SIZE.thumb + stretch,
      transform: [
        { translateX: direction * (position.value * travel + (value ? -stretch : 0)) },
        { scale: 1 - 0.1 * press.value },
      ],
    };
  }, [direction, travel, value]);

  return (
    <Pressable
      {...props}
      ref={ref}
      accessible
      accessibilityRole="switch"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ ...accessibilityState, checked: value, disabled }}
      aria-checked={value}
      aria-disabled={disabled}
      disabled={disabled}
      hitSlop={{ top: 10, bottom: 10, left: 0, right: 0 }}
      className={`min-h-12 min-w-12 items-center justify-center rounded-full web:focus-visible:outline-2 web:focus-visible:outline-lilac-strong ${disabled ? 'opacity-60' : ''} ${className}`}
      style={style}
      onPress={() => onValueChange(!value)}
      onPressIn={(event) => {
        if (animate && !disabled) press.value = withSpring(1, THUMB_SPRING);
        onPressIn?.(event);
      }}
      onPressOut={(event) => {
        if (animate) press.value = withSpring(0, THUMB_SPRING);
        onPressOut?.(event);
      }}
    >
      <Animated.View
        style={[styles.track, { width: SIZE.width, height: SIZE.height, borderRadius: SIZE.height / 2 }, trackStyle]}
      >
        <Animated.View
          style={[
            styles.thumb,
            {
              start: SIZE.padding,
              height: SIZE.thumb,
              borderRadius: SIZE.thumb / 2,
              backgroundColor: value ? colors.ink : colors.panel,
            },
            thumbStyle,
          ]}
        />
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  track: { flexShrink: 0, justifyContent: 'center' },
  thumb: { position: 'absolute', boxShadow: '0 2px 4px rgba(0, 0, 0, 0.18)' },
});
