import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { addPrompt, isVercelProd } from '@/lib/prompts';
import { uploadToCloudinary } from '@/lib/cloudinary';
import { checkRateLimit, getClientRateLimitKey } from '@/lib/rate-limit';
import { writeAuditEvent } from '@/lib/audit';

export const runtime = 'nodejs'; // Ensure Node.js runtime for fs
const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;
const ALLOWED_MODELS = new Set(['FluxArt', 'VideoGen', 'GPT Image', 'Midjourney']);
const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const MAX_PROMPT_LENGTH = 12000;

// GET /api/admin/prompts - Get all prompts (protected)
export async function GET() {
  try {
    await requireAdmin();
    const { getAllPrompts } = await import('@/lib/prompts');
    const prompts = await getAllPrompts();
    return NextResponse.json(prompts);
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Failed to fetch prompts' }, { status: 500 });
  }
}

// POST /api/admin/prompts - Add new prompt (protected)
export async function POST(request: NextRequest) {
  try {
    const rateLimit = await checkRateLimit({
      key: getClientRateLimitKey('admin-prompts-create', request),
      limit: 10,
      windowMs: 60 * 1000,
    });

    if (!rateLimit.allowed) {
      return NextResponse.json({ error: 'Too many prompt creation requests' }, { status: 429 });
    }

    // Check admin auth
    const session = await requireAdmin();

    const formData = await request.formData();
    
    const fullPrompt = formData.get('fullPrompt') as string;
    const model = formData.get('model') as string;
    const tagsRaw = formData.get('tags') as string;
    const creator = (formData.get('creator') as string) || 'Billi';
    
    const imageFile = formData.get('image') as File | null;

    if (!fullPrompt || !model) {
      return NextResponse.json(
        { error: 'Full Prompt and Model are required' },
        { status: 400 }
      );
    }

    // Auto-generate short prompt from full prompt (first 140 chars)
    const shortPrompt = fullPrompt.length > 140 
      ? fullPrompt.substring(0, 137) + '...' 
      : fullPrompt;

    const tags = tagsRaw 
      ? tagsRaw.split(',').map(t => t.trim()).filter(Boolean) 
      : ['new'];

    if (!ALLOWED_MODELS.has(model)) {
      return NextResponse.json({ error: 'Invalid model selected' }, { status: 400 });
    }

    if (imageFile && imageFile.size > MAX_IMAGE_SIZE_BYTES) {
      return NextResponse.json({ error: 'Image must be 5MB or smaller' }, { status: 400 });
    }

    if (imageFile && imageFile.size > 0 && !ALLOWED_IMAGE_TYPES.has(imageFile.type)) {
      return NextResponse.json({ error: 'Unsupported image type' }, { status: 400 });
    }

    if (fullPrompt.length > MAX_PROMPT_LENGTH) {
      return NextResponse.json({ error: 'Prompt is too long' }, { status: 400 });
    }

    let imageUrl = 'https://picsum.photos/id/1015/600/800'; // fallback (if no image uploaded)

    // Handle image upload to Cloudinary
    if (imageFile && imageFile.size > 0) {
      const bytes = await imageFile.arrayBuffer();
      const buffer = Buffer.from(bytes);

      try {
        imageUrl = await uploadToCloudinary(buffer, 'prompt-gallery');
      } catch (uploadError: any) {
        console.error('❌ Cloudinary upload failed:', uploadError);
        
        const errorMessage = `Cloudinary upload failed: ${uploadError.message || uploadError}`;
        return NextResponse.json({ error: errorMessage }, { status: 500 });
      }
    }

    const newPrompt = await addPrompt({
      imageUrl,
      prompt: shortPrompt,
      fullPrompt,
      creator,
      creatorAvatar: 'https://picsum.photos/id/201/64/64',
      model: model as any,
      tags,
      category: 'Concept Art',
    });
    await writeAuditEvent({
      action: 'admin.prompt.create',
      actor: session.username,
      status: 'success',
      severity: 'info',
      ip: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || undefined,
      userAgent: request.headers.get('user-agent') || undefined,
      details: {
        promptId: newPrompt.id,
        model,
        hasImage: Boolean(imageFile && imageFile.size > 0),
      },
    });

    return NextResponse.json({ 
      success: true, 
      prompt: newPrompt,
      warning: isVercelProd 
        ? 'Prompt added for this request only. On Vercel (read-only filesystem) changes do not persist after the serverless function ends. For permanent changes run the site locally or add a database.'
        : undefined
    });

  } catch (error: any) {
    console.error('❌ Admin create prompt error (uncaught):', error);
    
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    await writeAuditEvent({
      action: 'admin.prompt.create',
      actor: 'unknown',
      status: 'failure',
      severity: 'warning',
      ip: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || undefined,
      userAgent: request.headers.get('user-agent') || undefined,
      details: { reason: 'internal_error' },
    });

    return NextResponse.json({ error: 'Internal Server Error while creating prompt' }, { status: 500 });
  }
}
