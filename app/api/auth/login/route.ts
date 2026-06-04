import { NextRequest, NextResponse } from 'next/server';
import {
  issueAdminSession,
  validateAdminCredentials,
} from '@/lib/auth';
import { createTwoFactorChallengeToken } from '@/lib/auth-core';
import { checkRateLimit, getClientRateLimitKey } from '@/lib/rate-limit';
import { writeAuditEvent } from '@/lib/audit';

export const runtime = 'nodejs'; // fs + node:crypto for admin auth

const ATTEMPT_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT_LIMIT = 20;
const RATE_LIMIT_WINDOW = ATTEMPT_WINDOW_MS;

export async function POST(request: NextRequest) {
  try {
    const ipKey = getClientRateLimitKey('auth-login', request);
    const limit = await checkRateLimit({
      key: ipKey,
      limit: RATE_LIMIT_LIMIT,
      windowMs: RATE_LIMIT_WINDOW,
    });

    if (!limit.allowed) {
      return NextResponse.json(
        { error: 'Too many login attempts. Please try again later.' },
        { status: 429 }
      );
    }

    let parsed: any;
    try {
      parsed = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid request body. Expected JSON.' },
        { status: 400 }
      );
    }
    const { username, password } = parsed || {};

    if (!username || !password) {
      return NextResponse.json(
        { error: 'Username and password are required' },
        { status: 400 }
      );
    }

    const result = await validateAdminCredentials(username, password);
    const userAgent = request.headers.get('user-agent') || undefined;

    if (!result.isValid) {
      console.error(`[Admin Login] Validation failed for username="${username}". Redeploy latest code! (hard fallback + secret cache + full nav fixes are in). Use Gaurav@Harsh / billi123`);
      await writeAuditEvent({
        action: 'admin.login',
        actor: username,
        status: 'failure',
        severity: 'warning',
        ip: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || undefined,
        userAgent,
        details: { reason: 'invalid_credentials' },
      });

      return NextResponse.json(
        { error: 'Invalid username or password' },
        { status: 401 }
      );
    }

    if (result.twoFactorEnabled) {
      const tempToken = await createTwoFactorChallengeToken(result.username);
      await writeAuditEvent({
        action: 'admin.login.2fa_challenge',
        actor: result.username,
        status: 'attempt',
        severity: 'info',
        ip: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || undefined,
        userAgent,
      });

      return NextResponse.json({
        success: true,
        requiresTwoFactor: true,
        tempToken,
        message: 'Two-factor verification required',
      });
    }

    await issueAdminSession(result.username);
    await writeAuditEvent({
      action: 'admin.login',
      actor: result.username,
      status: 'success',
      severity: 'info',
      ip: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || undefined,
      userAgent,
    });

    return NextResponse.json({ success: true, message: 'Logged in successfully' });
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
