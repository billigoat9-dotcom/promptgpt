import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';

export const runtime = 'nodejs';

export async function GET() {
  const session = await getSession();
  
  if (session?.isAdmin) {
    return NextResponse.json({ 
      isAdmin: true, 
      username: session.username 
    });
  }
  
  return NextResponse.json({ isAdmin: false });
}
