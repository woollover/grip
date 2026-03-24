import type { Database } from 'bun:sqlite';
import type { EventStore } from '../../../core/events';
import { commitEvent } from '../../../core/projections';
import { slugify } from '../../../core/utils';
import { ulid } from 'ulidx';
import { authorLayout } from './layout';
import { esc } from '../../../views/shared';
import { editorImageWidget } from './media';
import { AlignPicker, getSiteHost } from './shared';

interface Page {
  id: string; slug: string; title: string; body_md: string;
  body_html: string; status: string; created_at: number; updated_at: number;
}

export function renderPagesIndex(db: Database): JSX.Element {
  const pages = db.prepare('SELECT * FROM pages ORDER BY updated_at DESC').all() as Page[];

  function statusDot(status: string): JSX.Element {
    if (status === 'published') return <span class="sdot sdot-pub" />;
    return <span class="sdot sdot-draft" />;
  }

  const content = (
    <div>
      <div class="page-hd">
        <h2>Pages</h2>
        <a href="/pages/new" class="btn btn-primary btn-sm">+ New page</a>
      </div>

      {pages.length === 0 && (
        <p style="color:var(--g-text-muted);font-size:.88rem">No pages yet.</p>
      )}

      <div>
        {pages.map(p => (
          <div class="article-row">
            <div class="article-dot">{statusDot(p.status)}</div>
            <div class="article-info">
              <a class="article-row-title" href={`/pages/${p.id}/edit`}>{esc(p.title)}</a>
              <div class="article-row-meta">
                <code style="font-size:.72rem">/{esc(p.slug)}</code>
                {p.status !== 'published' && (
                  <span style="color:var(--g-text-muted);font-size:.7rem">{p.status}</span>
                )}
              </div>
            </div>
            <div class="article-row-actions">
              <a href={`/pages/${p.id}/edit`} class="btn btn-outline btn-sm">Edit</a>
              {p.status !== 'published' && (
                <form method="POST" action={`/pages/${p.id}/publish`} style="margin:0">
                  <button type="submit" class="btn btn-ghost btn-sm">Publish</button>
                </form>
              )}
              {p.status === 'published' && (
                <span style="font-size:.72rem;color:var(--g-success);font-weight:600">Live ✓</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  return authorLayout('Pages', content, db, '/pages');
}

export function renderPageNew(db: Database): JSX.Element {
  const content = (
    <div class="editor-shell">
      <div class="editor-topbar">
        <a class="editor-topbar-brand" href="/dashboard">GRIP</a>
        <span style="color:var(--g-border)">›</span>
        <a href="/pages" style="font-size:.78rem;color:var(--g-text-muted);text-decoration:none">Pages</a>
        <span style="color:var(--g-border)">›</span>
        <span class="editor-title-pill" id="editor-title-display">New page</span>
        <div class="editor-spacer"></div>
        <button type="submit" form="page-form" class="btn btn-outline btn-sm">Save draft</button>
        <a href="/pages" class="btn btn-ghost btn-sm">Cancel</a>
      </div>

      <form id="page-form" method="POST" action="/pages">
        <div class="editor-metabar">
          <input
            class="editor-title-input"
            type="text"
            name="title"
            placeholder="Page title…"
            required
            autofocus
            id="page-title"
            oninput="document.getElementById('editor-title-display').textContent = this.value || 'New page'"
          />
          <div style="display:flex;align-items:center;gap:.5rem;flex-shrink:0">
            <span style="font-size:.7rem;color:var(--g-text-muted)">Slug:</span>
            <input
              type="text"
              name="slug"
              id="page-slug"
              placeholder="auto-generated"
              class="tags-input"
            />
          </div>
        </div>

        <div class="editor-split">
          <div class="editor-pane">
            <div class="editor-pane-header">
              <span>Markdown</span>
              <div style="display:flex;gap:.5rem;align-items:center;font-weight:400;letter-spacing:0;text-transform:none">
                <AlignPicker />
                {editorImageWidget()}
              </div>
            </div>
            <div class="editor-pane-body">
              <textarea
                name="body"
                id="body"
                data-md-editor
                hx-post="/preview"
                hx-trigger="keyup changed delay:300ms"
                hx-target="#preview"
                placeholder="Write in Markdown…"
              />
            </div>
          </div>
          <div class="editor-pane">
            <div class="editor-pane-header"><span>Preview</span></div>
            <div class="editor-pane-body editor-preview" id="preview">
              <em style="color:var(--g-text-muted);font-size:.85rem">Preview will appear here…</em>
            </div>
          </div>
        </div>

        <div class="editor-footerbar">
          <span>New page</span>
          <span class="sep">·</span>
          <span id="word-count">0 words</span>
          <div style="flex:1"></div>
          <span>Status: <strong>draft</strong></span>
        </div>
      </form>
      <script src="/static/grip-editor.js" defer />
      <script>{`
        (function() {
          var ta = document.querySelector('textarea[name="body"]');
          var wc = document.getElementById('word-count');
          if (ta && wc) {
            function updateWC() { var w = ta.value.trim() ? ta.value.trim().split(/\\s+/).length : 0; wc.textContent = w + ' word' + (w !== 1 ? 's' : ''); }
            ta.addEventListener('input', updateWC);
          }
        })();
      `}</script>
    </div>
  );

  return authorLayout('New page', content, db, '/pages', true, true);
}

export function handlePageCreate(
  db: Database, store: EventStore,
  body: { title: string; slug?: string; body: string }
): string {
  const id = ulid();
  const slug = body.slug?.trim() || slugify(body.title);
  const event = { type: 'PageCreated' as const, id, title: body.title, slug, body: body.body };
  commitEvent(db, store, event);
  return id;
}

export function renderPageEdit(db: Database, id: string): JSX.Element {
  const page = db.prepare('SELECT * FROM pages WHERE id = ?').get(id) as Page | null;
  if (!page) return authorLayout('Not found', <p>Page not found.</p>, db, '/pages');
  const siteHost = getSiteHost(db);

  const statusDotStyle = page.status === 'published'
    ? 'background:var(--g-success)'
    : 'background:transparent;border:1.5px solid var(--g-text-muted)';

  const content = (
    <div class="editor-shell">
      <div class="editor-topbar">
        <a class="editor-topbar-brand" href="/dashboard">GRIP</a>
        <span style="color:var(--g-border)">›</span>
        <a href="/pages" style="font-size:.78rem;color:var(--g-text-muted);text-decoration:none">Pages</a>
        <span style="color:var(--g-border)">›</span>
        <span class="editor-title-pill" id="editor-title-display">{esc(page.title)}</span>
        <div class="editor-spacer"></div>
        <span class="editor-status-pill">
          <span style={`width:6px;height:6px;border-radius:50%;display:inline-block;${statusDotStyle}`}></span>
          {page.status}
        </span>
        <button type="submit" form="page-form" class="btn btn-outline btn-sm">Save</button>
        {page.status !== 'published' && (
          <button type="submit" form="publish-form" class="btn btn-primary btn-sm">Publish →</button>
        )}
        {page.status === 'published' && (
          <a href={`//${siteHost}/p/${esc(page.slug)}`} target="_blank" rel="noopener" class="btn btn-ghost btn-sm">View →</a>
        )}
      </div>

      <form id="page-form" method="POST" action={`/pages/${id}/revise`}>
        <div class="editor-metabar">
          <input
            class="editor-title-input"
            type="text"
            name="title"
            value={esc(page.title)}
            required
            id="page-title"
            oninput="document.getElementById('editor-title-display').textContent = this.value || 'Untitled'"
          />
          <div style="display:flex;align-items:center;gap:.5rem;flex-shrink:0">
            <span style="font-size:.7rem;color:var(--g-text-muted)">Slug:</span>
            <input
              type="text"
              name="slug"
              value={esc(page.slug)}
              class="tags-input"
            />
          </div>
        </div>

        <div class="editor-split">
          <div class="editor-pane">
            <div class="editor-pane-header">
              <span>Markdown</span>
              <div style="display:flex;gap:.5rem;align-items:center;font-weight:400;letter-spacing:0;text-transform:none">
                <AlignPicker />
                {editorImageWidget()}
              </div>
            </div>
            <div class="editor-pane-body">
              <textarea
                name="body"
                id="body"
                data-md-editor
                hx-post="/preview"
                hx-trigger="keyup changed delay:300ms"
                hx-target="#preview"
              >{page.body_md}</textarea>
            </div>
          </div>
          <div class="editor-pane">
            <div class="editor-pane-header"><span>Preview</span></div>
            <div class="editor-pane-body editor-preview" id="preview">
              <em style="color:var(--g-text-muted);font-size:.85rem">Loading preview…</em>
            </div>
          </div>
        </div>

        <div class="editor-footerbar">
          <span safe>/{page.slug}</span>
          <span class="sep">·</span>
          <span id="word-count">— words</span>
          <div style="flex:1"></div>
          <span>Status: <strong>{page.status}</strong></span>
        </div>
      </form>

      <form id="publish-form" method="POST" action={`/pages/${id}/publish`} style="display:none"></form>

      <script src="/static/grip-editor.js" defer />
      <script>{`
        (function() {
          var ta = document.querySelector('textarea[name="body"]');
          var wc = document.getElementById('word-count');
          if (ta && wc) {
            function updateWC() { var w = ta.value.trim() ? ta.value.trim().split(/\\s+/).length : 0; wc.textContent = w + ' word' + (w !== 1 ? 's' : ''); }
            ta.addEventListener('input', updateWC);
            updateWC();
          }
        })();
      `}</script>
    </div>
  );

  return authorLayout(`Edit: ${page.title}`, content, db, '/pages', true, true);
}

export function handlePageRevise(
  db: Database, store: EventStore, id: string,
  body: { title?: string; slug?: string; body?: string }
): void {
  const event = { type: 'PageRevised' as const, id, title: body.title, slug: body.slug?.trim() || undefined, body: body.body };
  commitEvent(db, store, event);
}

export function handlePagePublish(db: Database, store: EventStore, id: string): void {
  const event = { type: 'PagePublished' as const, id };
  commitEvent(db, store, event);
}
