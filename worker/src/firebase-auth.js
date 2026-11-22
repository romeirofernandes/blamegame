import { createRemoteJWKSet, jwtVerify } from 'jose';

const firebaseKeys = createRemoteJWKSet(
  new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'),
);

export async function verifyFirebaseIdToken(idToken, projectId) {
  if (!projectId) throw new Error('Firebase authentication is not configured.');
  if (typeof idToken !== 'string' || idToken.length < 100 || idToken.length > 8192) {
    throw new Error('Invalid Firebase ID token.');
  }

  const { payload } = await jwtVerify(idToken, firebaseKeys, {
    issuer: `https://securetoken.google.com/${projectId}`,
    audience: projectId,
    algorithms: ['RS256'],
    requiredClaims: ['sub', 'iat', 'exp'],
  });
  if (typeof payload.firebase?.sign_in_provider !== 'string' || payload.firebase.sign_in_provider === 'anonymous') {
    throw new Error('Sign in with an account to play.');
  }
  if (typeof payload.sub !== 'string' || !payload.sub) throw new Error('Invalid Firebase ID token.');
  return payload.sub;
}
