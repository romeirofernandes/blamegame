import { useRef, useState } from 'react';
import { Image, View, type TextInputInstance } from 'react-native';
import { HugeiconsIcon } from '@hugeicons/react-native';
import EyeIcon from '@hugeicons/core-free-icons/EyeIcon';
import EyeOffIcon from '@hugeicons/core-free-icons/EyeOffIcon';
import { Tabs, TabsList, TabsTrigger } from './beui/tabs';
import { Body, Button, Field, Label, Surface, Tap, Title } from './ui';
import { useAppearance } from './appearance';
import { useAuth } from './auth';

type AccountScreenProps = { forPlay?: boolean; onAuthenticated: () => void };
type FormMode = 'signin' | 'signup';

function errorMessage(error: unknown, action: 'signin' | 'signup' | 'signout' | 'google', linkingGuest: boolean) {
  const code = (error as { code?: string } | null)?.code;
  if (code === 'auth/invalid-email') return 'Enter a valid email address.';
  if (code === 'auth/weak-password') return 'Choose a password with at least 6 characters.';
  if (code === 'auth/email-already-in-use') return 'An account already uses this email. Sign in instead.';
  if (code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found') {
    return action === 'google'
      ? 'Firebase couldn’t verify your Google sign-in. Try again or use email and password.'
      : 'Email or password did not match. Check your details and try again.';
  }
  if (code === 'auth/credential-already-in-use' && linkingGuest) {
    return action === 'google'
      ? 'That Google account already has a Blame Game account. Sign in to it; this guest session stays separate.'
      : 'That email already has an account. Sign in to that account; this guest session stays separate.';
  }
  if (code === 'auth/account-exists-with-different-credential') {
    return 'A Blame Game account already uses this Google email with another sign-in method. Use that method to sign in.';
  }
  if (code === 'auth/guest-link-uid-changed') {
    return 'This guest account could not be linked. Your guest session is still active; try again.';
  }
  if (code === 'auth/google-not-configured' || code === 'auth/google-id-token-missing') {
    return 'Google sign-in is not configured for this build. Ask the app owner to finish Google setup.';
  }
  if (code === 'auth/operation-not-allowed' || code === 'auth/admin-restricted-operation') {
    return `Ask the app owner to enable ${action === 'google' ? 'Google' : 'Email/Password'} sign-in in Firebase.`;
  }
  if (code === 'PLAY_SERVICES_NOT_AVAILABLE') return 'Google Play Services is unavailable or needs an update.';
  if (code === 'auth/unauthorized-domain') {
    return 'This web address is not authorized for sign-in. Ask the app owner to add it in Firebase Authentication settings.';
  }
  if (code === 'auth/popup-blocked') return 'Allow pop-ups for this site, then try Google sign-in again.';
  if (code === 'auth/network-request-failed') return 'Unable to reach Firebase. Check your connection and try again.';
  if (action === 'signout') return 'Unable to sign out. Check your connection and try again.';
  if (action === 'signup') return 'Unable to create the account. Check your details and try again.';
  if (action === 'google') return 'Unable to sign in with Google. Try again or use email and password.';
  return 'Unable to sign in. Check your details and try again.';
}

