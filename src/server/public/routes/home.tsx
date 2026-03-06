import type { Database } from 'bun:sqlite';
import { publicLayout } from '../../../views/layout';

interface Article {
  slug: string; title: string; published_at: number;
}

interface MicroPost {
  id: string; body_html: string; created_at: number;
}

export function renderHome(db: Database, siteTitle: string, siteDescription: string): JSX.Element {
  const articles = db.prepare(`
    SELECT slug, title, published_at
    FROM articles WHERE status = 'published'
    ORDER BY published_at DESC LIMIT 8
  `).all() as Article[];

  const microPosts = db.prepare(`
    SELECT id, body_html, created_at
    FROM micro_posts WHERE status = 'active'
    ORDER BY created_at DESC LIMIT 5
  `).all() as MicroPost[];

  const fmt = (ts: number) =>
    new Date(ts).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

  const content = (
    <div>
      {articles.length > 0 && (
        <section>
          <h2 style="margin-top:0;margin-bottom:1.25rem">Articles</h2>
          <ul class="post-list">
            {articles.map(a => (
              <li>
                <span class="post-date">{fmt(a.published_at)}</span>
                <span class="post-title">
                  <a href={`/articles/${a.slug}`}>{a.title}</a>
                </span>
              </li>
            ))}
          </ul>
          <p style="margin-top:1rem;font-size:0.875rem">
            <a href="/articles">All articles →</a>
          </p>
        </section>
      )}

      {microPosts.length > 0 && (
        <section style="margin-top:2.5rem">
          <h2 style="margin-bottom:1.25rem">Notes</h2>
          <ul class="note-stream">
            {microPosts.map(p => (
              <li>
                <div class="note-meta">{fmt(p.created_at)}</div>
                <div class="note-body">{p.body_html}</div>
              </li>
            ))}
          </ul>
          <p style="margin-top:1rem;font-size:0.875rem">
            <a href="/micro">All notes →</a>
          </p>
        </section>
      )}

      {articles.length === 0 && microPosts.length === 0 && (
        <p style="color:var(--pico-muted-color)">Nothing published yet.</p>
      )}
    </div>
  );

  return publicLayout({ title: 'Home', siteTitle, description: siteDescription, db }, content);
}
