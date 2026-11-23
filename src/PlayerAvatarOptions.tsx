import { useEffect, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, View, type ViewInstance } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getRandomValues } from 'expo-crypto';
import { launchImageLibraryAsync } from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { HugeiconsIcon } from '@hugeicons/react-native';
import ImageUpload01Icon from '@hugeicons/core-free-icons/ImageUpload01Icon';
import { useAppearance } from './appearance';
import { validatePlayerAvatar } from './avatar';
import { DITHER_AVATAR_VARIANT_COUNT } from './dither-avatar';
import { Avatar, Body, Button, Tap, Title } from './ui';
import { useReducedMotionPreference } from './beui/useReducedMotion';

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
      const mode: AvatarMode = storedMode !== 'generated' && photo ? 'photo' : 'generated';
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
      if (!Number.isInteger(avatarVariant) || avatarVariant < 0 || avatarVariant >= DITHER_AVATAR_VARIANT_COUNT) {
        throw new Error('Choose a valid generated avatar.');
      }
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
  const { colors } = useAppearance();
  const reducedMotion = useReducedMotionPreference();
  const avatarButtonRef = useRef<ViewInstance>(null);
  const closeButtonRef = useRef<ViewInstance>(null);
  const drawerWasOpen = useRef(false);

  useEffect(() => {
    if (drawerWasOpen.current && !drawerOpen) avatarButtonRef.current?.focus?.();
    drawerWasOpen.current = drawerOpen;
  }, [drawerOpen]);

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
      setDrawerOpen(false);
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
      setDrawerOpen(false);
    } catch {
      setError('Couldn’t save that photo. Try a different image.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <View className="gap-3">
      <Tap
        ref={avatarButtonRef}
        label="Change avatar"
        onPress={openDrawer}
        disabled={!ready || busy}
        className="min-h-14 flex-row items-center gap-3 rounded-xl"
      >
        <Avatar player={{ id: seed, avatar, avatarVariant }} />
        <Body className="flex-1 font-boldface text-cloud">Change avatar</Body>
      </Tap>
      <Modal
        accessibilityLabel="Choose an avatar"
        accessibilityRole="dialog"
        accessibilityViewIsModal
        animationType={reducedMotion ? "none" : "fade"}
        onDismiss={() => avatarButtonRef.current?.focus?.()}
        onShow={() => closeButtonRef.current?.focus?.()}
        onRequestClose={closeDrawer}
        presentationStyle="overFullScreen"
        transparent
        visible={drawerOpen}
      >
        <View className="flex-1 items-center justify-center bg-black/50 px-5 py-8">
          <Pressable accessible={false} className="absolute inset-0" onPress={closeDrawer} />
          <View className="w-full max-w-[420px] overflow-hidden rounded-[24px] border border-line bg-canvas px-5 pt-5 pb-5" style={{ maxHeight: '86%' }}>
            <Title className="text-[28px] leading-8">Choose an avatar</Title>
            <Body className="mt-2 text-sm text-muted">Pick a pattern or upload a photo.</Body>
            {error ? (
              <Body accessibilityRole="alert" className="mt-3 rounded-xl bg-peach/10 px-3 py-2 text-sm text-peach">{error}</Body>
            ) : null}
            <ScrollView className="mt-5 flex-1" contentContainerClassName="gap-3 pb-3" showsVerticalScrollIndicator={false}>
              {Array.from({ length: Math.ceil(DITHER_AVATAR_VARIANT_COUNT / 3) }, (_, row) => (
                <View key={row} className="flex-row gap-3">
                  {Array.from({ length: 3 }, (_, column) => row * 3 + column).map((variant) => {
                    if (variant >= DITHER_AVATAR_VARIANT_COUNT) return <View key={variant} className="flex-1" />;
                    const selected = mode === 'generated' && avatarVariant === variant;
                    return (
                      <Tap
                        key={variant}
                        label={`Generated avatar choice ${variant + 1}`}
                        aria-pressed={selected}
                        onPress={() => void chooseGenerated(variant)}
                        disabled={busy}
                        className="flex-1"
                      >
                        <View className={`min-h-[72px] w-full items-center justify-center rounded-[16px] border-2 ${selected ? 'border-lime-strong bg-lime/40' : 'border-transparent bg-panel'}`}>
                          <Avatar player={{ id: seed, avatarVariant: variant }} size={48} />
                        </View>
                      </Tap>
                    );
                  })}
                </View>
              ))}
            </ScrollView>
            {mode === 'generated' && hasPhoto ? (
              <Button tone="quiet" arrow={false} onPress={() => void chooseSavedPhoto()} disabled={busy} className="mb-2">
                Use saved photo
              </Button>
            ) : null}
            <Button label="Upload a photo" tone="secondary" arrow={false} onPress={() => void choosePhoto()} disabled={!ready || busy} className="mb-2">
              <>
                <HugeiconsIcon accessible={false} icon={ImageUpload01Icon} size={20} color={colors.cloud} strokeWidth={1.8} />
                <Body className="font-boldface text-base">Upload a photo</Body>
              </>
            </Button>
            <Button ref={closeButtonRef} tone="secondary" arrow={false} onPress={closeDrawer}>
              Close
            </Button>
          </View>
        </View>
      </Modal>
    </View>
  );
}
