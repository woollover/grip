import type { Database } from 'bun:sqlite';
import type { EventStore } from '../../../core/events';
import { commitEvent } from '../../../core/projections';
import { slugify } from '../../../core/utils';
import { ulid } from 'ulidx';
import { authorLayout } from './layout';
import { paginationNav, fmtDate, esc } from '../../../views/shared';
import { getSiteHost } from './shared';
import { editorImageWidget } from './media';

const PAGE_SIZE = 20;

interface Article {
  id: string; slug: string; title: string; body_md: string;
  tags: string; status: string; created_at: number; updated_at: number; published_at: number | null;
}

type StatusFilter = 'all' | 'published' | 'draft' | 'unpublished';

export function renderArticlesIndex(db: Database, page = 1, statusFilter: StatusFilter = 'all'): JSX.Element {
  // Count per status
  const countAll       = (db.prepare('SELECT COUNT(*) as n FROM articles').get() as { n: number }).n;
  const countPublished = (db.prepare("SELECT COUNT(*) as n FROM articles WHERE status = 'published'").get() as { n: number }).n;
  const countDraft     = (db.prepare("SELECT COUNT(*) as n FROM articles WHERE status = 'draft'").get() as { n: number }).n;
  const countUnpub     = (db.prepare("SELECT COUNT(*) as n FROM articles WHERE status = 'unpublished'").get() as { n: number }).n;

  let total: number;
  let articles: Article[];
  const offset = (page - 1) * PAGE_SIZE;

  if (statusFilter === 'all') {
    total = countAll;
    articles = db.prepare('SELECT * FROM articles ORDER BY updated_at DESC LIMIT ? OFFSET ?').all(PAGE_SIZE, offset) as Article[];
  } else {
    total = statusFilter === 'published' ? countPublished : statusFilter === 'draft' ? countDraft : countUnpub;
    articles = db.prepare(
      'SELECT * FROM articles WHERE status = ? ORDER BY updated_at DESC LIMIT ? OFFSET ?'
    ).all(statusFilter, PAGE_SIZE, offset) as Article[];
  }

  function tabLink(filter: StatusFilter, label: string, count: number): JSX.Element {
    const isActive = statusFilter === filter;
    return (
      <a href={`/articles?status=${filter}`} class={`ftab${isActive ? ' active' : ''}`}>
        {label} <span class="ftab-count">{count}</span>
      </a>
    );
  }

  function statusDot(status: string): JSX.Element {
    if (status === 'published')   return <span class="sdot sdot-pub" />;
    if (status === 'draft')       return <span class="sdot sdot-draft" />;
    return <span class="sdot sdot-unpub" />;
  }

  const content = (
    <div>
      <div class="page-hd">
        <h2>Articles</h2>
        <a href="/articles/new" class="btn btn-primary btn-sm">+ New article</a>
      </div>

      <div class="filter-tabs">
        {tabLink('all',         'All',         countAll)}
        {tabLink('published',   'Published',   countPublished)}
        {tabLink('draft',       'Drafts',      countDraft)}
        {tabLink('unpublished', 'Unpublished', countUnpub)}
      </div>

      {articles.length === 0 && (
        <p style="color:var(--g-text-muted);font-size:.88rem">No articles found.</p>
      )}

      <div>
        {articles.map(a => {
          const tags: string[] = (() => { try { return JSON.parse(a.tags); } catch { return []; } })();
          const dateLabel = a.published_at ? fmtDate(a.published_at) : fmtDate(a.updated_at);
          return (
            <div class="article-row">
              <div class="article-dot">{statusDot(a.status)}</div>
              <div class="article-info">
                <a class="article-row-title" href={`/articles/${a.id}/edit`}>{esc(a.title)}</a>
                <div class="article-row-meta">
                  <span>{dateLabel}</span>
                  {tags.length > 0 && <span>·</span>}
                  {tags.map(t => (
                    <a href={`/articles?tag=${encodeURIComponent(t)}`} class="tag" style="font-size:.68rem">{esc(t)}</a>
                  ))}
                  {a.status !== 'published' && (
                    <span style={`color:var(${a.status === 'draft' ? '--g-text-muted' : '--g-warn'});font-size:.7rem`}>{a.status}</span>
                  )}
                </div>
              </div>
              <div class="article-row-actions">
                <a href={`/articles/${a.id}/edit`} class="btn btn-outline btn-sm">Edit</a>
                <form method="POST" action={`/articles/${a.id}/${a.status === 'published' ? 'unpublish' : 'publish'}`} style="margin:0">
                  <button class="btn btn-ghost btn-sm" type="submit">
                    {a.status === 'published' ? 'Unpublish' : 'Publish'}
                  </button>
                </form>
              </div>
            </div>
          );
        })}
      </div>

      {paginationNav(page, total, PAGE_SIZE, `/articles?status=${statusFilter}`)}
    </div>
  );

  return authorLayout('Articles', content, db, '/articles');
}

