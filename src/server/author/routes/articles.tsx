import type { Database } from 'bun:sqlite';
import type { EventStore } from '../../../core/events';
import { applyEvent } from '../../../core/projections';
import { ulid } from 'ulidx';
import { authorLayout } from './layout';
import { editorImageWidget } from './media';

interface Article {
  id: string; slug: string; title: string; body_md: string;
  tags: string; status: string; created_at: number; updated_at: number; published_at: number | null;
}

function alignPicker(): string {
  return `
    <div id="img-align-picker" data-align="center"
         style="display:inline-flex;border:1px solid var(--pico-primary);border-radius:var(--pico-border-radius);overflow:hidden;font-size:0.8rem;margin-bottom:0.5rem">
      <button type="button" onclick="setImgAlign(this,'left')"
              style="border:none;padding:0.25rem 0.65rem;cursor:pointer;background:transparent">
        ⇤ Left
      </button>
      <button type="button" onclick="setImgAlign(this,'center')"
              style="border:none;border-left:1px solid var(--pico-primary);border-right:1px solid var(--pico-primary);padding:0.25rem 0.65rem;cursor:pointer;background:var(--pico-primary);color:var(--pico-primary-inverse)">
        ↔ Center
      </button>
      <button type="button" onclick="setImgAlign(this,'right')"
              style="border:none;padding:0.25rem 0.65rem;cursor:pointer;background:transparent">
        Right ⇥
      </button>
    </div>
    <script>
    function setImgAlign(btn, align) {
      document.getElementById('img-align-picker').dataset.align = align;
      document.querySelectorAll('#img-align-picker button').forEach(b => {
        b.style.background = 'transparent'; b.style.color = '';
      });
      btn.style.background = 'var(--pico-primary)';
      btn.style.color = 'var(--pico-primary-inverse)';
    }
    </script>`;
}

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export function renderArticlesIndex(db: Database): string {
  const articles = db.prepare('SELECT * FROM articles ORDER BY updated_at DESC').all() as Article[];
  const content = `
    <div style="display:flex;justify-content:space-between;align-items:center">
      <h2>Articles</h2>
      <a href="/articles/new" role="button">New article</a>
    </div>
    <table>
      <thead><tr><th>Title</th><th>Slug</th><th>Status</th><th>Updated</th><th>Actions</th></tr></thead>
      <tbody>
        ${articles.map(a => `
          <tr>
            <td><a href="/articles/${a.id}/edit">${a.title}</a></td>
            <td><code>${a.slug}</code></td>
            <td>${a.status}</td>
            <td>${new Date(a.updated_at).toLocaleDateString()}</td>
            <td>
              ${a.status === 'draft' || a.status === 'unpublished'
                ? `<form method="POST" action="/articles/${a.id}/publish" style="display:inline"><button class="outline" style="padding:0.2rem 0.6rem">Publish</button></form>`
                : `<form method="POST" action="/articles/${a.id}/unpublish" style="display:inline"><button class="outline secondary" style="padding:0.2rem 0.6rem">Unpublish</button></form>`
              }
            </td>
          </tr>`).join('')}
      </tbody>
    </table>
  `;
  return authorLayout('Articles', content, db);
}

export function renderArticleNew(): string {
  const content = `
    <h2>New article</h2>
    <form method="POST" action="/articles">
      <label>Title <input type="text" name="title" required autofocus></label>
      <label>Slug (leave blank to auto-generate) <input type="text" name="slug" placeholder="auto"></label>
      <label>Tags (comma-separated) <input type="text" name="tags"></label>
      <label>Body (Markdown)
        <textarea name="body" rows="20"
          hx-post="/preview" hx-trigger="keyup changed delay:300ms"
          hx-target="#preview"></textarea>
      </label>
      ${alignPicker()}
      ${editorImageWidget()}
      <div class="preview-pane" id="preview"><em>Preview will appear here…</em></div>
      <button type="submit">Save draft</button>
      <a href="/articles" role="button" class="outline secondary">Cancel</a>
    </form>
  `;
  return authorLayout('New article', content);
}

export function handleArticleCreate(
  db: Database, store: EventStore,
  body: { title: string; slug?: string; body: string; tags?: string }
): string {
  const id = ulid();
  const slug = body.slug?.trim() || slugify(body.title);
  const tags = (body.tags ?? '').split(',').map(t => t.trim()).filter(Boolean);
  const event = { type: 'ArticleCreated' as const, id, title: body.title, slug, body: body.body, tags };
  store.append(event);
  applyEvent(db, event, Date.now());
  return id;
}

export function renderArticleEdit(db: Database, id: string): string {
  const article = db.prepare('SELECT * FROM articles WHERE id = ?').get(id) as Article | null;
  if (!article) return authorLayout('Not found', '<p>Article not found.</p>', db);

  const content = `
    <div style="display:flex;justify-content:space-between;align-items:center">
      <h2>Edit: ${article.title}</h2>
      <span>Status: <strong>${article.status}</strong></span>
    </div>
    <form method="POST" action="/articles/${id}/revise">
      <label>Title <input type="text" name="title" value="${article.title}" required></label>
      <label>Tags <input type="text" name="tags" value="${JSON.parse(article.tags).join(', ')}"></label>
      <label>Body (Markdown)
        <textarea name="body" rows="20"
          hx-post="/preview" hx-trigger="keyup changed delay:300ms"
          hx-target="#preview">${article.body_md}</textarea>
      </label>
      ${alignPicker()}
      ${editorImageWidget()}
      <div class="preview-pane" id="preview">Loading preview…</div>
      <button type="submit">Save revision</button>
    </form>
    <hr>
    <div style="display:flex;gap:1rem">
      ${article.status !== 'published'
        ? `<form method="POST" action="/articles/${id}/publish"><button>Publish</button></form>`
        : `<form method="POST" action="/articles/${id}/unpublish"><button class="outline secondary">Unpublish</button></form>`
      }
      <a href="/articles" role="button" class="outline secondary">Back to articles</a>
    </div>
  `;
  return authorLayout(`Edit: ${article.title}`, content, db);
}

export function handleArticleRevise(
  db: Database, store: EventStore, id: string,
  body: { title: string; body: string; tags?: string }
): void {
  const tags = (body.tags ?? '').split(',').map(t => t.trim()).filter(Boolean);
  const event = { type: 'ArticleRevised' as const, id, title: body.title, body: body.body, tags };
  store.append(event);
  applyEvent(db, event, Date.now());
}

export function handleArticlePublish(db: Database, store: EventStore, id: string): void {
  const event = { type: 'ArticlePublished' as const, id };
  store.append(event);
  applyEvent(db, event, Date.now());
}

export function handleArticleUnpublish(db: Database, store: EventStore, id: string): void {
  const event = { type: 'ArticleUnpublished' as const, id };
  store.append(event);
  applyEvent(db, event, Date.now());
}
