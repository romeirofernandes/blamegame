import { createContext, createElement, useContext, useEffect, useMemo, useState, type PropsWithChildren } from 'react';
import {
  createUserWithEmailAndPassword,
  EmailAuthProvider,
  linkWithCredential,
  onIdTokenChanged,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  type User,
} from 'firebase/auth';
import { auth, initializationError } from './auth/firebase';
import { firebaseConfigReady, missingFirebaseConfig } from './auth/config';


type AuthContextValue = {
  user: User | null;
  loading: boolean;
  configured: boolean;
  setupError: string | null;
  signIn: (email: string, password: string) => Promise<User>;
  signUp: (email: string, password: string) => Promise<User>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const setupError = !firebaseConfigReady
  ? `Set ${missingFirebaseConfig.join(', ')} in your Expo environment, then restart the app.`
  : initializationError
    ? 'Firebase Auth could not start. Check the public Firebase configuration and restart the app.'
    : null;

function requireAuth() {
  if (!auth) throw new Error(setupError ?? 'Firebase Auth is unavailable.');
  return auth;
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(Boolean(auth) && !initializationError);
  const [authRevision, setAuthRevision] = useState(0);

  useEffect(() => {
    if (!auth || initializationError) return;
    return onIdTokenChanged(
      auth,
      (nextUser) => {
        setUser(nextUser);
        setAuthRevision((revision) => revision + 1);
        setLoading(false);
      },
      () => setLoading(false),
    );
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    user,
    loading,
    configured: Boolean(auth) && !initializationError,
    setupError,
    signIn: async (email, password) => {
      const result = await signInWithEmailAndPassword(requireAuth(), email.trim(), password);
      return result.user;
    },
    signUp: async (email, password) => {
      const currentUser = requireAuth().currentUser;
      if (currentUser?.isAnonymous) {
        const credential = EmailAuthProvider.credential(email.trim(), password);
        const linkedUser = (await linkWithCredential(currentUser, credential)).user;
        if (linkedUser.uid !== currentUser.uid || linkedUser.isAnonymous) {
          throw Object.assign(new Error('Firebase changed the guest account UID while linking credentials.'), {
            code: 'auth/guest-link-uid-changed',
          });
        }
        setUser(linkedUser);
        setAuthRevision((revision) => revision + 1);
        return linkedUser;
      }
      return (await createUserWithEmailAndPassword(requireAuth(), email.trim(), password)).user;
    },
    signOut: async () => firebaseSignOut(requireAuth()),
  }), [user, loading, authRevision]);

  return createElement(AuthContext.Provider, { value }, children);
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider.');
  return context;
}
