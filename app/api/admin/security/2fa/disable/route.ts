import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, disableTwoFactor } from '@/lib/auth';
import { writeAuditEvent } from '@/lib/audit';
import { checkRateLimit, getClientRateLimitKey } from '@/lib/rate-limit';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const session = await requireAdmin();
    const rateLimit = await checkRateLimit({
      key: getClientRateLimitKey('admin-2fa-disable', request),
      limit: 5,
      windowMs: 60 * 1000,
    });

    if (!rateLimit.allowed) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    await disableTwoFactor();

    await writeAuditEvent({
      action: 'admin.2fa.disable',
      actor: session.username,
      status: 'success',
      severity: 'warning',
      ip: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || undefined,
      userAgent: request.headers.get('user-agent') || undefined,
    });

    return NextResponse.json({
      success: true,
      message: 'Two-factor authentication has been disabled.',
    });
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Failed to disable 2FA' }, { status: 500 });
  }
}
