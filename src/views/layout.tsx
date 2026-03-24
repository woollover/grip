/**
 * Public site layout.
 *
 * JSX RENDERING MODEL — READ THIS FIRST
 * ══════════════════════════════════════
 * GRIP uses @kitajs/html as the JSX factory — NOT React.
 * JSX compiles to HTML strings at build time via Bun.
 * There is no browser JS, no virtual DOM, no hydration.
 *
 * Escaping convention:
 *   {value}        →  raw string, passed through as-is (NO auto-escape)
 *   {esc(value)}   →  explicit HTML-escape for untrusted/user-controlled strings
 *   {raw(html)}    →  explicit passthrough for pre-rendered HTML (trusted markdown output only)
 */
import type { Database } from "bun:sqlite";
import { getColorScheme, getThemeVersion } from "../core/themes";
import { readPublicity, esc } from "./shared";

export interface LayoutOptions {
  title: string;
  description?: string;
  siteTitle?: string;
  db?: Database;
  activeTag?: string;
  /** When true, renders full-width (no sidebar). Use for single-article/page views. */
  hideSidebar?: boolean;
  /** Pathname (e.g. '/articles') used to set aria-current on nav links. */
  activePath?: string;
}

// ── Sidebar ────────────────────────────────────────────────────────────────────

function buildSidebar(
  db: Database,
  pub: ReturnType<typeof readPublicity>,
  activeTag?: string,
): JSX.Element {
  const desc = db
    .prepare("SELECT value FROM config WHERE key = 'site_description'")
    .get() as { value: string } | null;

  const recent = pub.showArticles
    ? (db
        .prepare(
          `SELECT title, slug FROM articles
           WHERE status = 'published'
           ORDER BY published_at DESC LIMIT 6`,
        )
        .all() as { title: string; slug: string }[])
    : [];

  const tags: string[] = [];
  if (pub.showArticles) {
    const tagRows = db
      .prepare(
        "SELECT tags FROM articles WHERE status = 'published' AND tags != '[]'",
      )
      .all() as { tags: string }[];
    const tagSet = new Set<string>();
    for (const row of tagRows) {
      try {
        (JSON.parse(row.tags) as string[]).forEach((t) => tagSet.add(t));
      } catch {}
    }
    tags.push(...[...tagSet].sort());
  }

  return (
    <aside class="sidebar">
      {desc?.value && (
        <section class="sb-section">
          <p class="sb-desc">{esc(desc.value)}</p>
        </section>
      )}

      {recent.length > 0 && (
        <section class="sb-section">
          <h4 class="sb-label">Recent</h4>
          <ul class="sb-list">
            {recent.map((a) => (
              <li>
                <a href={`/articles/${a.slug}`}>{esc(a.title)}</a>
              </li>
            ))}
          </ul>
        </section>
      )}

      {tags.length > 0 && (
        <section class="sb-section">
          <h4 class="sb-label">Tags</h4>
          <div class="tag-cloud">
            {tags.map((t) => (
              <a
                href={`/articles?tag=${encodeURIComponent(t)}`}
                class={`tag${t === activeTag ? " tag--active" : ""}`}
              >
                {esc(t)}
              </a>
            ))}
          </div>
        </section>
      )}
    </aside>
  );
}

// ── Layout ────────────────────────────────────────────────────────────────────

