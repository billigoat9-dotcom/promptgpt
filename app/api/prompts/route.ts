import { NextResponse } from 'next/server';
import { getAllPrompts } from '@/lib/prompts';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    const prompts = await getAllPrompts();
    return NextResponse.json(prompts, {
      headers: {
        'Cache-Control': 'no-store, max-age=0, must-revalidate',
      },
    });
  } catch (error) {
    console.error('Error fetching prompts:', error);
    return NextResponse.json(
      { error: 'Failed to fetch prompts' },
      {
        status: 500,
        headers: {
          'Cache-Control': 'no-store, max-age=0, must-revalidate',
        },
      }
    );
  }
}
