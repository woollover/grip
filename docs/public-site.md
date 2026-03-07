# The Public Site (port 3000)

The public site is what visitors see at `https://yourdomain.com`. It is entirely read-only — no login, no forms, no JavaScript on the reader's side.

---

## Pages

### Home — `/`

Shows two columns of recent content:

- **Articles** — the 8 most recent published articles, listed by date with title links
- **Notes** — the 5 most recent active micro-posts, shown in full

If nothing has been published yet, shows a placeholder message.

### Articles — `/articles`

Full paginated list of published articles, 10 per page.

**Tag filtering:** click any tag in the sidebar to filter by it. The URL becomes `/articles?tag=writing`. Tags can be combined with pagination: `/articles?tag=writing&page=2`.

**Pagination:** `← Newer` / `Older →` links appear when there are more than 10 articles.

### Single article — `/articles/:slug`

The article's full text, rendered from Markdown. Shows:
- Title and publication date
- Tags (each links to the filtered articles list)
- Body with prose styling (comfortable reading width, ~68 characters per line)

Returns 404 if the slug doesn't exist or the article isn't published.

### Notes — `/micro`

Paginated stream of micro-posts, 20 per page, newest first. Each note shows date and full content. If ActivityPub is enabled, notes link to their ActivityPub representation.

### Pages — `/pages/:slug`

Static pages (About, Contact, etc.) published from the author panel. Full prose styling.

### Media — `/media/:id`

Serves uploaded files by their ULID identifier. Images, PDFs, audio, and video are served inline; other file types are served as downloads. Responses are cached aggressively (1 year, immutable).

### RSS — `/rss.xml`, `/articles/rss.xml`, `/micro/rss.xml`

Three RSS feeds:
- `/rss.xml` — everything (articles + notes)
- `/articles/rss.xml` — articles only
- `/micro/rss.xml` — notes only

All linked in the site footer and in the `<head>` of every page.

---

## Sidebar

Visible on all pages (collapses below the content on mobile). Contains:
- Site description
- Recent articles list (up to 6)
- Tag cloud from all published articles

---

## Navigation header

- Site title (links to home)
- Articles
- Notes
- Any published static pages

---

## ActivityPub (when enabled)

The following endpoints are added to the public server:

| Endpoint | Purpose |
|----------|---------|
| `/.well-known/webfinger` | Fediverse account discovery |
| `/activitypub/actor` | Your identity as a Person object |
| `/activitypub/outbox` | Your notes as an ActivityStreams collection |
| `/activitypub/followers` | Contact count |
| `/activitypub/notes/:id` | Individual note |
| `/activitypub/inbox` | Receives Follow, Undo, Create, Delete from remote servers |

Visiting `/activitypub/actor` or `/activitypub/notes/:id` in a browser redirects to `/micro`. These endpoints only return ActivityPub JSON when the request includes `Accept: application/activity+json`.

---

## Security

- No cookies set on the public server
- No client-side JavaScript
- Security headers: `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Content-Security-Policy`
- All SQL queries are parameterized (no SQL injection risk)
- No user-supplied content is executed — Markdown is author-written