export function AccountScreen({ forPlay, onAuthenticated }: AccountScreenProps) {
  const { user, loading, configured, googleSignInAvailable, signIn, signUp, signInWithGoogle, signOut } = useAuth();
  const { colors } = useAppearance();
  const [mode, setMode] = useState<FormMode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const emailInput = useRef<TextInputInstance | null>(null);
  const passwordInput = useRef<TextInputInstance | null>(null);
  const isGuest = Boolean(user?.isAnonymous);

  async function run(action: 'signin' | 'signup' | 'signout') {
    setError('');
    if (action !== 'signout' && !email.trim()) {
      setError('Enter your email address.');
      emailInput.current?.focus();
      return;
    }
    if ((action === 'signin' || action === 'signup') && !password) {
      setError('Enter your password.');
      passwordInput.current?.focus();
      return;
    }

    setBusy(true);
    try {
      if (action === 'signin') await signIn(email, password);
      if (action === 'signup') {
        const guestUid = isGuest ? user?.uid : null;
        const signedUpUser = await signUp(email, password);
        if (guestUid && (signedUpUser.uid !== guestUid || signedUpUser.isAnonymous)) {
          throw Object.assign(new Error('Guest identity changed during account linking.'), { code: 'auth/guest-link-uid-changed' });
        }
      }
      if (action === 'signout') await signOut();
      setPassword('');
      setPasswordVisible(false);
      if (action !== 'signout') onAuthenticated();
    } catch (cause) {
      setError(errorMessage(cause, action, isGuest));
    } finally {
      setBusy(false);
    }
  }

  async function runGoogleSignIn() {
    setError('');
    setBusy(true);
    try {
      const guestUid = isGuest ? user?.uid : null;
      const signedInUser = await signInWithGoogle();
      if (!signedInUser) return;
      if (guestUid && (signedInUser.uid !== guestUid || signedInUser.isAnonymous)) {
        throw Object.assign(new Error('Guest identity changed during Google account linking.'), {
          code: 'auth/guest-link-uid-changed',
        });
      }
      onAuthenticated();
    } catch (cause) {
      const code = (cause as { code?: string } | null)?.code;
      if (code !== 'auth/popup-closed-by-user' && code !== 'auth/cancelled-popup-request') {
        setError(errorMessage(cause, 'google', isGuest));
      }
    } finally {
      setBusy(false);
    }
  }

  if (!configured) {
    return (
      <Surface className="gap-4 p-5">
        <Label className="text-peach">Account setup</Label>
        <Title className="text-[44px] leading-[1]">Account setup needed</Title>
        <Body className="text-muted">
          Ask the app owner to finish Firebase setup so you can sign in and play.
        </Body>
      </Surface>
    );
  }

  if (loading) {
    return (
      <View className="gap-3">
        <Title>One moment</Title>
        <Body accessibilityLiveRegion="polite" className="text-muted">Restoring your account…</Body>
      </View>
    );
  }

  if (user && !isGuest) {
    return (
      <View className="gap-6">
        <View className="gap-2">
          <Label className="text-lilac-strong">Signed in</Label>
          <Title>Good to see you</Title>
          <Body className="text-muted">{user.email || 'Your account is ready.'}</Body>
        </View>
        {!!error && (
          <Surface className="border-peach/40 p-3">
            <Body accessibilityRole="alert" className="text-peach">{error}</Body>
          </Surface>
        )}
        <Button tone="danger" arrow={false} onPress={() => void run('signout')} disabled={busy}>
          {busy ? 'Signing out…' : 'Sign out'}
        </Button>
      </View>
    );
  }

  return (
    <View className="gap-6">
      <View className="gap-2">
        <Label className="text-lilac-strong">{isGuest ? 'Guest account' : 'Account'}</Label>
        <Title>{isGuest ? 'Save your account' : mode === 'signup' ? 'Create account' : forPlay ? 'Sign in to play' : 'Welcome back'}</Title>
        <Body className="text-muted">
          {isGuest
            ? 'Link email and password or Google sign-in to this guest account. Firebase keeps the same player identity.'
            : mode === 'signup' ? 'Set up your account to play.'
            : forPlay ? 'Sign in or create an account to continue.' : 'Sign in to your account.'}
        </Body>
      </View>

      {!isGuest && (
        <Tabs
          value={mode}
          values={['signin', 'signup']}
          onValueChange={(value) => {
            if (!busy && (value === 'signin' || value === 'signup')) {
              setMode(value);
              setPasswordVisible(false);
              setError('');
            }
          }}
        >
          <TabsList accessibilityLabel="Account form">
            <TabsTrigger value="signin" disabled={busy}>Sign in</TabsTrigger>
            <TabsTrigger value="signup" disabled={busy}>Create account</TabsTrigger>
          </TabsList>
        </Tabs>
      )}

      {googleSignInAvailable && (
        <Button label={isGuest ? 'Link Google account' : 'Continue with Google'} tone="secondary" arrow={false} onPress={() => void runGoogleSignIn()} disabled={busy}>
          <Image accessible={false} aria-hidden source={require('../assets/google-mark.png')} style={{ width: 20, height: 20 }} resizeMode="contain" />
          <Body className="text-center font-boldface text-base">{isGuest ? 'Link Google account' : 'Continue with Google'}</Body>
        </Button>
      )}

      <View className="gap-4">
        <Field
          label="Email"
          ref={emailInput}
          accessibilityLabel="Email"
          autoCapitalize="none"
          autoComplete="email"
          autoCorrect={false}
          className="web:focus-visible:outline-2 web:focus-visible:outline-lilac-strong"
          keyboardType="email-address"
          onChangeText={setEmail}
          onSubmitEditing={() => passwordInput.current?.focus()}
          placeholder="you@example.com"
          returnKeyType="next"
          textContentType="emailAddress"
          value={email}
        />
        <View className="gap-2">
          <Field
            label="Password"
            ref={passwordInput}
            accessibilityLabel="Password"
            accessibilityHint={mode === 'signup' ? 'Use at least 6 characters.' : undefined}
            autoComplete={mode === 'signup' || isGuest ? 'new-password' : 'current-password'}
            onChangeText={setPassword}
            onSubmitEditing={() => void run(isGuest || mode === 'signup' ? 'signup' : 'signin')}
            placeholder={mode === 'signup' || isGuest ? 'At least 6 characters' : 'Enter your password'}
            returnKeyType="go"
            secureTextEntry={!passwordVisible}
            trailing={(
              <Tap
                label={passwordVisible ? 'Hide password' : 'Show password'}
                className="size-12 items-center rounded-xl"
                onPress={() => setPasswordVisible((visible) => !visible)}
              >
                <HugeiconsIcon accessible={false} icon={passwordVisible ? EyeOffIcon : EyeIcon} size={22} color={colors.muted} strokeWidth={1.8} />
              </Tap>
            )}
            textContentType={mode === 'signup' || isGuest ? 'newPassword' : 'password'}
            value={password}
          />
          {isGuest && <Body className="text-sm leading-5 text-muted">Use at least 6 characters.</Body>}
        </View>
      </View>

      {!!error && (
        <Surface className="border-peach/40 p-3">
          <Body accessibilityRole="alert" className="text-peach">{error}</Body>
        </Surface>
      )}

      <View className="gap-3">
        <Button onPress={() => void run(isGuest || mode === 'signup' ? 'signup' : 'signin')} disabled={busy}>
          {busy ? 'Connecting…' : isGuest ? 'Save account' : mode === 'signup' ? 'Create account' : 'Sign in'}
        </Button>
        {isGuest && (
          <Button tone="danger" arrow={false} onPress={() => void run('signout')} disabled={busy}>
            {busy ? 'Updating account…' : 'Sign out'}
          </Button>
        )}
      </View>
      <Body accessibilityLiveRegion="polite" className="min-h-5 text-center text-sm text-muted">
        {busy ? 'Connecting to your account…' : ' '}
      </Body>
    </View>
  );
}
