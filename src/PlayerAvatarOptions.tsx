import { useEffect, useState } from 'react';
import { View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { launchImageLibraryAsync } from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { validatePlayerAvatar } from './avatar';
import { Avatar, Body, Button } from './ui';

export function usePlayerAvatar(uid: string | undefined) {
  const [saved, setSaved] = useState<{ uid: string; avatar?: string }>();
  const key = uid ? `blame-game-avatar:${uid}` : null;

  useEffect(() => {
    if (!key || !uid) return;
    let active = true;
    void AsyncStorage.getItem(key)
      .then(validatePlayerAvatar)
      .catch(() => undefined)
      .then((avatar) => {
        if (active) setSaved({ uid, avatar });
      });
    return () => { active = false; };
  }, [key, uid]);

  return {
    avatar: saved?.uid === uid ? saved?.avatar : undefined,
    ready: !uid || saved?.uid === uid,
    async update(avatar: string | undefined) {
      if (!key || !uid) return;
      if (avatar) await AsyncStorage.setItem(key, avatar);
      else await AsyncStorage.removeItem(key);
      setSaved((current) => current?.uid === uid ? { uid, avatar } : current);
    },
  };
}

export function PlayerAvatarOptions({ seed, avatar, ready, update }: {
  seed: string;
} & ReturnType<typeof usePlayerAvatar>) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

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

  async function removePhoto() {
    setBusy(true);
    setError('');
    try {
      await update(undefined);
    } catch {
      setError('Couldn’t remove your photo. Try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <View className="gap-3 rounded-[20px] border border-line bg-panel p-4">
      <View className="flex-row items-center gap-3">
        <Avatar player={{ id: seed, avatar }} />
        <Body className="flex-1 text-sm text-muted">Everyone in your next room can see this avatar.</Body>
      </View>
      <Button tone="secondary" arrow={false} onPress={() => void choosePhoto()} disabled={!ready || busy}>
        {busy ? 'Updating avatar…' : avatar ? 'Change photo' : 'Choose photo'}
      </Button>
      {avatar ? <Button tone="quiet" arrow={false} onPress={() => void removePhoto()} disabled={busy}>Use generated avatar</Button> : null}
      {error ? <Body accessibilityRole="alert" className="text-sm text-peach">{error}</Body> : null}
    </View>
  );
}
