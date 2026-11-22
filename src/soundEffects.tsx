import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useReducedMotionPreference } from './beui/useReducedMotion';
import { useSoundPlayback, type Cue } from './soundPlayback';

const storageKey = 'blame-game:sound-effects';

type SoundEffects = {
  enabled: boolean;
  setEnabled: (enabled: boolean) => void;
  play: (cue: Cue) => void;
};

const SoundEffectsContext = createContext<SoundEffects>({
  enabled: false, setEnabled() {}, play() {},
});

export function SoundEffectsProvider({ children }: { children: ReactNode }) {
  const [enabled, setPreference] = useState(true);
  const active = useRef(false);
  const changed = useRef(false);
  const reducedMotion = useReducedMotionPreference();
  const { play, stop } = useSoundPlayback();

  useEffect(() => {
    let mounted = true;
    void AsyncStorage.getItem(storageKey).catch(() => null).then((stored) => {
      if (!mounted || changed.current) return;
      active.current = stored !== 'off';
      setPreference(active.current);
    });
    return () => { mounted = false; };
  }, []);

  const setEnabled = useCallback((next: boolean) => {
    changed.current = true;
    active.current = next;
    setPreference(next);
    if (!next) stop();
    void AsyncStorage.setItem(storageKey, next ? 'on' : 'off').catch(() => {});
  }, [stop]);

  const playIfEnabled = useCallback((cue: Cue) => {
    if (active.current && !reducedMotion) play(cue);
  }, [play, reducedMotion]);
  const value = useMemo(() => ({ enabled, setEnabled, play: playIfEnabled }), [enabled, setEnabled, playIfEnabled]);

  return <SoundEffectsContext.Provider value={value}>{children}</SoundEffectsContext.Provider>;
}

export function useSoundEffects() {
  return useContext(SoundEffectsContext);
}
