import type { Database } from 'bun:sqlite';
import type { EventStore } from '../../../core/events';
import { applyEvent } from '../../../core/projections';
import { ulid } from 'ulidx';
import { mkdirSync } from 'fs';
import { authorLayout } from './layout';
import { esc } from '../../../views/shared';
import { listAllMedia, type MediaFile } from '../../data/media';

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

function mimeEmoji(mimeType: string): string {
  if (mimeType.startsWith('image/')) return '🖼️';
  if (mimeType === 'application/pdf') return '📄';
  if (mimeType.startsWith('audio/')) return '🎵';
  if (mimeType.startsWith('video/')) return '🎬';
  if (mimeType.startsWith('text/')) return '📝';
  return '📎';
}


type MediaFilter = 'all' | 'images' | 'docs' | 'other';

export function renderMediaIndex(db: Database, filter: MediaFilter = 'all'): JSX.Element {
  let files: MediaFile[];
  const allFiles = listAllMedia(db);

  if (filter === 'images') {
    files = allFiles.filter(f => f.mime_type.startsWith('image/'));
  } else if (filter === 'docs') {
    files = allFiles.filter(f => f.mime_type === 'application/pdf' || f.mime_type.startsWith('text/'));
  } else if (filter === 'other') {
    files = allFiles.filter(f => !f.mime_type.startsWith('image/') && f.mime_type !== 'application/pdf' && !f.mime_type.startsWith('text/'));
  } else {
    files = allFiles;
  }

  const totalCount = allFiles.length;
  const imgCount = allFiles.filter(f => f.mime_type.startsWith('image/')).length;
  const docCount = allFiles.filter(f => f.mime_type === 'application/pdf' || f.mime_type.startsWith('text/')).length;
  const otherCount = allFiles.filter(f => !f.mime_type.startsWith('image/') && f.mime_type !== 'application/pdf' && !f.mime_type.startsWith('text/')).length;

  function filterBtn(f: MediaFilter, label: string): JSX.Element {
    return (
      <a href={`/media?filter=${f}`} class={`filter-btn${filter === f ? ' active' : ''}`} style="text-decoration:none">{label}</a>
    );
  }

  const content = (
    <div>
      <div class="page-hd">
        <h2>Media</h2>
        <label class="btn btn-primary btn-sm" style="cursor:pointer">
          ↑ Upload file
          <input type="file" id="media-upload-input" style="display:none" accept="image/*,application/pdf,audio/*,video/*,text/plain" />
        </label>
      </div>

      <div class="media-drop-zone" id="media-drop-zone">
        <span style="font-size:1.8rem;display:block;margin-bottom:.4rem">📂</span>
        Drop files here to upload — or click <strong>↑ Upload file</strong><br />
        <span style="font-size:.72rem">Images, PDFs, audio, video · Max 50 MB</span>
      </div>

      <div class="filter-row">
        <span style="color:var(--g-text-muted)">{totalCount} file{totalCount !== 1 ? 's' : ''}</span>
        <span style="color:var(--g-border)">·</span>
        {filterBtn('all', 'All')}
        {filterBtn('images', `Images${imgCount > 0 ? ` (${imgCount})` : ''}`)}
        {filterBtn('docs', `Documents${docCount > 0 ? ` (${docCount})` : ''}`)}
        {filterBtn('other', `Other${otherCount > 0 ? ` (${otherCount})` : ''}`)}
      </div>

      {/* Hidden upload form */}
      <form method="POST" action="/media" enctype="multipart/form-data" id="media-upload-form" style="display:none">
        <input type="file" name="file" id="media-file-field" />
        <input type="text" name="altText" id="media-alt-field" />
      </form>

      {files.length === 0 && (
        <p style="color:var(--g-text-muted);font-size:.88rem">No files found.</p>
      )}

      <div class="media-grid">
        {files.map(f => {
          const isImage = f.mime_type.startsWith('image/');
          const dateStr = new Date(f.uploaded_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
          return (
            <div class="media-card">
              <div class="media-thumb">
                {isImage
                  ? <img src={`/media/${f.id}`} alt={esc(f.alt_text || f.filename)} />
                  : <span style="font-size:2rem">{mimeEmoji(f.mime_type)}</span>
                }
              </div>
              <div class="media-card-info">
                <div class="media-card-name" title={esc(f.filename)}>{esc(f.filename)}</div>
                <div class="media-card-sub">{esc(f.mime_type)} · {dateStr}</div>
                <button
                  class="media-copy-btn"
                  type="button"
                  onclick={`navigator.clipboard.writeText('/media/${esc(f.id)}').then(function(){this.textContent='✓ Copied';setTimeout(function(){document.querySelectorAll('.media-copy-btn').forEach(function(b){b.textContent='📋 Copy URL'})},1500)}.bind(this))`}
                >📋 Copy URL</button>
              </div>
            </div>
          );
        })}
      </div>

      <script>{`
        (function() {
          var dropZone = document.getElementById('media-drop-zone');
          var fileInput = document.getElementById('media-upload-input');
          var form = document.getElementById('media-upload-form');
          var fileField = document.getElementById('media-file-field');

          function uploadFile(file) {
            var fd = new FormData();
            fd.append('file', file);
            fd.append('altText', file.name.replace(/\\.[^.]+$/, ''));
            fetch('/media', { method: 'POST', body: fd })
              .then(function() { window.location.reload(); })
              .catch(function(e) { alert('Upload failed: ' + e.message); });
          }

          if (fileInput) {
            fileInput.addEventListener('change', function() {
              if (this.files[0]) uploadFile(this.files[0]);
            });
          }

          if (dropZone) {
            dropZone.addEventListener('click', function() { if (fileInput) fileInput.click(); });
            dropZone.addEventListener('dragover', function(e) {
              e.preventDefault();
              this.style.borderColor = 'var(--g-accent)';
              this.style.background = 'var(--g-accent-muted)';
            });
            dropZone.addEventListener('dragleave', function() {
              this.style.borderColor = '';
              this.style.background = '';
            });
            dropZone.addEventListener('drop', function(e) {
              e.preventDefault();
              this.style.borderColor = '';
              this.style.background = '';
              var files = e.dataTransfer && e.dataTransfer.files;
              if (files && files[0]) uploadFile(files[0]);
            });
          }
        })();
      `}</script>
    </div>
  );

  return authorLayout('Media', content, db, '/media');
}

export function editorImageWidget(): JSX.Element {
  const script = `
(function() {
  var btn      = document.getElementById('insert-image-btn');
  var input    = document.getElementById('image-file-input');
  var textarea = document.querySelector('textarea[name="body"]');
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
    <span>
      <button type="button" id="insert-image-btn" class="btn btn-ghost btn-sm"
        style="font-size:.72rem">
        📎 Insert image
      </button>
      <input type="file" id="image-file-input" accept="image/*" style="display:none" />
      <script>{script}</script>
    </span>
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
