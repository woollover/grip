import type { Database } from 'bun:sqlite';
import { getColorScheme } from '../../../core/themes';

export function authorLayout(title: string, content: JSX.Element, db?: Database): JSX.Element {
  const scheme = db ? getColorScheme(db) : 'light';
  const page = (
    <html lang="en" data-theme={scheme}>
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>GRIP — {title}</title>
        <link rel="stylesheet" href="/static/pico.min.css" />
        <link rel="stylesheet" href="/theme.css" />
        <script src="/static/htmx.min.js" defer />
        <style>{`
          /* ── Compact author UI ── */
          body { font-size: 0.9rem; }
          h1 { font-size: 1.4rem; } h2 { font-size: 1.2rem; } h3 { font-size: 1rem; } h4 { font-size: 0.85rem; }
          input, select, textarea { font-size: 0.85rem !important; padding: 0.35rem 0.6rem !important; }
          label { font-size: 0.8rem; font-weight: 500; margin-bottom: 0.75rem; }
          button, [role=button] { font-size: 0.8rem !important; padding: 0.3rem 0.85rem !important; }
          button[type=submit].primary-action { padding: 0.25rem 0.75rem !important; }
          table { font-size: 0.82rem; }
          th, td { padding: 0.4rem 0.6rem !important; }
          section { margin-bottom: 1.25rem; }
          hr { margin: 1rem 0; }
          /* ── Nav ── */
          nav { border-bottom: 1px solid var(--pico-muted-border-color); margin-bottom: 1.5rem; }
          nav ul { list-style: none; display: flex; gap: 1.25rem; padding: 0.6rem 0; margin: 0; }
          nav a { font-size: 0.8rem; color: var(--pico-muted-color); text-decoration: none; }
          nav a:hover { color: var(--pico-primary); }
          nav strong a { color: var(--pico-color); font-size: 0.85rem; letter-spacing: 0.05em; }
          /* ── Editor ── */
          .preview-pane { border: 1px solid var(--pico-muted-border-color); padding: 0.75rem; min-height: 160px; border-radius: var(--pico-border-radius); font-size: 0.82rem; }
          /* ── Page header row ── */
          .page-hd { display: flex; align-items: center; justify-content: space-between; margin-bottom: 1.25rem; gap: 1rem; }
          .page-hd h2, .page-hd h3 { margin: 0; }
        `}</style>
      </head>
      <body>
        <div class="container">
          <nav>
            <ul>
              <li><strong><a href="/dashboard">GRIP</a></strong></li>
              <li><a href="/articles">Articles</a></li>
              <li><a href="/micro">Micro</a></li>
              <li><a href="/pages">Pages</a></li>
              <li><a href="/media">Media</a></li>
              <li><a href="/settings">Settings</a></li>
              <li style="margin-left:auto">
                <form method="POST" action="/logout" style="margin:0">
                  <button type="submit" class="outline secondary" style="padding:0.25rem 0.75rem">Logout</button>
                </form>
              </li>
            </ul>
          </nav>
          <main>
            {content}
          </main>
        </div>
      </body>
    </html>
  );
  return ('<!DOCTYPE html>' + page) as unknown as JSX.Element;
}
