import type { Database } from 'bun:sqlite';
import { publicLayout } from '../../../views/layout';

interface Article {
  id: string; slug: string; title: string; body_html: string;
  tags: string; published_at: number | null;
}

interface MicroPost {
  id: string; body_html: string; created_at: number;
}

export function renderHome(db: Database, siteTitle: string, siteDescription: string): JSX.Element {
  const articles = db.prepare(`
    SELECT id, slug, title, body_html, tags, published_at
    FROM articles WHERE status = 'published'
    ORDER BY published_at DESC LIMIT 5
  `).all() as Article[];

  const microPosts = db.prepare(`
    SELECT id, body_html, created_at
    FROM micro_posts WHERE status = 'active'
    ORDER BY created_at DESC LIMIT 5
  `).all() as MicroPost[];

  const content = (
    <div>
      <h1>{siteTitle}</h1>
      {siteDescription ? <p>{siteDescription}</p> : ''}

      {articles.length > 0 && (
        <section>
          <h2>Recent articles</h2>
          {articles.map(a => (
            <article>
              <h3><a href={`/articles/${a.slug}`}>{a.title}</a></h3>
              <small>{a.published_at ? new Date(a.published_at).toLocaleDateString() : ''}</small>
            </article>
          ))}
          <p><a href="/articles">All articles →</a></p>
        </section>
      )}

      {microPosts.length > 0 && (
        <section>
          <h2>Recent notes</h2>
          {microPosts.map(p => (
            <article>
              <div safe>{p.body_html}</div>
              <small>{new Date(p.created_at).toLocaleDateString()}</small>
            </article>
          ))}
          <p><a href="/micro">All notes →</a></p>
        </section>
      )}
    </div>
  );

  return publicLayout({ title: 'Home', siteTitle, description: siteDescription, db }, content);
}
