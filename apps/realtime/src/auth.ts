import crypto from 'node:crypto';

const SESSION_SECRET =
  process.env.SESSION_SECRET || 'luma-dev-session-secret-change-in-production-32chars';

export interface SessionTokenPayload {
  userId: string;
  username: string;
  displayName: string;
  exp: number;
}

export function verifySessionToken(token: string | undefined): SessionTokenPayload | null {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;

  const [payloadB64, signature] = parts;
  const expected = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(payloadB64)
    .digest('base64url');

  const sigBuf = Buffer.from(signature);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }

  try {
    const parsed = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
    if (
      typeof parsed?.userId === 'string' &&
      typeof parsed?.username === 'string' &&
      typeof parsed?.displayName === 'string' &&
      typeof parsed?.exp === 'number' &&
      parsed.exp > Date.now()
    ) {
      return parsed as SessionTokenPayload;
    }
  } catch {
    return null;
  }
  return null;
}

export function verifyPasswordScrypt(password: string, storedHash: string): boolean {
  const parts = storedHash.split(':');
  if (parts.length !== 2) return false;
  const [salt, hashHex] = parts;
  const derived = crypto.scryptSync(password, salt, 64);
  const storedBuf = Buffer.from(hashHex, 'hex');
  if (derived.length !== storedBuf.length) return false;
  return crypto.timingSafeEqual(derived, storedBuf);
}
