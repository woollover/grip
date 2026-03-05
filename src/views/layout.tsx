import type { Database } from 'bun:sqlite';
import { getThemeAttr } from '../core/themes';

export interface LayoutOptions {
  title: string;
  description?: string;
  siteTitle?: string;
  db?: Database;
}

export function publicLayout(opts: LayoutOptions, content: JSX.Element): JSX.Element {
  const { title, description = '', siteTitle = 'GRIP', db } = opts;
  const themeAttr = db ? getThemeAttr(db) : '';
  const isDark = themeAttr.includes('dark');
  return (
    <html lang="en" data-theme={isDark ? 'dark' : undefined}>
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{title} — {siteTitle}</title>
        {description ? <meta name="description" content={description} /> : ''}
        <link rel="stylesheet" href="/static/pico.min.css" />
        <link rel="stylesheet" href="/theme.css" />
        <link rel="alternate" type="application/rss+xml" title={siteTitle} href="/rss.xml" />
      </head>
      <body>
        <header class="container">
          <nav>
            <ul>
              <li><strong><a href="/">{siteTitle}</a></strong></li>
            </ul>
            <ul>
              <li><a href="/articles">Articles</a></li>
              <li><a href="/micro">Notes</a></li>
            </ul>
          </nav>
        </header>
        <main class="container" safe>
          {content}
        </main>
        <footer class="container">
          <small>
            <a href="/rss.xml">RSS</a>{' · '}
            <a href="/articles/rss.xml">Articles</a>{' · '}
            <a href="/micro/rss.xml">Notes</a>
          </small>
        </footer>
      </body>
    </html>
  );
}
