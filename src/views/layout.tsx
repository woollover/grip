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
/* ── Reset ── */
.site-header, .site-footer { border-top: none; padding-top: 0; padding-bottom: 0; }
*, *::before, *::after { box-sizing: border-box; }
a { transition: color 0.15s; }

/* ── Header ── */
.site-header {
  border-bottom: 1px solid var(--pico-muted-border-color);
}
.site-header nav {
  padding: 1.1rem 0;
  align-items: center;
}
.site-header nav ul { margin: 0; gap: 1.5rem; }
.site-header nav > ul:first-child a {
  font-size: 0.85rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: inherit;
  text-decoration: none;
}
.site-header nav > ul:last-child a {
  font-size: 0.8rem;
  color: var(--pico-muted-color);
  text-decoration: none;
}
.site-header nav > ul:last-child a:hover { color: var(--pico-color); }

/* ── Page shell ── */
.layout-wrap {
  display: grid;
  grid-template-columns: 1fr 210px;
  gap: 4rem;
  align-items: start;
  padding-top: 3rem;
  padding-bottom: 4rem;
}
@media (max-width: 760px) {
  .layout-wrap { grid-template-columns: 1fr; gap: 2.5rem; }
}
.layout-wrap > main { min-width: 0; }

/* ── Sidebar ── */
.sidebar {
  font-size: 0.82rem;
  border-left: 1px solid var(--pico-muted-border-color);
  padding-left: 1.75rem;
  position: sticky;
  top: 2rem;
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
.sb-section { margin-bottom: 1.75rem; }
.sb-desc { color: var(--pico-muted-color); line-height: 1.6; margin: 0; font-size: 0.8rem; }
.sb-label {
  font-size: 0.6rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--pico-muted-color);
  opacity: 0.7;
  margin: 0 0 0.6rem;
}
.sb-list { list-style: none; padding: 0; margin: 0; }
.sb-list li { padding: 0.3rem 0; line-height: 1.4; }
.sb-list a { color: var(--pico-muted-color); text-decoration: none; }
.sb-list a:hover { color: var(--pico-primary); }

/* ── Tag cloud ── */
.tag-cloud { display: flex; flex-wrap: wrap; gap: 0.3rem; }
.tag {
  display: inline-block;
  font-size: 0.67rem;
  line-height: 1;
  padding: 0.2rem 0.5rem;
  border: 1px solid var(--pico-muted-border-color);
  border-radius: 3px;
  color: var(--pico-muted-color);
  text-decoration: none;
  transition: border-color 0.15s, color 0.15s;
}
.tag:hover { border-color: var(--pico-primary); color: var(--pico-primary); }
.tag--active {
  border-color: var(--pico-primary);
  color: var(--pico-primary);
  background: color-mix(in srgb, var(--pico-primary) 8%, transparent);
}

/* ── Section label (used in home page) ── */
.section-label {
  font-size: 0.65rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--pico-muted-color);
  margin: 0 0 1.25rem;
}

/* ── Post list (articles index, home) ── */
.post-list { list-style: none; padding: 0; margin: 0; }
.post-list li {
  display: flex;
  gap: 1.25rem;
  align-items: baseline;
  padding: 0.6rem 0;
  border-bottom: 1px solid color-mix(in srgb, var(--pico-muted-border-color) 60%, transparent);
}
.post-list li:last-child { border-bottom: none; }
.post-date {
  font-size: 0.72rem;
  color: var(--pico-muted-color);
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
  min-width: 5rem;
  opacity: 0.8;
}
.post-title { flex: 1; min-width: 0; }
.post-list a { color: inherit; text-decoration: none; }
.post-list a:hover { color: var(--pico-primary); }

/* ── Note stream ── */
.note-stream { list-style: none; padding: 0; margin: 0; }
.note-stream li {
  padding: 1.35rem 0;
  border-bottom: 1px solid color-mix(in srgb, var(--pico-muted-border-color) 60%, transparent);
}
.note-stream li:last-child { border-bottom: none; }
.note-meta {
  font-size: 0.72rem;
  color: var(--pico-muted-color);
  margin-bottom: 0.5rem;
  opacity: 0.8;
}
.note-body p { margin-bottom: 0.6rem; line-height: 1.7; }
.note-body p:last-child { margin-bottom: 0; }
.note-body code { font-size: 0.85em; }

/* ── See-all links ── */
.see-all {
  display: inline-block;
  margin-top: 1.25rem;
  font-size: 0.8rem;
  color: var(--pico-muted-color);
  text-decoration: none;
}
.see-all:hover { color: var(--pico-primary); }

/* ── Article prose ── */
.prose { line-height: 1.82; max-width: 68ch; }
.prose p { margin-bottom: 1.3em; }
.prose h2 { margin-top: 2.25em; margin-bottom: 0.75em; }
.prose h3 { margin-top: 1.75em; margin-bottom: 0.5em; }
.prose pre {
  border-radius: 5px;
  overflow-x: auto;
  font-size: 0.855rem;
  line-height: 1.65;
}
.prose pre code { background: none; border: none; padding: 0; font-size: inherit; }
.prose code:not(pre code) {
  font-size: 0.85em;
  padding: 0.15em 0.4em;
  border-radius: 3px;
}
.prose blockquote {
  border-left: 2px solid var(--pico-primary);
  margin-left: 0;
  padding-left: 1.25rem;
  color: var(--pico-muted-color);
  font-style: italic;
}
.prose table { font-size: 0.875rem; }
.prose a { text-decoration: underline; text-underline-offset: 3px; }

/* ── Pagination ── */
.pagination {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-top: 2.5rem;
  padding-top: 1.25rem;
  border-top: 1px solid var(--pico-muted-border-color);
  font-size: 0.8rem;
}
.pagination a { color: var(--pico-muted-color); text-decoration: none; }
.pagination a:hover { color: var(--pico-primary); }
.pagination-info { flex: 1; text-align: center; color: var(--pico-muted-color); opacity: 0.7; }
.pagination-disabled { color: var(--pico-muted-border-color); cursor: default; opacity: 0.5; }

/* ── Article header meta ── */
.article-meta {
  font-size: 0.8rem;
  color: var(--pico-muted-color);
  margin-top: -0.25rem;
  margin-bottom: 2.5rem;
  display: flex;
  flex-wrap: wrap;
  gap: 0.6rem;
  align-items: center;
  opacity: 0.85;
}

/* ── Footer ── */
.site-footer {
  border-top: 1px solid var(--pico-muted-border-color);
  padding: 1.25rem 0;
  font-size: 0.75rem;
  color: var(--pico-muted-color);
  opacity: 0.8;
}
.site-footer a { color: inherit; text-decoration: none; }
.site-footer a:hover { color: var(--pico-primary); opacity: 1; }
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
