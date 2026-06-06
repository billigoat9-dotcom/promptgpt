import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { getAllPrompts, savePrompts } from '@/lib/prompts';
import { writeAuditEvent } from '@/lib/audit';

export const runtime = 'nodejs';

type RouteParams = {
  params: Promise<{ id: string }>;
};

function getRequestMeta(request: NextRequest) {
  return {
    ip:
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') ||
      undefined,
    userAgent: request.headers.get('user-agent') || undefined,
  };
}

// DELETE - Delete a prompt from the active prompt store
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;

  try {
    const session = await requireAdmin();

    const prompts = await getAllPrompts();
    const exists = prompts.some((prompt) => prompt.id === id);

    if (!exists) {
      return NextResponse.json(
        { error: 'Prompt not found' },
        { status: 404 }
      );
    }

    const nextPrompts = prompts.filter((prompt) => prompt.id !== id);
    await savePrompts(nextPrompts);

    const meta = getRequestMeta(request);
    await writeAuditEvent({
      action: 'admin.prompt.delete',
      actor: session.username,
      status: 'success',
      severity: 'warning',
      ip: meta.ip,
      userAgent: meta.userAgent,
      details: {
        promptId: id,
        remainingCount: nextPrompts.length,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Prompt deleted successfully',
    });
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.error('DELETE Error:', error);

    await writeAuditEvent({
      action: 'admin.prompt.delete',
      actor: 'unknown',
      status: 'failure',
      severity: 'warning',
      details: {
        reason: 'internal_error',
        promptId: id,
      },
    });

    return NextResponse.json(
      {
        error: 'Failed to delete prompt',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
