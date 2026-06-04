import { cookies } from 'next/headers';
import { mkdir, readFile, writeFile } from 'fs/promises';
import path from 'path';
import crypto from 'node:crypto';
import {
  createSessionToken,
  SESSION_COOKIE_NAME,
  verifySessionToken,
} from './auth-core';

export interface AdminSession {
  isAdmin: boolean;
  username: string;
}

export interface AdminRecord {
  username: string;
  passwordHash: string;
  passwordSalt: string;
  passwordUpdatedAt: string;
  twoFactorEnabled?: boolean;
  twoFactorSecret?: string;
  twoFactorPendingSecret?: string;
  twoFactorPendingCreatedAt?: string;
}

export interface AdminSecurityState {
  username: string;
  twoFactorEnabled: boolean;
  hasPendingTwoFactor: boolean;
}

const ADMIN_FILE = path.join(process.cwd(), 'lib', 'data', 'admin.json');
const PASSWORD_KEY_LENGTH = 32;

async function ensureAdminDir() {
  try {
    await mkdir(path.dirname(ADMIN_FILE), { recursive: true });
  } catch {
    // On Vercel / read-only FS this can fail. We still try to read the bundled file.
    // Write paths are separately guarded.
  }
}

function hashPassword(password: string, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(password, salt, PASSWORD_KEY_LENGTH).toString('hex');
  return { passwordHash: hash, passwordSalt: salt };
}

function getConfiguredAdminCredentials() {
  const username = process.env.ADMIN_USERNAME?.trim() || process.env.ADMIN_INITIAL_USERNAME?.trim();
  const password = process.env.ADMIN_PASSWORD?.trim() || process.env.ADMIN_INITIAL_PASSWORD?.trim();

  if (!username || !password) {
    return null;
  }

  return { username, password };
}

function buildEnvBackedAdminRecord(username: string, password: string): AdminRecord {
  const salt = crypto.createHash('sha256').update(`promptgpt-admin:${username}`).digest('hex').slice(0, 32);
  const { passwordHash, passwordSalt } = hashPassword(password, salt);

  return {
    username,
    passwordHash,
    passwordSalt,
    passwordUpdatedAt: new Date().toISOString(),
    twoFactorEnabled: false,
  };
}

function verifyPassword(password: string, stored: AdminRecord) {
  const attemptedHash = crypto.scryptSync(password, stored.passwordSalt, PASSWORD_KEY_LENGTH);
  const actualHash = Buffer.from(stored.passwordHash, 'hex');
  if (actualHash.length !== attemptedHash.length) return false;
  return crypto.timingSafeEqual(actualHash, attemptedHash);
}

export async function validateAdminCredentials(username: string, password: string) {
  const configured = getConfiguredAdminCredentials();
  if (configured) {
    const isConfiguredValid = username === configured.username && password === configured.password;

    if (isConfiguredValid) {
      return {
        isValid: true,
        username: configured.username,
        twoFactorEnabled: false,
      };
    }
  }

  const creds = await getAdminRecord(false);

  return {
    isValid: username === creds.username && verifyPassword(password, creds),
    username: creds.username,
    twoFactorEnabled: Boolean(creds.twoFactorEnabled && creds.twoFactorSecret),
  };
}

export async function issueAdminSession(username: string) {
  const token = await createSessionToken(username);
  const cookieStore = await cookies();

  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24,
    path: '/',
  });
}

async function getAdminRecord(preferConfiguredCredentials = true): Promise<AdminRecord> {
  const configured = getConfiguredAdminCredentials();
  if (preferConfiguredCredentials && configured) {
    return buildEnvBackedAdminRecord(configured.username, configured.password);
  }

  await ensureAdminDir();

  try {
    const data = await readFile(ADMIN_FILE, 'utf-8');
    const parsed = JSON.parse(data);

    if (parsed?.passwordHash && parsed?.passwordSalt) {
      return {
        username: parsed.username || 'admin',
        passwordHash: parsed.passwordHash,
        passwordSalt: parsed.passwordSalt,
        passwordUpdatedAt: parsed.passwordUpdatedAt || new Date().toISOString(),
        twoFactorEnabled: Boolean(parsed.twoFactorEnabled),
        twoFactorSecret: parsed.twoFactorSecret,
        twoFactorPendingSecret: parsed.twoFactorPendingSecret,
        twoFactorPendingCreatedAt: parsed.twoFactorPendingCreatedAt,
      };
    }

    if (typeof parsed?.password === 'string') {
      const { passwordHash, passwordSalt } = hashPassword(parsed.password);
      const migrated: AdminRecord = {
        username: parsed.username || 'admin',
        passwordHash,
        passwordSalt,
        passwordUpdatedAt: new Date().toISOString(),
        twoFactorEnabled: Boolean(parsed.twoFactorEnabled),
        twoFactorSecret: parsed.twoFactorSecret,
        twoFactorPendingSecret: parsed.twoFactorPendingSecret,
        twoFactorPendingCreatedAt: parsed.twoFactorPendingCreatedAt,
      };

      await writeAdminRecord(migrated);
      return migrated;
    }
  } catch {
    // fall through to bootstrap
  }

  // Auto-bootstrap (never throw). This prevents "Internal server error" on /api/auth/login
  // when admin.json is missing or unreadable (e.g. first prod run, deleted file, parse error).
  // If ADMIN_INITIAL_* provided they are used (works in prod too). In prod without them we
  // generate a strong one-time password and print it to the server console.
  const isProd = process.env.NODE_ENV === 'production';
  const username = process.env.ADMIN_INITIAL_USERNAME || 'Gaurav@Harsh';
  let initialPassword = process.env.ADMIN_INITIAL_PASSWORD;
  if (!initialPassword) {
    if (isProd) {
      // Strong random, url-safe, alphanum only for easy typing
      initialPassword = crypto.randomBytes(16).toString('base64url').replace(/[^a-zA-Z0-9]/g, '').slice(0, 18);
    } else {
      initialPassword = 'change-me-now';
    }
  }
  const { passwordHash, passwordSalt } = hashPassword(initialPassword);
  const seeded: AdminRecord = {
    username,
    passwordHash,
    passwordSalt,
    passwordUpdatedAt: new Date().toISOString(),
    twoFactorEnabled: false,
  };

  await writeAdminRecord(seeded);

  if (isProd && !process.env.ADMIN_INITIAL_PASSWORD) {
    console.error(
      `\n[PromptGpt Admin] PRODUCTION AUTO-BOOTSTRAP:\n` +
      `  No valid admin.json (or unreadable). Generated fresh credentials.\n` +
      `  Username: ${username}\n` +
      `  Password: ${initialPassword}\n` +
      `  >>> SAVE THE PASSWORD NOW! It is only printed once. Login at /admin/login then change it in Settings.\n`
    );
  } else if (!isProd) {
    console.warn('Admin credentials bootstrap file was created for development. Change ADMIN_INITIAL_PASSWORD immediately.');
  }
  return seeded;
}

