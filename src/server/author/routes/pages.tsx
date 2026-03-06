import type { Database } from 'bun:sqlite';
import type { EventStore } from '../../../core/events';
import { applyEvent } from '../../../core/projections';
import { ulid } from 'ulidx';
import { authorLayout } from './layout';
import { editorImageWidget } from './media';
import { AlignPicker } from './shared';

interface Page {
  id: string; slug: string; title: string; body_md: string;
  body_html: string; status: string; created_at: number; updated_at: number;
}

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export function renderPagesIndex(db: Database): JSX.Element {
  const pages = db.prepare('SELECT * FROM pages ORDER BY updated_at DESC').all() as Page[];

  const content = (
    <div>
      <div style="display:flex;justify-content:space-between;align-items:center">
        <h2>Pages</h2>
        <a href="/pages/new" role="button">New page</a>
      </div>
      <table>
        <thead>
          <tr><th>Title</th><th>Slug</th><th>Status</th><th>Actions</th></tr>
        </thead>
        <tbody>
          {pages.map(p => (
            <tr>
              <td><a href={`/pages/${p.id}/edit`}>{p.title}</a></td>
              <td><code>/{p.slug}</code></td>
              <td>{p.status}</td>
              <td>
                {p.status !== 'published'
                  ? (
                    <form method="POST" action={`/pages/${p.id}/publish`} style="display:inline">
                      <button class="outline" style="padding:0.2rem 0.6rem">Publish</button>
                    </form>
                  )
                  : <span>Published</span>
                }
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return authorLayout('Pages', content, db);
}

export function renderPageNew(): JSX.Element {
  const content = (
    <div>
      <h2>New page</h2>
      <form method="POST" action="/pages">
        <label>Title <input type="text" name="title" required autofocus /></label>
        <label>Slug <input type="text" name="slug" placeholder="auto-generated" /></label>
        <label>
          Body (Markdown)
          <textarea name="body" rows="20"
            hx-post="/preview" hx-trigger="keyup changed delay:300ms"
            hx-target="#preview" />
        </label>
        <AlignPicker />
        <div>{editorImageWidget()}</div>
        <div class="preview-pane" id="preview"><em>Preview here…</em></div>
        <button type="submit">Save draft</button>
      </form>
    </div>
  );

  return authorLayout('New page', content);
}

export function handlePageCreate(
  db: Database, store: EventStore,
  body: { title: string; slug?: string; body: string }
): string {
  const id = ulid();
  const slug = body.slug?.trim() || slugify(body.title);
  const event = { type: 'PageCreated' as const, id, title: body.title, slug, body: body.body };
  store.append(event);
  applyEvent(db, event, Date.now());
  return id;
}

export function renderPageEdit(db: Database, id: string): JSX.Element {
  const page = db.prepare('SELECT * FROM pages WHERE id = ?').get(id) as Page | null;
  if (!page) return authorLayout('Not found', <p>Page not found.</p>, db);

  const content = (
    <div>
      <div style="display:flex;justify-content:space-between;align-items:center">
        <h2>Edit: {page.title}</h2>
        <span>Status: <strong>{page.status}</strong></span>
      </div>
      <form method="POST" action={`/pages/${id}/revise`}>
        <label>Title <input type="text" name="title" value={page.title} required /></label>
        <label>
          Body (Markdown)
          <textarea name="body" rows="20"
            hx-post="/preview" hx-trigger="keyup changed delay:300ms"
            hx-target="#preview">{page.body_md}</textarea>
        </label>
        <AlignPicker />
        <div>{editorImageWidget()}</div>
        <div class="preview-pane" id="preview">Loading preview…</div>
        <button type="submit">Save revision</button>
      </form>
      <hr />
      {page.status !== 'published'
        ? <form method="POST" action={`/pages/${id}/publish`}><button>Publish</button></form>
        : <p>Published</p>
      }
    </div>
  );

  return authorLayout(`Edit: ${page.title}`, content, db);
}

export function handlePageRevise(
  db: Database, store: EventStore, id: string,
  body: { title?: string; body?: string }
): void {
  const event = { type: 'PageRevised' as const, id, title: body.title, body: body.body };
  store.append(event);
  applyEvent(db, event, Date.now());
}

export function handlePagePublish(db: Database, store: EventStore, id: string): void {
  const event = { type: 'PagePublished' as const, id };
  store.append(event);
  applyEvent(db, event, Date.now());
}
