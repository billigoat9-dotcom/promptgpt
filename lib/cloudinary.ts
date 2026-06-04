import { v2 as cloudinary } from 'cloudinary';
import dotenv from 'dotenv';
import { Prompt } from './types';

// Load .env.local explicitly only if not running on Vercel (where platform env vars are injected)
// and only if Cloudinary vars aren't already present (Next.js loads .env* automatically for the app).
if (!process.env.VERCEL && !process.env.CLOUDINARY_CLOUD_NAME) {
  dotenv.config({ path: '.env.local' });
}

let cloudinaryConfigured = false;

function ensureCloudinaryConfigured() {
  if (cloudinaryConfigured) return;

  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error(
      'Cloudinary credentials are missing. Please ensure the following environment variables are set:\n' +
      'CLOUDINARY_CLOUD_NAME\nCLOUDINARY_API_KEY\nCLOUDINARY_API_SECRET\n\n' +
      '• Local development (.env.local) mein daalo\n' +
      '• Vercel dashboard mein Project Settings → Environment Variables mein daalo\n' +
      '  → Production, Preview aur Development teeno environments select karke same values daal do'
    );
  }

  cloudinary.config({
    cloud_name: cloudName,
    api_key: apiKey,
    api_secret: apiSecret,
    secure: true,
  });

  cloudinaryConfigured = true;
  console.log('✅ Cloudinary configured for cloud:', cloudName);
}

export default cloudinary;

/**
 * Uploads an image buffer to Cloudinary
 */
export async function uploadToCloudinary(
  buffer: Buffer,
  folder: string = 'prompt-gallery'
): Promise<string> {
  try {
    ensureCloudinaryConfigured();
  } catch (configError: any) {
    console.error('❌ Cloudinary configuration error:', configError.message);
    throw configError; // Re-throw so the API route can catch it
  }

  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: 'image',
        quality: 'auto',
        fetch_format: 'auto',
      },
      (error, result) => {
        if (error) {
          console.error('❌ Cloudinary upload error:', error);
          return reject(new Error(`Cloudinary upload failed: ${error.message || JSON.stringify(error)}`));
        }

        if (result?.secure_url) {
          console.log('✅ Successfully uploaded to Cloudinary:', result.secure_url);
          resolve(result.secure_url);
        } else {
          reject(new Error('Cloudinary did not return a secure_url'));
        }
      }
    );

    uploadStream.end(buffer);
  });
}

export async function uploadPromptsData(prompts: Prompt[]): Promise<void> {
  try {
    ensureCloudinaryConfigured();
  } catch (configError: any) {
    console.error('❌ Cloudinary configuration error for prompts data:', configError.message);
    throw configError;
  }

  const jsonString = JSON.stringify(prompts, null, 2);
  const base64 = Buffer.from(jsonString).toString('base64');
  const dataUri = `data:application/json;base64,${base64}`;

  await cloudinary.uploader.upload(dataUri, {
    resource_type: 'raw',
    public_id: 'prompts/data',
    overwrite: true,
  });
}

export async function getPromptsData(): Promise<Prompt[] | null> {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  if (!cloudName) {
    return null;
  }

  const url = `https://res.cloudinary.com/${cloudName}/raw/upload/prompts/data?_=${Date.now()}`;
  try {
    const res = await fetch(url, {
      cache: 'no-store',
      headers: { 'Cache-Control': 'no-cache' },
    });
    if (!res.ok) {
      return null;
    }
    const data = await res.json();
    return Array.isArray(data) ? data : null;
  } catch (error) {
    console.error('❌ Failed to fetch prompts data from Cloudinary:', error);
    return null;
  }
}
