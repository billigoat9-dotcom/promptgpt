/**
 * One-time migration script to upload local images to Cloudinary
 * and update lib/data/prompts.json with new URLs.
 *
 * Run with: npx tsx -r dotenv/config scripts/migrate-to-cloudinary.ts
 */

import { readFile, writeFile } from 'fs/promises';
import path from 'path';
import dotenv from 'dotenv';
import { uploadToCloudinary } from '../lib/cloudinary';

// Load .env.local explicitly
dotenv.config({ path: '.env.local' });

const PROMPTS_FILE = path.join(process.cwd(), 'lib', 'data', 'prompts.json');
const UPLOADS_DIR = path.join(process.cwd(), 'public', 'uploads');

async function migrate() {
  console.log('Starting migration to Cloudinary...\n');

  // Read current prompts
  const data = await readFile(PROMPTS_FILE, 'utf-8');
  const prompts = JSON.parse(data);

  let updatedCount = 0;

  for (const prompt of prompts) {
    const imageUrl: string = prompt.imageUrl;

    // Only process local uploads
    if (imageUrl.startsWith('/uploads/')) {
      const filename = imageUrl.replace('/uploads/', '');
      const localPath = path.join(UPLOADS_DIR, filename);

      try {
        const buffer = await readFile(localPath);
        const cloudinaryUrl = await uploadToCloudinary(buffer, 'prompt-gallery');

        console.log(`✓ Migrated: ${filename} → ${cloudinaryUrl}`);

        prompt.imageUrl = cloudinaryUrl;
        updatedCount++;
      } catch (error) {
        console.error(`✗ Failed to migrate ${filename}:`, error);
      }
    }
  }

  if (updatedCount > 0) {
    await writeFile(PROMPTS_FILE, JSON.stringify(prompts, null, 2));
    console.log(`\n✅ Successfully migrated ${updatedCount} image(s) to Cloudinary.`);
    console.log('prompts.json has been updated.');
  } else {
    console.log('\nNo local images found to migrate.');
  }
}

migrate().catch(console.error);
