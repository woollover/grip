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

// ── CSS ───────────────────────────────────────────────────────────────────────

const CSS = `
/* Reset Pico container padding on header/footer for clean flush lines */
.site-header, .site-footer {
  border-top: none;
  padding-top: 0;
  padding-bottom: 0;
}

/* ── Header ── */
.site-header {
  border-bottom: 1px solid var(--pico-muted-border-color);
}
.site-header nav {
  padding: 0.9rem 0;
  align-items: center;
}
.site-header nav ul { margin: 0; }

/* ── Page shell ── */
.layout-wrap {
  display: grid;
  grid-template-columns: 1fr 230px;
  gap: 3.5rem;
  align-items: start;
  padding-top: 2.5rem;
  padding-bottom: 3rem;
}
@media (max-width: 760px) {
  .layout-wrap { grid-template-columns: 1fr; gap: 2rem; }
}

/* ── Main ── */
.layout-wrap > main { min-width: 0; }

/* ── Sidebar ── */
.sidebar {
  font-size: 0.875rem;
  border-left: 1px solid var(--pico-muted-border-color);
  padding-left: 1.75rem;
  position: sticky;
  top: 1.5rem;
}
@media (max-width: 760px) {
  .sidebar {
    border-left: none;
    border-top: 1px solid var(--pico-muted-border-color);
    padding-left: 0;
    padding-top: 1.5rem;
    position: static;
  }
}
.sb-section { margin-bottom: 2rem; }
.sb-desc { color: var(--pico-muted-color); line-height: 1.55; margin: 0; }
.sb-label {
  font-size: 0.65rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--pico-muted-color);
  margin: 0 0 0.65rem;
}
.sb-list { list-style: none; padding: 0; margin: 0; }
.sb-list li {
  padding: 0.35rem 0;
  border-bottom: 1px solid var(--pico-muted-border-color);
  line-height: 1.4;
}
.sb-list li:last-child { border-bottom: none; }
.sb-list a { color: inherit; text-decoration: none; }
.sb-list a:hover { color: var(--pico-primary); }

/* ── Tag cloud ── */
.tag-cloud { display: flex; flex-wrap: wrap; gap: 0.35rem; }
.tag {
  font-size: 0.7rem;
  line-height: 1.6;
  padding: 0.1rem 0.55rem;
  border: 1px solid var(--pico-muted-border-color);
  border-radius: 999px;
  color: var(--pico-muted-color);
  text-decoration: none;
}
.tag:hover { border-color: var(--pico-primary); color: var(--pico-primary); }
.tag--active { border-color: var(--pico-primary); color: var(--pico-primary); background: color-mix(in srgb, var(--pico-primary) 10%, transparent); }

/* ── Footer ── */
.site-footer {
  border-top: 1px solid var(--pico-muted-border-color);
  padding: 1rem 0;
  font-size: 0.8rem;
  color: var(--pico-muted-color);
}
.site-footer a { color: inherit; text-decoration: none; }
.site-footer a:hover { color: var(--pico-primary); }

/* ── Post list (articles index, home) ── */
.post-list { list-style: none; padding: 0; margin: 0; }
.post-list li {
  display: flex;
  gap: 1.5rem;
  align-items: baseline;
  padding: 0.65rem 0;
  border-bottom: 1px solid var(--pico-muted-border-color);
}
.post-list li:last-child { border-bottom: none; }
.post-date {
  font-size: 0.78rem;
  color: var(--pico-muted-color);
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
  min-width: 5.5rem;
}
.post-title { flex: 1; min-width: 0; }
.post-list a { color: inherit; text-decoration: none; }
.post-list a:hover { color: var(--pico-primary); }

/* ── Note stream (home) ── */
.note-stream { list-style: none; padding: 0; margin: 0; }
.note-stream li {
  padding: 1.25rem 0;
  border-bottom: 1px solid var(--pico-muted-border-color);
}
.note-stream li:last-child { border-bottom: none; }
.note-stream .note-meta {
  font-size: 0.78rem;
  color: var(--pico-muted-color);
  margin-bottom: 0.35rem;
}
.note-stream .note-body p { margin-bottom: 0.5rem; }
.note-stream .note-body p:last-child { margin-bottom: 0; }

/* ── Article prose ── */
.prose { line-height: 1.8; }
.prose p { margin-bottom: 1.25em; }
.prose h2, .prose h3 { margin-top: 2em; }

/* Code blocks — enhanced for readability across all themes */
.prose pre {
  border-radius: 6px;
  overflow-x: auto;
  font-size: 0.875rem;
  line-height: 1.65;
}
.prose pre code {
  background: none;
  border: none;
  padding: 0;
  font-size: inherit;
}
.prose code:not(pre code) {
  font-size: 0.875em;
  padding: 0.15em 0.45em;
  border-radius: 4px;
}
/* Blockquote — subtle left border */
.prose blockquote {
  border-left: 3px solid var(--pico-primary);
  margin-left: 0;
  padding-left: 1.25rem;
  color: var(--pico-muted-color);
  font-style: italic;
}
/* Tables in prose */
.prose table { font-size: 0.9rem; }

/* ── Pagination ── */
.pagination {
  display: flex;
  align-items: center;
  gap: 1.5rem;
  margin-top: 2rem;
  padding-top: 1.25rem;
  border-top: 1px solid var(--pico-muted-border-color);
  font-size: 0.875rem;
}
.pagination a { color: inherit; text-decoration: none; }
.pagination a:hover { color: var(--pico-primary); }
.pagination-info { flex: 1; text-align: center; color: var(--pico-muted-color); }
.pagination-disabled { color: var(--pico-muted-border-color); cursor: default; }

/* ── Article header meta ── */
.article-meta {
  font-size: 0.85rem;
  color: var(--pico-muted-color);
  margin-top: -0.5rem;
  margin-bottom: 2rem;
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  align-items: center;
}
`;

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
        <link rel="stylesheet" href="/static/pico.min.css" />
        <link rel="stylesheet" href="/theme.css" />
        <link rel="alternate" type="application/rss+xml" title={siteTitle} href="/rss.xml" />
        <style>{CSS}</style>
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
