import { useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { getRandomValues } from 'expo-crypto';
import type { Command, Message, RoomView } from './game';

type Outbound = Exclude<Command, { type: 'create' | 'join' }>
  | Omit<Extract<Command, { type: 'create' }>, 'token'>
  | Omit<Extract<Command, { type: 'join' }>, 'token'>;

type Identity = { token: string; code?: string };
const storageKey = 'blame-game-session';
const storage = Platform.OS === 'web' ? {
  async getItem(key: string) { return sessionStorage.getItem(key); },
  async setItem(key: string, value: string) { sessionStorage.setItem(key, value); },
  async removeItem(key: string) { sessionStorage.removeItem(key); },
} : AsyncStorage;

function newToken() {
  return Array.from(getRandomValues(new Uint8Array(24)), (byte) => byte.toString(16).padStart(2, '0')).join('');
}
const serverUrl = process.env.EXPO_PUBLIC_SERVER_URL?.replace(/\/$/, '');

export function webOrigin() {
  if (serverUrl) return serverUrl;
  if (Platform.OS === 'web') {
    if (location.port === '8081') return `${location.protocol}//${location.hostname}:3000`;
    return location.origin;
  }
  const host = Constants.expoConfig?.hostUri?.split(':')[0];
  return host ? `http://${host}:3000` : '';
}

export function useRoom() {
  const socket = useRef<WebSocket | null>(null);
  const identity = useRef<Identity | null>(null);
  const [room, setRoom] = useState<RoomView | null>(null);
  const [connected, setConnected] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const origin = webOrigin();
    if (!origin) return;
    let stopped = false;
    let retry: ReturnType<typeof setTimeout>;
    let attempts = 0;

    function connect() {
      if (stopped) return;
      const peer = new WebSocket(origin.replace(/^http/, 'ws') + '/ws');
      socket.current = peer;
      peer.onopen = () => {
        if (stopped) return;
        attempts = 0;
        setConnected(true);
        const saved = identity.current;
        if (saved?.code) peer.send(JSON.stringify({ type: 'resume', code: saved.code, token: saved.token }));
      };
      peer.onmessage = ({ data }) => {
        if (stopped) return;
        const message = JSON.parse(data) as Message;
        setPending(false);
        if (message.type === 'state') {
          const saved = identity.current!;
          if (saved.code !== message.room.code) {
            saved.code = message.room.code;
            void storage.setItem(storageKey, JSON.stringify(saved)).catch(() => {});
          }
          setError('');
          setRoom(message.room);
        } else {
          setError(message.message);
          if (message.reset) clear();
        }
      };
      peer.onerror = () => peer.close();
      peer.onclose = () => {
        if (stopped) return;
        socket.current = null;
        setConnected(false);
        setPending(false);
        retry = setTimeout(connect, Math.min(500 * 2 ** attempts++, 5000));
      };
    }

    void storage.getItem(storageKey).then((value) => {
      if (value) {
        const saved = JSON.parse(value) as Identity;
        if (typeof saved?.token === 'string') identity.current = saved;
      }
    }).catch(() => {}).finally(() => {
      if (stopped) return;
      identity.current ??= { token: newToken() };
      connect();
    });

    return () => {
      stopped = true;
      clearTimeout(retry);
      socket.current?.close();
      socket.current = null;
    };
  }, []);

  function clear() {
    if (identity.current) delete identity.current.code;
    void storage.removeItem(storageKey).catch(() => {});
    setRoom(null);
  }

  function send(command: Outbound) {
    const peer = socket.current;
    if (peer?.readyState !== WebSocket.OPEN || !identity.current) {
      setError('Couldn’t reach the game server. Try again in a moment.');
      return;
    }
    const payload = command.type === 'create' || command.type === 'join'
      ? { ...command, token: identity.current.token }
      : command;
    setError('');
    setPending(true);
    peer.send(JSON.stringify(payload));
  }

  function leave() {
    if (socket.current?.readyState === WebSocket.OPEN) socket.current.send(JSON.stringify({ type: 'leave' }));
    clear();
    setPending(false);
    setError('');
  }

  return { room, connected, pending, error, send, leave, clearError: () => setError('') };
}
