import { getThemeAttr } from '../../../core/themes';

export function authorLayout(title: string, content: string, db?: import('bun:sqlite').Database): string {
  const themeAttr = db ? getThemeAttr(db) : '';
  return `<!DOCTYPE html>
<html lang="en" ${themeAttr}>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>GRIP — ${title}</title>
  <link rel="stylesheet" href="/static/pico.min.css">
  <link rel="stylesheet" href="/theme.css">
  <script src="/static/htmx.min.js" defer></script>
  <style>
    nav { border-bottom: 1px solid var(--pico-muted-border-color); margin-bottom: 2rem; }
    nav ul { list-style: none; display: flex; gap: 1.5rem; padding: 0.75rem 0; }
    .preview-pane { border: 1px solid var(--pico-muted-border-color); padding: 1rem; min-height: 200px; border-radius: var(--pico-border-radius); }
  </style>
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
      ${content}
    </main>
  </div>
</body>
</html>`;
}
