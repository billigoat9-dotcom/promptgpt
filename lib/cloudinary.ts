import { v2 as cloudinary } from 'cloudinary';
import dotenv from 'dotenv';

// Load .env.local explicitly (safe for both Next.js and scripts)
dotenv.config({ path: '.env.local' });

let cloudinaryConfigured = false;

function ensureCloudinaryConfigured() {
  if (cloudinaryConfigured) return;

  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error(
      'Cloudinary credentials are missing. Please check your .env.local file has:\n' +
      'CLOUDINARY_CLOUD_NAME\nCLOUDINARY_API_KEY\nCLOUDINARY_API_SECRET'
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
