import type { Database } from 'bun:sqlite';
import { readFileSync } from 'fs';
import { getMediaById } from '../../data/media';

export function serveMedia(db: Database, id: string): Response | null {
  const file = getMediaById(db, id);
  if (!file) return null;

  try {
    const data = readFileSync(file.path);
    const isInline = file.mime_type.startsWith('image/') || file.mime_type.startsWith('video/') || file.mime_type.startsWith('audio/');
    return new Response(data, {
      headers: {
        'Content-Type': file.mime_type,
        'Cache-Control': 'public, max-age=31536000, immutable',
        'X-Content-Type-Options': 'nosniff',
        ...(isInline ? {} : { 'Content-Disposition': `attachment; filename="${file.filename}"` }),
      },
    });
  } catch {
    return null;
  }
}
