import type { Database } from 'bun:sqlite';
import { publicLayout } from '../../../views/layout';
import { fmtDate, esc } from '../../../views/shared';
import { getSiteConfig } from '../../data/config';
import { listArticles } from '../../data/articles';
import { listMicroPosts } from '../../data/micro';

export function renderHome(db: Database, siteTitle: string, siteDescription: string): JSX.Element {
  const site = getSiteConfig(db);

  const articles = site.showArticles
    ? listArticles(db, { pageSize: 8 }).articles
    : [];

  const microPosts = site.showMicro
    ? listMicroPosts(db, { pageSize: 5 }).posts
    : [];

  const content = (
    <div>
      {site.homeIntro && (
        <div class="home-intro">
          <p>{esc(site.homeIntro)}</p>
        </div>
      )}

      {articles.length > 0 && (
        <section>
          <p class="section-label">Articles</p>
          <ul class="post-list">
            {articles.map(a => (
              <li>
                <span class="post-date">{a.date}</span>
                <span class="post-title">
                  <a href={`/articles/${a.slug}`}>{esc(a.title)}</a>
                </span>
              </li>
            ))}
          </ul>
          <a href="/articles" class="see-all">All articles →</a>
        </section>
      )}

      {microPosts.length > 0 && (
        <section style="margin-top:3rem">
          <p class="section-label">Notes</p>
          <ul class="note-stream">
            {microPosts.map(p => (
              <li>
                <div class="note-meta">
                  <a href={`/micro/${p.id}`} style="color:inherit;text-decoration:none">
                    {p.date}
                  </a>
                </div>
                <div class="note-body">{p.body_html}</div>
              </li>
            ))}
          </ul>
          <a href="/micro" class="see-all">All notes →</a>
        </section>
      )}

      {articles.length === 0 && microPosts.length === 0 && !site.homeIntro && (
        <p style="color:var(--g-text-muted)">Nothing published yet.</p>
      )}
    </div>
  );

  return publicLayout({ title: 'Home', siteTitle, description: siteDescription, db, activePath: '/' }, content);
}
