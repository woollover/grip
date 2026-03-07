# GRIP

> *"The Personal GRIP is an act of self-authorship. It exists to restore the individual's right to speak, create, remember, and publish without asking permission."*

---

## What is GRIP?

GRIP is a personal web publishing system that you run on your own machine or server. It is not a platform. It is not a SaaS. It is not a blog engine you sign up for. There is no company behind it that decides what you can post, how visible you are, or what happens to your content when their business model changes.

GRIP is software you own and operate. Your words live in a SQLite database on your disk. Your past cannot be rewritten without your knowledge. Nobody can shadow-ban you, rank you down, or close your account.

If you want a space on the web that is genuinely yours — not rented, not moderated by a third party, not shaped by engagement algorithms — GRIP is for that.

---

## What GRIP is NOT

- **Not a platform.** There is no GRIP.com where you sign up and get a subdomain.
- **Not a SaaS.** Nothing phones home. No subscription. No usage metrics sent anywhere.
- **Not a blog engine in the WordPress sense.** There is no plugin marketplace, no theme store, no ecosystem with commercial interests.
- **Not a social network.** There are no feeds, no likes, no contact counts, no reply threads designed to capture attention.
- **Not a CMS for teams.** It is single-author by design. If you want multi-author, fork it and make it so.
- **Not something that requires the cloud.** It runs fully offline. A network connection is optional.

---

## Core Principles

### Sovereignty
The GRIP belongs to its owner. No external authority decides what is acceptable, visible, promoted, or silenced. You are the final arbiter of your content.

### Local-First
GRIP must run locally, independently, and offline if needed. Networking is an extension — not a requirement. Your content exists on your machine first. The server is just a window into it.

### Immutable History
What is written happened. The append-only event store means past content is never silently rewritten or deleted. You can choose what is publicly visible, but the record of what you wrote and when remains intact. The past is honest.

### Human Pace
No infinite feeds. No urgency loops. No engagement mechanics. You write when you have something to say. Readers read when they choose to. The software does not demand anything from either party.

### Authorship Over Performance
Metrics like views, likes, and reach are optional and opt-in. Nothing in GRIP is designed to distort your expression in pursuit of engagement. Write to think, not to perform.

### Simplicity Over Scale
GRIP favors clarity and durability over clever abstractions. The formats it uses — Markdown, HTML, SQLite — will still be readable in 20 years. The code should be understandable by a single person.

---

## Feature Set

**Publishing**
- Long-form articles from Markdown, with draft/publish/unpublish lifecycle
- Short-form micronotes — published immediately, retractable
- Static pages (About, Contact, etc.) with public nav integration
- Tags and filtering
- Media uploads (images, PDF, audio, video) with inline editor widget
- Six visual themes with live preview and per-property customisation

**Reading Experience**
- Public server at port 3000 serves rendered HTML to visitors
- Clean, readable prose with sidebar navigation
- Paginated article and note lists with tag filtering
- No JavaScript on the public site
- No tracking scripts, no external requests, no CDN

**Author Interface**
- Separate author server at port 4000
- Passphrase authentication with 7-day session cookie
- Markdown editor with live preview (HTMX)
- Article, page, and media management
- Settings UI: site identity, theme, and ActivityPub status

**Data Integrity**
- Append-only SQLite event store (events are never deleted or modified)
- ULID-based event IDs (sortable, collision-resistant)
- Projections rebuilt from events at any time (`grip rebuild`)
- WAL mode for safe concurrent reads

**Syndication**
- Three RSS feeds: all content, articles only, notes only
- Full ActivityPub federation — make your notes followable from Mastodon and the fediverse (opt-in)
- New posts delivered to contacts automatically
- Recent posts backfilled to new contacts on follow
- Optional fediverse reply collection with owner moderation

**Operations**
- Single binary runtime: Bun
- `grip status` to inspect system state
- `grip serve` to start both servers
- Caddy reverse proxy configuration for production TLS
- systemd service file for deployment as a system service
- One-command VPS installer

