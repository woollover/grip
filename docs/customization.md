# Customizing GRIP

GRIP is designed to be yours. This guide explains how to make it look, feel, and behave the way you want. It assumes you are comfortable reading and editing code.

Everything in here is optional. You can run GRIP without changing a single line of source, and it will work just fine with the defaults.

---

## 1. Theme Presets

GRIP ships with three built-in themes: **light**, **dark**, and **cyberpunk**.

To switch between them, go to the author interface (`https://author.example.com`), open the Settings page, and select a theme from the dropdown. The change takes effect immediately and is persisted in the database.

Under the hood, selecting a theme writes a `SettingChanged` event to the event store with `key: "theme"` and the chosen value. On startup and after any change, the `config` projection table is updated and GRIP reads the active theme from there.

---

## 2. Creating a Custom Theme

Themes are defined in `src/core/themes.ts`. Each theme is a set of CSS custom property overrides layered on top of PicoCSS v2's defaults.

The file looks like this:

```typescript
// src/core/themes.ts

export type ThemeId = "light" | "dark" | "cyberpunk" | "your-theme-id";

export const THEMES: Record<ThemeId, Theme> = {
  light: {
    label: "Light",
    vars: {
      "--pico-font-family": "Georgia, serif",
      "--pico-color": "#1a1a1a",
      "--pico-background-color": "#ffffff",
      "--pico-primary": "#0066cc",
    },
  },
  dark: {
    label: "Dark",
    vars: {
      "--pico-font-family": "Georgia, serif",
      "--pico-color": "#e8e8e8",
      "--pico-background-color": "#111111",
      "--pico-primary": "#4da6ff",
    },
  },
  cyberpunk: {
    label: "Cyberpunk",
    vars: {
      "--pico-font-family": "'Courier New', monospace",
      "--pico-color": "#00ff41",
      "--pico-background-color": "#0a0a0a",
      "--pico-primary": "#ff00ff",
    },
  },
};
```

**To add a new theme:**

1. Open `src/core/themes.ts`.
2. Add your theme ID to the `ThemeId` union type.
3. Add an entry to the `THEMES` object with a `label` and a `vars` map.
4. Restart GRIP. Your new theme will appear in the Settings dropdown.

**PicoCSS v2 custom properties that matter:**

PicoCSS v2 uses CSS custom properties throughout. The most useful ones to override:

| Property | What it controls |
|---|---|
| `--pico-font-family` | Body font stack |
| `--pico-font-size` | Base font size (default `16px`) |
| `--pico-line-height` | Line height for body text |
| `--pico-color` | Default text color |
| `--pico-background-color` | Page background |
| `--pico-primary` | Accent color (links, buttons, focus rings) |
| `--pico-secondary` | Secondary accent |
| `--pico-muted-color` | Muted/secondary text |
| `--pico-muted-border-color` | Borders and dividers |
| `--pico-card-background-color` | Card and article block backgrounds |
| `--pico-card-border-color` | Card borders |
| `--pico-ins-color` | Inserted/highlighted text |

For a full list of variables, open `public/static/pico.min.css` and search for `--pico-`. The file is minified but readable with a formatter.

**How theme vars are applied:**

The active theme's `vars` are written into a `<style>` block on every page inside a `:root { }` selector. This overrides PicoCSS's defaults for the entire page. No JavaScript involved.

---

## 3. Site Identity

Your site's title, description, and domain are set during `grip setup` and stored in the `config` table. You can change them in two ways:

**Via the Settings page** in the author interface. Changes take effect immediately.

**Via `grip.toml`** (for manual or scripted changes):

```toml
[site]
title = "My GRIP"
description = "A personal web space."
domain = "example.com"

[server]
public_port = 3000
author_port = 4000

[auth]
session_days = 7
```

If you edit `grip.toml` directly, restart GRIP for the changes to be read. Note that `grip.toml` values are read at startup and written into the database — the database is the source of truth at runtime. Editing the toml while GRIP is running has no immediate effect.

---

## 4. Layout Customization

GRIP has two separate layout contexts:

