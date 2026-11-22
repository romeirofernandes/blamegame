import { expect, spyOn, test } from 'bun:test';
import { exportJWK, generateKeyPair, SignJWT } from 'jose';
import { verifyFirebaseIdToken } from '../src/firebase-auth.js';

test('only accepts signed, unexpired ID tokens with the configured Firebase issuer and audience', async () => {
  const projectId = 'blame-game-test';
  const { publicKey, privateKey } = await generateKeyPair('RS256', { extractable: true });
  const kid = 'test-signing-key';
  const key = { ...(await exportJWK(publicKey)), kid, alg: 'RS256', use: 'sig' };
  const fetchKeys = spyOn(globalThis, 'fetch').mockImplementation(async () => Response.json({ keys: [key] }));
  try {
    const token = ({ audience = projectId, expires = '5m', provider = 'password' } = {}) => new SignJWT({ firebase: { sign_in_provider: provider } })
      .setProtectedHeader({ alg: 'RS256', kid })
      .setIssuer(`https://securetoken.google.com/${projectId}`)
      .setAudience(audience)
      .setSubject('player-one')
      .setIssuedAt()
      .setExpirationTime(expires)
      .sign(privateKey);

    expect(await verifyFirebaseIdToken(await token(), projectId)).toBe('player-one');
    await expect(verifyFirebaseIdToken(await token({ audience: 'different-project' }), projectId)).rejects.toThrow();
    await expect(verifyFirebaseIdToken(await token({ expires: -1 }), projectId)).rejects.toThrow();
    await expect(verifyFirebaseIdToken(await token({ provider: 'anonymous' }), projectId)).rejects.toThrow();
  } finally {
    fetchKeys.mockRestore();
  }
});
