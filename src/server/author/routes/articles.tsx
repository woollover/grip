import type { Database } from 'bun:sqlite';
import type { EventStore } from '../../../core/events';
import { applyEvent } from '../../../core/projections';
import { ulid } from 'ulidx';
import { authorLayout } from './layout';
import { editorImageWidget } from './media';
import { AlignPicker } from './shared';

interface Article {
  id: string; slug: string; title: string; body_md: string;
  tags: string; status: string; created_at: number; updated_at: number; published_at: number | null;
}

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export function renderArticlesIndex(db: Database): JSX.Element {
  const articles = db.prepare('SELECT * FROM articles ORDER BY updated_at DESC').all() as Article[];

  const content = (
    <div>
      <div style="display:flex;justify-content:space-between;align-items:center">
        <h2>Articles</h2>
        <a href="/articles/new" role="button">New article</a>
      </div>
      <table>
        <thead>
          <tr><th>Title</th><th>Slug</th><th>Status</th><th>Updated</th><th>Actions</th></tr>
        </thead>
        <tbody>
          {articles.map(a => (
            <tr>
              <td><a href={`/articles/${a.id}/edit`}>{a.title}</a></td>
              <td><code>{a.slug}</code></td>
              <td>{a.status}</td>
              <td>{new Date(a.updated_at).toLocaleDateString()}</td>
              <td>
                {a.status === 'draft' || a.status === 'unpublished'
                  ? (
                    <form method="POST" action={`/articles/${a.id}/publish`} style="display:inline">
                      <button class="outline" style="padding:0.2rem 0.6rem">Publish</button>
                    </form>
                  )
                  : (
                    <form method="POST" action={`/articles/${a.id}/unpublish`} style="display:inline">
                      <button class="outline secondary" style="padding:0.2rem 0.6rem">Unpublish</button>
                    </form>
                  )
                }
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return authorLayout('Articles', content, db);
}

export function renderArticleNew(): JSX.Element {
  const content = (
    <div>
      <h2>New article</h2>
      <form method="POST" action="/articles">
        <label>Title <input type="text" name="title" required autofocus /></label>
        <label>Slug (leave blank to auto-generate) <input type="text" name="slug" placeholder="auto" /></label>
        <label>Tags (comma-separated) <input type="text" name="tags" /></label>
        <label>
          Body (Markdown)
          <textarea name="body" rows="20"
            hx-post="/preview" hx-trigger="keyup changed delay:300ms"
            hx-target="#preview" />
        </label>
        <AlignPicker />
        <div safe>{editorImageWidget()}</div>
        <div class="preview-pane" id="preview"><em>Preview will appear here…</em></div>
        <button type="submit">Save draft</button>
        <a href="/articles" role="button" class="outline secondary">Cancel</a>
      </form>
    </div>
  );

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

export function renderArticleEdit(db: Database, id: string): JSX.Element {
  const article = db.prepare('SELECT * FROM articles WHERE id = ?').get(id) as Article | null;
  if (!article) return authorLayout('Not found', <p>Article not found.</p>, db);

  const content = (
    <div>
      <div style="display:flex;justify-content:space-between;align-items:center">
        <h2>Edit: {article.title}</h2>
        <span>Status: <strong>{article.status}</strong></span>
      </div>
      <form method="POST" action={`/articles/${id}/revise`}>
        <label>Title <input type="text" name="title" value={article.title} required /></label>
        <label>Tags <input type="text" name="tags" value={JSON.parse(article.tags).join(', ')} /></label>
        <label>
          Body (Markdown)
          <textarea name="body" rows="20"
            hx-post="/preview" hx-trigger="keyup changed delay:300ms"
            hx-target="#preview">{article.body_md}</textarea>
        </label>
        <AlignPicker />
        <div safe>{editorImageWidget()}</div>
        <div class="preview-pane" id="preview">Loading preview…</div>
        <button type="submit">Save revision</button>
      </form>
      <hr />
      <div style="display:flex;gap:1rem">
        {article.status !== 'published'
          ? <form method="POST" action={`/articles/${id}/publish`}><button>Publish</button></form>
          : <form method="POST" action={`/articles/${id}/unpublish`}><button class="outline secondary">Unpublish</button></form>
        }
        <a href="/articles" role="button" class="outline secondary">Back to articles</a>
      </div>
    </div>
  );

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
