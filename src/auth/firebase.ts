import { getApp, getApps, initializeApp } from 'firebase/app';
import {
  browserLocalPersistence,
  getAuth,
  initializeAuth,
  type Auth,
} from 'firebase/auth';
import { firebaseConfig, firebaseConfigReady } from './config';

let auth: Auth | null = null;
let initializationError: Error | null = null;

if (firebaseConfigReady) {
  try {
    const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
    try {
      auth = initializeAuth(app, { persistence: browserLocalPersistence });
    } catch (error) {
      if ((error as { code?: string }).code !== 'auth/already-initialized') throw error;
      auth = getAuth(app);
    }
  } catch (error) {
    initializationError = error instanceof Error ? error : new Error('Firebase Auth initialization failed.');
  }
}

export { auth, initializationError };