**No telemetry. No analytics. No external dependencies at runtime.**

---

## Architecture

GRIP uses event sourcing as its data model. Every action — posting, editing, publishing, following — is recorded as an immutable event in SQLite. Projection tables are derived from that event log and can be rebuilt at any time.

```
CLI / Author UI
      |
      v
  Event Store (SQLite, append-only)
      |
      v
  Projections (SQLite, rebuildable)
      |
     / \
    /   \
Public  Author
Server  Server
:3000   :4000
```

**Two servers, two concerns:**
- Port 3000 — public-facing, read-only, no auth required. This is what the internet sees.
- Port 4000 — author-facing, write operations, protected by passphrase + session cookie.

**Storage:**
- One SQLite file: `data/grip.sqlite`
- Event table: append-only, never mutated
- Projection tables: derived, rebuildable with `grip rebuild`
- Media files: on disk under `media/`

**Tech stack:**
- Runtime: [Bun](https://bun.sh)
- Language: TypeScript
- HTTP framework: [Elysia](https://elysiajs.com)
- Database: SQLite via `bun:sqlite`
- Markdown rendering: markdown-it
- CSS: PicoCSS (vendored)
- Interactivity: HTMX (vendored)
- Auth: bcryptjs + constant-time session comparison
- Event IDs: ULID
- ActivityPub: HTTP Signatures (RSA-2048), signed GET and POST
- Reverse proxy: Caddy (production)
- Process management: systemd (production)

---

## Quick Start

### Install (production — Linux VPS)

One command installs everything:

```sh
bash <(curl -fsSL https://raw.githubusercontent.com/woollover/grip/main/install.sh)
```

Then run the setup wizard:

```sh
su - grip -c '/opt/grip/grip setup'
```

See [`docs/install.md`](docs/install.md) for the full step-by-step guide.

### Install (local / development)

Requires [Bun](https://bun.sh):

```sh
git clone https://github.com/woollover/grip.git
cd grip
bun install
```

### Setup

```sh
bun run src/cli/index.ts setup
```

The wizard walks through:
1. **Site identity** — title, description, domain
2. **Server ports** — public site (default 3000) and author interface (default 4000)
3. **Passphrase** — hashed with bcrypt, never stored in plain text
4. **ActivityPub** — optional fediverse federation

This creates `data/grip.sqlite` (your database) and `grip.toml` (your config). Both are gitignored.

### Serve

```sh
bun run src/main.ts
```

- Public site: http://localhost:3000
- Author interface: http://localhost:4000 — log in with the passphrase you set

### Publish a post

Write a Markdown file with optional front matter, then:

```sh
bun run src/cli/index.ts post my-article.md
```

Front matter (optional):

```md
---
title: My First Post
slug: my-first-post
tags: writing, notes
---

Your content here.
```

The post is saved as a draft. Log in to the author interface to publish it.

### Post a micronote

```sh
bun run src/cli/index.ts micro "Had a good thought today. Writing it down."
```

Short notes, no file required. Published immediately.

---

## CLI Reference

**On a production server (binary):**

| Command | Description |
|---------|-------------|
| `grip setup` | Interactive wizard: configure site, set passphrase, init database |
| `grip serve` | Start both public (:3000) and author (:4000) servers |
| `grip post <file.md>` | Create an article from a Markdown file (saved as draft) |
| `grip micro "text"` | Publish a micronote immediately |
| `grip rebuild` | Rebuild all projection tables by replaying the event store |
| `grip status` | Print the last 20 events with type, ID, and timestamp |

**In development (Bun source):**

| Command | Description |
|---------|-------------|
| `bun run src/cli/index.ts setup` | Same as above |
| `bun run src/main.ts` | Start both servers |
| `bun run src/cli/index.ts post <file.md>` | Same as above |
| `bun run src/cli/index.ts micro "text"` | Same as above |
| `bun run src/cli/index.ts rebuild` | Same as above |
| `bun run src/cli/index.ts status` | Same as above |

---

## ActivityPub / Fediverse

GRIP can federate with Mastodon and any other ActivityPub-compatible server. When enabled, people can follow your account from any fediverse app and your notes appear in their timeline.

Enable it in `grip.toml`:

```toml
[activitypub]
enabled        = true
username       = "you"           # your handle: @you@yourdomain.com
accept_replies = true            # collect fediverse replies as comments
```

Restart GRIP. The console will confirm: `ActivityPub enabled as @you@yourdomain.com`.

The author panel's **Settings** page shows your federation status, contact count, and a link to the contacts list. The **Replies** panel lets you moderate incoming replies.

ActivityPub requires a public HTTPS domain. For local testing, use a cloudflared tunnel:
```sh
cloudflared tunnel --url http://localhost:3000
```

---

## Production Deployment

For a production setup you need a Linux server, a domain name, and Caddy for TLS.

**One-command installer** (run as root on a fresh Ubuntu 22.04 VPS):

```sh
bash <(curl -fsSL https://raw.githubusercontent.com/woollover/grip/main/install.sh)
```

Downloads the latest pre-built binary — no git, no Bun, no build step required.

Then run the setup wizard and configure Caddy. See [`docs/install.md`](docs/install.md) for the full non-technical step-by-step guide.

Deployment files:
- `grip.service` — systemd unit file
- `Caddyfile.example` — Caddy reverse proxy config
- `docs/caddy.md` — Caddy setup and hardening guide

---

## Documentation

| File | Contents |
|------|----------|
| [`docs/install.md`](docs/install.md) | Step-by-step installation from scratch, non-technical |
| [`docs/public-site.md`](docs/public-site.md) | Every public route and feature explained |
| [`docs/admin-panel.md`](docs/admin-panel.md) | Full author panel guide |
| [`docs/caddy.md`](docs/caddy.md) | Caddy setup, security headers, IP restriction |
| [`MANIFESTO.md`](MANIFESTO.md) | The philosophy behind GRIP |

---

## Honesty About Status

GRIP is functional and in active personal use. It is not battle-hardened at scale, but for a single-author personal site it is solid.

**What works:**
- Full publishing workflow (articles, notes, pages, media)
- Event sourcing with projection rebuilding
- ActivityPub federation with signed fetches, backfill, and reply moderation
- Theme customisation with live preview
- RSS feeds, tag filtering, pagination throughout
- Security: parameterized queries, constant-time session comparison, SSRF protection, MIME type validation, security response headers

**Known gaps:**
- No retry queue for failed ActivityPub deliveries
- No search
- No test suite beyond manual verification
- No automated backup tooling (back up `data/grip.sqlite` — it is just a file)

Use it. Break it. Fix it. It is yours.

---

## Why This Exists

The web was not always platforms. Before social networks, people ran their own sites. They wrote for themselves and for whoever found them. There were no algorithms deciding reach, no moderation policies from a company in another country, no feeds tuned to provoke.

That web is not gone. It is just unpopular. It requires a little more work and a little more intention.

GRIP is a small attempt to make that work easier — to give someone who cares about owning their digital presence a place to stand that nobody can pull out from under them.

It is not trying to compete with Substack or Medium or Bluesky. It is trying to be something those things cannot be: entirely yours.

---

## License

GRIP is released under the **GNU Affero General Public License v3.0 (AGPL-3.0)**.

This choice is deliberate and coherent with the manifesto.

The AGPL allows anyone to use, fork, modify, and run GRIP freely — on their own machine, their own server, in any context. The one restriction: if you modify GRIP and run it as a **network service** (i.e. a hosted platform for others), you must publish your source code to those users.

This targets the only scenario the manifesto explicitly warns against: someone taking this tool of sovereignty and turning it into a new platform that captures others. The license and the philosophy say the same thing.

If you fork GRIP and run it for yourself, you owe nothing to anyone. It is yours.

See `LICENSE` for the full text.

---

*The manifesto lives in `MANIFESTO.md`.*
