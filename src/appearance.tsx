import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Appearance, Platform, useColorScheme, View } from 'react-native';
import Svg, { Circle, Ellipse, G, Path, Rect, Text as SvgText } from 'react-native-svg';
import { VariableContextProvider } from 'nativewind';

export type AppearancePreference = 'system' | 'light' | 'dark';
export type AppearanceTheme = Exclude<AppearancePreference, 'system'>;

export type AppearanceColors = {
  ink: string;
  canvas: string;
  panel: string;
  line: string;
  cloud: string;
  muted: string;
  lilac: string;
  lilacStrong: string;
  lime: string;
  limeStrong: string;
  peach: string;
  peachFill: string;
  promptStack: string;
  promptStackAccent: string;
  promptBorder: string;
  doodle: string;
};

const APPEARANCE_STORAGE_KEY = 'blame-game-appearance';

const palettes: Record<AppearanceTheme, AppearanceColors> = {
  light: {
    ink: '#15131d',
    canvas: '#f5f1f8',
    panel: '#ffffff',
    line: '#93879f',
    cloud: '#211b29',
    muted: '#625a69',
    lilac: '#e7dcf5',
    lilacStrong: '#684b96',
    lime: '#e2fc67',
    limeStrong: '#536312',
    peach: '#9b4934',
    peachFill: '#ffb199',
    promptStack: '#eee7f7',
    promptStackAccent: '#c8adff',
    promptBorder: '#8675af',
    doodle: '#6d5494',
  },
  dark: {
    ink: '#15131d',
    canvas: '#100e16',
    panel: '#211e2d',
    line: '#716b7c',
    cloud: '#fbf7ff',
    muted: '#bab1cb',
    lilac: '#c8adff',
    lilacStrong: '#c8adff',
    lime: '#e2fc67',
    limeStrong: '#e2fc67',
    peach: '#ffb199',
    peachFill: '#ffb199',
    promptStack: '#302548',
    promptStackAccent: '#8e71cc',
    promptBorder: '#8675af',
    doodle: '#c8adff',
  },
};

type AppearanceContextValue = {
  preference: AppearancePreference;
  theme: AppearanceTheme;
  colors: AppearanceColors;
  setPreference: (preference: AppearancePreference) => void;
};

const AppearanceContext = createContext<AppearanceContextValue | null>(null);

function isPreference(value: string | null): value is AppearancePreference {
  return value === 'system' || value === 'light' || value === 'dark';
}

function readWebPreference(): AppearancePreference {
  if (Platform.OS !== 'web') return 'system';
  try {
    const stored = globalThis.localStorage?.getItem(APPEARANCE_STORAGE_KEY) ?? null;
    return isPreference(stored) ? stored : 'system';
  } catch {
    return 'system';
  }
}

export function AppearanceProvider({ children }: { children: ReactNode }) {
  const systemScheme = useColorScheme();
  const [preference, setPreferenceState] = useState<AppearancePreference>(readWebPreference);
  const [storageReady, setStorageReady] = useState(Platform.OS === 'web');
  const theme: AppearanceTheme = preference === 'system' ? (systemScheme ?? 'light') : preference;
  const colors = palettes[theme];

  useEffect(() => {
    if (Platform.OS === 'web') return;

    let active = true;
    void AsyncStorage.getItem(APPEARANCE_STORAGE_KEY)
      .then((stored) => {
        if (active && isPreference(stored)) setPreferenceState(stored);
      })
      .catch(() => {})
      .finally(() => {
        if (active) setStorageReady(true);
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!storageReady || Platform.OS === 'web') return;
    Appearance.setColorScheme(preference === 'system' ? 'auto' : preference);
  }, [preference, storageReady]);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const root = document.documentElement;
    root.dataset.appearance = preference;
    root.style.colorScheme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', colors.canvas);
    for (const [name, value] of Object.entries(colors)) {
      const token = name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
      root.style.setProperty(`--color-${token}`, value);
    }
  }, [colors, preference, theme]);

  const setPreference = useCallback((next: AppearancePreference) => {
    setPreferenceState(next);
    void AsyncStorage.setItem(APPEARANCE_STORAGE_KEY, next).catch(() => {});
  }, []);

  const variables = useMemo(
    () => Object.fromEntries(Object.entries(colors).map(([name, value]) => {
      const token = name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
      return [`--color-${token}`, value];
    })) as Record<`--${string}`, string>,
    [colors],
  );

  const value = useMemo(
    () => ({ preference, theme, colors, setPreference }),
    [colors, preference, setPreference, theme],
  );

  return (
    <AppearanceContext.Provider value={value}>
      <VariableContextProvider value={variables}>{children}</VariableContextProvider>
    </AppearanceContext.Provider>
  );
}

export function useAppearance() {
  const appearance = useContext(AppearanceContext);
  if (!appearance) throw new Error('useAppearance must be used inside AppearanceProvider.');
  return appearance;
}