async function writeAdminRecord(record: AdminRecord) {
  const isVercel = !!process.env.VERCEL;
  const isProd = process.env.NODE_ENV === 'production';

  if (isVercel || isProd) {
    // On Vercel (and generally in prod deploys without persistent FS) we do not support
    // persisting credential changes via file. The admin must manage via env vars or re-deploy.
    console.warn('[Admin] writeAdminRecord skipped — credential changes via Settings UI are not supported on this deployment (Vercel read-only FS).');
    // We still allow the operation to "succeed" in memory for the current request,
    // but the next request will load from the committed admin.json again.
    return;
  }

  await ensureAdminDir();
  await writeFile(ADMIN_FILE, JSON.stringify(record, null, 2));
}

export async function getAdminSecurityState(): Promise<AdminSecurityState> {
  const record = await getAdminRecord();
  return {
    username: record.username,
    twoFactorEnabled: Boolean(record.twoFactorEnabled && record.twoFactorSecret),
    hasPendingTwoFactor: Boolean(record.twoFactorPendingSecret),
  };
}

export async function login(username: string, password: string): Promise<boolean> {
  const result = await validateAdminCredentials(username, password);

  if (result.isValid) {
    await issueAdminSession(username);
    return true;
  }
  return false;
}

export async function logout() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}

export async function getSession(): Promise<AdminSession | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!token) return null;

  return verifySessionToken(token);
}

export async function requireAdmin() {
  const session = await getSession();
  if (!session?.isAdmin) {
    throw new Error('Unauthorized');
  }
  return session;
}

export async function updateAdminCredentials(newUsername: string, newPassword: string) {
  const current = await getAdminRecord();
  const { passwordHash, passwordSalt } = hashPassword(newPassword);

  await writeAdminRecord({
    ...current,
    username: newUsername,
    passwordHash,
    passwordSalt,
    passwordUpdatedAt: new Date().toISOString(),
  });
}

export async function setPendingTwoFactorSecret(secret: string) {
  const current = await getAdminRecord();

  await writeAdminRecord({
    ...current,
    twoFactorPendingSecret: secret,
    twoFactorPendingCreatedAt: new Date().toISOString(),
  });
}

export async function confirmTwoFactorSecret(code: string, username: string) {
  const current = await getAdminRecord();
  const pendingSecret = current.twoFactorPendingSecret;

  if (!pendingSecret) {
    throw new Error('No pending 2FA setup found');
  }

  const { authenticator } = await import('otplib');
  authenticator.options = { window: 1 };

  if (!authenticator.check(code, pendingSecret)) {
    return false;
  }

  await writeAdminRecord({
    ...current,
    username,
    twoFactorEnabled: true,
    twoFactorSecret: pendingSecret,
    twoFactorPendingSecret: undefined,
    twoFactorPendingCreatedAt: undefined,
    passwordUpdatedAt: current.passwordUpdatedAt,
  });

  return true;
}

export async function disableTwoFactor() {
  const current = await getAdminRecord();
  await writeAdminRecord({
    ...current,
    twoFactorEnabled: false,
    twoFactorSecret: undefined,
    twoFactorPendingSecret: undefined,
    twoFactorPendingCreatedAt: undefined,
  });
}

export async function getTwoFactorSecret() {
  const current = await getAdminRecord();
  return current.twoFactorSecret || current.twoFactorPendingSecret || null;
}

export async function getTwoFactorEnabled() {
  const current = await getAdminRecord();
  return Boolean(current.twoFactorEnabled && current.twoFactorSecret);
}

export async function getAdminRecordSnapshot() {
  return getAdminRecord();
}
