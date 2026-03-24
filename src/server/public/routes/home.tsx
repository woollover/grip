import type { Database } from 'bun:sqlite';
import { publicLayout } from '../../../views/layout';
import { fmtDate, readPublicity, esc } from '../../../views/shared';

interface Article {
  slug: string; title: string; published_at: number;
}

interface MicroPost {
  id: string; body_html: string; created_at: number;
}

export function renderHome(db: Database, siteTitle: string, siteDescription: string): JSX.Element {
  const get = (key: string, def: string) =>
    (db.prepare('SELECT value FROM config WHERE key = ?').get(key) as { value: string } | null)?.value ?? def;

  const pub = readPublicity(db);
  const homeIntro = get('home_intro', '');

  const articles = pub.showArticles ? db.prepare(`
    SELECT slug, title, published_at
    FROM articles WHERE status = 'published'
    ORDER BY published_at DESC LIMIT 8
  `).all() as Article[] : [];

  const microPosts = pub.showMicro ? db.prepare(`
    SELECT id, body_html, created_at
    FROM micro_posts WHERE status = 'active'
    ORDER BY created_at DESC LIMIT 5
  `).all() as MicroPost[] : [];

  const content = (
    <div>
      {homeIntro && (
        <div class="home-intro">
          <p>{esc(homeIntro)}</p>
        </div>
      )}

      {articles.length > 0 && (
        <section>
          <p class="section-label">Articles</p>
          <ul class="post-list">
            {articles.map(a => (
              <li>
                <span class="post-date">{fmtDate(a.published_at)}</span>
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
                    {fmtDate(p.created_at)}
                  </a>
                </div>
                <div class="note-body">{p.body_html}</div>
              </li>
            ))}
          </ul>
          <a href="/micro" class="see-all">All notes →</a>
        </section>
      )}

      {articles.length === 0 && microPosts.length === 0 && !homeIntro && (
        <p style="color:var(--g-text-muted)">Nothing published yet.</p>
      )}
    </div>
  );

  return publicLayout({ title: 'Home', siteTitle, description: siteDescription, db, activePath: '/' }, content);
}
