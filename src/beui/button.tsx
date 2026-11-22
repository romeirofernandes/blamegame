// Adapted from beUI Native Button (MIT).
// Source: https://github.com/starc007/beui-native/tree/main/src/components/button
import { type ReactNode, type Ref, useEffect } from 'react';
import {
  Pressable,
  type PressableProps,
  type StyleProp,
  type ViewInstance,
  type ViewStyle,
} from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useReducedMotionPreference } from './useReducedMotion';
import { useSoundEffects } from '../soundEffects';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
const PRESS_SPRING = { stiffness: 500, damping: 30, mass: 0.6 } as const;

export type ButtonRootProps = Omit<PressableProps, 'children' | 'style'> & {
  children: ReactNode;
  className?: string;
  label?: string;
  selected?: boolean;
  pressScale?: number;
  disableAnimation?: boolean;
  style?: StyleProp<ViewStyle>;
  ref?: Ref<ViewInstance>;
};

/** The shared BeUI pressable root; visual variants stay in the app's wrappers. */
export function ButtonRoot({
  children,
  className = '',
  label,
  selected,
  pressScale = 0.96,
  disableAnimation = false,
  disabled,
  style,
  accessibilityLabel,
  accessibilityRole = 'button',
  accessibilityState,
  onPressIn,
  onPressOut,
  onPress,
  pressRetentionOffset,
  ref,
  ...props
}: ButtonRootProps) {
  const reducedMotion = useReducedMotionPreference();
  const { play } = useSoundEffects();
  const animate = !reducedMotion && !disableAnimation;
  const scale = useSharedValue(1);
  const pressed = useSharedValue(0);
  useEffect(() => {
    if (!animate || disabled) scale.value = 1;
  }, [animate, disabled, scale]);
  const animatedStyle = useAnimatedStyle(
    () => ({
      transform: [{ scale: scale.value }],
      opacity: animate ? 1 : 1 - 0.12 * pressed.value,
    }),
    [animate],
  );

  return (
    <AnimatedPressable
      {...props}
      ref={ref}
      accessible
      accessibilityRole={accessibilityRole}
      accessibilityLabel={label ?? accessibilityLabel}
      accessibilityState={{ ...accessibilityState, selected, disabled: disabled ?? false }}
      aria-disabled={disabled}
      disabled={disabled}
      className={className}
      style={[style, animatedStyle]}
      pressRetentionOffset={pressRetentionOffset ?? 16}
      onPress={onPress ? (event) => {
        play('tap');
        onPress(event);
      } : undefined}
      onPressIn={(event) => {
        pressed.value = 1;
        if (animate) scale.value = withSpring(pressScale, PRESS_SPRING);
        onPressIn?.(event);
      }}
      onPressOut={(event) => {
        pressed.value = 0;
        if (animate) scale.value = withSpring(1, PRESS_SPRING);
        onPressOut?.(event);
      }}
    >
      {children}
    </AnimatedPressable>
  );
}
