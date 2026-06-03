import { Prompt } from './types';
import { MOCK_PROMPTS } from './mockData';
import fs from 'fs/promises';
import path from 'path';

const DATA_FILE = path.join(process.cwd(), 'lib', 'data', 'prompts.json');

// Ensure directory exists
async function ensureDataDir() {
  const dir = path.dirname(DATA_FILE);
  try {
    await fs.mkdir(dir, { recursive: true });
  } catch {}
}

// Load prompts (from file or fallback to mock)
export async function getAllPrompts(): Promise<Prompt[]> {
  await ensureDataDir();
  
  try {
    const data = await fs.readFile(DATA_FILE, 'utf-8');
    const parsed = JSON.parse(data);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed;
    }
  } catch (error) {
    // File doesn't exist or invalid - seed with mock data
    console.log('Seeding prompts from mock data...');
    await savePrompts(MOCK_PROMPTS);
    return MOCK_PROMPTS;
  }
  
  return MOCK_PROMPTS;
}

// Save all prompts
export async function savePrompts(prompts: Prompt[]): Promise<void> {
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
