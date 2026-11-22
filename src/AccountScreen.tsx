import { useRef, useState } from 'react';
import { Pressable, TextInput, View, type TextInputInstance } from 'react-native';
import { Body, Label, Tap, Title } from './ui';
import { useAppearance } from './appearance';
import { useAuth } from './auth';

type AccountScreenProps = { onAuthenticated?: () => void };
type FormMode = 'signin' | 'signup';

function AccountAction({ children, onPress, disabled, primary = false }: {
  children: string;
  onPress: () => void;
  disabled?: boolean;
  primary?: boolean;
}) {
  const { colors } = useAppearance();
  return (
    <Tap label={children} onPress={onPress} disabled={disabled} className="rounded-[18px]">
      <View
        className="min-h-14 flex-row items-center justify-center rounded-[18px] border px-4 py-3"
        style={{
          backgroundColor: primary ? colors.lime : colors.panel,
          borderColor: primary ? colors.ink : colors.muted,
          opacity: disabled ? 0.5 : 1,
        }}
      >
        <Body className="text-center font-boldface" style={{ color: primary ? colors.ink : colors.cloud }}>
          {children}
        </Body>
      </View>
    </Tap>
  );
}

function errorMessage(error: unknown, action: 'signin' | 'signup' | 'guest' | 'signout', linkingGuest: boolean) {
  const code = (error as { code?: string } | null)?.code;
  if (code === 'auth/invalid-email') return 'Enter a valid email address.';
  if (code === 'auth/weak-password') return 'Choose a password with at least 6 characters.';
  if (code === 'auth/email-already-in-use') return 'An account already uses this email. Sign in instead.';
  if (code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found') {
    return 'Email or password did not match. Check your details and try again.';
  }
  if (code === 'auth/credential-already-in-use' && linkingGuest) {
    return 'That email already has an account. Sign in to that account; this guest session stays separate.';
  }
  if (code === 'auth/guest-link-uid-changed') {
    return 'This guest account could not be linked. Your guest session is still active; try again.';
  }
  if (code === 'auth/operation-not-allowed') {
    return action === 'guest'
      ? 'Guest play is not enabled for this app. Ask the app owner to turn it on.'
      : 'Email sign-in is not enabled for this app. Ask the app owner to turn it on.';
  }
  if (code === 'auth/network-request-failed') return 'Unable to reach Firebase. Check your connection and try again.';
  if (action === 'signout') return 'Unable to sign out. Check your connection and try again.';
  if (action === 'guest') return 'Unable to start a guest session. Check your connection and try again.';
  if (action === 'signup') return 'Unable to create the account. Check your details and try again.';
  return 'Unable to sign in. Check your details and try again.';
}

