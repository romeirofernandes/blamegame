import { useMemo, useState, type ReactNode } from 'react';
import { Image, Platform, Pressable, Text, View, type TextProps } from 'react-native';
import Animated, { cubicBezier, useReducedMotion } from 'react-native-reanimated';
import { HugeiconsIcon } from '@hugeicons/react-native';
import ArrowRight01Icon from '@hugeicons/core-free-icons/ArrowRight01Icon';
import SparklesIcon from '@hugeicons/core-free-icons/SparklesIcon';
import * as Haptics from 'expo-haptics';
import { twMerge } from 'tailwind-merge';
import { useAppearance } from './appearance';
import Svg, { Path, Rect } from 'react-native-svg';
import { DITHER_AVATAR_SIZE, DITHER_OFFSET_Y, DITHER_SCALE, ditherAvatar } from './dither-avatar';

export function Body({ className = '', ...props }: TextProps) {
  return <Text className={twMerge('font-body text-base leading-body text-cloud', className)} {...props} />;
}

export function Title({ className = '', ...props }: TextProps) {
  return <Text accessibilityRole="header" className={twMerge('font-display text-[46px] leading-display tracking-display text-cloud', className)} {...props} />;
}

export function Label({ className = '', ...props }: TextProps) {
  return <Text className={twMerge('font-boldface text-[11px] uppercase tracking-label text-muted', className)} {...props} />;
}

export function Tap({ children, onPress, label, disabled, selected, className = '' }: {
  children: ReactNode;
  onPress: () => void;
  label?: string;
  disabled?: boolean;
  selected?: boolean;
  className?: string;
}) {
  const [pressed, setPressed] = useState(false);
  const reduced = useReducedMotion();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled, selected }}
      className={`min-h-12 justify-center rounded-[18px] web:focus-visible:outline-2 web:focus-visible:outline-lilac-strong ${className}`}
      disabled={disabled}
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      pressRetentionOffset={16}
    >
      <Animated.View
        className="w-full"
        style={reduced ? { opacity: pressed ? 0.88 : 1 } : {
          transform: [{ scale: pressed ? 0.96 : 1 }],
          transitionProperty: 'transform',
          transitionDuration: 150,
          transitionTimingFunction: cubicBezier(0, 0, 0.58, 1),
        }}
      >
        {children}
      </Animated.View>
    </Pressable>
  );
}

export function Button({ children, onPress, tone = 'primary', disabled, arrow = true }: {
  children: string;
  onPress: () => void;
  tone?: 'primary' | 'secondary' | 'quiet';
  disabled?: boolean;
  arrow?: boolean;
}) {
  const { colors: palette } = useAppearance();
  const background = tone === 'primary' ? 'bg-lime' : tone === 'secondary' ? 'border border-line bg-panel' : '';
  const color = tone === 'primary' ? palette.ink : tone === 'secondary' ? palette.cloud : palette.muted;
  return (
    <Tap onPress={onPress} disabled={disabled}>
      <View className={`min-h-14 flex-row items-center justify-center gap-2 rounded-[18px] px-4 py-3 ${background} ${disabled ? 'opacity-45' : ''}`}>
        <Text className="text-center font-boldface text-base" style={{ color }}>{children}</Text>
        {arrow && <HugeiconsIcon icon={ArrowRight01Icon} size={20} color={color} strokeWidth={2} />}
      </View>
    </Tap>
  );
}

export function Avatar({ player }: { player: { id: string; avatar?: string } }) {
  const [failedPhoto, setFailedPhoto] = useState<string>();
  const pattern = useMemo(() => ditherAvatar(player.id), [player.id]);
  return (
    <View aria-hidden className="size-10 shrink-0 overflow-hidden rounded-full">
      {player.avatar && player.avatar !== failedPhoto ? (
        <Image
          source={{ uri: player.avatar }}
          className="size-10"
          onError={() => setFailedPhoto(player.avatar)}
        />
      ) : (
        <Svg width={40} height={40} viewBox={`0 0 ${DITHER_AVATAR_SIZE} ${DITHER_AVATAR_SIZE}`}>
          <Rect width={DITHER_AVATAR_SIZE} height={DITHER_AVATAR_SIZE} fill={pattern.fill} />
          <Path
            d={pattern.path}
            fill="none"
            stroke={pattern.stroke}
            transform={`translate(0,${DITHER_OFFSET_Y}) scale(${DITHER_SCALE})`}
          />
        </Svg>
      )}
    </View>
  );
}

export function PromptCard({ question, label, color, hero = false }: {
  question: string;
  label: string;
  color?: string;
  hero?: boolean;
}) {
  const { colors: palette } = useAppearance();
  return (
    <View className={hero ? 'relative mx-1 mt-2 pb-2' : 'relative'}>
      {hero && (
        <>
          <View pointerEvents="none" className="absolute inset-x-3 bottom-0 top-4 -rotate-4 rounded-[25px] border" style={{ borderColor: palette.promptBorder, backgroundColor: palette.promptStack }} />
          <View pointerEvents="none" className="absolute inset-x-2 bottom-1 top-2 rotate-3 rounded-[25px]" style={{ backgroundColor: palette.promptStackAccent }} />
        </>
      )}
      <View className={`overflow-hidden rounded-[25px] p-5 ${hero ? 'min-h-[188px]' : ''}`} style={{ backgroundColor: color ?? palette.lilac }}>
        <View className="flex-row items-center justify-between gap-2">
          <View className="rounded-full border border-ink/60 px-2.5 py-1.5">
            <Label className="tracking-label text-ink">{label}</Label>
          </View>
          <HugeiconsIcon icon={SparklesIcon} color={palette.ink} size={31} strokeWidth={1.7} />
        </View>
        <Title className={`mt-3 text-ink ${hero ? 'text-[31px]' : 'text-[34px]'}`}>
          {question}
        </Title>
      </View>
    </View>
  );
}

export function hapticSelect() {
  if (Platform.OS !== 'web') void Haptics.selectionAsync().catch(() => {});
}