**The public site** layout is in `src/views/layout.tsx`. This wraps every page that visitors see. It generates the outer HTML shell: `<head>`, theme vars, navigation, and footer.

**The author interface** layout is in `src/server/author/routes/layout.ts`. This wraps the editing UI that only you see.

### Adding navigation links to the public site

Open `src/views/layout.tsx` and find the `<nav>` element:

```tsx
// src/views/layout.tsx (simplified)
export function Layout({ title, children, theme }: LayoutProps) {
  return `<!DOCTYPE html>
<html>
<head>
  <title>${escapeHtml(title)}</title>
  <link rel="stylesheet" href="/static/pico.min.css">
  <style>:root { ${themeVars} }</style>
</head>
<body>
  <header>
    <nav>
      <a href="/">Home</a>
      <a href="/archive">Archive</a>
      <!-- Add your links here -->
    </nav>
  </header>
  <main>${children}</main>
  <footer>
    <p>${escapeHtml(siteTitle)}</p>
    <!-- Add footer content here -->
  </footer>
</body>
</html>`;
}
```

Add links, a tagline, or any static HTML you want inside those blocks. This is plain HTML inside a template string — no build step required. Restart GRIP after editing.

### Adding custom CSS

The cleanest place to add custom styles is in the `<style>` block inside the layout, after the theme vars:

```tsx
<style>
  :root { ${themeVars} }

  /* Your custom CSS below */
  article h1 { font-size: 1.8rem; }
  .micro-post { border-left: 3px solid var(--pico-primary); padding-left: 1rem; }
</style>
```

Because PicoCSS is classless, you can style standard HTML elements directly without adding class names to the templates.

---

## 5. Adding a New Content Type

GRIP uses event sourcing. All state changes are events. To add a new content type (e.g. "bookmarks", "recipes", "reading notes"), you follow this pattern:

### Step 1 — Define the event type

In `src/core/events.ts`, add a new event interface and include it in the union type:

```typescript
// src/core/events.ts

export interface BookmarkCreated {
  type: "BookmarkCreated";
  id: string;       // ULID
  url: string;
  title: string;
  comment: string;
  tags: string[];
}

// Add to the union:
export type GripEvent =
  | ArticleCreated
  | ArticleUpdated
  | MicroPostCreated
  | BookmarkCreated  // <-- add this
  // ... other events
```

### Step 2 — Handle it in projections

In `src/core/projections.ts`, create a projection table for bookmarks and handle the event:

```typescript
// src/core/projections.ts

// In the createTables() function, add:
db.run(`
  CREATE TABLE IF NOT EXISTS bookmarks (
    id TEXT PRIMARY KEY,
    url TEXT NOT NULL,
    title TEXT NOT NULL,
    comment TEXT NOT NULL DEFAULT '',
    tags TEXT NOT NULL DEFAULT '[]',
    created_at TEXT NOT NULL
  ) STRICT
`);

// In the applyEvent() function, add a case:
case "BookmarkCreated":
  db.run(
    `INSERT INTO bookmarks (id, url, title, comment, tags, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      event.id,
      event.url,
      event.title,
      event.comment,
      JSON.stringify(event.tags),
      ulidToDate(event.id).toISOString(),
    ]
  );
  break;
```

### Step 3 — Add author routes (to create bookmarks)

Create `src/server/author/routes/bookmarks.ts`:

```typescript
// src/server/author/routes/bookmarks.ts
import { Elysia } from "elysia";
import { getDb } from "../../../core/db";
import { appendEvent } from "../../../core/events";
import { ulid } from "ulidx";

export const bookmarkRoutes = new Elysia()
  .get("/bookmarks/new", ({ session }) => {
    // Return an HTML form for creating a bookmark
    return `<form method="POST" action="/bookmarks">
      <input name="url" placeholder="URL" required>
      <input name="title" placeholder="Title" required>
      <textarea name="comment"></textarea>
      <button type="submit">Save</button>
    </form>`;
  })
  .post("/bookmarks", ({ body, session }) => {
    const id = ulid();
    appendEvent(getDb(), {
      type: "BookmarkCreated",
      id,
      url: body.url,
      title: body.title,
      comment: body.comment ?? "",
      tags: [],
    });
    return Response.redirect("/bookmarks", 303);
  });
