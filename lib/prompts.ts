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
      if (cloudData && Array.isArray(cloudData) && cloudData.length > 0) {
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
      // If Cloudinary available, upload the current data to it for future use
      if (hasCloudinaryCreds) {
        try {
          await uploadPromptsData(parsed);
        } catch (e) {
          console.error('Failed to seed current file data to Cloudinary:', e);
        }
      }
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
    try {
      await uploadPromptsData(prompts);
      return;
    } catch (error) {
      console.error('Cloudinary prompts data upload error, falling back:', error);
    }
  }

  const redisClient = await getRedisClient();
  if (redisClient) {
    try {
      await redisClient.set('prompts', JSON.stringify(prompts));
      return;
    } catch (error) {
      console.error('Redis prompts save error, falling back to file:', error);
    }
  }

  if (isVercelProd) {
    // On Vercel the FS is read-only / changes don't persist across invocations.
    console.warn('[Prompts] savePrompts skipped on Vercel (read-only filesystem). Using Cloudinary/Redis for persistence if configured.');
    return;
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
