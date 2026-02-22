# Customizing GRIP

GRIP is designed to be yours. This guide explains how to make it look, feel, and behave the way you want. It assumes you are comfortable reading and editing code.

Everything in here is optional. You can run GRIP without changing a single line of source, and it will work fine with the defaults.

---

## 1. Theme Presets

GRIP ships with three built-in themes: **light**, **dark**, and **cyberpunk**.

To switch, open the author interface, go to **Settings**, and select a theme. The change takes effect immediately on both the public site and the author interface.

Theme selection writes directly to the `config` table in the database. It is not recorded in the event store — it is a cosmetic preference, not a meaningful act.

---

## 2. Creating a Custom Theme

Themes are defined in `src/core/themes.ts`. Each theme is a raw CSS string that gets served at the `/theme.css` endpoint on both servers. Both layouts link to it with `<link rel="stylesheet" href="/theme.css">`.

The actual structure:

```typescript
// src/core/themes.ts

export type ThemeName = 'light' | 'dark' | 'cyberpunk';

export const THEMES: Record<ThemeName, string> = {
  light: `/* GRIP — Light theme (PicoCSS default) */
:root { color-scheme: light; }
`,

  dark: `/* GRIP — Dark theme */
:root { color-scheme: dark; }
html[data-theme="dark"] {
  --pico-background-color: #13171f;
  --pico-card-background-color: #1c2030;
}
`,

  cyberpunk: `/* GRIP — Cyberpunk theme */
:root {
  color-scheme: dark;
  --pico-font-family: 'Courier New', monospace;
  --pico-background-color: #0a0a12;
  --pico-primary: #00ff88;
  /* ... */
}
`,
};
```

**To add a new theme:**

1. Open `src/core/themes.ts`.
2. Add your theme name to the `ThemeName` union type:
   ```typescript
   export type ThemeName = 'light' | 'dark' | 'cyberpunk' | 'forest';
   ```
3. Add an entry to the `THEMES` object with a CSS string:
   ```typescript
   forest: `/* GRIP — Forest theme */
   :root {
     color-scheme: light;
     --pico-background-color: #f4f1ec;
     --pico-color: #2c3e2d;
     --pico-primary: #4a7c59;
     --pico-font-family: Georgia, serif;
   }
   `,
   ```
4. Add it to the allowed list in `src/server/author/routes/settings.tsx`:
   ```typescript
   const allowed: Theme[] = ['light', 'dark', 'cyberpunk', 'forest'];
   ```
5. Add a radio option in the `themeOptions` array in the same file.
6. Restart GRIP. Your theme will appear in Settings.

**PicoCSS v2 custom properties that matter:**

| Property | What it controls |
|---|---|
| `--pico-font-family` | Body font stack |
| `--pico-color` | Default text color |
| `--pico-background-color` | Page background |
| `--pico-primary` | Accent color (links, buttons, focus rings) |
| `--pico-secondary` | Secondary accent |
| `--pico-muted-color` | Muted/secondary text |
| `--pico-muted-border-color` | Borders and dividers |
| `--pico-card-background-color` | Card and article block backgrounds |
| `--pico-h1-color` through `--pico-h4-color` | Heading colours |
| `--pico-code-color` | Inline code text colour |
| `--pico-code-background-color` | Inline code background |

For a full list, open `public/static/pico.min.css` and search for `--pico-`. Paste the minified file into a formatter first for readability.

**How themes are applied:**

Both servers expose `GET /theme.css`. This endpoint reads the active theme name from the `config` table and returns the corresponding CSS string. The `<html>` tag also gets `data-theme="dark"` for dark and cyberpunk themes so PicoCSS's dark-mode variables kick in.

---

## 3. Site Identity

Your site title, description, and domain are set during `bun run cli setup` and stored in the `config` table. You can change them in two ways:

**Via the Settings page** in the author interface. Changes are logged as a `SiteConfigUpdated` event in the event store and applied immediately.

**Via `grip.toml`** — but note that `grip.toml` is only read at startup to seed the database on first run. The database is the source of truth at runtime. Editing `grip.toml` after setup has no effect unless you run setup again.

---

## 4. Layout Customization

GRIP has two layout contexts:

**Public site** — `src/views/layout.tsx`. The `publicLayout()` function wraps every page visitors see. It generates the full HTML shell including `<head>`, nav, and footer.

**Author interface** — `src/server/author/routes/layout.ts`. The `authorLayout()` function wraps every page in the writing UI.

Both are plain TypeScript functions that return HTML strings — no JSX compiler, no build step.

### Adding navigation links to the public site

Open `src/views/layout.tsx` and find the `<nav>` block:

```typescript
  <nav>
    <ul>
      <li><strong><a href="/">${siteTitle}</a></strong></li>
    </ul>
    <ul>
      <li><a href="/articles">Articles</a></li>
      <li><a href="/micro">Notes</a></li>
    </ul>
  </nav>
```

Add links to the second `<ul>`. For example, to add a pages link:

```typescript
      <li><a href="/pages/about">About</a></li>
```

Restart GRIP after editing.

### Adding custom CSS

Add a `<style>` block inside the `<head>` in the layout, after the theme link:

```typescript
  <link rel="stylesheet" href="/theme.css">
  <style>
    article h1 { font-size: 1.8rem; }
    .micro-post { border-left: 3px solid var(--pico-primary); padding-left: 1rem; }
  </style>
```

PicoCSS is classless — you can style standard HTML elements directly without adding classes to templates.

