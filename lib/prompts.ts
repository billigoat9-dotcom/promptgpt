import { Prompt } from './types';
import { MOCK_PROMPTS } from './mockData';
import fs from 'fs/promises';
import path from 'path';
import { getRedisClient } from './rate-limit';
import { getPromptsData, uploadPromptsData } from './cloudinary';

const DATA_FILE = path.join(process.cwd(), 'lib', 'data', 'prompts.json');

// Ensure directory exists
async function ensureDataDir() {
  const dir = path.dirname(DATA_FILE);
  try {
    await fs.mkdir(dir, { recursive: true });
  } catch {}
}

export const isVercelProd = process.env.NODE_ENV === 'production' && !!process.env.VERCEL;

export async function isPromptsPersistent(): Promise<boolean> {
  const redisClient = await getRedisClient();
  // Persistent if Redis available OR Cloudinary is configured (we'll use it for data)
  const hasCloudinary = !!process.env.CLOUDINARY_CLOUD_NAME && !!process.env.CLOUDINARY_API_KEY && !!process.env.CLOUDINARY_API_SECRET;
  return !!redisClient || hasCloudinary || !isVercelProd;
}

// Load prompts (prefer Cloudinary data if creds present, else Redis, else local file, else mock)
export async function getAllPrompts(): Promise<Prompt[]> {
  // 1. Try Cloudinary for prompts data (primary for Vercel + keeping Cloudinary)
  const hasCloudinaryCreds = !!process.env.CLOUDINARY_CLOUD_NAME && !!process.env.CLOUDINARY_API_KEY && !!process.env.CLOUDINARY_API_SECRET;
  if (hasCloudinaryCreds) {
    try {
      const cloudData = await getPromptsData();
      if (cloudData === 'NO_DATA_FILE') {
        // No data file on Cloudinary yet. Return empty so that:
        // - Public starts empty until first write (which will enrich with initials, see savePrompts).
        // - We never overwrite a just-performed write due to a transient 404 right after upload.
        console.log('Cloudinary prompts/data.json does not exist yet (first run or after delete-all).');
        return [];
      }
      if (cloudData !== null && Array.isArray(cloudData)) {
        return cloudData;
      }
    } catch (error) {
      console.error('Cloudinary prompts data load error:', error);
    }
  }

  // 2. Try Redis if available
  const redisClient = await getRedisClient();
  if (redisClient) {
    try {
      const data = await redisClient.get('prompts');
      if (data) {
        const parsed = JSON.parse(data as string);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (error) {
      console.error('Redis prompts load error:', error);
    }
  }

  // 3. Fallback to local file
  await ensureDataDir();
  
  try {
    const data = await fs.readFile(DATA_FILE, 'utf-8');
    const parsed = JSON.parse(data);
    if (Array.isArray(parsed) && parsed.length > 0) {
      // Do NOT upload here - that would overwrite Cloudinary data with old bundled file.
      // Seeding only happens on explicit save or in the catch (initial no data).
      if (redisClient) {
        try {
          await redisClient.set('prompts', JSON.stringify(parsed));
        } catch (e) {
          console.error('Failed to seed prompts to Redis:', e);
        }
      }
      return parsed;
    }
  } catch (error) {
    // File doesn't exist or invalid - seed with mock data
    console.log('Seeding prompts from mock data...');
    const initial = [...MOCK_PROMPTS];
    if (hasCloudinaryCreds) {
      try {
        await uploadPromptsData(initial);
        return initial;
      } catch (e) {
        console.error('Failed to upload initial mock to Cloudinary:', e);
      }
    }
    if (redisClient) {
      try {
        await redisClient.set('prompts', JSON.stringify(initial));
        return initial;
      } catch (e) {
        console.error('Failed to seed prompts to Redis:', e);
      }
    }
    if (isVercelProd) {
      return initial;
    }
    await savePromptsToFile(initial);
    return initial;
  }
  
  return MOCK_PROMPTS;
}

// Save all prompts (prefer Cloudinary, then Redis, then file)
export async function savePrompts(prompts: Prompt[]): Promise<void> {
  const hasCloudinaryCreds = !!process.env.CLOUDINARY_CLOUD_NAME && !!process.env.CLOUDINARY_API_KEY && !!process.env.CLOUDINARY_API_SECRET;
  if (hasCloudinaryCreds) {
    let toUpload = prompts;
    try {
      // If Cloudinary currently has no data (or empty), enrich the list we're about to write
      // with any "initial / bundled" prompts from the committed local file. This preserves
      // the starting gallery on first use after deploy, without causing read-triggered clobbers.
      const current = await getPromptsData();
      if (current === 'NO_DATA_FILE' || (Array.isArray(current) && current.length === 0)) {
        await ensureDataDir();
        const localRaw = await fs.readFile(DATA_FILE, 'utf-8').catch(() => '[]');
        const local = JSON.parse(localRaw);
        if (Array.isArray(local) && local.length > 0) {
          const have = new Set((toUpload || []).map((p: Prompt) => p.id));
          const missing = local.filter((p: Prompt) => !have.has(p.id));
          if (missing.length > 0) {
            toUpload = [...(toUpload || []), ...missing];
            console.log('Enriched save list with', missing.length, 'initial prompts from local file (cloud was empty).');
          }
        }
      }
    } catch (enrichErr) {
      console.warn('Non-fatal: could not enrich save list from local on empty cloud:', enrichErr);
    }

    try {
      await uploadPromptsData(toUpload);

      if (isVercelProd) {
        // Validate that the freshly uploaded Cloudinary prompt data is readable.
        const validation = await getPromptsData();
        if (!Array.isArray(validation)) {
          throw new Error('Cloudinary prompt data upload completed, but the persisted data cannot be read back.');
        }
      }

      // For local development convenience (when Cloudinary creds are present), also keep the on-disk
      // lib/data/prompts.json in sync so that inspecting the file shows the current truth.
      // We never read this file for the active list when hasCloudinaryCreds (cloud wins).
      if (!isVercelProd) {
        try {
          await savePromptsToFile(toUpload);
        } catch (e) {
          console.warn('Non-fatal: failed to also write current list to local prompts.json for inspection:', e);
        }
      }
      return;
    } catch (error: any) {
      console.error('Cloudinary prompts data upload error, falling back:', error);
      if (isVercelProd) {
        throw new Error(
          'Cloudinary prompt persistence failed in production. Please verify your Cloudinary credentials and that raw JSON uploads are allowed for this account.'
        );
      }
    }
  }

  const redisClient = await getRedisClient();
  if (redisClient) {
    try {
      await redisClient.set('prompts', JSON.stringify(prompts));
      return;
    } catch (error: any) {
      console.error('Redis prompts save error, falling back to file:', error);
    }
  }

  if (isVercelProd) {
    throw new Error(
      '[Prompts] savePrompts failed on Vercel: no persistent storage backend is configured. Set Cloudinary credentials or provide Redis to persist prompt data.'
    );
  }
  await savePromptsToFile(prompts);
}

async function savePromptsToFile(prompts: Prompt[]): Promise<void> {
  await ensureDataDir();
  await fs.writeFile(DATA_FILE, JSON.stringify(prompts, null, 2), 'utf-8');
}

// Add a new prompt (with auto-generated ID and defaults)
export async function addPrompt(newPromptData: Omit<Prompt, 'id' | 'likes' | 'views' | 'createdAt'>): Promise<Prompt> {
  const prompts = await getAllPrompts();
  
  const newPrompt: Prompt = {
    ...newPromptData,
    id: 'prompt_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9),
    likes: 0,
    views: 0,
    createdAt: new Date().toISOString(),
  };
  
  prompts.unshift(newPrompt); // Add to beginning (newest first)
  
  await savePrompts(prompts);
  return newPrompt;
}

// Get single prompt
export async function getPromptById(id: string): Promise<Prompt | null> {
  const prompts = await getAllPrompts();
  return prompts.find(p => p.id === id) || null;
}
