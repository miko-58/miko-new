import { randomUUID } from 'node:crypto';
import {
  v2 as cloudinary,
  type UploadApiErrorResponse,
  type UploadApiResponse,
} from 'cloudinary';

export function cloudinaryConfig() {
  const cloud_name = process.env.CLOUDINARY_CLOUD_NAME?.trim();
  const api_key = process.env.CLOUDINARY_API_KEY?.trim();
  const api_secret = process.env.CLOUDINARY_API_SECRET?.trim();
  if (!cloud_name || !api_key || !api_secret) throw new Error('Cloudinary設定がありません');
  return { cloud_name, api_key, api_secret, secure: true };
}

// Only sign this application's originals in the configured cloud, never arbitrary URLs.
export function cloudinaryPhotoId(value: unknown, cloudName: string): string {
  if (typeof value !== 'string') throw new Error('Missing photo URL');
  const url = new URL(value);
  if (url.origin !== 'https://res.cloudinary.com' || url.username || url.password || url.search || url.hash) {
    throw new Error('Invalid photo origin');
  }
  const prefix = `/${cloudName}/image/authenticated/`;
  if (!url.pathname.startsWith(prefix)) throw new Error('Invalid photo cloud');
  const match = /^(?:s--[A-Za-z0-9_-]+--\/)?v\d+\/(nearu\/posts\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.jpg$/.exec(url.pathname.slice(prefix.length));
  if (!match?.[1]) throw new Error('Invalid photo path');
  return match[1];
}

export async function uploadCloudinaryPhoto(buffer: Buffer) {
  const config = cloudinaryConfig();
  const publicId = `nearu/posts/${randomUUID()}`;
  const result = await new Promise<{ secure_url: string }>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream({
      ...config, public_id: publicId, resource_type: 'image', type: 'authenticated',
      format: 'jpg', overwrite: false, timeout: 60000,
    }, (error?: UploadApiErrorResponse, result?: UploadApiResponse) => {
      if (error || !result) reject(new Error('Cloudinary upload failed'));
      else resolve(result);
    });
    stream.on('error', () => reject(new Error('Cloudinary upload failed')));
    stream.end(buffer);
  });
  if (cloudinaryPhotoId(result.secure_url, config.cloud_name) !== publicId) throw new Error('Invalid upload response');
  // Keep a permanent original reference in Firestore; issue access URLs only when reading.
  const reference = new URL(result.secure_url);
  reference.pathname = reference.pathname.replace(/\/s--[A-Za-z0-9_-]+--\//, '/');
  return { blobName: publicId, imageUrl: reference.href };
}

export function signCloudinaryPhoto(value: unknown) {
  const config = cloudinaryConfig();
  const id = cloudinaryPhotoId(value, config.cloud_name);
  return cloudinary.utils.private_download_url(id, 'jpg', {
    ...config, resource_type: 'image', type: 'authenticated',
    attachment: false, expires_at: Math.floor(Date.now() / 1000) + 3600,
  });
}
