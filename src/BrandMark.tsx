import { Text, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

const INK = '#15131d';
const LILAC = '#c8adff';
const LIME = '#e2fc67';
const SPARKLE = 'm105 12 2.8 7.2 7.2 2.8-7.2 2.8-2.8 7.2-2.8-7.2-7.2-2.8 7.2-2.8Z';

export type BrandMarkProps = {
  /** Width and height of the icon tile, in logical pixels. */
  size?: number;
  /** Wordmark color, set this to the current foreground color in light or dark UI. */
  color?: string;
  /** Hide the stacked wordmark when only the icon is needed. */
  iconOnly?: boolean;
  style?: StyleProp<ViewStyle>;
};

/** A prompt-card icon and stacked Blame Game wordmark. */
export function BrandMark({ size = 42, color = '#fbf7ff', iconOnly = false, style }: BrandMarkProps) {
  const wordStyle: TextStyle = {
    color,
    fontFamily: 'GeistPixelSquare',
    fontSize: size * 0.49,
    letterSpacing: size * 0.016,
    lineHeight: size * 0.5,
  };

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel="Blame Game"
      style={[{ flexDirection: 'row', alignItems: 'center', gap: size * 0.24 }, style]}
    >
      <Svg width={size} height={size} viewBox="0 0 128 128" accessible={false}>
        <Rect x="5" y="5" width="118" height="118" rx="34" fill={LILAC} />
        <Path
          d="M30 29h27c8.3 0 15 6.7 15 15v23c0 8.3-6.7 15-15 15h-5L40 94l1-12H30c-8.3 0-15-6.7-15-15V44c0-8.3 6.7-15 15-15Z"
          fill="#a88bdc"
          transform="rotate(-9 43 58)"
        />
        <Path
          d="M54 19h28c11 0 20 9 20 20v31c0 11-9 20-20 20h-3l-14 15 1-15H54c-11 0-20-9-20-20V39c0-11 9-20 20-20Z"
          fill={LIME}
          transform="rotate(4 65 58)"
        />
        <Path
          d="M52 47c.5-8 6.5-13 14.5-13 8.7 0 14.5 5 14.5 12 0 6-3.8 9-9.3 12-5.8 3-7.7 6.3-7.7 12.4"
          fill="none"
          stroke={INK}
          strokeLinecap="round"
          strokeWidth="8.5"
        />
        <Circle cx="64" cy="78" r="4.5" fill={INK} />
        <Path d={SPARKLE} fill={INK} />
      </Svg>
      {!iconOnly && (
        <View accessible={false}>
          <Text style={wordStyle}>BLAME</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: size * 0.1 }}>
            <Text style={wordStyle}>GAME</Text>
            <Svg width={size * 0.17} height={size * 0.17} viewBox="0 0 16 16" accessible={false}>
              <Path d="M8 0 9.8 6.2 16 8l-6.2 1.8L8 16l-1.8-6.2L0 8l6.2-1.8Z" fill={LIME} />
            </Svg>
          </View>
        </View>
      )}
    </View>
  );
}

export default BrandMark;
