import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApp, getApps, initializeApp } from 'firebase/app';
import * as FirebaseAuth from 'firebase/auth';
import type { Auth, Persistence } from 'firebase/auth';
import { firebaseConfig, firebaseConfigReady } from './config';

// Firebase Auth exposes this from its React Native runtime entry, but not its shared declaration file.
const { getAuth, initializeAuth, getReactNativePersistence } = FirebaseAuth as typeof FirebaseAuth & {
  getReactNativePersistence(storage: typeof AsyncStorage): Persistence;
};

let auth: Auth | null = null;
let initializationError: Error | null = null;

if (firebaseConfigReady) {
  try {
    const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
    try {
      auth = initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) });
    } catch (error) {
      if ((error as { code?: string }).code !== 'auth/already-initialized') throw error;
      auth = getAuth(app);
    }
  } catch (error) {
    initializationError = error instanceof Error ? error : new Error('Firebase Auth initialization failed.');
  }
}

export { auth, initializationError };
