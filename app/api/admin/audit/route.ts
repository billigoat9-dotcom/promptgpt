import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { readAuditEvents } from '@/lib/audit';

export async function GET(request: NextRequest) {
  try {
    await requireAdmin();
    const limitParam = Number(request.nextUrl.searchParams.get('limit') || 200);
    const events = await readAuditEvents(limitParam);
    return NextResponse.json({ events });
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Failed to load audit log' }, { status: 500 });
  }
}
