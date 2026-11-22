import { useMemo, useState, type ReactNode } from 'react';
import { Image, Platform, Text, View, type TextProps } from 'react-native';
import { HugeiconsIcon } from '@hugeicons/react-native';
import ArrowRight01Icon from '@hugeicons/core-free-icons/ArrowRight01Icon';
import SparklesIcon from '@hugeicons/core-free-icons/SparklesIcon';
import * as Haptics from 'expo-haptics';
import { twMerge } from 'tailwind-merge';
import { useAppearance } from './appearance';
import { ButtonRoot, type ButtonRootProps } from './beui/button';
import { Surface } from './beui/card';
import Svg, { Path, Rect } from 'react-native-svg';
import { DITHER_AVATAR_SIZE, DITHER_OFFSET_Y, DITHER_SCALE, ditherAvatar } from './dither-avatar';

export { Field } from './beui/input';
export { GameSwitch } from './beui/switch';
export { Surface };

export function Body({ className = '', ...props }: TextProps) {
  return <Text className={twMerge('font-body text-base leading-body text-cloud', className)} {...props} />;
}

export function Title({ className = '', ...props }: TextProps) {
  return <Text accessibilityRole="header" className={twMerge('font-display text-[46px] leading-display tracking-display text-cloud', className)} {...props} />;
}

export function Label({ className = '', ...props }: TextProps) {
  return <Text className={twMerge('font-boldface text-[11px] uppercase tracking-label text-muted', className)} {...props} />;
}

export type TapProps = Omit<ButtonRootProps, 'children' | 'onPress'> & {
  children: ReactNode;
  onPress: NonNullable<ButtonRootProps['onPress']>;
};

export function Tap({ children, className = '', ...props }: TapProps) {
  return (
    <ButtonRoot
      {...props}
      className={`min-h-12 justify-center rounded-[18px] web:focus-visible:outline-2 web:focus-visible:outline-lilac-strong ${className}`}
    >
      {children}
    </ButtonRoot>
  );
}

export type ButtonProps = Omit<TapProps, 'children' | 'className'> & {
  children: ReactNode;
  tone?: 'primary' | 'secondary' | 'quiet';
  arrow?: boolean;
  className?: string;
};

export function Button({ children, onPress, tone = 'primary', disabled, arrow = true, className = '', label, ...props }: ButtonProps) {
  const { colors: palette } = useAppearance();
  const background = tone === 'primary' ? 'bg-lime' : tone === 'secondary' ? 'border border-line bg-panel' : '';
  const color = tone === 'primary' ? palette.ink : tone === 'secondary' ? palette.cloud : palette.muted;
  const textChild = typeof children === 'string' || typeof children === 'number';
  return (
    <Tap {...props} label={label ?? (textChild ? String(children) : undefined)} onPress={onPress} disabled={disabled} className={className}>
      <View className={`min-h-14 flex-row items-center justify-center gap-2 rounded-[18px] px-4 py-3 ${background} ${disabled ? 'opacity-45' : ''}`}>
        {textChild ? <Text className="text-center font-boldface text-base" style={{ color }}>{children}</Text> : children}
        {arrow && <HugeiconsIcon icon={ArrowRight01Icon} size={20} color={color} strokeWidth={2} />}
      </View>
    </Tap>
  );
}

export function Avatar({ player }: { player: { id: string; avatar?: string; avatarSeed?: string; avatarVariant?: number } }) {
  const [failedPhoto, setFailedPhoto] = useState<string>();
  const pattern = useMemo(
    () => ditherAvatar(player.avatarSeed ?? player.id, player.avatarVariant),
    [player.id, player.avatarSeed, player.avatarVariant],
  );
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

export function PresenceAvatar({ player }: {
  player: { id: string; avatar?: string; online?: boolean };
}) {
  return (
    <View aria-hidden className="relative">
      <Avatar player={player} />
      <View
        className={`absolute bottom-0 right-0 size-3 rounded-full border-2 border-panel ${player.online === false ? 'bg-peach' : 'bg-lime-strong'}`}
      />
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
    <View className="relative">
      <Surface className={`overflow-hidden rounded-[25px] border-0 p-5 ${hero ? 'min-h-[188px]' : ''}`} style={{ backgroundColor: color ?? palette.lilac }}>
        <View className="flex-row items-center justify-between gap-2">
          <View className="rounded-full border border-ink/60 px-2.5 py-1.5">
            <Label className="tracking-label text-ink">{label}</Label>
          </View>
          <HugeiconsIcon icon={SparklesIcon} color={palette.ink} size={31} strokeWidth={1.7} />
        </View>
        <Title className={`mt-3 text-ink ${hero ? 'text-[31px]' : 'text-[34px]'}`}>
          {question}
        </Title>
      </Surface>
    </View>
  );
}

export function hapticSelect() {
  if (Platform.OS !== 'web') void Haptics.selectionAsync().catch(() => {});
}
