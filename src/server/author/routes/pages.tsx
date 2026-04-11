import type { EventStore } from '../../../core/events';
import { commitEvent } from '../../../core/projections';
import { slugify } from '../../../core/utils';
import { ulid } from 'ulidx';
import { authorLayout } from './layout';
import { esc } from '../../../views/shared';
import { editorImageWidget } from './media';
import { AlignPicker } from './shared';
import type { GripDb } from '../../data/index';

const EDITOR_SCRIPT = `(function(){
  var ta=document.querySelector('textarea[name="body"]');
  var wc=document.getElementById('word-count');
  if(ta&&wc){
    function upd(){var w=ta.value.trim()?ta.value.trim().split(/\\s+/).length:0;wc.textContent=w.toLocaleString()+' word'+(w!==1?'s':'');}
    ta.addEventListener('input',upd);upd();
  }
  document.addEventListener('keydown',function(e){
    if((e.ctrlKey||e.metaKey)&&e.key==='s'){
      e.preventDefault();
      var f=document.querySelector('.editor-shell form');
      if(f)f.requestSubmit();
    }
  });
})();`;

export function renderPagesIndex(db: GripDb): JSX.Element {
  const pages = db.pages.listAdmin();

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

export function renderPageNew(db: GripDb): JSX.Element {
  const content = (
    <div class="editor-shell">
      <div class="editor-topbar">
        <a class="editor-topbar-brand" href="/dashboard">GRIP</a>
        <span class="editor-topbar-sep">›</span>
        <a href="/pages" class="editor-topbar-crumb">Pages</a>
        <div class="editor-spacer" />
        <button type="submit" form="page-form" class="btn btn-primary btn-sm">Save draft</button>
        <a href="/pages" class="btn btn-ghost btn-sm">Cancel</a>
      </div>

      <form id="page-form" method="POST" action="/pages">
        <div class="editor-titlebar">
          <input
            class="editor-title-input"
            type="text"
            name="title"
            placeholder="Page title…"
            required
            autofocus
          />
        </div>
        <div class="editor-metabar">
          <span class="editor-meta-label">Slug</span>
          <input
            type="text"
            name="slug"
            placeholder="auto-generated from title"
            class="editor-meta-input"
          />
        </div>

        <div class="editor-split">
          <div class="editor-pane">
            <div class="editor-pane-header">
              <span>Markdown</span>
              <div class="editor-pane-tools">
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
              <p class="editor-preview-empty">Preview appears as you write…</p>
            </div>
          </div>
        </div>

        <div class="editor-footerbar">
          <span id="word-count">0 words</span>
          <div class="editor-footerbar-spacer" />
          <span class="editor-footerbar-hint">Ctrl+S to save</span>
        </div>
      </form>
      <script src="/static/grip-editor.js" defer />
      <script>{EDITOR_SCRIPT}</script>
    </div>
  );

  return authorLayout('New page', content, db, '/pages', true, true);
}

export function handlePageCreate(
  db: GripDb, store: EventStore,
  body: { title: string; slug?: string; body: string }
): string {
  const id = ulid();
  const slug = body.slug?.trim() || slugify(body.title);
  const event = { type: 'PageCreated' as const, id, title: body.title, slug, body: body.body };
  commitEvent(db.raw, store, event);
  return id;
}

export function renderPageEdit(db: GripDb, id: string): JSX.Element {
  const page = db.pages.getById(id);
  if (!page) return authorLayout('Not found', <p>Page not found.</p>, db, '/pages');
  const siteHost = db.config.getSite().domain;

  const content = (
    <div class="editor-shell">
      <div class="editor-topbar">
        <a class="editor-topbar-brand" href="/dashboard">GRIP</a>
        <span class="editor-topbar-sep">›</span>
        <a href="/pages" class="editor-topbar-crumb">Pages</a>
        <div class="editor-spacer" />
        <span class={`editor-status-pill status-${page.status}`}>{page.status}</span>
        <button type="submit" form="page-form" class="btn btn-outline btn-sm">Save</button>
        {page.status !== 'published' && (
          <button type="submit" form="publish-form" class="btn btn-primary btn-sm">Publish</button>
        )}
        {page.status === 'published' && (
          <a href={`//${siteHost}/p/${esc(page.slug)}`} target="_blank" rel="noopener" class="btn btn-ghost btn-sm">View ↗</a>
        )}
      </div>

      <form id="page-form" method="POST" action={`/pages/${id}/revise`}>
        <div class="editor-titlebar">
          <input
            class="editor-title-input"
            type="text"
            name="title"
            value={esc(page.title)}
            required
            autofocus
          />
        </div>
        <div class="editor-metabar">
          <span class="editor-meta-label">Slug</span>
          <input
            type="text"
            name="slug"
            value={esc(page.slug)}
            class="editor-meta-input"
          />
        </div>

        <div class="editor-split">
          <div class="editor-pane">
            <div class="editor-pane-header">
              <span>Markdown</span>
              <div class="editor-pane-tools">
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
                hx-trigger="load, keyup changed delay:300ms"
                hx-target="#preview"
              >{page.body_md}</textarea>
            </div>
          </div>
          <div class="editor-pane">
            <div class="editor-pane-header"><span>Preview</span></div>
            <div class="editor-pane-body editor-preview" id="preview">
              <p class="editor-preview-empty">Loading…</p>
            </div>
          </div>
        </div>

        <div class="editor-footerbar">
          <span id="word-count">— words</span>
          <div class="editor-footerbar-spacer" />
          <span class="editor-footerbar-hint">Ctrl+S to save</span>
        </div>
      </form>

      <form id="publish-form" method="POST" action={`/pages/${id}/publish`} style="display:none" />

      <script src="/static/grip-editor.js" defer />
      <script>{EDITOR_SCRIPT}</script>
    </div>
  );

  return authorLayout(`Edit: ${page.title}`, content, db, '/pages', true, true);
}

export function handlePageRevise(
  db: GripDb, store: EventStore, id: string,
  body: { title?: string; slug?: string; body?: string }
): void {
  const event = { type: 'PageRevised' as const, id, title: body.title, slug: body.slug?.trim() || undefined, body: body.body };
  commitEvent(db.raw, store, event);
}

export function handlePagePublish(db: GripDb, store: EventStore, id: string): void {
  const event = { type: 'PagePublished' as const, id };
  commitEvent(db.raw, store, event);
}
