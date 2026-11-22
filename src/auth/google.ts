import {
  GoogleAuthProvider,
  linkWithPopup,
  signInWithPopup,
  type Auth,
  type User,
} from 'firebase/auth';

export const googleSignInAvailable = true;

export async function signInWithGoogle(auth: Auth, guest: User | null) {
  const provider = new GoogleAuthProvider();
  const result = guest
    ? await linkWithPopup(guest, provider)
    : await signInWithPopup(auth, provider);
  return result.user;
}
