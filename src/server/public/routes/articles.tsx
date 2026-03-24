import type { Database } from 'bun:sqlite';
import { publicLayout } from '../../../views/layout';
import { fmtDate, paginationNav, esc } from '../../../views/shared';

interface Article {
  id: string; slug: string; title: string;
  body_html: string; tags: string;
  created_at: number; published_at: number | null;
}

const PAGE_SIZE = 10;

export function renderArticlesList(db: Database, siteTitle: string, tag?: string, page = 1): JSX.Element {
  let total: number;
  let articles: Article[];

  if (tag) {
    total = (db.prepare(`
      SELECT COUNT(*) as n FROM articles
      WHERE status = 'published'
        AND EXISTS (SELECT 1 FROM json_each(tags) WHERE value = ?)
    `).get(tag) as { n: number }).n;

    articles = db.prepare(`
      SELECT id, slug, title, tags, published_at
      FROM articles
      WHERE status = 'published'
        AND EXISTS (SELECT 1 FROM json_each(tags) WHERE value = ?)
      ORDER BY published_at DESC
      LIMIT ? OFFSET ?
    `).all(tag, PAGE_SIZE, (page - 1) * PAGE_SIZE) as Article[];
  } else {
    total = (db.prepare(
      "SELECT COUNT(*) as n FROM articles WHERE status = 'published'"
    ).get() as { n: number }).n;

    articles = db.prepare(`
      SELECT id, slug, title, tags, published_at
      FROM articles WHERE status = 'published'
      ORDER BY published_at DESC
      LIMIT ? OFFSET ?
    `).all(PAGE_SIZE, (page - 1) * PAGE_SIZE) as Article[];
  }

  const baseHref = tag ? `/articles?tag=${encodeURIComponent(tag)}` : '/articles';

  const content = (
    <div>
      <h1 style="margin-top:0;margin-bottom:0.35rem">Articles</h1>
      {tag && (
        <p style="margin-bottom:1.5rem;font-size:0.875rem;color:var(--g-text-muted)">
          {'Filtered by tag: '}
          <span class="tag" style="margin-right:0.5rem">{esc(tag)}</span>
          <a href="/articles">clear ×</a>
        </p>
      )}
      {!tag && <p style="height:1.5rem;margin:0" />}
      {articles.length === 0 && (
        <p style="color:var(--g-text-muted)">No articles found{tag ? ` tagged "${esc(tag)}"` : ''}.</p>
      )}
      <ul class="post-list">
        {articles.map(a => {
          const tags: string[] = JSON.parse(a.tags);
          return (
            <li>
              <span class="post-date">{a.published_at ? fmtDate(a.published_at) : ''}</span>
              <span class="post-title">
                <a href={`/articles/${a.slug}`}>{esc(a.title)}</a>
                {tags.length > 0 && (
                  <span style="margin-left:0.75rem">
                    {tags.map(t => (
                      <a href={`/articles?tag=${encodeURIComponent(t)}`} class="tag" style="margin-right:0.25rem">{esc(t)}</a>
                    ))}
                  </span>
                )}
              </span>
            </li>
          );
        })}
      </ul>
      {paginationNav(page, total, PAGE_SIZE, baseHref)}
    </div>
  );

  return publicLayout(
    { title: tag ? `Articles: ${esc(tag)}` : 'Articles', siteTitle, db, activeTag: tag, activePath: '/articles' },
    content,
  );
}

export function renderArticle(db: Database, slug: string, siteTitle: string): JSX.Element | null {
  const article = db.prepare(`
    SELECT * FROM articles WHERE slug = ? AND status = 'published'
  `).get(slug) as Article | null;

  if (!article) return null;

  const tags: string[] = JSON.parse(article.tags);

  const content = (
    <article>
      <h1 style="margin-top:0;margin-bottom:0.5rem">{esc(article.title)}</h1>
      <div class="article-meta">
        {article.published_at ? <span>{fmtDate(article.published_at)}</span> : ''}
        {tags.map(t => (
          <a href={`/articles?tag=${encodeURIComponent(t)}`} class="tag">{esc(t)}</a>
        ))}
      </div>
      <div class="prose">{article.body_html}</div>
      <p style="margin-top:2.5rem;font-size:0.875rem;border-top:1px solid var(--g-border-faint);padding-top:1.25rem">
        <a href="/articles">← All articles</a>
      </p>
    </article>
  );

  return publicLayout(
    { title: article.title, siteTitle, db, hideSidebar: true, activePath: '/articles' },
    content,
  );
}
