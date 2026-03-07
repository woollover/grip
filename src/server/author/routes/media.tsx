import type { Database } from 'bun:sqlite';
import type { EventStore } from '../../../core/events';
import { applyEvent } from '../../../core/projections';
import { ulid } from 'ulidx';
import { mkdirSync } from 'fs';
import { authorLayout } from './layout';

const ALLOWED_MIME: Record<string, string> = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
  gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml',
  pdf: 'application/pdf', mp4: 'video/mp4', mp3: 'audio/mpeg',
  txt: 'text/plain', md: 'text/plain',
};

function deriveMimeType(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() ?? '';
  return ALLOWED_MIME[ext] ?? '';
}

interface MediaFile {
  id: string; filename: string; mime_type: string; path: string;
  alt_text: string | null; tags: string; uploaded_at: number;
}

export function renderMediaIndex(db: Database): JSX.Element {
  const files = db.prepare('SELECT * FROM media ORDER BY uploaded_at DESC').all() as MediaFile[];

  const content = (
    <div>
      <h2>Media</h2>
      <form method="POST" action="/media" enctype="multipart/form-data">
        <label>Upload file <input type="file" name="file" required /></label>
        <label>Alt text <input type="text" name="altText" placeholder="Describe the file" /></label>
        <button type="submit">Upload</button>
      </form>
      <hr />
      <div class="grid">
        {files.map(f => (
          <figure>
            {f.mime_type.startsWith('image/')
              ? <img src={`/media/${f.id}`} alt={f.alt_text ?? ''} style="max-width:100%" />
              : <p><a href={`/media/${f.id}`}>{f.filename}</a></p>
            }
            <figcaption>
              <code>{f.filename}</code><br />
              <small>{f.mime_type} · {new Date(f.uploaded_at).toLocaleDateString()}</small>
            </figcaption>
          </figure>
        ))}
      </div>
    </div>
  );

  return authorLayout('Media', content, db);
}

export function editorImageWidget(): JSX.Element {
  const script = `
(function() {
  const btn      = document.getElementById('insert-image-btn');
  const input    = document.getElementById('image-file-input');
  const textarea = document.querySelector('textarea[name="body"]');
  btn.addEventListener('click', () => input.click());
  input.addEventListener('change', async () => {
    const file = input.files[0];
    if (!file) return;
    btn.disabled = true;
    btn.textContent = 'Uploading\u2026';
    const form = new FormData();
    form.append('file', file);
    form.append('altText', file.name.replace(/\\.[^.]+$/, ''));
    try {
      const res  = await fetch('/media/upload', { method: 'POST', body: form });
      const data = await res.json();
      const align = document.getElementById('img-align-picker')?.dataset.align ?? 'center';
      const snippet = buildSnippet(data.alt, data.id, align);
      const s = textarea.selectionStart, e = textarea.selectionEnd;
      textarea.value = textarea.value.slice(0, s) + snippet + textarea.value.slice(e);
      textarea.selectionStart = textarea.selectionEnd = s + snippet.length;
      textarea.dispatchEvent(new KeyboardEvent('keyup'));
    } finally {
      btn.disabled = false;
      btn.textContent = '\uD83D\uDCCE Insert image';
      input.value = '';
    }
  });
  function buildSnippet(alt, id, align) {
    const src = '/media/' + id;
    if (align === 'left')
      return '<img src="' + src + '" alt="' + alt + '" style="float:left;margin:0 1.5rem 1rem 0">\\n\\n';
    if (align === 'right')
      return '<img src="' + src + '" alt="' + alt + '" style="float:right;margin:0 0 1rem 1.5rem">\\n\\n';
    return '<img src="' + src + '" alt="' + alt + '" style="display:block;margin:0 auto">\\n\\n';
  }
})();
`;

  return (
    <div style="margin-bottom:0.5rem">
      <button type="button" id="insert-image-btn" class="outline"
        style="padding:0.3rem 0.8rem;font-size:0.875rem">
        📎 Insert image
      </button>
      <input type="file" id="image-file-input" accept="image/*" style="display:none" />
      <script>{script}</script>
    </div>
  );
}

async function saveUpload(
  db: Database, store: EventStore,
  body: { file: File; altText?: string },
): Promise<{ id: string; mimeType: string; alt: string }> {
  const mimeType = deriveMimeType(body.file.name);
  if (!mimeType) throw new Error(`File type not allowed: ${body.file.name}`);

  const mediaPath = `${process.cwd()}/media`;
  mkdirSync(mediaPath, { recursive: true });

  const id = ulid();
  const ext = body.file.name.split('.').pop()!.toLowerCase();
  const filePath = `${mediaPath}/${id}.${ext}`;
  await Bun.write(filePath, await body.file.arrayBuffer());

  const alt = body.altText?.trim() || body.file.name.replace(/\.[^.]+$/, '');
  const event = {
    type: 'MediaUploaded' as const,
    id,
    filename: body.file.name,
    mimeType,
    path: filePath,
    altText: alt,
  };
  store.append(event);
  applyEvent(db, event, Date.now());
  return { id, mimeType, alt };
}

export async function handleMediaUploadJson(
  db: Database, store: EventStore,
  body: { file: File; altText?: string }
): Promise<{ id: string; url: string; alt: string }> {
  const { id, alt } = await saveUpload(db, store, body);
  return { id, url: `/media/${id}`, alt };
}

export async function handleMediaUpload(
  db: Database, store: EventStore,
  body: { file: File; altText?: string }
): Promise<void> {
  await saveUpload(db, store, body);
}