```

Register it in the author app setup.

### Step 4 — Add public routes (to display bookmarks)

Create `src/server/public/routes/bookmarks.ts` and add a route that queries the `bookmarks` projection table and returns HTML.

### Step 5 — Rebuild if needed

If you are adding this to an existing GRIP with existing data, run:

```bash
bun run src/cli/index.ts rebuild
```

This replays all events and rebuilds every projection table, including the new `bookmarks` table. Your existing content is unaffected.

---

## 6. Custom Fonts

GRIP vendors its assets to avoid external dependencies. If you want a custom font, follow the same principle:

1. Download the font files (`.woff2` is the right format for modern browsers).
2. Put them in `public/static/fonts/` (create the directory if it does not exist).
3. Add a `@font-face` declaration in the layout's `<style>` block:

```css
@font-face {
  font-family: "MyFont";
  src: url("/static/fonts/myfont.woff2") format("woff2");
  font-display: swap;
}
```

4. Reference it in your theme's `--pico-font-family` variable or in a custom CSS rule.

Google Fonts has a "Download family" button for any font. Other sources: [Fontsource](https://fontsource.org/) publishes open-source fonts as downloadable packages, or you can use system fonts and avoid the download entirely. Common system font stacks:

```
/* Serif */
font-family: Georgia, "Times New Roman", serif;

/* Sans-serif */
font-family: system-ui, -apple-system, sans-serif;

/* Monospace */
font-family: "Courier New", Courier, monospace;
```

---

## 7. grip.toml Reference

`grip.toml` is created by `grip setup` in the GRIP root directory. Here is a full reference of all supported options:

```toml
[site]
# The name of your site, shown in the browser title bar and site header.
title = "My GRIP"

# A short description used in the HTML meta description tag.
description = "A personal web space."

# Your public domain, without protocol. Used to generate canonical URLs.
domain = "example.com"

[server]
# Port for the public-facing site. Default: 3000.
public_port = 3000

# Port for the author interface. Default: 4000.
author_port = 4000

# Host to bind both servers to. Default: 127.0.0.1 (loopback only, not public).
# Change to 0.0.0.0 only if you know what you are doing.
host = "127.0.0.1"

[auth]
# How many days a session cookie lasts before requiring login again. Default: 7.
session_days = 7

# Number of failed login attempts before a 15-minute IP lockout. Default: 5.
rate_limit_attempts = 5

# Duration of the lockout in minutes. Default: 15.
rate_limit_minutes = 15

[paths]
# Directory for the SQLite database file. Default: ./data
data_dir = "./data"

# Directory for uploaded media files. Default: ./media
media_dir = "./media"
```

Options set in `grip.toml` are read once at startup. If you change them, restart GRIP.

---

## 8. Rebuilding Projections

The `grip rebuild` command drops all projection tables (`articles`, `micro_posts`, `pages`, `media`, `config`) and replays every event in the `events` table from the beginning to reconstruct them.

**When to run it:**

- After changing how GRIP processes events in `projections.ts` (e.g. you changed how tags are stored).
- After changing how Markdown is rendered (e.g. you changed `markdown-it` options) and you want all rendered HTML updated.
- After adding a new content type and its projection table, to process any historical events of that type that were added before the new code existed.
- If a projection table gets corrupted or out of sync. The event store is the source of truth; the projections are always reconstructable.

**How to run it:**

```bash
bun run src/cli/index.ts rebuild
```

Or, if you have the `grip` binary installed:

```bash
grip rebuild
```

GRIP must not be serving requests while a rebuild is running. Stop the service first:

```bash
systemctl stop grip
bun run src/cli/index.ts rebuild
systemctl start grip
```

The rebuild time depends on how many events you have. For most personal sites with a few hundred posts, it completes in under a second. The `events` table is never touched — only the projection tables are rebuilt.
