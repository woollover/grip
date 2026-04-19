import type { EventStore } from '../../../core/events';
import { commitEvent } from '../../../core/projections';
import { slugify } from '../../../core/utils';
import { ulid } from 'ulidx';
import { authorLayout } from './layout';
import { esc } from '../../../views/shared';
import type { GripDb } from '../../data/index';

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
    <div class="writing-shell">
      <div class="ws-topbar">
        <a href="/pages" class="ws-back btn btn-ghost btn-sm">← Pages</a>
        <span class="ws-topbar-center">New page</span>
        <div class="ws-topbar-end">
          <button type="submit" form="ws-form" class="btn btn-primary btn-sm">Save draft</button>
        </div>
      </div>
      <form id="ws-form" method="POST" action="/pages">
        <div class="ws-scroll">
          <div class="ws-body">
            <input
              type="text"
              name="title"
              id="grip-title"
              class="ws-title"
              placeholder="Page title…"
              autofocus
              required
            />
            <div id="grip-page-body" class="cm6-mount"></div>
            <textarea id="grip-hidden-page-body" name="body" style="display:none"></textarea>
            <input type="hidden" name="slug" id="grip-page-slug" value="" />
          </div>
        </div>
      </form>
    </div>
  );
  return authorLayout('New page', content, db, '/pages', true, false, true);
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
    <div class="writing-shell">
      <div class="ws-topbar">
        <a href="/pages" class="ws-back btn btn-ghost btn-sm">← Pages</a>
        <span class="ws-save-indicator" id="save-indicator"></span>
        <div class="ws-topbar-end">
          <button type="button" id="ws-typewriter" class="btn btn-ghost btn-sm ws-mode-btn" title="Typewriter mode">T</button>
          <button type="button" id="ws-focus" class="btn btn-ghost btn-sm ws-mode-btn" title="Focus mode">F</button>
          <button type="submit" form="ws-form" class="btn btn-outline btn-sm">Save</button>
          <button type="button" id="ws-drawer-toggle" class="btn btn-ghost btn-sm" title="Page settings">⚙</button>
        </div>
      </div>

      <form id="ws-form" method="POST" action={`/pages/${id}/revise`}>
        <div class="ws-scroll">
          <div class="ws-body">
            <input
              type="text"
              name="title"
              id="grip-title"
              class="ws-title"
              value={esc(page.title)}
              placeholder="Page title…"
            />
            <div id="grip-page-body" class="cm6-mount"></div>
            <textarea
              id="grip-hidden-page-body"
              name="body"
              style="display:none"
            >{page.body_md}</textarea>
          </div>
        </div>

        <aside class="ws-drawer" id="ws-drawer">
          <div class="ws-drawer-header">
            <span class="ws-drawer-title">Page settings</span>
            <button type="button" id="ws-drawer-close" class="btn btn-ghost btn-sm">✕</button>
          </div>
          <div class="ws-drawer-section">
            <label class="ws-label">Slug</label>
            <input type="text" name="slug" value={esc(page.slug)} class="ws-input" />
          </div>
          <div class="ws-drawer-section">
            <div style="display:flex;align-items:center;gap:.5rem">
              <span class={`sdot sdot-${page.status === 'published' ? 'pub' : 'draft'}`} />
              <span style="font-size:.78rem;color:var(--g-text-muted)">{page.status}</span>
              {page.status === 'published' && (
                <a href={`//${siteHost}/p/${esc(page.slug)}`} target="_blank" rel="noopener" style="font-size:.72rem;color:var(--g-accent);margin-left:auto">View ↗</a>
              )}
            </div>
          </div>
          <div class="ws-drawer-section ws-drawer-actions">
            <button type="submit" class="btn btn-outline btn-sm" style="width:100%">Save</button>
            {page.status !== 'published'
              ? <button type="submit" form="publish-form" class="btn btn-primary btn-sm" style="width:100%">Publish</button>
              : null
            }
          </div>
        </aside>
      </form>

      <form id="publish-form" method="POST" action={`/pages/${id}/publish`} style="display:none" />
    </div>
  );

  return authorLayout(`Edit: ${page.title}`, content, db, '/pages', true, false, true);
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
