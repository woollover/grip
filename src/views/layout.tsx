import type { Database } from 'bun:sqlite';
import { getColorScheme } from '../core/themes';

export interface LayoutOptions {
  title: string;
  description?: string;
  siteTitle?: string;
  db?: Database;
  activeTag?: string;
}

// ── Sidebar ────────────────────────────────────────────────────────────────────

function buildSidebar(db: Database, activeTag?: string): JSX.Element {
  const desc = db.prepare(
    "SELECT value FROM config WHERE key = 'site_description'"
  ).get() as { value: string } | null;

  const recent = db.prepare(`
    SELECT title, slug FROM articles
    WHERE status = 'published'
    ORDER BY published_at DESC LIMIT 6
  `).all() as { title: string; slug: string }[];

  const tagRows = db.prepare(
    "SELECT tags FROM articles WHERE status = 'published' AND tags != '[]'"
  ).all() as { tags: string }[];

  const tagSet = new Set<string>();
  for (const row of tagRows) {
    try { (JSON.parse(row.tags) as string[]).forEach(t => tagSet.add(t)); } catch {}
  }
  const tags = [...tagSet].sort();

  return (
    <aside class="sidebar">
      {desc?.value && (
        <section class="sb-section">
          <p class="sb-desc">{desc.value}</p>
        </section>
      )}

      {recent.length > 0 && (
        <section class="sb-section">
          <h4 class="sb-label">Recent</h4>
          <ul class="sb-list">
            {recent.map(a => (
              <li><a href={`/articles/${a.slug}`}>{a.title}</a></li>
            ))}
          </ul>
        </section>
      )}

      {tags.length > 0 && (
        <section class="sb-section">
          <h4 class="sb-label">Tags</h4>
          <div class="tag-cloud">
            {tags.map(t => (
              <a href={`/articles?tag=${encodeURIComponent(t)}`} class={`tag${t === activeTag ? ' tag--active' : ''}`}>{t}</a>
            ))}
          </div>
        </section>
      )}
    </aside>
  );
}

// ── Layout ────────────────────────────────────────────────────────────────────

export function publicLayout(opts: LayoutOptions, content: JSX.Element): JSX.Element {
  const { title, description = '', siteTitle = 'GRIP', db, activeTag } = opts;
  const scheme = db ? getColorScheme(db) : 'light';
  const sidebar = db ? buildSidebar(db, activeTag) : null;

  const navPages = db ? (db.prepare(
    "SELECT title, slug FROM pages WHERE status = 'published' ORDER BY title ASC"
  ).all() as { title: string; slug: string }[]) : [];

  const page = (
    <html lang="en" data-theme={scheme}>
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{title} — {siteTitle}</title>
        {description ? <meta name="description" content={description} /> : ''}
        <link rel="stylesheet" href="/static/open-props.min.css" />
        <link rel="stylesheet" href="/static/grip.css" />
        <link rel="stylesheet" href="/theme.css" />
        <link rel="alternate" type="application/rss+xml" title={siteTitle} href="/rss.xml" />
      </head>
      <body>
        <header class="site-header container">
          <nav>
            <ul>
              <li><strong><a href="/">{siteTitle}</a></strong></li>
            </ul>
            <ul>
              <li><a href="/articles">Articles</a></li>
              <li><a href="/micro">Notes</a></li>
              {navPages.map(p => <li><a href={`/pages/${p.slug}`}>{p.title}</a></li>)}
            </ul>
          </nav>
        </header>

        <div class="layout-wrap container">
          <main>{content}</main>
          {sidebar}
        </div>

        <footer class="site-footer container">
          <a href="/rss.xml">RSS</a>{' · '}
          <a href="/articles/rss.xml">Articles</a>{' · '}
          <a href="/micro/rss.xml">Notes</a>
        </footer>
      </body>
    </html>
  );
  return ('<!DOCTYPE html>' + page) as unknown as JSX.Element;
}