export function renderArticleNew(db: Database): JSX.Element {
  const content = (
    <div class="editor-shell">
      <div class="editor-topbar">
        <a class="editor-topbar-brand" href="/dashboard">GRIP</a>
        <span style="color:var(--g-border)">›</span>
        <span class="editor-title-pill" id="editor-title-display">Untitled article</span>
        <div class="editor-spacer"></div>
        <button type="submit" form="article-form" class="btn btn-outline btn-sm">Save draft</button>
        <a href="/articles" class="btn btn-ghost btn-sm">Cancel</a>
      </div>

      <form id="article-form" method="POST" action="/articles">
        <div class="editor-metabar">
          <input
            class="editor-title-input"
            type="text"
            name="title"
            placeholder="Article title…"
            required
            autofocus
            id="article-title"
            oninput="document.getElementById('editor-title-display').textContent = this.value || 'Untitled article'"
          />
          <div class="tag-chips" id="tag-chips-container">
            <span style="font-size:.7rem;color:var(--g-text-muted);margin-right:.2rem">Tags:</span>
            <input
              type="text"
              name="tags"
              id="tags-field"
              placeholder="tag1, tag2…"
              class="tags-input"
            />
          </div>
        </div>

        <div class="editor-split">
          <div class="editor-pane">
            <div class="editor-pane-header">
              <span>Markdown</span>
              <div style="display:flex;gap:.5rem;align-items:center;font-weight:400;letter-spacing:0;text-transform:none">
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
          <span>New article</span>
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
            function updateWC() {
              var words = ta.value.trim() ? ta.value.trim().split(/\\s+/).length : 0;
              wc.textContent = words + ' word' + (words !== 1 ? 's' : '');
            }
            ta.addEventListener('input', updateWC);
            updateWC();
          }
        })();
      `}</script>
    </div>
  );

  return authorLayout('New article', content, db, '/articles', true, true);
}

export function handleArticleCreate(
  db: Database, store: EventStore,
  body: { title: string; slug?: string; body: string; tags?: string }
): string {
  const id = ulid();
  const slug = body.slug?.trim() || slugify(body.title);
  const tags = (body.tags ?? '').split(',').map(t => t.trim()).filter(Boolean);
  const event = { type: 'ArticleCreated' as const, id, title: body.title, slug, body: body.body, tags };
  commitEvent(db, store, event);
  return id;
}

export function renderArticleEdit(db: Database, id: string): JSX.Element {
  const article = db.prepare('SELECT * FROM articles WHERE id = ?').get(id) as Article | null;
  if (!article) return authorLayout('Not found', <p>Article not found.</p>, db, '/articles');
  const siteHost = getSiteHost(db);
  const tags: string[] = (() => { try { return JSON.parse(article.tags); } catch { return []; } })();

  const statusDotStyle = article.status === 'published'
    ? 'background:var(--g-success)'
    : article.status === 'draft'
      ? 'background:transparent;border:1.5px solid var(--g-text-muted)'
      : 'background:var(--g-warn)';

  const content = (
    <div class="editor-shell">
      <div class="editor-topbar">
        <a class="editor-topbar-brand" href="/dashboard">GRIP</a>
        <span style="color:var(--g-border)">›</span>
        <span class="editor-title-pill" id="editor-title-display">{esc(article.title)}</span>
        <div class="editor-spacer"></div>
        <span class="editor-status-pill">
          <span style={`width:6px;height:6px;border-radius:50%;display:inline-block;${statusDotStyle}`}></span>
          {article.status}
        </span>
        <button type="submit" form="article-form" class="btn btn-outline btn-sm">Save</button>
        {article.status !== 'published'
          ? <button type="submit" form="publish-form" class="btn btn-primary btn-sm">Publish →</button>
          : <button type="submit" form="unpublish-form" class="btn btn-ghost btn-sm">Unpublish</button>
        }
        {article.status === 'published' && (
          <a href={`//${siteHost}/articles/${esc(article.slug)}`} target="_blank" rel="noopener" class="btn btn-ghost btn-sm">View →</a>
        )}
      </div>

      <form id="article-form" method="POST" action={`/articles/${id}/revise`}>
        <div class="editor-metabar">
          <input
            class="editor-title-input"
            type="text"
            name="title"
            value={esc(article.title)}
            required
            id="article-title"
            oninput="document.getElementById('editor-title-display').textContent = this.value || 'Untitled'"
          />
          <div class="tag-chips">
            <span style="font-size:.7rem;color:var(--g-text-muted);margin-right:.2rem">Tags:</span>
            {tags.map(t => (
              <span class="tag-chip">{esc(t)}</span>
            ))}
          </div>
          <input
            type="text"
            name="tags"
            value={tags.join(', ')}
            placeholder="tag1, tag2…"
            class="tags-input"
          />
        </div>

        <div class="editor-split">
          <div class="editor-pane">
            <div class="editor-pane-header">
              <span>Markdown</span>
              <div style="display:flex;gap:.5rem;align-items:center;font-weight:400;letter-spacing:0;text-transform:none">
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
              >{article.body_md}</textarea>
            </div>
          </div>
          <div class="editor-pane">
            <div class="editor-pane-header"><span>Preview</span></div>
            <div class="editor-pane-body editor-preview" id="preview">Loading preview…</div>
          </div>
        </div>

        <div class="editor-footerbar">
          <span>Slug: <code style="font-size:.7rem;color:var(--g-accent)">{esc(article.slug)}</code></span>
          <span class="sep">·</span>
          <span id="word-count">— words</span>
          <div style="flex:1"></div>
          <span>Status: <strong style="color:var(--g-text)">{article.status}</strong></span>
        </div>
      </form>

      <form id="publish-form" method="POST" action={`/articles/${id}/publish`} style="display:none"></form>
      <form id="unpublish-form" method="POST" action={`/articles/${id}/unpublish`} style="display:none"></form>

      <script src="/static/grip-editor.js" defer />
      <script>{`
        (function() {
          var ta = document.querySelector('textarea[name="body"]');
          var wc = document.getElementById('word-count');
          if (ta && wc) {
            function updateWC() {
              var words = ta.value.trim() ? ta.value.trim().split(/\\s+/).length : 0;
              wc.textContent = words.toLocaleString() + ' word' + (words !== 1 ? 's' : '');
            }
            ta.addEventListener('input', updateWC);
            updateWC();
          }
        })();
      `}</script>
    </div>
  );

  return authorLayout(`Edit: ${article.title}`, content, db, '/articles', true, true);
}

export function handleArticleRevise(
  db: Database, store: EventStore, id: string,
  body: { title: string; body: string; tags?: string }
): void {
  const tags = (body.tags ?? '').split(',').map(t => t.trim()).filter(Boolean);
  const event = { type: 'ArticleRevised' as const, id, title: body.title, body: body.body, tags };
  commitEvent(db, store, event);
}

export function handleArticlePublish(db: Database, store: EventStore, id: string): void {
  const event = { type: 'ArticlePublished' as const, id };
  commitEvent(db, store, event);
}

export function handleArticleUnpublish(db: Database, store: EventStore, id: string): void {
  const event = { type: 'ArticleUnpublished' as const, id };
  commitEvent(db, store, event);
}
