import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { getRandomValues } from 'expo-crypto';
import type { Command, Message, RoomView } from './game';

type Enter = Extract<Command, { type: 'create' | 'join' | 'resume' }>;
type Outbound = Exclude<Command, Enter>
  | Omit<Extract<Enter, { type: 'create' }>, 'token'>
  | Omit<Extract<Enter, { type: 'join' }>, 'token'>;
type Account = { uid: string; getIdToken: () => Promise<string> };
type Identity = { token: string; code?: string };

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
    if (location.port === '8081') return `${location.protocol}//${location.hostname}:3000`;
    return location.origin;
  }
  const host = Constants.expoConfig?.hostUri?.split(':')[0];
  return host ? `http://${host}:3000` : '';
}

export function useRoom(account: Account | null = null, authReady = true) {
  const controller = useRef<{ send: (command: Outbound) => void; leave: () => void }>(null);
  const [room, setRoom] = useState<RoomView | null>(null);
  const [connected, setConnected] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const uid = account?.uid;
  const getIdToken = useEffectEvent(() => account?.getIdToken());

  useEffect(() => {
    setRoom(null);
    setError('');
    setPending(false);
    setConnected(false);
    const origin = webOrigin();
    if (!origin || !authReady) return;

    const storageKey = uid ? `blame-game-session:${uid}` : 'blame-game-session';
    let stopped = false;
    let retry: ReturnType<typeof setTimeout> | undefined;
    let handshakeTimeout: ReturnType<typeof setTimeout> | undefined;
    let attempts = 0;
    let identity: Identity | undefined;
    let socket: WebSocket | null = null;

    function disconnect() {
      clearTimeout(retry);
      clearTimeout(handshakeTimeout);
      const peer = socket;
      socket = null;
      peer?.close();
    }

    function clearRoom() {
      if (identity) delete identity.code;
      void storage.removeItem(storageKey).catch(() => {});
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
        if (!uid) {
          sendEntry();
          return;
        }
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
          disconnect();
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
          if (saved.code !== message.room.code) {
            saved.code = message.room.code;
            void storage.setItem(storageKey, JSON.stringify(saved)).catch(() => {});
          }
          setConnected(true);
          setError('');
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
        if (identity?.code) {
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
      leave() {
        if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type: 'leave' }));
        clearRoom();
        setError('');
      },
    };

    void storage.getItem(storageKey).then((value) => {
      if (stopped || !value) return;
      const saved = JSON.parse(value) as Identity;
      if (typeof saved?.token === 'string') identity = saved;
    }).catch(() => {}).finally(() => {
      if (stopped) return;
      identity ??= { token: newToken() };
      if (identity.code) open({ type: 'resume', code: identity.code, token: identity.token });
    });

    return () => {
      stopped = true;
      controller.current = null;
      disconnect();
    };
  }, [authReady, uid]);

  return {
    room,
    connected,
    pending,
    error,
    send(command: Outbound) {
      if (controller.current) controller.current.send(command);
      else setError('Could not reach the game server. Try again in a moment.');
    },
    leave: () => controller.current?.leave(),
    clearError: () => setError(''),
  };
}
