export const MAX_PLAYER_AVATAR_LENGTH = 8192;

const JPEG_PREFIX = 'data:image/jpeg;base64,';

export function validatePlayerAvatar(value: unknown): string | undefined {
  if (typeof value !== 'string' || value.length > MAX_PLAYER_AVATAR_LENGTH ||
      !value.startsWith(JPEG_PREFIX)) return;

  const encoded = value.slice(JPEG_PREFIX.length);
  if (!/^\/9j\/[A-Za-z0-9+/]*={0,2}$/.test(encoded) || encoded.length % 4 !== 0) return;

  const bytes = atob(encoded);
  // Read JPEG segment lengths up to a supported start-of-frame marker.
  for (let offset = 2; offset + 8 < bytes.length;) {
    if (bytes.charCodeAt(offset++) !== 0xff) return;
    while (bytes.charCodeAt(offset) === 0xff) offset++;
    const marker = bytes.charCodeAt(offset++);
    if (marker === 0xda || marker === 0xd9) return;
    const length = (bytes.charCodeAt(offset) << 8) | bytes.charCodeAt(offset + 1);
    if (length < 2 || offset + length > bytes.length) return;
    if (marker === 0xc0 || marker === 0xc1 || marker === 0xc2) {
      if (length < 8) return;
      const height = (bytes.charCodeAt(offset + 3) << 8) | bytes.charCodeAt(offset + 4);
      const width = (bytes.charCodeAt(offset + 5) << 8) | bytes.charCodeAt(offset + 6);
      return width > 0 && height > 0 && width <= 96 && height <= 96 ? value : undefined;
    }
    offset += length;
  }
}
