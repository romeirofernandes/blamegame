import { useEffect, useState } from 'react';
import { Modal, Platform, View } from 'react-native';
import Constants from 'expo-constants';
import * as Linking from 'expo-linking';
import { Body, Button, Label, Surface, Title } from './ui';

const LATEST_RELEASE_URL = 'https://api.github.com/repos/romeirofernandes/blamegame/releases/latest';

type ReleaseInfo = {
  tag_name?: unknown;
  assets?: Array<{ name?: unknown; browser_download_url?: unknown }>;
};

type AvailableUpdate = { version: string; downloadUrl: string };

function versionParts(value: string): number[] | null {
  const match = value.match(/^v?(\d+)\.(\d+)\.(\d+)(?:[-+][0-9A-Za-z.-]+)?$/i);
  return match ? match.slice(1, 4).map(Number) : null;
}

function isNewerVersion(candidate: string, installed: string): boolean {
  const candidateParts = versionParts(candidate);
  const installedParts = versionParts(installed);
  if (!candidateParts || !installedParts) return false;

  for (let index = 0; index < 3; index += 1) {
    if (candidateParts[index] !== installedParts[index]) {
      return candidateParts[index] > installedParts[index];
    }
  }
  return false;
}

async function findUpdate(): Promise<AvailableUpdate | null> {
  const installedVersion = Constants.expoConfig?.version;
  if (!installedVersion) return null;

  const response = await fetch(LATEST_RELEASE_URL, {
    headers: { Accept: 'application/vnd.github+json' },
  });
  if (!response.ok) return null;

  const release = await response.json() as ReleaseInfo;
  const tag = typeof release.tag_name === 'string' ? release.tag_name : '';
  if (!isNewerVersion(tag, installedVersion)) return null;

  const apk = release.assets?.find((asset) =>
    typeof asset.name === 'string' && asset.name.toLowerCase().endsWith('.apk')
      && typeof asset.browser_download_url === 'string'
      && asset.browser_download_url.startsWith('https://github.com/'),
  );
  if (!apk || typeof apk.browser_download_url !== 'string') return null;

  return { version: tag.replace(/^v/i, ''), downloadUrl: apk.browser_download_url };
}

export function UpdatePrompt() {
  const [update, setUpdate] = useState<AvailableUpdate | null>(null);
  const [opening, setOpening] = useState(false);
  const [openError, setOpenError] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'android' || __DEV__) return;
    let mounted = true;
    void findUpdate()
      .then((latest) => { if (mounted && latest) setUpdate(latest); })
      .catch(() => {});
    return () => { mounted = false; };
  }, []);

  async function openDownload() {
    if (!update) return;
    setOpening(true);
    setOpenError(false);
    try {
      await Linking.openURL(update.downloadUrl);
      setUpdate(null);
    } catch {
      setOpenError(true);
    } finally {
      setOpening(false);
    }
  }

  function dismiss() {
    setUpdate(null);
    setOpenError(false);
  }

  return (
    <Modal
      visible={!!update}
      transparent
      animationType="fade"
      statusBarTranslucent
      accessibilityViewIsModal
      onRequestClose={dismiss}
    >
      <View className="flex-1 items-center justify-center px-6" style={{ backgroundColor: 'rgba(0,0,0,0.68)' }}>
        <Surface className="w-full max-w-[420px] gap-4 rounded-[24px] bg-panel p-5">
          <View className="gap-2">
            <Label className="text-lilac-strong">Blame Game update</Label>
            <Title className="text-[34px] leading-[1.1]">Update available</Title>
            <Body className="mt-1 text-muted">
              Version {update?.version} is ready with the latest improvements.
            </Body>
          </View>
          {openError && (
            <Body accessibilityRole="alert" className="text-sm text-peach">
              Could not open the download. Check your connection and try again.
            </Body>
          )}
          <View className="gap-2">
            <Button onPress={() => void openDownload()} disabled={opening}>
              {opening ? 'Opening download…' : 'Download update'}
            </Button>
            <Button tone="secondary" arrow={false} onPress={dismiss} disabled={opening}>Later</Button>
          </View>
          <Body className="text-xs leading-5 text-muted">
            Android will ask you to confirm the update after the APK downloads.
          </Body>
        </Surface>
      </View>
    </Modal>
  );
}
