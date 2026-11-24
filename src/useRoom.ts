import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { getRandomValues } from 'expo-crypto';
import type { Command, Message, RoomView } from './game';
import { getDeck } from './decks';

type Enter = Extract<Command, { type: 'create' | 'join' | 'resume' }>;
type Outbound = Exclude<Command, Enter>
  | Omit<Extract<Enter, { type: 'create' }>, 'token'>
  | Omit<Extract<Enter, { type: 'join' }>, 'token'>;
type Account = { uid: string; getIdToken: () => Promise<string> };
type Identity = {
  token: string;
  code?: string;
  title?: string;
  phase?: RoomView['phase'];
  round?: number;
  total?: number;
  updatedAt?: number;
  detached?: boolean;
};
export type RejoinableGame = Pick<Identity, 'code' | 'title' | 'phase' | 'round' | 'total'> & { code: string };

const storage = Platform.OS === 'web' ? {
  async getItem(key: string) { return sessionStorage.getItem(key); },
  async setItem(key: string, value: string) { sessionStorage.setItem(key, value); },
  async removeItem(key: string) { sessionStorage.removeItem(key); },
} : AsyncStorage;
const serverUrl = process.env.EXPO_PUBLIC_SERVER_URL?.replace(/\/$/, '');

function newToken() {
  return Array.from(getRandomValues(new Uint8Array(24)), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function webOrigin() {
  if (serverUrl) return serverUrl;
  if (Platform.OS === 'web') {
    if (typeof location === 'undefined') return '';
    if (location.port === '8081') return `${location.protocol}//${location.hostname}:3000`;
    return location.origin;
  }
  const host = Constants.expoConfig?.hostUri?.split(':')[0];
  return host ? `http://${host}:3000` : '';
}

export function useRoom(account: Account | null, authReady: boolean) {
  const controller = useRef<{
    send: (command: Outbound) => void;
    rejoin: (code: string) => void;
    leave: () => void;
  }>(null);
  const [room, setRoom] = useState<RoomView | null>(null);
  const [rejoinableGames, setRejoinableGames] = useState<RejoinableGame[]>([]);
  const [connected, setConnected] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [readyUid, setReadyUid] = useState<string>();
  const uid = account?.uid;
  const origin = webOrigin();
  const getIdToken = useEffectEvent(() => account?.getIdToken());

  useEffect(() => {
    setRoom(null);
    setRejoinableGames([]);
    setError('');
    setPending(false);
    setConnected(false);
    setReadyUid(undefined);
    if (!origin || !authReady || !uid) return;

    const storageKey = `blame-game-sessions:${uid}`;
    const legacyStorageKey = `blame-game-session:${uid}`;
    let stopped = false;
    let retry: ReturnType<typeof setTimeout> | undefined;
    let handshakeTimeout: ReturnType<typeof setTimeout> | undefined;
    let attempts = 0;
    let identity: Identity | undefined;
    let identities: Identity[] = [];
    let currentRoom: RoomView | null = null;
    let socket: WebSocket | null = null;

    function publishIdentities() {
      const available = identities
        .filter((saved): saved is Identity & { code: string } => Boolean(saved.code) && saved.phase !== 'recap')
        .sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
      setRejoinableGames(available.map(({ code, title, phase, round, total }) => ({ code, title, phase, round, total })));
      const stored = identities.filter((saved) => saved.code && saved.phase !== 'recap');
      const save = stored.length ? storage.setItem(storageKey, JSON.stringify(stored)) : storage.removeItem(storageKey);
      void save.then(() => storage.removeItem(legacyStorageKey)).catch(() => {});
    }

    function forgetIdentity(saved: Identity | undefined) {
      if (!saved?.code) return;
      identities = identities.filter((entry) => entry.code !== saved.code);
      publishIdentities();
    }

    function disconnect() {
      clearTimeout(retry);
      clearTimeout(handshakeTimeout);
      const peer = socket;
      socket = null;
      peer?.close();
    }

    function clearRoom() {
      forgetIdentity(identity);
      if (identity) delete identity.code;
      currentRoom = null;
      setConnected(false);
      setPending(false);
      setRoom(null);
      disconnect();
    }

    function open(entry: Enter, creationAttempts = 1) {
      disconnect();
      const path = entry.type === 'create' ? '/ws/new' : `/ws/${encodeURIComponent(entry.code.toUpperCase().trim())}`;
      const peer = new WebSocket(origin.replace(/^http/, 'ws') + path);
      socket = peer;
      handshakeTimeout = setTimeout(() => peer.close(), 12_000);
      let joining = true;

      function sendEntry() {
        peer.send(JSON.stringify(entry));
      }

      peer.onopen = async () => {
        if (stopped || socket !== peer) return;
        try {
          const idToken = await getIdToken();
          if (stopped || socket !== peer || peer.readyState !== WebSocket.OPEN) return;
          if (!idToken) throw new Error('Sign-in expired');
          peer.send(JSON.stringify({ type: 'authenticate', idToken }));
        } catch {
          if (stopped || socket !== peer) return;
          setError('Could not verify your sign-in. Check your connection and try again.');
          setConnected(false);
          setPending(false);
          if (currentRoom) peer.close();
          else disconnect();
        }
      };

      peer.onmessage = ({ data }) => {
        if (stopped || socket !== peer) return;
        const message = JSON.parse(data) as Message | { type: 'authenticated' };
        if (message.type === 'authenticated') {
          sendEntry();
          return;
        }
        if (message.type === 'error' && message.retryCreate && entry.type === 'create' && creationAttempts < 3) {
          open(entry, creationAttempts + 1);
          return;
        }
        setPending(false);
        if (message.type === 'state') {
          joining = false;
          attempts = 0;
          clearTimeout(handshakeTimeout);
          const saved = identity!;
          const { code, phase, round, total } = message.room;
          if (saved.detached || saved.code !== code || saved.phase !== phase || saved.round !== round ||
              saved.total !== total || !saved.title) {
            saved.code = code;
            saved.title = message.room.customDeck?.name ?? getDeck(message.room.deckId)?.name ?? message.room.deckId;
            saved.phase = phase;
            saved.round = round;
            saved.total = total;
            saved.updatedAt = Date.now();
            delete saved.detached;
            identities = identities.filter((entry) => entry.code !== code);
            if (phase !== 'recap') identities.unshift(saved);
            publishIdentities();
          }
          setConnected(true);
          setError('');
          currentRoom = message.room;
          setRoom(message.room);
        } else {
          setError(message.message);
          if (message.reset) clearRoom();
          else if (joining) disconnect();
        }
      };

      peer.onerror = () => peer.close();
      peer.onclose = () => {
        if (stopped || socket !== peer) return;
        socket = null;
        clearTimeout(handshakeTimeout);
        setConnected(false);
        setPending(false);
        if (currentRoom && identity?.code) {
          const { code, token } = identity;
          retry = setTimeout(() => open({ type: 'resume', code, token }), Math.min(500 * 2 ** attempts++, 5000));
        } else {
          setError('Could not reach the game server. Try again in a moment.');
        }
      };
    }

    controller.current = {
      send(command) {
        if (!identity) {
          setError('Getting your session ready. Try again in a moment.');
          return;
        }
        if (command.type === 'create' || command.type === 'join') {
          const existing = command.type === 'join'
            ? identities.find((saved) => saved.code === command.code.trim().toUpperCase())
            : undefined;
          identity = existing ?? { token: newToken() };
          setError('');
          setPending(true);
          open({ ...command, token: identity.token });
          return;
        }
        if (socket?.readyState !== WebSocket.OPEN) {
          setError('Could not reach the game server. Try again in a moment.');
          return;
        }
        setError('');
        setPending(true);
        socket.send(JSON.stringify(command));
      },
      rejoin(code) {
        const saved = identities.find((entry) => entry.code === code);
        if (!saved) {
          setError('That saved game is no longer available.');
          return;
        }
        identity = saved;
        setError('');
        setPending(true);
        open({ type: 'resume', code, token: saved.token });
      },
      leave() {
        if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type: 'leave' }));
        if (currentRoom && currentRoom.phase !== 'lobby' && currentRoom.phase !== 'recap') {
          if (identity) identity.detached = true;
          publishIdentities();
          setConnected(false);
          setPending(false);
          setRoom(null);
          currentRoom = null;
          disconnect();
        } else {
          clearRoom();
        }
        setError('');
      },
    };

    void Promise.all([storage.getItem(storageKey), storage.getItem(legacyStorageKey)]).then(([value, legacy]) => {
      if (stopped) return;
      try {
        const parsed = value ? JSON.parse(value) : null;
        if (Array.isArray(parsed)) {
          identities = parsed.filter((saved): saved is Identity => saved && typeof saved.token === 'string' &&
            typeof saved.code === 'string' && /^[A-HJ-NP-Z2-9]{5}$/i.test(saved.code));
        }
      } catch {}
      try {
        const parsed = legacy ? JSON.parse(legacy) : null;
        if (parsed && typeof parsed.token === 'string' && typeof parsed.code === 'string' &&
          /^[A-HJ-NP-Z2-9]{5}$/i.test(parsed.code) && !identities.some((saved) => saved.code === parsed.code)) {
          identities.push(parsed as Identity);
        }
      } catch {}
      identities = identities.filter((saved, index, all) => all.findIndex((entry) => entry.code === saved.code) === index);
      identities = identities.filter((saved) => saved.phase !== 'recap');
      identities.sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
      identity = identities.find((saved) => !saved.detached);
      publishIdentities();
    }).catch(() => {}).finally(() => {
      if (stopped) return;
      identity ??= { token: newToken() };
      setReadyUid(uid);
      if (identity.code) open({ type: 'resume', code: identity.code, token: identity.token });
    });

    return () => {
      stopped = true;
      controller.current = null;
      disconnect();
    };
  }, [authReady, origin, uid]);

  return {
    room,
    rejoinableGames,
    available: Boolean(origin),
    ready: authReady && Boolean(uid && uid === readyUid),
    connected,
    pending,
    error,
    send(command: Outbound) {
      if (controller.current) controller.current.send(command);
      else setError('Could not reach the game server. Try again in a moment.');
    },
    rejoin: (code: string) => controller.current?.rejoin(code),
    leave: () => controller.current?.leave(),
    clearError: () => setError(''),
  };
}
