import { publicLayout } from '../../../views/layout';
import { paginationNav, esc } from '../../../views/shared';
import type { GripDb } from '../../data/index';

const PAGE_SIZE = 10;

export function renderArticlesList(db: GripDb, siteTitle: string, tag?: string, page = 1): JSX.Element {
  const { articles, total } = db.articles.list({ page, tag, pageSize: PAGE_SIZE });
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
        {articles.map(a => (
          <li>
            <span class="post-date">{a.date}</span>
            <span class="post-title">
              <a href={`/articles/${a.slug}`}>{esc(a.title)}</a>
              {a.tags.length > 0 && (
                <span style="margin-left:0.75rem">
                  {a.tags.map(t => (
                    <a href={`/articles?tag=${encodeURIComponent(t)}`} class="tag" style="margin-right:0.25rem">{esc(t)}</a>
                  ))}
                </span>
              )}
            </span>
          </li>
        ))}
      </ul>
      {paginationNav(page, total, PAGE_SIZE, baseHref)}
    </div>
  );

  return publicLayout(
    { title: tag ? `Articles: ${esc(tag)}` : 'Articles', siteTitle, db, activeTag: tag, activePath: '/articles' },
    content,
  );
}

export function renderArticle(db: GripDb, slug: string, siteTitle: string): JSX.Element | null {
  const article = db.articles.get(slug);
  if (!article) return null;

  const content = (
    <article>
      <div class="article-back">
        <a href="/articles">← Articles</a>
        {article.tags.length > 0 && (
          <div class="article-tags">
            {article.tags.map(t => (
              <a href={`/articles?tag=${encodeURIComponent(t)}`} class="tag">{esc(t)}</a>
            ))}
          </div>
        )}
      </div>
      <h1 class="article-title">{esc(article.title)}</h1>
      {article.date && <span class="article-date">{article.date}</span>}
      <div class="prose">{article.body_html}</div>
      <div class="article-footer">
        <a href="/articles">← All articles</a>
      </div>
    </article>
  );

  return publicLayout(
    { title: article.title, siteTitle, db, hideSidebar: true, activePath: '/articles' },
    content,
  );
}