/** Original, decorative chat-room doodles; place first inside a positioned screen container. */
export function DoodleWallpaper() {
  const { colors } = useAppearance();

  return (
    <View
      accessible={false}
      aria-hidden
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
      className="absolute inset-0 overflow-hidden"
    >
      <Svg
        accessible={false}
        width="100%"
        height="100%"
        viewBox="0 0 390 844"
        preserveAspectRatio="xMidYMid slice"
        opacity={0.12}
      >
        <G opacity={0.36} stroke="none">
          <Circle cx={36} cy={278} r={24} fill={colors.promptStackAccent} />
          <Circle cx={348} cy={326} r={30} fill={colors.peachFill} />
          <Ellipse cx={83} cy={615} rx={34} ry={19} fill={colors.lilac} />
          <Circle cx={323} cy={749} r={27} fill={colors.promptStackAccent} />
          <Circle cx={192} cy={425} r={4} fill={colors.lime} />
          <Circle cx={205} cy={425} r={2} fill={colors.peachFill} />
        </G>
        <G fill="none" stroke={colors.doodle} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
          <Path d="M103 58c7 4 12 4 19 0m-9-9v18" />
          <Path d="m252 103 3 7 7 3-7 3-3 7-3-7-7-3 7-3z" />
          <G transform="rotate(-8 331 292)">
            <Circle cx={331} cy={292} r={13} />
            <Circle cx={327} cy={289} r={1.2} fill={colors.doodle} />
            <Circle cx={335} cy={289} r={1.2} fill={colors.doodle} />
            <Path d="M327 296q4 4 8 0" />
          </G>
          <G transform="rotate(-9 42 102)">
            <Rect x={18} y={83} width={55} height={36} rx={15} />
            <Path d="M31 118 25 129l17-10" />
            <Circle cx={34} cy={101} r={1.7} fill={colors.doodle} />
            <Circle cx={45} cy={101} r={1.7} fill={colors.doodle} />
            <Circle cx={56} cy={101} r={1.7} fill={colors.doodle} />
          </G>
          <Path d="M305 69c7-10 13-10 20 0s13 10 20 0 13-10 20 0" />
          <Path d="M333 166c2-9 8-13 17-12 10 1 13 10 6 17l-9 8v5" />
          <Circle cx={347} cy={194} r={1.6} fill={colors.doodle} />
          <G transform="rotate(8 78 239)">
            <SvgText x={27} y={245} fill={colors.doodle} stroke="none" fontSize={21} fontWeight="700" fontStyle="italic">LOL</SvgText>
            <Path d="M27 251c15 5 31 4 48-1" />
          </G>
          <Path d="m176 106 7 10 12-1-8 9 3 12-10-6-10 6 3-12-8-9 12 1z" />
          <Path d="M260 254c-4-11 2-18 13-15 1-10 13-13 19-4 9-5 18 2 15 12 8 6 4 18-7 19h-29c-9 0-14-5-11-12" />
          <Path d="M274 255h20m-10-10v20" />
          <G transform="rotate(-7 93 391)">
            <Ellipse cx={80} cy={385} rx={31} ry={19} />
            <Path d="m105 399 11 10-2-16" />
            <SvgText x={61} y={391} fill={colors.doodle} stroke="none" fontSize={14} fontWeight="700">WHO?</SvgText>
          </G>
          <Path d="M216 366c8 9 17 9 26 0s18-9 27 0 18 9 27 0" />
          <Path d="m330 405 11 11m0-11-11 11" />
          <G transform="rotate(10 37 545)">
            <Path d="M21 535c0-9 13-14 19-5 6-9 19-4 19 5 0 12-19 25-19 25s-19-13-19-25z" />
          </G>
          <Path d="M145 511c-7-7-14-7-21 0s-14 7-21 0" />
          <Path d="m270 526 4 11 11 4-11 4-4 11-4-11-11-4 11-4z" />
          <G transform="rotate(-8 337 625)">
            <Rect x={305} y={603} width={58} height={37} rx={8} />
            <Path d="m317 615 7 6 8-8m8 2h14m-30 13 7 6 8-8m8 2h7" />
          </G>
          <Path d="M36 704c8-12 16-12 24 0s16 12 24 0 16-12 24 0" />
          <G transform="rotate(9 195 728)">
            <SvgText x={163} y={735} fill={colors.doodle} stroke="none" fontSize={18} fontWeight="700" fontStyle="italic">oops</SvgText>
            <Path d="M164 741c12 3 23 3 34-1" />
          </G>
          <Circle cx={152} cy={195} r={4} />
          <Circle cx={164} cy={195} r={4} />
          <Path d="M155 209q5 5 10 0" />
          <Path d="M201 611c9-9 18-9 27 0m-13-13v27" />
          <Path d="M101 789c9-8 18-8 27 0m-13-13v26" />
          <G transform="rotate(12 93 327)">
            <Rect x={75} y={307} width={31} height={39} rx={6} />
            <Path d="M83 307v-6h30a5 5 0 0 1 5 5v29h-12m-23-9h15m-15 8h10" />
          </G>
          <Path d="m54 460 5 8 9 2-7 5 1 9-8-5-8 5 1-9-7-5 9-2z" />
          <G transform="rotate(-12 326 478)">
            <Rect x={304} y={456} width={44} height={44} rx={10} />
            <Circle cx={316} cy={468} r={2} />
            <Circle cx={326} cy={478} r={2} />
            <Circle cx={336} cy={488} r={2} />
          </G>
          <Path d="m63 629 8 7 15-17m208 109 7 7m0-7-7 7" />
          <Path d="M137 663c9-9 18-9 27 0s18 9 27 0 18-9 27 0" />
          <G transform="rotate(7 287 690)">
            <Rect x={265} y={674} width={43} height={31} rx={12} />
            <Path d="M276 690h1m9 0h1m-9 7q4 3 8 0" />
          </G>
          <Path d="M344 548v21m-7-14h14m-12 8h10" />
          <Circle cx={38} cy={454} r={2} fill={colors.doodle} />
          <Circle cx={48} cy={449} r={1.5} fill={colors.doodle} />
          <Circle cx={58} cy={454} r={2} fill={colors.doodle} />
          <Circle cx={263} cy={807} r={3} />
          <Circle cx={275} cy={807} r={3} />
          <Path d="M265 818q5 4 10 0" />
        </G>
      </Svg>
    </View>
  );
}
