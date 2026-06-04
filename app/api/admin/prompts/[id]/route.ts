import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { getAllPrompts, savePrompts, isVercelProd } from '@/lib/prompts';
import { checkRateLimit, getClientRateLimitKey } from '@/lib/rate-limit';
import { writeAuditEvent } from '@/lib/audit';

export const runtime = 'nodejs';
const ALLOWED_MODELS = new Set(['FluxArt', 'VideoGen', 'GPT Image', 'Midjourney']);

type Params = { params: Promise<{ id: string }> };

// PATCH - Update likes, views, or other fields
export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const session = await requireAdmin();
    const rateLimit = await checkRateLimit({
      key: getClientRateLimitKey('admin-prompts-patch', request),
      limit: 30,
      windowMs: 60 * 1000,
    });

    if (!rateLimit.allowed) {
      return NextResponse.json({ error: 'Too many update requests' }, { status: 429 });
    }

    const { id } = await params;
    const body = await request.json();

    const prompts = await getAllPrompts();
    const index = prompts.findIndex(p => p.id === id);

    if (index === -1) {
      return NextResponse.json({ error: 'Prompt not found' }, { status: 404 });
    }

    const updatedPrompt = { ...prompts[index] };

    // Allow updating likes and views manually
    if (typeof body.likes === 'number') {
      updatedPrompt.likes = Math.max(0, body.likes);
    }
    if (typeof body.views === 'number') {
      updatedPrompt.views = Math.max(0, body.views);
    }

    // Optional: allow editing other fields
    if (typeof body.fullPrompt === 'string') {
      if (body.fullPrompt.length > 12000) {
        return NextResponse.json({ error: 'Prompt is too long' }, { status: 400 });
      }
      updatedPrompt.fullPrompt = body.fullPrompt;
    }
    if (typeof body.prompt === 'string') {
      updatedPrompt.prompt = body.prompt;
    }
    if (typeof body.model === 'string') {
      if (!ALLOWED_MODELS.has(body.model)) {
        return NextResponse.json({ error: 'Invalid model selected' }, { status: 400 });
      }
      updatedPrompt.model = body.model;
    }
    if (Array.isArray(body.tags)) {
      updatedPrompt.tags = body.tags
        .filter((tag: unknown): tag is string => typeof tag === 'string')
        .slice(0, 20);
    }

    prompts[index] = updatedPrompt;
    await savePrompts(prompts);
    await writeAuditEvent({
      action: 'admin.prompt.update',
      actor: session.username,
      status: 'success',
      severity: 'info',
      ip: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || undefined,
      userAgent: request.headers.get('user-agent') || undefined,
      details: {
        promptId: id,
        likes: updatedPrompt.likes,
        views: updatedPrompt.views,
        model: updatedPrompt.model,
      },
    });

    return NextResponse.json({ 
      success: true, 
      prompt: updatedPrompt,
      warning: isVercelProd 
        ? 'Change applied for this request only. On Vercel deployments prompt data is read-only (no persistence).'
        : undefined
    });
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    await writeAuditEvent({
      action: 'admin.prompt.update',
      actor: 'unknown',
      status: 'failure',
      severity: 'warning',
      ip: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || undefined,
      userAgent: request.headers.get('user-agent') || undefined,
      details: { reason: 'internal_error' },
    });
    return NextResponse.json({ error: 'Failed to update prompt' }, { status: 500 });
  }
}

// DELETE - Remove a prompt
export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const session = await requireAdmin();
    const rateLimit = await checkRateLimit({
      key: getClientRateLimitKey('admin-prompts-delete', request),
      limit: 20,
      windowMs: 60 * 1000,
    });

    if (!rateLimit.allowed) {
      return NextResponse.json({ error: 'Too many delete requests' }, { status: 429 });
    }

    const { id } = await params;

    const prompts = await getAllPrompts();
    const filtered = prompts.filter(p => p.id !== id);

    if (filtered.length === prompts.length) {
      return NextResponse.json({ error: 'Prompt not found' }, { status: 404 });
    }

    await savePrompts(filtered);
    await writeAuditEvent({
      action: 'admin.prompt.delete',
      actor: session.username,
      status: 'success',
      severity: 'warning',
      ip: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || undefined,
      userAgent: request.headers.get('user-agent') || undefined,
      details: { promptId: id },
    });
    return NextResponse.json({ 
      success: true,
      warning: isVercelProd 
        ? 'Delete applied for this request only. On Vercel deployments prompt data is read-only (no persistence).'
        : undefined
    });
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    await writeAuditEvent({
      action: 'admin.prompt.delete',
      actor: 'unknown',
      status: 'failure',
      severity: 'warning',
      ip: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || undefined,
      userAgent: request.headers.get('user-agent') || undefined,
      details: { reason: 'internal_error' },
    });
    return NextResponse.json({ error: 'Failed to delete prompt' }, { status: 500 });
  }
}
