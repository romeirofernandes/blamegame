import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Appearance, Platform, useColorScheme, View } from 'react-native';
import Svg, { Defs, G, Path, Pattern, Rect } from 'react-native-svg';
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

// Original 32-unit line drawings, arranged in a staggered repeating tile.
const doodles = [
  'M5 6h22a3 3 0 0 1 3 3v12a3 3 0 0 1-3 3H14l-6 5v-5H5a3 3 0 0 1-3-3V9a3 3 0 0 1 3-3ZM9 15h1m5 0h1m5 0h1', // Chat
  'M8 4h16a4 4 0 0 1 4 4v16a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4V8a4 4 0 0 1 4-4Zm2 6h.1m12 0h.1m-6 6h.1m-6 6h.1m12 0h.1', // Die
  'M16 2l3.5 10.5L30 16l-10.5 3.5L16 30l-3.5-10.5L2 16l10.5-3.5L16 2Z', // Spark
  'M3 13 29 4l-7 24-7-9-12-6Zm12 6L29 4M6 23l-3 3m8 0-2 4', // Paper plane
  'M7 9h18a4 4 0 0 1 4 4v6a5 5 0 0 1-5 5c-3 0-4-4-8-4s-5 4-8 4a5 5 0 0 1-5-5v-6a4 4 0 0 1 4-4Zm4 3v7m-3.5-3.5h7m7 0h.1m3-3h.1', // Controller
  'M16 27 5 17C-3 8 10 2 16 10 22 2 35 8 27 17L16 27Z', // Heart
  'M11 4h13a3 3 0 0 1 3 3v17M5 11a3 3 0 0 1 3-3h13a3 3 0 0 1 3 3v15a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3Zm9.5 2 4 5.5-4 5.5-4-5.5Z', // Cards
  'M18 2 6 18h9l-1 12 12-17h-9l1-11Z', // Bolt
  'M6 9h20a3 3 0 0 1 3 3v13H3V12a3 3 0 0 1 3-3Zm-3 7h26m-17-7V5h8v4m-6 7v3h4v-3', // Briefcase
  'M3 12V5h7m12 0h7v7m0 8v7h-7m-12 0H3v-7m13-10 2 4 5 .6-3.5 3.4.8 4.8-4.3-2.2-4.3 2.2.8-4.8L9 14.6l5-.6Z', // Spotlight
  'M16 3a13 13 0 1 0 0 26 13 13 0 0 0 0-26ZM10 13h.1m11.9 0h.1M10 19q6 7 12 0', // Smile
  'M6 20 22 4l6 6L12 26l-8 2 2-8Zm0 0 6 6M18 8l6 6', // Pencil
  'M8 10a8 8 0 0 1 16-1c0 5-8 6-8 11m0 7h.1', // Question
  'M4 11 27 7l2 15-23 4L4 11Zm9 5 3 3 5-6', // Ballot
  'M4 10l24 12-4 5-8-10-7-1-5-6Zm16-4 3-4m3 9 4-2M9 23l-5 5', // Party popper
  'M4 18c4-9 8-9 12 0s8 9 12 0M9 6l2 3m13-3-2 3', // Squiggle
];

/** Decorative wallpaper with a fixed motif scale on different screen sizes. */
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
      <Svg accessible={false} width="100%" height="100%">
        <Defs>
          <Pattern id="game-doodles" width={256} height={224} patternUnits="userSpaceOnUse">
            <G fill="none" stroke={colors.doodle} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" opacity={0.15}>
              {doodles.map((path, index) => {
                const row = Math.floor(index / 4);
                const column = index % 4;
                const x = 6 + column * 64 + (row % 2) * 20;
                const y = 9 + row * 56 + (column % 2) * 6;
                const rotation = [-12, 10, -6, 16][(column + row) % 4];
                return <Path key={path} d={path} transform={`translate(${x} ${y}) rotate(${rotation} 16 16)`} />;
              })}
              <Path d="M52 45h.1m67 3h.1m58-4h.1m63 5h.1M8 101h.1m70 4h.1m65-5h.1m63 4h.1M52 157h.1m67 3h.1m58-4h.1m63 5h.1M8 213h.1m70 4h.1m65-5h.1m63 4h.1" strokeWidth={2.5} />
            </G>
          </Pattern>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#game-doodles)" />
      </Svg>
    </View>
  );
}
