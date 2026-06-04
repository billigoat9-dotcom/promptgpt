const SESSION_COOKIE_NAME = 'admin_session';
const TWO_FACTOR_CHALLENGE_TTL_MS = 10 * 60 * 1000;

type TokenPurpose = 'session' | '2fa';

type TokenPayload = {
  purpose: TokenPurpose;
  username: string;
  iat: number;
  exp: number;
  nonce: string;
};

function getSessionSecret() {
  const secret = process.env.ADMIN_AUTH_SECRET;

  if (secret && secret.trim()) {
    return secret.trim();
  }

  if (process.env.NODE_ENV === 'production') {
    // Never throw (would turn successful logins into 500 Internal server error).
    // Use a random ephemeral secret per process start and log a loud warning.
    // Admin sessions will not survive a server restart until ADMIN_AUTH_SECRET is set.
    console.error(
      '\n[PromptGpt] CRITICAL: ADMIN_AUTH_SECRET is not set in production.\n' +
      'Using an ephemeral in-memory secret for this process only.\n' +
      'Set a strong ADMIN_AUTH_SECRET in your environment (e.g. .env.local or hosting dashboard) for persistent sessions.\n' +
      'All admin logins will require re-auth after every server restart until fixed!\n'
    );
    // Generate using Web Crypto (no node:crypto import to stay portable)
    try {
      if (globalThis.crypto?.getRandomValues) {
        const arr = new Uint8Array(32);
        globalThis.crypto.getRandomValues(arr);
        let hex = '';
        for (let i = 0; i < arr.length; i++) hex += arr[i].toString(16).padStart(2, '0');
        return 'ephemeral-prod-' + hex;
      }
    } catch {}
    return 'ephemeral-prod-insecure-' + Date.now().toString(36);
  }

  return 'prompt-gallery-dev-secret-change-before-deploy';
}

function bytesToBase64Url(bytes: Uint8Array) {
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64UrlToBytes(value: string) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }

  return bytes;
}

function decodePayload(encodedPayload: string): TokenPayload | null {
  try {
    const payloadBytes = base64UrlToBytes(encodedPayload);
    const parsed = JSON.parse(new TextDecoder().decode(payloadBytes));

    if (
      !parsed ||
      (parsed.purpose !== 'session' && parsed.purpose !== '2fa') ||
      typeof parsed.username !== 'string' ||
      typeof parsed.iat !== 'number' ||
      typeof parsed.exp !== 'number' ||
      typeof parsed.nonce !== 'string'
    ) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

async function hmacSignature(message: string, secret: string) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );

  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(message));
  return bytesToBase64Url(new Uint8Array(signature));
}

async function createSignedToken(username: string, purpose: TokenPurpose, ttlMs: number) {
  const secret = getSessionSecret();
  const now = Date.now();
  const payload: TokenPayload = {
    purpose,
    username,
    iat: now,
    exp: now + ttlMs,
    nonce: crypto.randomUUID(),
  };

  const encodedPayload = bytesToBase64Url(new TextEncoder().encode(JSON.stringify(payload)));
  const signature = await hmacSignature(encodedPayload, secret);

  return `${encodedPayload}.${signature}`;
}

async function verifySignedToken(token: string, expectedPurpose: TokenPurpose) {
  try {
    const [encodedPayload, signature] = token.split('.');
    if (!encodedPayload || !signature) return null;

    const secret = getSessionSecret();
    const expectedSignature = await hmacSignature(encodedPayload, secret);
    if (signature !== expectedSignature) return null;

    const payload = decodePayload(encodedPayload);
    if (!payload || payload.purpose !== expectedPurpose) return null;
    if (Date.now() > payload.exp) return null;

    return {
      username: payload.username,
      purpose: payload.purpose,
    };
  } catch {
    return null;
  }
}

export async function createSessionToken(username: string) {
  return createSignedToken(username, 'session', 1000 * 60 * 60 * 24);
}

export async function createTwoFactorChallengeToken(username: string) {
  return createSignedToken(username, '2fa', TWO_FACTOR_CHALLENGE_TTL_MS);
}

export async function verifySessionToken(token: string) {
  const payload = await verifySignedToken(token, 'session');
  if (!payload) return null;

  return {
    isAdmin: true,
    username: payload.username,
  };
}

export async function verifyTwoFactorChallengeToken(token: string) {
  return verifySignedToken(token, '2fa');
}

export { SESSION_COOKIE_NAME, TWO_FACTOR_CHALLENGE_TTL_MS };
