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

  // Use a *unique* public_id for every data blob (immutable). This completely avoids
  // any "overwrite latest alias lag" on Cloudinary's fixed-name delivery path.
  const uniqueSuffix = Date.now() + '-' + Math.random().toString(36).slice(2, 9);
  const dataPublicId = `prompts/data-${uniqueSuffix}.json`;

  const result = await cloudinary.uploader.upload(dataUri, {
    resource_type: 'raw',
    public_id: dataPublicId,
    overwrite: true,
  });
  console.log('✅ Prompts data uploaded to Cloudinary as', dataPublicId, 'version:', result.version);

  // Write/overwrite a small *pointer* that tells readers the current data file name.
  // The pointer itself is overwritten but being tiny + new name on data, readers get strong consistency quickly.
  try {
    const pointer = JSON.stringify({ current: dataPublicId, updatedAt: new Date().toISOString() });
    const pB64 = Buffer.from(pointer).toString('base64');
    const pUri = `data:application/json;base64,${pB64}`;
    await cloudinary.uploader.upload(pUri, {
      resource_type: 'raw',
      public_id: 'prompts/data.current.json',
      overwrite: true,
    });
    console.log('✅ Pointer updated: prompts/data.current.json ->', dataPublicId);
  } catch (e: any) {
    console.warn('Pointer upload non-critical (will fallback):', e?.message || e);
  }

  // Also keep the classic fixed public_id in sync (for currently deployed code on Vercel that only knows the old path,
  // and as a reliable fallback in the new get logic). This guarantees that even if the pointer lags, readers eventually see fresh data.
  try {
    await cloudinary.uploader.upload(dataUri, {
      resource_type: 'raw',
      public_id: 'prompts/data.json',
      overwrite: true,
    });
    await cloudinary.uploader.explicit('prompts/data.json', {
      resource_type: 'raw',
      type: 'upload',
      invalidate: true,
    });
    console.log('✅ Also synced classic fixed prompts/data.json for back-compat + fallback');
  } catch (e: any) {
    console.warn('Fixed-name back-compat upload non-critical:', e?.message || e);
  }

  // Invalidate the pointer (and the unique blob)
  try {
    await cloudinary.uploader.explicit('prompts/data.current.json', {
      resource_type: 'raw',
      type: 'upload',
      invalidate: true,
    });
    await cloudinary.uploader.explicit(dataPublicId, {
      resource_type: 'raw',
      type: 'upload',
      invalidate: true,
    });
    console.log('✅ Invalidated cache for pointer + new data blob');
  } catch (e: any) {
    console.warn('Invalidate non-critical:', e?.message || e);
  }
}

export async function getPromptsData(): Promise<Prompt[] | 'NO_DATA_FILE' | null> {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  if (!cloudName) {
    return null;
  }

  const ts = Date.now();

  // Preferred: read the "current" pointer written by the immutable-blob + pointer scheme.
  try {
    const pointerUrl = `https://res.cloudinary.com/${cloudName}/raw/upload/prompts/data.current.json?ts=${ts}`;
    const pRes = await fetch(pointerUrl, {
      cache: 'no-store',
      headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate' },
    });
    if (pRes.ok) {
      const meta = await pRes.json().catch(() => ({} as any));
      const currentName: string | undefined = meta?.current;
      if (currentName && typeof currentName === 'string' && currentName.includes('data-')) {
        const dataUrl = `https://res.cloudinary.com/${cloudName}/raw/upload/${currentName}?ts=${ts}`;
        for (let attempt = 0; attempt < 3; attempt++) {
          try {
            const dRes = await fetch(dataUrl, {
              cache: 'no-store',
              headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate' },
            });
            if (dRes.ok) {
              const data = await dRes.json();
              console.log('✅ Fetched prompts via pointer ->', currentName, 'items:', Array.isArray(data) ? data.length : 0);
              return Array.isArray(data) ? data : [];
            }
            if (dRes.status === 404 && attempt < 2) {
              await new Promise(r => setTimeout(r, 300 + attempt * 200));
              continue;
            }
          } catch (e) {
            if (attempt === 2) throw e;
            await new Promise(r => setTimeout(r, 300 + attempt * 200));
          }
        }
      }
    }
  } catch (e) {
    // pointer missing or broken → try fallbacks below
  }

  // Fallback 1: old version pointer (data.ver.txt) + /vN/ path (for transitional deploys)
  try {
    const verUrl = `https://res.cloudinary.com/${cloudName}/raw/upload/prompts/data.ver.txt?ts=${ts}`;
    const vRes = await fetch(verUrl, { cache: 'no-store', headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate' } });
    if (vRes.ok) {
      const vText = (await vRes.text()).trim();
      if (/^\d+$/.test(vText)) {
        const verDataUrl = `https://res.cloudinary.com/${cloudName}/raw/upload/v${vText}/prompts/data.json?ts=${ts}`;
        const dv = await fetch(verDataUrl, { cache: 'no-store', headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate' } });
        if (dv.ok) {
          const data = await dv.json();
          console.log('✅ Fetched (legacy ver pointer v' + vText + ') items:', Array.isArray(data) ? data.length : 0);
          return Array.isArray(data) ? data : [];
        }
      }
    }
  } catch {}

  // Fallback 2: the original fixed-name path (for any data.json that was created before this pointer scheme, or direct seeds)
  const legacyUrl = `https://res.cloudinary.com/${cloudName}/raw/upload/prompts/data.json?ts=${ts}`;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(legacyUrl, {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate' },
      });
      if (!res.ok) {
        if (res.status === 404) {
          return 'NO_DATA_FILE';
        }
        if (attempt === 2) return null;
        await new Promise(r => setTimeout(r, 300 + attempt * 200));
        continue;
      }
      const data = await res.json();
      console.log('✅ Fetched prompts data (legacy fixed name) items:', Array.isArray(data) ? data.length : 0);
      return Array.isArray(data) ? data : [];
    } catch (error) {
      if (attempt === 2) return null;
      await new Promise(r => setTimeout(r, 300 + attempt * 200));
    }
  }
  return null;
}
