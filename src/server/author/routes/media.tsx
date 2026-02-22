import type { Database } from 'bun:sqlite';
import type { EventStore } from '../../../core/events';
import { applyEvent } from '../../../core/projections';
import { ulid } from 'ulidx';
import { mkdirSync } from 'fs';
import { authorLayout } from './layout';

interface MediaFile {
  id: string; filename: string; mime_type: string; path: string;
  alt_text: string | null; tags: string; uploaded_at: number;
}

export function renderMediaIndex(db: Database): string {
  const files = db.prepare('SELECT * FROM media ORDER BY uploaded_at DESC').all() as MediaFile[];
  const content = `
    <h2>Media</h2>
    <form method="POST" action="/media" enctype="multipart/form-data">
      <label>Upload file <input type="file" name="file" required></label>
      <label>Alt text <input type="text" name="altText" placeholder="Describe the file"></label>
      <button type="submit">Upload</button>
    </form>
    <hr>
    <div class="grid">
      ${files.map(f => `
        <figure>
          ${f.mime_type.startsWith('image/')
            ? `<img src="/media/${f.id}" alt="${f.alt_text ?? ''}" style="max-width:100%">`
            : `<p><a href="/media/${f.id}">${f.filename}</a></p>`
          }
          <figcaption>
            <code>${f.filename}</code><br>
            <small>${f.mime_type} · ${new Date(f.uploaded_at).toLocaleDateString()}</small>
          </figcaption>
        </figure>`).join('')}
    </div>
  `;
  return authorLayout('Media', content, db);
}

export async function handleMediaUpload(
  db: Database, store: EventStore,
  body: { file: File; altText?: string }
): Promise<void> {
  const mediaPath = `${process.cwd()}/media`;
  mkdirSync(mediaPath, { recursive: true });

  const id = ulid();
  const ext = body.file.name.split('.').pop() ?? '';
  const filename = `${id}.${ext}`;
  const filePath = `${mediaPath}/${filename}`;

  await Bun.write(filePath, await body.file.arrayBuffer());

  const event = {
    type: 'MediaUploaded' as const,
    id,
    filename: body.file.name,
    mimeType: body.file.type,
    path: filePath,
    altText: body.altText,
  };
  store.append(event);
  applyEvent(db, event, Date.now());
}
