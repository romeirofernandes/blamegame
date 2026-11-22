/// <reference types="bun" />
import { expect, mock, test } from 'bun:test';
import type { Auth, User } from 'firebase/auth';

const googleUser = { uid: 'google-user', isAnonymous: false } as User;
const linkedUser = { uid: 'guest-user', isAnonymous: false } as User;
const guest = { uid: 'guest-user', isAnonymous: true } as User;
const auth = {} as Auth;
let googleResponse: unknown = { type: 'success', data: { idToken: 'google-id-token' } };

class MockGoogleAuthProvider {
  static credential = mock((idToken: string) => ({ idToken }));
}

const linkWithCredential = mock(async () => ({ user: linkedUser }));
const signInWithCredential = mock(async () => ({ user: googleUser }));
const linkWithPopup = mock(async () => ({ user: linkedUser }));
const signInWithPopup = mock(async () => ({ user: googleUser }));
const configure = mock(() => {});
const hasPlayServices = mock(async () => true);
const signIn = mock(async () => googleResponse);

mock.module('firebase/auth', () => ({
  GoogleAuthProvider: MockGoogleAuthProvider,
  linkWithCredential,
  signInWithCredential,
  linkWithPopup,
  signInWithPopup,
}));

mock.module('expo-constants', () => ({
  default: {
    executionEnvironment: 'standalone',
    expoConfig: {
      extra: {
        googleWebClientId: 'web-client-id',
        googleIOSClientId: 'ios-client-id',
        googleIOSUrlScheme: 'com.googleusercontent.apps.ios-client',
      },
    },
  },
  ExecutionEnvironment: { StoreClient: 'storeClient' },
}));

mock.module('react-native', () => ({ Platform: { OS: 'android' } }));
mock.module('@react-native-google-signin/google-signin', () => ({
  GoogleSignin: { configure, hasPlayServices, signIn },
  isSuccessResponse: (response: { type?: string }) => response.type === 'success',
}));

function clearMocks() {
  for (const fn of [
    MockGoogleAuthProvider.credential,
    linkWithCredential,
    signInWithCredential,
    linkWithPopup,
    signInWithPopup,
    configure,
    hasPlayServices,
    signIn,
  ]) fn.mockClear();
  googleResponse = { type: 'success', data: { idToken: 'google-id-token' } };
}

test('native Google sign-in links a guest using Firebase credentials', async () => {
  clearMocks();
  const { signInWithGoogle } = await import('./google.native');

  const result = await signInWithGoogle(auth, guest);

  expect(result).toBe(linkedUser);
  expect(configure).toHaveBeenCalledWith({ webClientId: 'web-client-id' });
  expect(hasPlayServices).toHaveBeenCalledWith({ showPlayServicesUpdateDialog: true });
  expect(MockGoogleAuthProvider.credential).toHaveBeenCalledWith('google-id-token');
  expect(linkWithCredential).toHaveBeenCalledWith(guest, { idToken: 'google-id-token' });
  expect(signInWithCredential).not.toHaveBeenCalled();
});

test('native Google cancellation leaves Firebase untouched', async () => {
  clearMocks();
  googleResponse = { type: 'cancelled' };
  const { signInWithGoogle } = await import('./google.native');

  expect(await signInWithGoogle(auth, null)).toBeNull();
  expect(linkWithCredential).not.toHaveBeenCalled();
  expect(signInWithCredential).not.toHaveBeenCalled();
});

test('web Google sign-in uses Firebase popup and links a guest when present', async () => {
  clearMocks();
  const { signInWithGoogle } = await import('./google');

  expect(await signInWithGoogle(auth, guest)).toBe(linkedUser);
  expect(linkWithPopup).toHaveBeenCalledWith(guest, expect.any(MockGoogleAuthProvider));
  expect(signInWithPopup).not.toHaveBeenCalled();

  clearMocks();
  expect(await signInWithGoogle(auth, null)).toBe(googleUser);
  expect(signInWithPopup).toHaveBeenCalledWith(auth, expect.any(MockGoogleAuthProvider));
  expect(linkWithPopup).not.toHaveBeenCalled();
});
