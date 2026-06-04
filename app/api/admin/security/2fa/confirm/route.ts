import { NextRequest, NextResponse } from 'next/server';
import {
  confirmTwoFactorSecret,
  getAdminRecordSnapshot,
  requireAdmin,
} from '@/lib/auth';
import { writeAuditEvent } from '@/lib/audit';
import { checkRateLimit, getClientRateLimitKey } from '@/lib/rate-limit';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const session = await requireAdmin();
    const rateLimit = await checkRateLimit({
      key: getClientRateLimitKey('admin-2fa-confirm', request),
      limit: 5,
      windowMs: 60 * 1000,
    });

    if (!rateLimit.allowed) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    const { code } = await request.json();

    if (!code) {
      return NextResponse.json({ error: 'Verification code is required' }, { status: 400 });
    }

    const admin = await getAdminRecordSnapshot();
    if (!admin.twoFactorPendingSecret) {
      return NextResponse.json({ error: 'No pending 2FA setup found' }, { status: 400 });
    }

    const ok = await confirmTwoFactorSecret(String(code), admin.username);

    await writeAuditEvent({
      action: 'admin.2fa.setup.confirm',
      actor: session.username,
      status: ok ? 'success' : 'failure',
      severity: ok ? 'info' : 'warning',
      ip: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || undefined,
      userAgent: request.headers.get('user-agent') || undefined,
    });

    if (!ok) {
      return NextResponse.json({ error: 'Invalid verification code' }, { status: 401 });
    }

    return NextResponse.json({
      success: true,
      message: 'Two-factor authentication has been enabled.',
    });
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Failed to confirm 2FA setup' }, { status: 500 });
  }
}