export function AccountScreen({ onAuthenticated }: AccountScreenProps) {
  const { colors } = useAppearance();
  const { user, loading, configured, signIn, signUp, signInAsGuest, signOut } = useAuth();
  const [mode, setMode] = useState<FormMode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [linkedGuestUid, setLinkedGuestUid] = useState<string | null>(null);
  const emailInput = useRef<TextInputInstance | null>(null);
  const passwordInput = useRef<TextInputInstance | null>(null);
  const isGuest = Boolean(user?.isAnonymous);

  async function run(action: 'signin' | 'signup' | 'guest' | 'signout') {
    setError('');
    setLinkedGuestUid(null);
    if (action !== 'signout' && action !== 'guest' && !email.trim()) {
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
        if (guestUid) setLinkedGuestUid(guestUid);
      }
      if (action === 'guest') await signInAsGuest();
      if (action === 'signout') await signOut();
      if (action !== 'signout') onAuthenticated?.();
      setPassword('');
    } catch (cause) {
      setError(errorMessage(cause, action, isGuest));
    } finally {
      setBusy(false);
    }
  }

  if (!configured) {
    return (
      <View className="gap-4 rounded-[24px] border border-line bg-panel p-5">
        <Label className="text-peach">Account setup</Label>
        <Title className="text-[44px] leading-[1]">Play can still go on</Title>
        <Body className="text-muted">
          Account sign-in is not available right now. You can still host or join a room with a nickname.
        </Body>
      </View>
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
        {linkedGuestUid === user.uid && (
          <Body className="rounded-xl border border-line bg-panel p-3 text-muted">
            Guest account saved. Your player identity stayed the same.
          </Body>
        )}
        {!!error && <Body accessibilityRole="alert" className="rounded-xl border border-peach/40 bg-panel p-3 text-peach">{error}</Body>}
        <AccountAction onPress={() => void run('signout')} disabled={busy}>
          {busy ? 'Signing out…' : 'Sign out'}
        </AccountAction>
      </View>
    );
  }

  return (
    <View className="gap-6">
      <View className="gap-2">
        <Label className="text-lilac-strong">{isGuest ? 'Guest account' : 'Account'}</Label>
        <Title>{isGuest ? 'Link email sign-in' : mode === 'signup' ? 'Create an account' : 'Welcome back'}</Title>
        <Body className="text-muted">
          {isGuest
            ? 'Link an email and password to this guest account. Firebase keeps the same player identity.'
            : mode === 'signup'
              ? 'Create an account to sign in with email and password.'
              : 'Sign in to your account.'}
        </Body>
      </View>

      {!isGuest && (
        <View className="flex-row rounded-[16px] border border-line bg-panel p-1">
          {(['signin', 'signup'] as const).map((item) => {
            const selected = mode === item;
            return (
              <Pressable
                key={item}
                accessibilityRole="button"
                accessibilityLabel={item === 'signin' ? 'Sign-in form' : 'Account creation form'}
                accessibilityState={{ selected }}
                disabled={busy}
                className={`min-h-12 flex-1 items-center justify-center rounded-[12px] border web:focus-visible:outline-2 web:focus-visible:outline-lilac-strong ${selected ? 'border-lilac-strong bg-lilac' : 'border-transparent'}`}
                onPress={() => { setMode(item); setError(''); }}
              >
                <Body className={selected ? 'font-boldface text-ink' : 'text-muted'}>
                  {item === 'signin' ? 'Sign in' : 'Create account'}
                </Body>
              </Pressable>
            );
          })}
        </View>
      )}

      <View className="gap-4">
        <View className="gap-2">
          <Label>Email</Label>
          <TextInput
            ref={emailInput}
            accessibilityLabel="Email"
            autoCapitalize="none"
            autoComplete="email"
            autoCorrect={false}
            className="min-h-14 rounded-[16px] border border-line bg-panel px-4 py-3 font-body text-base web:focus-visible:outline-2 web:focus-visible:outline-lilac-strong"
            keyboardType="email-address"
            onChangeText={setEmail}
            onSubmitEditing={() => passwordInput.current?.focus()}
            placeholder="you@example.com"
            placeholderTextColor={colors.muted}
            returnKeyType="next"
            style={{ borderColor: colors.muted, color: colors.cloud }}
            textContentType="emailAddress"
            value={email}
          />
        </View>
        <View className="gap-2">
          <Label>Password</Label>
          <TextInput
            ref={passwordInput}
            accessibilityLabel="Password"
            autoComplete={mode === 'signup' || isGuest ? 'new-password' : 'current-password'}
            className="min-h-14 rounded-[16px] border border-line bg-panel px-4 py-3 font-body text-base web:focus-visible:outline-2 web:focus-visible:outline-lilac-strong"
            onChangeText={setPassword}
            onSubmitEditing={() => void run(isGuest || mode === 'signup' ? 'signup' : 'signin')}
            placeholder={mode === 'signup' || isGuest ? 'At least 6 characters' : 'Enter your password'}
            placeholderTextColor={colors.muted}
            returnKeyType="go"
            secureTextEntry
            style={{ borderColor: colors.muted, color: colors.cloud }}
            textContentType={mode === 'signup' || isGuest ? 'newPassword' : 'password'}
            value={password}
          />
          {(mode === 'signup' || isGuest) && <Body className="text-sm leading-5 text-muted">Use at least 6 characters.</Body>}
        </View>
      </View>

      {!!error && <Body accessibilityRole="alert" className="rounded-xl border border-peach/40 bg-panel p-3 text-peach">{error}</Body>}

      <View className="gap-3">
        <AccountAction primary onPress={() => void run(isGuest || mode === 'signup' ? 'signup' : 'signin')} disabled={busy}>
          {busy ? 'Connecting…' : isGuest ? 'Save account' : mode === 'signup' ? 'Create account' : 'Sign in'}
        </AccountAction>
        {!isGuest && (
          <AccountAction onPress={() => void run('guest')} disabled={busy}>
            {busy ? 'Starting guest session…' : 'Play as a guest'}
          </AccountAction>
        )}
        {isGuest && (
          <AccountAction onPress={() => void run('signout')} disabled={busy}>
            {busy ? 'Updating account…' : 'Sign out'}
          </AccountAction>
        )}
      </View>
      <Body accessibilityLiveRegion="polite" className="min-h-5 text-center text-sm text-muted">
        {busy ? 'Connecting to your account…' : ' '}
      </Body>
    </View>
  );
}
