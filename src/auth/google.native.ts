import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform } from 'react-native';
import {
  GoogleAuthProvider,
  linkWithCredential,
  signInWithCredential,
  type Auth,
  type User,
} from 'firebase/auth';

const webClientId =
  process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ||
  Constants.expoConfig?.extra?.googleWebClientId;
const iosClientId =
  process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ||
  Constants.expoConfig?.extra?.googleIOSClientId;
const iosUrlScheme = Constants.expoConfig?.extra?.googleIOSUrlScheme;
const nativeGoogleAvailable =
  Constants.executionEnvironment !== ExecutionEnvironment.StoreClient;

export const googleSignInAvailable =
  Boolean(webClientId) &&
  nativeGoogleAvailable &&
  (Platform.OS !== 'ios' || Boolean(iosClientId && iosUrlScheme));

export async function signInWithGoogle(auth: Auth, guest: User | null) {
  if (!googleSignInAvailable || !webClientId) {
    throw Object.assign(new Error('Google sign-in is not configured for this build.'), {
      code: 'auth/google-not-configured',
    });
  }

  const { GoogleSignin, isSuccessResponse } = await import(
    '@react-native-google-signin/google-signin'
  );
  GoogleSignin.configure({
    webClientId,
    ...(Platform.OS === 'ios' && iosClientId ? { iosClientId } : {}),
  });
  if (Platform.OS === 'android') {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
  }
  const result = await GoogleSignin.signIn();
  if (!isSuccessResponse(result)) return null;

  const idToken = result.data.idToken;
  if (!idToken) {
    throw Object.assign(new Error('Google did not return an ID token.'), {
      code: 'auth/google-id-token-missing',
    });
  }

  const credential = GoogleAuthProvider.credential(idToken);
  const userCredential = guest
    ? await linkWithCredential(guest, credential)
    : await signInWithCredential(auth, credential);
  return userCredential.user;
}
