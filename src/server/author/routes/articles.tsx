import type { EventStore } from '../../../core/events';
import { commitEvent } from '../../../core/projections';
import { slugify } from '../../../core/utils';
import { ulid } from 'ulidx';
import { authorLayout } from './layout';
import { paginationNav, fmtDate, esc } from '../../../views/shared';
import type { GripDb } from '../../data/index';

const PAGE_SIZE = 20;

type StatusFilter = 'all' | 'published' | 'draft' | 'unpublished';

export function renderArticlesIndex(db: GripDb, page = 1, statusFilter: StatusFilter = 'all'): JSX.Element {
  const counts = db.articles.countByStatus();
  const { countAll, countPublished, countDraft, countUnpub } = {
    countAll: counts.all,
    countPublished: counts.published,
    countDraft: counts.draft,
    countUnpub: counts.unpublished,
  };

  const { articles, total } = db.articles.listAdmin({ page, status: statusFilter, pageSize: PAGE_SIZE });

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
          const dateLabel = a.published_at ? fmtDate(a.published_at) : fmtDate(a.updated_at);
          return (
            <div class="article-row">
              <div class="article-dot">{statusDot(a.status)}</div>
              <div class="article-info">
                <a class="article-row-title" href={`/articles/${a.id}/edit`}>{esc(a.title)}</a>
                <div class="article-row-meta">
                  <span>{dateLabel}</span>
                  {a.tags.length > 0 && <span>·</span>}
                  {a.tags.map(t => (
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

export function renderArticleNew(db: GripDb): JSX.Element {
  const content = (
    <div class="writing-shell">
      <div class="ws-topbar">
        <a href="/articles" class="ws-back btn btn-ghost btn-sm">← Articles</a>
        <span class="ws-topbar-center">New article</span>
        <div class="ws-topbar-end">
          <button type="submit" form="ws-form" class="btn btn-primary btn-sm">Save draft</button>
        </div>
      </div>
      <form id="ws-form" method="POST" action="/articles">
        <div class="ws-scroll">
          <div class="ws-body">
            <input
              type="text"
              name="title"
              id="grip-title"
              class="ws-title"
              placeholder="Title…"
              autofocus
              required
            />
            <div id="grip-body" class="cm6-mount"></div>
            <textarea id="grip-hidden-body" name="body" style="display:none"></textarea>
          </div>
        </div>
      </form>
    </div>
  );
  return authorLayout('New article', content, db, '/articles', true, false, true);
}

export function handleArticleCreate(
  db: GripDb, store: EventStore,
  body: { title: string; slug?: string; body: string; tags?: string }
): string {
  const id = ulid();
  const slug = body.slug?.trim() || slugify(body.title);
  const tags = (body.tags ?? '').split(',').map(t => t.trim()).filter(Boolean);
  const event = { type: 'ArticleCreated' as const, id, title: body.title, slug, body: body.body, tags };
  commitEvent(db.raw, store, event);
  return id;
}

export function renderArticleEdit(db: GripDb, id: string): JSX.Element {
  const article = db.articles.getById(id);
  if (!article) return authorLayout('Not found', <p>Article not found.</p>, db, '/articles');
  const siteHost = db.config.getSite().domain;

  const content = (
    <div class="writing-shell">
      <div class="ws-topbar">
        <a href="/articles" class="ws-back btn btn-ghost btn-sm">← Articles</a>
        <span class="ws-save-indicator" id="save-indicator"></span>
        <div class="ws-topbar-end">
          <button type="button" id="ws-typewriter" class="btn btn-ghost btn-sm ws-mode-btn" title="Typewriter mode">T</button>
          <button type="button" id="ws-focus" class="btn btn-ghost btn-sm ws-mode-btn" title="Focus mode">F</button>
          <button type="submit" form="ws-form" class="btn btn-outline btn-sm">Save</button>
          <button type="button" id="ws-drawer-toggle" class="btn btn-ghost btn-sm" title="Article settings">⚙</button>
        </div>
      </div>

      <form id="ws-form" method="POST" action={`/articles/${id}/revise`}>
        <div class="ws-scroll">
          <div class="ws-body">
            <input
              type="text"
              name="title"
              id="grip-title"
              class="ws-title"
              value={esc(article.title)}
              placeholder="Title…"
            />
            <div id="grip-body" class="cm6-mount"></div>
            <textarea
              id="grip-hidden-body"
              name="body"
              style="display:none"
              hx-post={`/articles/${id}/autosave`}
              hx-trigger="input changed delay:30s"
              hx-target="#save-indicator"
              hx-swap="innerHTML"
            >{article.body_md}</textarea>
          </div>
        </div>

        <aside class="ws-drawer" id="ws-drawer">
          <div class="ws-drawer-header">
            <span class="ws-drawer-title">Article settings</span>
            <button type="button" id="ws-drawer-close" class="btn btn-ghost btn-sm">✕</button>
          </div>
          <div class="ws-drawer-section">
            <label class="ws-label">Tags</label>
            <input type="text" name="tags" value={article.tags.join(', ')} placeholder="tag1, tag2…" class="ws-input" />
          </div>
          <div class="ws-drawer-section">
            <label class="ws-label">Slug</label>
            <input type="text" name="slug" value={esc(article.slug)} class="ws-input" />
          </div>
          <div class="ws-drawer-section">
            <div style="display:flex;align-items:center;gap:.5rem">
              <span class={`sdot sdot-${article.status === 'published' ? 'pub' : article.status === 'draft' ? 'draft' : 'unpub'}`} />
              <span style="font-size:.78rem;color:var(--g-text-muted)">{article.status}</span>
              {article.status === 'published' && (
                <a href={`//${siteHost}/articles/${esc(article.slug)}`} target="_blank" rel="noopener" style="font-size:.72rem;color:var(--g-accent);margin-left:auto">View ↗</a>
              )}
            </div>
          </div>
          <div class="ws-drawer-section ws-drawer-actions">
            <button type="submit" class="btn btn-outline btn-sm" style="width:100%">Save</button>
            {article.status !== 'published'
              ? <button type="submit" form="publish-form" class="btn btn-primary btn-sm" style="width:100%">Publish</button>
              : <button type="submit" form="unpublish-form" class="btn btn-ghost btn-sm" style="width:100%">Unpublish</button>
            }
          </div>
        </aside>
      </form>

      <form id="publish-form" method="POST" action={`/articles/${id}/publish`} style="display:none" />
      <form id="unpublish-form" method="POST" action={`/articles/${id}/unpublish`} style="display:none" />
    </div>
  );

  return authorLayout(`Edit: ${article.title}`, content, db, '/articles', true, false, true);
}

export function handleArticleRevise(
  db: GripDb, store: EventStore, id: string,
  body: { title: string; body: string; tags?: string; slug?: string }
): void {
  const tags = (body.tags ?? '').split(',').map(t => t.trim()).filter(Boolean);
  const slug = body.slug?.trim() || undefined;
  const event = { type: 'ArticleRevised' as const, id, title: body.title, body: body.body, tags, slug };
  commitEvent(db.raw, store, event);
}

export function handleArticleAutosave(
  db: GripDb, store: EventStore, id: string,
  body: { body?: string }
): boolean {
  const article = db.articles.getById(id);
  if (!article) return false;
  const event = { type: 'ArticleRevised' as const, id, title: article.title, body: body.body ?? '', tags: article.tags };
  commitEvent(db.raw, store, event);
  return true;
}

export function handleArticlePublish(db: GripDb, store: EventStore, id: string): void {
  const event = { type: 'ArticlePublished' as const, id };
  commitEvent(db.raw, store, event);
}

export function handleArticleUnpublish(db: GripDb, store: EventStore, id: string): void {
  const event = { type: 'ArticleUnpublished' as const, id };
  commitEvent(db.raw, store, event);
}
