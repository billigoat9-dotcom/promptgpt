import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, updateAdminCredentials, getAdminRecordSnapshot } from '@/lib/auth';
import { checkRateLimit, getClientRateLimitKey } from '@/lib/rate-limit';
import { writeAuditEvent } from '@/lib/audit';

export async function GET() {
  try {
    await requireAdmin();
    const creds = await getAdminRecordSnapshot();
    return NextResponse.json({
      username: creds.username,
      twoFactorEnabled: Boolean(creds.twoFactorEnabled && creds.twoFactorSecret),
      hasPendingTwoFactor: Boolean(creds.twoFactorPendingSecret),
    });
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Failed to load settings' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await requireAdmin();
    const rateLimit = await checkRateLimit({
      key: getClientRateLimitKey('admin-settings-patch', request),
      limit: 10,
      windowMs: 60 * 1000,
    });

    if (!rateLimit.allowed) {
      return NextResponse.json({ error: 'Too many update requests' }, { status: 429 });
    }

    const body = await request.json();
    const newUsername = String(body.username || '').trim();
    const newPassword = String(body.password || '').trim();

    if (!newUsername || !newPassword) {
      return NextResponse.json({ error: 'Username and password cannot be empty' }, { status: 400 });
    }

    if (newUsername.length > 64 || newPassword.length > 128) {
      return NextResponse.json({ error: 'Credentials are too long' }, { status: 400 });
    }

    await updateAdminCredentials(newUsername, newPassword);

    // Force logout after credential change for security
    const { logout } = await import('@/lib/auth');
    await logout();

    await writeAuditEvent({
      action: 'admin.settings.update_credentials',
      actor: session.username,
      status: 'success',
      severity: 'warning',
      ip: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || undefined,
      userAgent: request.headers.get('user-agent') || undefined,
    });

    return NextResponse.json({ 
      success: true, 
      message: 'Credentials updated. Please login again with new credentials.' 
    });
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    await writeAuditEvent({
      action: 'admin.settings.update_credentials',
      actor: 'unknown',
      status: 'failure',
      severity: 'warning',
      ip: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || undefined,
      userAgent: request.headers.get('user-agent') || undefined,
      details: { reason: 'internal_error' },
    });
    return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 });
  }
}
