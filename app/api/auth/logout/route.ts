import { NextResponse } from 'next/server';
import { getSession, logout } from '@/lib/auth';
import { writeAuditEvent } from '@/lib/audit';

export async function POST(request: Request) {
  const session = await getSession();
  await logout();
  await writeAuditEvent({
    action: 'admin.logout',
    actor: session?.username || 'unknown',
    status: 'success',
    severity: 'info',
    ip: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || undefined,
    userAgent: request.headers.get('user-agent') || undefined,
  });
  return NextResponse.json({ success: true, message: 'Logged out' });
}
