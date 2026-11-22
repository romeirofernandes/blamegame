import type { FirebaseOptions } from 'firebase/app';
import Constants from 'expo-constants';

const projectConfig: FirebaseOptions | undefined = Constants.expoConfig?.extra?.firebase;

const firebaseConfig: FirebaseOptions = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY || projectConfig?.apiKey,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || projectConfig?.authDomain,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || projectConfig?.projectId,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID || projectConfig?.appId,
};

export const missingFirebaseConfig = [
  ['EXPO_PUBLIC_FIREBASE_API_KEY', firebaseConfig.apiKey],
  ['EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN', firebaseConfig.authDomain],
  ['EXPO_PUBLIC_FIREBASE_PROJECT_ID', firebaseConfig.projectId],
  ['EXPO_PUBLIC_FIREBASE_APP_ID', firebaseConfig.appId],
]
  .filter(([, value]) => !value)
  .map(([name]) => name);

export const firebaseConfigReady = missingFirebaseConfig.length === 0;
export { firebaseConfig };
