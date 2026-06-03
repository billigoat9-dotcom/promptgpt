import { NextRequest, NextResponse } from 'next/server';
import { authenticator } from 'otplib';
import {
  getAdminRecordSnapshot,
  issueAdminSession,
} from '@/lib/auth';
import { verifyTwoFactorChallengeToken } from '@/lib/auth-core';
import { checkRateLimit, getClientRateLimitKey } from '@/lib/rate-limit';
import { writeAuditEvent } from '@/lib/audit';

const MAX_ATTEMPTS = 5;
const WINDOW_MS = 10 * 60 * 1000;

export async function POST(request: NextRequest) {
  try {
    const ipKey = getClientRateLimitKey('auth-2fa', request);
    const limit = await checkRateLimit({
      key: ipKey,
      limit: MAX_ATTEMPTS,
      windowMs: WINDOW_MS,
    });

    if (!limit.allowed) {
      return NextResponse.json(
        { error: 'Too many verification attempts. Please try again later.' },
        { status: 429 }
      );
    }

    const { tempToken, code } = await request.json();

    if (!tempToken || !code) {
      return NextResponse.json(
        { error: 'Verification token and code are required' },
        { status: 400 }
      );
    }

    const challenge = await verifyTwoFactorChallengeToken(tempToken);
    if (!challenge) {
      await writeAuditEvent({
        action: 'admin.login.2fa',
        actor: 'unknown',
        status: 'failure',
        severity: 'warning',
        ip: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || undefined,
        userAgent: request.headers.get('user-agent') || undefined,
        details: { reason: 'invalid_challenge' },
      });

      return NextResponse.json({ error: 'Invalid or expired verification token' }, { status: 401 });
    }

    const admin = await getAdminRecordSnapshot();
    if (!admin.twoFactorEnabled || !admin.twoFactorSecret) {
      return NextResponse.json({ error: 'Two-factor authentication is not enabled' }, { status: 400 });
    }

    if (admin.username !== challenge.username) {
      return NextResponse.json({ error: 'Verification token does not match the active account' }, { status: 401 });
    }

    authenticator.options = { window: 1 };
    const ok = authenticator.check(String(code), admin.twoFactorSecret);

    if (!ok) {
      await writeAuditEvent({
        action: 'admin.login.2fa',
        actor: admin.username,
        status: 'failure',
        severity: 'warning',
        ip: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || undefined,
        userAgent: request.headers.get('user-agent') || undefined,
        details: { reason: 'invalid_code' },
      });

      return NextResponse.json({ error: 'Invalid verification code' }, { status: 401 });
    }

    await issueAdminSession(admin.username);

    await writeAuditEvent({
      action: 'admin.login.2fa',
      actor: admin.username,
      status: 'success',
      severity: 'info',
      ip: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || undefined,
      userAgent: request.headers.get('user-agent') || undefined,
    });

    return NextResponse.json({ success: true, message: 'Verified successfully' });
  } catch (error) {
    console.error('2FA verification error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
