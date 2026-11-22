import { useCallback, useRef } from 'react';
import { playSound, type SoundPlayback } from './vendor/sensory-ui/config/engine';
import { aeroPack } from './vendor/sensory-ui/sounds/packs';
import type { Cue } from './soundPlayback';

export function useSoundPlayback() {
  const request = useRef(0);
  const active = useRef<SoundPlayback | null>(null);

  const stop = useCallback(() => {
    request.current += 1;
    active.current?.stop();
    active.current = null;
  }, []);

  const play = useCallback((cue: Cue) => {
    if (typeof AudioContext === 'undefined') return;
    const id = ++request.current;
    void playSound(aeroPack[`interaction.${cue}`], { volume: 0.35 }).then((playback) => {
      if (request.current === id) active.current = playback;
      else playback.stop();
    }).catch(() => {});
  }, []);

  return { play, stop };
}