export function publicLayout(
  opts: LayoutOptions,
  content: JSX.Element,
): JSX.Element {
  const {
    title,
    description = "",
    siteTitle = "GRIP",
    db,
    activeTag,
    hideSidebar = false,
    activePath,
  } = opts;

  const scheme = db ? getColorScheme(db) : "light";
  const themeVersion = db ? getThemeVersion(db) : "default";
  const pub = db
    ? readPublicity(db)
    : { showArticles: true, showMicro: true, rssEnabled: true };

  const domain = db
    ? ((db.prepare("SELECT value FROM config WHERE key = 'domain'").get() as { value: string } | null)
        ?.value ?? "")
    : "";

  const sidebar = db && !hideSidebar ? buildSidebar(db, pub, activeTag) : null;

  const navPages = db
    ? (db
        .prepare(
          "SELECT title, slug FROM pages WHERE status = 'published' ORDER BY title ASC",
        )
        .all() as { title: string; slug: string }[])
    : [];

  const canonicalBase = domain ? `https://${domain}` : "";
  const canonicalUrl = activePath ? `${canonicalBase}${activePath}` : canonicalBase;
  const ogDescription = description || `${siteTitle} — a personal publishing space`;

  function navLink(href: string, label: string): JSX.Element {
    const isActive = activePath === href || (href !== '/' && activePath?.startsWith(href));
    return (
      <li>
        <a href={href} aria-current={isActive ? "page" : undefined}>
          {label}
        </a>
      </li>
    );
  }

  const page = (
    <html lang="en" data-theme={scheme}>
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>
          {esc(title)} — {esc(siteTitle)}
        </title>
        {description ? <meta name="description" content={esc(description)} /> : ""}
        {canonicalUrl ? <link rel="canonical" href={canonicalUrl} /> : ""}

        {/* Open Graph */}
        <meta property="og:title" content={esc(title)} />
        <meta property="og:description" content={esc(ogDescription)} />
        <meta property="og:type" content="website" />
        {canonicalUrl ? <meta property="og:url" content={canonicalUrl} /> : ""}
        <meta property="og:site_name" content={esc(siteTitle)} />

        {/* Twitter Card */}
        <meta name="twitter:card" content="summary" />
        <meta name="twitter:title" content={esc(title)} />
        <meta name="twitter:description" content={esc(ogDescription)} />

        <link rel="stylesheet" href="/static/open-props.min.css" />
        <link rel="stylesheet" href="/static/grip.css" />
        <link rel="stylesheet" href={`/theme.css?v=${themeVersion}`} />
        {pub.rssEnabled && (
          <link
            rel="alternate"
            type="application/rss+xml"
            title={esc(siteTitle)}
            href="/rss.xml"
          />
        )}
      </head>
      <body>
        <header class="site-header container">
          <nav>
            <ul>
              <li>
                <strong>
                  <a href="/">{esc(siteTitle)}</a>
                </strong>
              </li>
            </ul>
            <ul>
              {pub.showArticles && navLink("/articles", "Articles")}
              {pub.showMicro && navLink("/micro", "Notes")}
              {navPages.map((p) => navLink(`/pages/${p.slug}`, p.title))}
            </ul>
          </nav>
        </header>

        <div class={`layout-wrap container${hideSidebar ? " layout-wrap--full" : ""}`}>
          <main>{content}</main>
          {sidebar}
        </div>

        <footer class="site-footer container">
          <div class="footer-nav">
            {pub.showArticles && <a href="/articles">Articles</a>}
            {pub.showMicro && <a href="/micro">Notes</a>}
            {navPages.map((p) => <a href={`/pages/${p.slug}`}>{esc(p.title)}</a>)}
          </div>
          {pub.rssEnabled && (
            <div class="footer-rss">
              <a href="/rss.xml">RSS</a>
              {pub.showArticles && <a href="/articles/rss.xml">Articles feed</a>}
              {pub.showMicro && <a href="/micro/rss.xml">Notes feed</a>}
            </div>
          )}
        </footer>
      </body>
    </html>
  );
  return ("<!DOCTYPE html>" + page) as unknown as JSX.Element;
}

// ── 404 ───────────────────────────────────────────────────────────────────────

export function render404(db: Database): string {
  const siteTitle =
    (db.prepare("SELECT value FROM config WHERE key = 'site_title'").get() as { value: string } | null)
      ?.value ?? "GRIP";
  return publicLayout(
    { title: "Not Found", siteTitle, db },
    <div>
      <h1>404 — Not found</h1>
      <p style="color:var(--g-text-muted)">This page doesn't exist.</p>
      <p>
        <a href="/">← Go home</a>
      </p>
    </div>,
  ) as unknown as string;
}
