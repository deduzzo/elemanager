import imageCompression from 'browser-image-compression';
import { supabase } from './supabase';

const BUCKET = 'sezioni-photos';

export type UploadedPhoto = {
  storage_path: string;
  width: number;
  height: number;
  bytes: number;
};

async function getImageDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Impossibile leggere immagine'));
    };
    img.src = url;
  });
}

export async function uploadPhoto(
  file: File,
  giornataId: string,
  sezioneId: string,
): Promise<UploadedPhoto> {
  // Compress: max 1MB, max side 2000px, WebP if possibile.
  const compressed = await imageCompression(file, {
    maxSizeMB: 1,
    maxWidthOrHeight: 2000,
    useWebWorker: true,
    fileType: 'image/webp',
  });

  const dims = await getImageDimensions(compressed);
  const date = new Date().toISOString().slice(0, 10);
  const uuid = crypto.randomUUID();
  const ext = compressed.type === 'image/webp' ? 'webp' : compressed.type === 'image/png' ? 'png' : 'jpg';
  const path = `${giornataId}/${sezioneId}/${date}-${uuid}.${ext}`;

  const { error } = await supabase.storage.from(BUCKET).upload(path, compressed, {
    cacheControl: '3600',
    upsert: false,
    contentType: compressed.type,
  });
  if (error) throw error;

  return {
    storage_path: path,
    width: dims.width,
    height: dims.height,
    bytes: compressed.size,
  };
}

export async function deletePhotoFile(storagePath: string): Promise<void> {
  const { error } = await supabase.storage.from(BUCKET).remove([storagePath]);
  if (error) throw error;
}

export async function getSignedUrl(storagePath: string, expiresInSec = 3600): Promise<string> {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(storagePath, expiresInSec);
  if (error) throw error;
  return data.signedUrl;
}
