import type { Database } from 'bun:sqlite';
import { publicLayout } from '../../../views/layout';

interface Article {
  id: string; slug: string; title: string;
  body_md: string; body_html: string; tags: string;
  status: string; created_at: number; updated_at: number; published_at: number | null;
}

export function renderArticlesList(db: Database, siteTitle: string): string {
  const articles = db.prepare(`
    SELECT * FROM articles WHERE status = 'published'
    ORDER BY published_at DESC
  `).all() as Article[];

  const content = `
    <h1>Articles</h1>
    ${articles.length === 0 ? '<p>No articles published yet.</p>' : ''}
    ${articles.map(a => `
      <article>
        <h2><a href="/articles/${a.slug}">${a.title}</a></h2>
        <small>${a.published_at ? new Date(a.published_at).toLocaleDateString() : ''}</small>
        ${JSON.parse(a.tags).length > 0
          ? `<p>${JSON.parse(a.tags).map((t: string) => `<mark>${t}</mark>`).join(' ')}</p>`
          : ''}
      </article>`).join('')}
  `;

  return publicLayout({ title: 'Articles', siteTitle, db }, content);
}

export function renderArticle(db: Database, slug: string, siteTitle: string): string | null {
  const article = db.prepare(`
    SELECT * FROM articles WHERE slug = ? AND status = 'published'
  `).get(slug) as Article | null;

  if (!article) return null;

  const content = `
    <article>
      <header>
        <h1>${article.title}</h1>
        <small>
          ${article.published_at ? new Date(article.published_at).toLocaleDateString() : ''}
          ${JSON.parse(article.tags).length > 0
            ? ' · ' + JSON.parse(article.tags).map((t: string) => `<mark>${t}</mark>`).join(' ')
            : ''}
        </small>
      </header>
      <div class="prose">
        ${article.body_html}
      </div>
    </article>
    <nav aria-label="Breadcrumb">
      <a href="/articles">← All articles</a>
    </nav>
  `;

  return publicLayout({ title: article.title, siteTitle, db }, content);
}
