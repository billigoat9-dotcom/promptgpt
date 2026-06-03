import { NextRequest, NextResponse } from 'next/server';
import { authenticator } from 'otplib';
import QRCode from 'qrcode';
import { requireAdmin, getAdminRecordSnapshot, setPendingTwoFactorSecret } from '@/lib/auth';
import { writeAuditEvent } from '@/lib/audit';
import { checkRateLimit, getClientRateLimitKey } from '@/lib/rate-limit';

export async function POST(request: NextRequest) {
  try {
    const session = await requireAdmin();
    const rateLimit = await checkRateLimit({
      key: getClientRateLimitKey('admin-2fa-setup', request),
      limit: 5,
      windowMs: 60 * 1000,
    });

    if (!rateLimit.allowed) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    const admin = await getAdminRecordSnapshot();
    const issuer = 'PromptGpt Admin';
    const secret = authenticator.generateSecret();
    const otpauthUrl = authenticator.keyuri(admin.username, issuer, secret);
    const qrDataUrl = await QRCode.toDataURL(otpauthUrl);

    await setPendingTwoFactorSecret(secret);
    await writeAuditEvent({
      action: 'admin.2fa.setup.started',
      actor: session.username,
      status: 'success',
      severity: 'info',
      ip: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || undefined,
      userAgent: request.headers.get('user-agent') || undefined,
      details: { issuer },
    });

    return NextResponse.json({
      success: true,
      issuer,
      secret,
      otpauthUrl,
      qrDataUrl,
      message: 'Scan the QR code with your authenticator app, then confirm the code.',
    });
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Failed to start 2FA setup' }, { status: 500 });
  }
}
