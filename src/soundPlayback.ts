import { useCallback, useRef } from 'react';
import { useAudioPlayer } from 'expo-audio';

export type Cue = 'tap' | 'toggle';

export function useSoundPlayback() {
  const tap = useAudioPlayer(require('../assets/sounds/tap.wav'));
  const toggle = useAudioPlayer(require('../assets/sounds/toggle.wav'));
  const request = useRef(0);

  const stop = useCallback(() => {
    request.current += 1;
    tap.pause();
    toggle.pause();
  }, [tap, toggle]);

  const play = useCallback((cue: Cue) => {
    stop();
    const id = request.current;
    const player = cue === 'tap' ? tap : toggle;
    void player.seekTo(0).then(() => {
      if (request.current === id) player.play();
    }).catch(() => {});
  }, [stop, tap, toggle]);

  return { play, stop };
}
