// Adapted from beUI Native Input (MIT).
// Source: https://github.com/starc007/beui-native/tree/main/src/components/input
import { type ReactNode, type Ref, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, TextInput, type TextInputInstance, type TextInputProps, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { twMerge } from 'tailwind-merge';
import { useAppearance } from '../appearance';
import { useReducedMotionPreference } from './useReducedMotion';

const AnimatedTextInput = Animated.createAnimatedComponent(TextInput);
const COLOR_FADE = { duration: 200 };

export type FieldProps = TextInputProps & {
  label: string;
  trailing?: ReactNode;
  className?: string;
  ref?: Ref<TextInputInstance>;
};

const INPUT_CLASSES =
  'min-h-14 rounded-[16px] border border-line bg-panel px-4 py-3 font-body text-base text-cloud web:focus-visible:outline-2 web:focus-visible:outline-lilac-strong';

export function Field({
  label,
  trailing,
  multiline,
  className = '',
  accessibilityLabel,
  keyboardAppearance,
  placeholderTextColor,
  onFocus,
  onBlur,
  style,
  ref,
  ...props
}: FieldProps) {
  const { theme, colors } = useAppearance();
  const inputRef = useRef<TextInputInstance | null>(null);
  const [focused, setFocused] = useState(false);
  const reducedMotion = useReducedMotionPreference();
  const animate = !reducedMotion;
  const border = useSharedValue(colors.line);
  const ring = useSharedValue(0);

  useEffect(() => {
    const nextBorder = focused ? colors.lilacStrong : colors.line;
    const nextRing = focused ? 1 : 0;
    border.value = animate ? withTiming(nextBorder, COLOR_FADE) : nextBorder;
    ring.value = animate ? withTiming(nextRing, COLOR_FADE) : nextRing;
  }, [animate, border, colors.line, colors.lilacStrong, focused, ring]);

  const borderStyle = useAnimatedStyle(() => ({ borderColor: border.value }));
  const ringStyle = useAnimatedStyle(() => ({ opacity: ring.value }));

  return (
    <View className="gap-2">
      <Text
        accessibilityElementsHidden
        importantForAccessibility="no"
        className="font-boldface text-[11px] uppercase tracking-label text-muted"
        onPress={() => inputRef.current?.focus()}
      >
        {label}
      </Text>
      <View className="relative">
        <Animated.View
          pointerEvents="none"
          style={[styles.ring, { borderColor: colors.lilacStrong }, ringStyle]}
        />
        <AnimatedTextInput
          {...props}
          ref={(node: TextInputInstance | null) => {
            inputRef.current = node;
            if (typeof ref === 'function') ref(node);
            else if (ref) ref.current = node;
          }}
          multiline={multiline}
          accessibilityLabel={accessibilityLabel ?? label}
          keyboardAppearance={keyboardAppearance ?? theme}
          placeholderTextColor={placeholderTextColor ?? colors.muted}
          className={twMerge(INPUT_CLASSES, className)}
          style={[
            borderStyle,
            {
              minHeight: 56,
              paddingHorizontal: 16,
              paddingVertical: 12,
              paddingRight: trailing ? 56 : 16,
              includeFontPadding: false,
              textAlignVertical: multiline ? 'top' : 'center',
            },
            style,
          ]}
          onFocus={(event) => {
            setFocused(true);
            onFocus?.(event);
          }}
          onBlur={(event) => {
            setFocused(false);
            onBlur?.(event);
          }}
        />
        {trailing && <View className="absolute bottom-0 right-0 top-0 w-14 items-center justify-center">{trailing}</View>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  ring: {
    position: 'absolute',
    top: -2,
    bottom: -2,
    left: -2,
    right: -2,
    borderWidth: 2,
    borderRadius: 18,
  },
});
