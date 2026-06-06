import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { getAllPrompts, savePrompts } from '@/lib/prompts';
import { writeAuditEvent } from '@/lib/audit';
import type { Model } from '@/lib/types';

export const runtime = 'nodejs';
const ALLOWED_MODELS = new Set(['FluxArt', 'VideoGen', 'GPT Image', 'Midjourney']);

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

function normalizeTags(tags: unknown): string[] | undefined {
  if (Array.isArray(tags)) {
    return tags
      .map((tag) => String(tag).trim())
      .filter(Boolean);
  }

  if (typeof tags === 'string') {
    return tags
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean);
  }

  return undefined;
}

function toFiniteNumber(value: unknown): number | undefined {
  if (value === null || value === undefined || value === '') return undefined;
  const num = Number(value);
  return Number.isFinite(num) ? num : undefined;
}

// PATCH - Update a prompt in the active prompt store
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;

  try {
    const session = await requireAdmin();
    const body = await request.json().catch(() => ({} as Record<string, unknown>));

    const prompts = await getAllPrompts();
    const index = prompts.findIndex((prompt) => prompt.id === id);

    if (index === -1) {
      return NextResponse.json({ error: 'Prompt not found' }, { status: 404 });
    }

    const existing = prompts[index];
    const nextModel =
      typeof body.model === 'string' && body.model.trim() && ALLOWED_MODELS.has(body.model)
        ? (body.model as Model)
        : existing.model;
    const nextPrompt = {
      ...existing,
      ...(typeof body.prompt === 'string' && body.prompt.trim() ? { prompt: body.prompt } : {}),
      ...(typeof body.fullPrompt === 'string' && body.fullPrompt.trim() ? { fullPrompt: body.fullPrompt } : {}),
      ...(typeof body.creator === 'string' && body.creator.trim() ? { creator: body.creator } : {}),
      ...(typeof body.creatorAvatar === 'string' && body.creatorAvatar.trim() ? { creatorAvatar: body.creatorAvatar } : {}),
      ...(typeof body.imageUrl === 'string' && body.imageUrl.trim() ? { imageUrl: body.imageUrl } : {}),
      ...(typeof body.category === 'string' && body.category.trim() ? { category: body.category } : {}),
      model: nextModel,
      ...(normalizeTags(body.tags) ? { tags: normalizeTags(body.tags)! } : {}),
      ...(toFiniteNumber(body.likes) !== undefined ? { likes: toFiniteNumber(body.likes)! } : {}),
      ...(toFiniteNumber(body.views) !== undefined ? { views: toFiniteNumber(body.views)! } : {}),
    };

    prompts[index] = nextPrompt;
    await savePrompts(prompts);

    const meta = getRequestMeta(request);
    await writeAuditEvent({
      action: 'admin.prompt.update',
      actor: session.username,
      status: 'success',
      severity: 'info',
      ip: meta.ip,
      userAgent: meta.userAgent,
      details: {
        promptId: id,
        likes: nextPrompt.likes,
        views: nextPrompt.views,
        model: nextPrompt.model,
      },
    });

    return NextResponse.json({
      success: true,
      prompt: nextPrompt,
    });
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.error('PATCH Error:', error);

    await writeAuditEvent({
      action: 'admin.prompt.update',
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
        error: 'Failed to update prompt',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
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