---

## 5. Adding a New Content Type

GRIP uses event sourcing. All state changes are events. To add a new content type (e.g. bookmarks, recipes, reading notes), follow this pattern:

### Step 1 — Define the event type

In `src/core/event-types.ts`, add to the `GripEvent` union:

```typescript
// src/core/event-types.ts

export type GripEvent =
  // ... existing events ...

  // Bookmarks
  | { type: 'BookmarkCreated'; id: string; url: string; title: string; comment: string; tags: string[] }
```

### Step 2 — Create the projection table

In `src/core/db.ts`, add the table to `initSchema()`:

```typescript
db.exec(`
  CREATE TABLE IF NOT EXISTS bookmarks (
    id          TEXT PRIMARY KEY,
    url         TEXT NOT NULL,
    title       TEXT NOT NULL,
    comment     TEXT NOT NULL DEFAULT '',
    tags        TEXT NOT NULL DEFAULT '[]',
    created_at  INTEGER NOT NULL
  ) STRICT;
`);
```

### Step 3 — Handle the event in projections

In `src/core/projections.ts`, add a case to `applyEvent()`:

```typescript
case 'BookmarkCreated': {
  db.prepare(`
    INSERT OR REPLACE INTO bookmarks (id, url, title, comment, tags, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(event.id, event.url, event.title, event.comment, JSON.stringify(event.tags), createdAt);
  break;
}
```

### Step 4 — Add author routes (to create bookmarks)

Create `src/server/author/routes/bookmarks.tsx` and export render/handler functions following the same pattern as `articles.tsx`. Then register the routes in `src/server/author/index.ts`:

```typescript
import { renderBookmarksIndex, handleBookmarkCreate } from './routes/bookmarks';

// Inside createAuthorApp():
app.get('/bookmarks', ({ cookie }) => {
  return requireAuth(cookie[SESSION_COOKIE]?.value) ?? html(renderBookmarksIndex(db));
});

app.post('/bookmarks', ({ body, cookie }) => {
  const guard = requireAuth(cookie[SESSION_COOKIE]?.value);
  if (guard) return guard;
  handleBookmarkCreate(db, store, body as any);
  return new Response(null, { status: 302, headers: { Location: '/bookmarks' } });
});
```

The handler uses `store.append()` (the `EventStore` instance already in scope):

```typescript
export function handleBookmarkCreate(db: Database, store: EventStore, body: {...}): void {
  const id = ulid();
  const event = { type: 'BookmarkCreated' as const, id, url: body.url, title: body.title, comment: body.comment ?? '', tags: [] };
  store.append(event);
  applyEvent(db, event, Date.now());
}
```

### Step 5 — Add public routes (to display bookmarks)

Create `src/server/public/routes/bookmarks.tsx` and register it in `src/server/public/index.ts`.

### Step 6 — Rebuild if needed

If you are adding this to an existing GRIP with data:

```bash
systemctl stop grip
bun run cli rebuild
systemctl start grip
```

This replays all events and rebuilds every projection table. Your events are never touched.

---

## 6. Custom Fonts

GRIP vendors its assets to avoid external dependencies. Follow the same principle for fonts:

1. Download font files in `.woff2` format.
2. Put them in `public/static/fonts/` (create the directory if needed).
3. Add a `@font-face` declaration in your theme's CSS string in `src/core/themes.ts`:

```css
@font-face {
  font-family: "MyFont";
  src: url("/static/fonts/myfont.woff2") format("woff2");
  font-display: swap;
}
:root {
  --pico-font-family: "MyFont", Georgia, serif;
}
```

[Fontsource](https://fontsource.org/) publishes open-source fonts as downloadable packages. Or use a system font stack and skip the download:

```css
/* Serif */    font-family: Georgia, "Times New Roman", serif;
/* Sans */     font-family: system-ui, -apple-system, sans-serif;
/* Mono */     font-family: "Courier New", Courier, monospace;
```

---

## 7. grip.toml Reference

`grip.toml` is created by `bun run cli setup`. It is gitignored — `grip.toml.example` is the versioned template. Values are read at startup and seeded into the database; the database is the source of truth at runtime.

```toml
[server]
# Port for the public-facing site (proxied by Caddy)
public_port  = 3000

# Port for the author interface
author_port  = 4000

# Your domain — used in RSS feed URLs
domain       = "example.com"

[data]
# Path to the SQLite database file
db_path      = "./data/grip.sqlite"

# Directory for uploaded media files
media_path   = "./media"

[site]
# Shown in the site header and RSS feed title
title        = "My GRIP"

# Used in the RSS feed description and meta tags
description  = "A personal publishing space"
```

---

## 8. Rebuilding Projections

The `rebuild` command drops all projection tables (`articles`, `micro_posts`, `pages`, `media`, `config`) and replays every event in the `events` table from the beginning to reconstruct them.

**When to run it:**

- After changing event handling in `projections.ts` (e.g. you changed how tags are stored).
- After changing markdown-it options — rendered HTML in projection tables will be regenerated.
- After adding a new projection table, to populate it from historical events.
- If a projection table gets out of sync. The event store is the source of truth; projections are always reconstructable.

**How to run it:**

```bash
# Stop the server first
systemctl stop grip

bun run cli rebuild

# Restart
systemctl start grip
```

For local development:

```bash
bun run src/cli/index.ts rebuild
```

The rebuild touches only projection tables. The `events` table is never modified.
