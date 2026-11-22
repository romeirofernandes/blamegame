import { useEffect, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, View, type ViewInstance } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getRandomValues } from 'expo-crypto';
import { launchImageLibraryAsync } from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { validatePlayerAvatar } from './avatar';
import { DITHER_AVATAR_VARIANT_COUNT } from './dither-avatar';
import { Avatar, Body, Button, Surface, Tap, Title } from './ui';
import { useReducedMotionPreference } from './beui/useReducedMotion';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type AvatarMode = 'photo' | 'generated';

function newAvatarSeed() {
  return Array.from(getRandomValues(new Uint8Array(16)), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function usePlayerAvatar(uid: string | undefined) {
  const [saved, setSaved] = useState<{
    uid: string;
    photo?: string;
    avatarSeed: string;
    avatarVariant: number;
    mode: AvatarMode;
  }>();
  const photoKey = uid ? `blame-game-avatar:${uid}` : null;
  const seedKey = uid ? `blame-game-avatar-seed:${uid}` : null;
  const variantKey = uid ? `blame-game-avatar-variant:${uid}` : null;
  const modeKey = uid ? `blame-game-avatar-mode:${uid}` : null;

  useEffect(() => {
    if (!photoKey || !seedKey || !variantKey || !modeKey || !uid) return;
    let active = true;
    void Promise.all([
      AsyncStorage.getItem(photoKey).catch(() => null),
      AsyncStorage.getItem(seedKey).catch(() => null),
      AsyncStorage.getItem(variantKey).catch(() => null),
      AsyncStorage.getItem(modeKey).catch(() => null),
    ]).then(async ([storedPhoto, storedSeed, storedVariant, storedMode]) => {
      const avatarSeed = storedSeed && /^[a-f\d]{32}$/i.test(storedSeed) ? storedSeed : newAvatarSeed();
      if (storedSeed !== avatarSeed) await AsyncStorage.setItem(seedKey, avatarSeed).catch(() => {});
      const parsedVariant = Number(storedVariant);
      const avatarVariant = Number.isInteger(parsedVariant) && parsedVariant >= 0 && parsedVariant < DITHER_AVATAR_VARIANT_COUNT
        ? parsedVariant
        : 0;
      const photo = validatePlayerAvatar(storedPhoto);
      const mode: AvatarMode = storedMode === 'generated' || storedMode === 'photo'
        ? storedMode
        : photo ? 'photo' : 'generated';
      if (active) setSaved({ uid, photo, avatarSeed, avatarVariant, mode });
    }).catch(() => {
      if (active) setSaved({ uid, avatarSeed: newAvatarSeed(), avatarVariant: 0, mode: 'generated' });
    });
    return () => { active = false; };
  }, [modeKey, photoKey, seedKey, uid, variantKey]);

  const profile = saved?.uid === uid ? saved : undefined;
  return {
    avatar: profile?.mode === 'photo' ? profile.photo : undefined,
    hasPhoto: Boolean(profile?.photo),
    avatarSeed: profile?.avatarSeed,
    avatarVariant: profile?.avatarVariant ?? 0,
    mode: profile?.mode ?? 'generated' as AvatarMode,
    ready: !uid || !!profile,
    async update(avatar: string | undefined) {
      if (!photoKey || !modeKey || !uid) return;
      if (avatar) await AsyncStorage.setItem(photoKey, avatar);
      else await AsyncStorage.removeItem(photoKey);
      const mode: AvatarMode = avatar ? 'photo' : 'generated';
      await AsyncStorage.setItem(modeKey, mode);
      setSaved((current) => current?.uid === uid ? { ...current, photo: avatar, mode } : current);
    },
    async selectGeneratedAvatar(avatarVariant: number) {
      if (!variantKey || !modeKey || !uid) return;
      await AsyncStorage.setItem(variantKey, String(avatarVariant));
      await AsyncStorage.setItem(modeKey, 'generated');
      setSaved((current) => current?.uid === uid ? { ...current, avatarVariant, mode: 'generated' } : current);
    },
    async useSavedPhoto() {
      if (!modeKey || !uid || !saved?.photo) return;
      await AsyncStorage.setItem(modeKey, 'photo');
      setSaved((current) => current?.uid === uid ? { ...current, mode: 'photo' } : current);
    },
  };
}

export function PlayerAvatarOptions({ seed, avatar, hasPhoto, avatarVariant, mode, ready, update, selectGeneratedAvatar, useSavedPhoto }: {
  seed: string;
  avatar?: string;
  hasPhoto: boolean;
  avatarVariant: number;
  mode: AvatarMode;
  ready: boolean;
  update: (avatar: string | undefined) => Promise<void>;
  selectGeneratedAvatar: (variant: number) => Promise<void>;
  useSavedPhoto: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotionPreference();
  const generatedButtonRef = useRef<ViewInstance>(null);
  const closeButtonRef = useRef<ViewInstance>(null);

  function closeDrawer() {
    setDrawerOpen(false);
  }

  function openDrawer() {
    setError('');
    setDrawerOpen(true);
  }

  async function chooseGenerated(variant: number) {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await selectGeneratedAvatar(variant);
      setDrawerOpen(false);
    } catch {
      setError('Couldn’t save that avatar. Try again.');
    } finally {
      setBusy(false);
    }
  }

  async function chooseSavedPhoto() {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await useSavedPhoto();
    } catch {
      setError('Couldn’t use your saved photo. Try again.');
    } finally {
      setBusy(false);
    }
  }

  async function choosePhoto() {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const picked = await launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 });
      if (picked.canceled) return;
      const { uri, width, height } = picked.assets[0];
      const side = Math.min(width, height);
      const context = ImageManipulator.manipulate(uri);
      if (width !== height && side > 0) {
        context.crop({
          originX: Math.floor((width - side) / 2),
          originY: Math.floor((height - side) / 2),
          width: side,
          height: side,
        });
      }
      context.resize({ width: 80, height: 80 });
      const image = await context.renderAsync();
      const result = await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.56, base64: true });
      const photo = validatePlayerAvatar(`data:image/jpeg;base64,${result.base64 ?? ''}`);
      if (!photo) throw new Error('Photo could not be resized.');
      await update(photo);
    } catch {
      setError('Couldn’t save that photo. Try a different image.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Surface className="gap-3 p-4">
      <View className="flex-row items-center gap-3">
        <Avatar player={{ id: seed, avatar, avatarVariant }} />
        <Body className="flex-1 text-sm text-muted">Everyone in your next room can see this avatar.</Body>
      </View>
      <Button tone="secondary" arrow={false} onPress={() => void choosePhoto()} disabled={!ready || busy}>
        {busy ? 'Updating avatar…' : hasPhoto ? 'Change photo' : 'Choose photo'}
      </Button>
      <Button
        ref={generatedButtonRef}
        tone="quiet"
        arrow={false}
        onPress={openDrawer}
        disabled={!ready || busy}
      >
        {mode === 'photo' ? 'Use generated avatar' : 'Change generated avatar'}
      </Button>
      {mode === 'generated' && hasPhoto ? (
        <Button tone="quiet" arrow={false} onPress={() => void chooseSavedPhoto()} disabled={busy}>
          Use saved photo
        </Button>
      ) : null}
      {error ? (
        <Surface className="border-peach/40 px-3 py-2">
          <Body accessibilityRole="alert" className="text-sm text-peach">{error}</Body>
        </Surface>
      ) : null}
      <Modal
        animationType={reducedMotion ? "none" : "slide"}
        onDismiss={() => generatedButtonRef.current?.focus?.()}
        onShow={() => closeButtonRef.current?.focus?.()}
        onRequestClose={closeDrawer}
        presentationStyle="overFullScreen"
        transparent
        visible={drawerOpen}
      >
        <View accessibilityViewIsModal className="flex-1 justify-end bg-black/60">
          <Pressable accessible={false} className="absolute inset-0" onPress={closeDrawer} />
          <View className="max-h-[86%] rounded-t-[28px] border border-line bg-canvas px-5 pt-5" style={{ paddingBottom: Math.max(insets.bottom, 16) }}>
            <View className="mb-4 h-1.5 w-10 self-center rounded-full bg-line" aria-hidden />
            <Title className="text-[28px] leading-8">Generated avatar</Title>
            <Body className="mt-2 text-sm text-muted">Choose a dither pattern. Your saved photo stays here if you want it back.</Body>
            {error ? (
              <Surface className="mt-3 border-peach/40 px-3 py-2">
                <Body accessibilityRole="alert" className="text-sm text-peach">{error}</Body>
              </Surface>
            ) : null}
            <ScrollView className="mt-5" contentContainerClassName="flex-row flex-wrap gap-2 pb-2" showsVerticalScrollIndicator={false}>
              {Array.from({ length: DITHER_AVATAR_VARIANT_COUNT }, (_, variant) => {
                const selected = mode === 'generated' && avatarVariant === variant;
                return (
                  <Tap
                    key={variant}
                    label={`Pattern ${variant + 1}, use generated avatar`}
                    aria-pressed={selected}
                    onPress={() => void chooseGenerated(variant)}
                    disabled={busy}
                    className="w-[31%]"
                  >
                    <Surface className={`min-h-[92px] w-full items-center justify-center gap-1 rounded-[16px] border p-2 ${selected ? 'border-lime-strong bg-prompt-stack' : 'border-line bg-panel'}`}>
                      <Avatar player={{ id: seed, avatarVariant: variant }} />
                      <Body className="text-center text-xs text-cloud">Pattern {variant + 1}</Body>
                    </Surface>
                  </Tap>
                );
              })}
            </ScrollView>
            <Button ref={closeButtonRef} tone="secondary" arrow={false} onPress={closeDrawer}>
              Close
            </Button>
          </View>
        </View>
      </Modal>
    </Surface>
  );
}
