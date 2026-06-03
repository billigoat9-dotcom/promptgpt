import { NextResponse } from 'next/server';
import { requireAdmin, getAdminSecurityState } from '@/lib/auth';

export async function GET() {
  try {
    await requireAdmin();
    const state = await getAdminSecurityState();
    return NextResponse.json(state);
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Failed to load security state' }, { status: 500 });
  }
}
