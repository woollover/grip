import type { Database } from 'bun:sqlite';
import { readFileSync } from 'fs';

interface MediaFile {
  id: string; filename: string; mime_type: string; path: string;
  alt_text: string | null; uploaded_at: number;
}

export function serveMedia(db: Database, id: string): Response | null {
  const file = db.prepare('SELECT * FROM media WHERE id = ?').get(id) as MediaFile | null;
  if (!file) return null;

  try {
    const data = readFileSync(file.path);
    return new Response(data, {
      headers: {
        'Content-Type': file.mime_type,
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch {
    return null;
  }
}
