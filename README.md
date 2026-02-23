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
- **Not a social network.** There are no feeds, no likes, no follower counts, no reply threads designed to capture attention.
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
- Long-form posts from Markdown files (`grip post article.md`)
- Short-form micronotes from the command line (`grip micro "a quick thought"`)
- Drafts: posts can be staged before being made public
- Scheduled visibility (set a future publish date)
- Tags and basic taxonomy

**Reading Experience**
- Public server at port 3000 serves rendered HTML to visitors
- Clean, readable typography via PicoCSS (vendored, no CDN)
- Three theme presets: `light`, `dark`, `cyberpunk`
- HTMX for lightweight interactivity (vendored, no CDN)
- No JavaScript frameworks. No tracking scripts. No external requests.

**Author Interface**
- Separate author server at port 4000 (not exposed publicly)
- Passphrase authentication with session cookie
- Web UI for drafting, editing visibility, and reviewing post history
- Full event log visible to the author

**Data Integrity**
- Append-only SQLite event store (events are never deleted or modified)
- ULID-based event IDs (sortable, collision-resistant)
- Projections rebuilt from events at any time (`grip rebuild`)
- If a projection table is corrupted or schema changes, rebuild from source of truth

**Syndication**
- RSS feeds for all content, articles only, or micro-posts only (`/rss.xml`, `/articles/rss.xml`, `/micro/rss.xml`)
- ActivityPub federation — make your micro-posts followable from Mastodon and the fediverse (opt-in, see [`docs/activitypub.md`](docs/activitypub.md))
- Optional fediverse reply collection (disabled by default, owner-moderated)

**Operations**
- Single binary runtime: Bun
- `grip status` to inspect the system state
- `grip serve` to start both servers
- Caddy reverse proxy configuration for production TLS
- systemd service file for deployment as a system service

**No telemetry. No analytics. No external dependencies at runtime.**

---

## Architecture

GRIP uses event sourcing as its data model. Every action — posting, editing visibility, adding a tag — is recorded as an immutable event in SQLite. Projection tables (the readable views used by the servers) are derived from that event log and can be rebuilt at any time.

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

- Port 3000 — public-facing, read-only, no auth required. This is what the internet sees. Caddy sits in front of it in production.
- Port 4000 — author-facing, write operations, protected by passphrase + session cookie. Never exposed beyond localhost.

**Storage:**
- One SQLite file: `grip.db`
- Event table: append-only, never mutated
- Projection tables: derived, rebuildable with `grip rebuild`

**Tech stack:**
- Runtime: [Bun](https://bun.sh)
- Language: TypeScript
- HTTP framework: [Elysia](https://elysiajs.com)
- Database: SQLite via `bun:sqlite`
- Markdown rendering: markdown-it
- CSS: PicoCSS (vendored)
- Interactivity: HTMX (vendored)
- Auth: bcryptjs passphrase hashing, session cookie
- Event IDs: ULID
- Reverse proxy: Caddy (production)
- Process management: systemd (production)

---

## Quick Start

### Prerequisites

Install [Bun](https://bun.sh):

```sh
curl -fsSL https://bun.sh/install | bash
export PATH="$HOME/.bun/bin:$PATH"
```

### Install

```sh
git clone https://github.com/woollover/grip.git
cd grip
bun install
```

### Setup

Run the interactive setup wizard once to configure your site and set your passphrase:

```sh
bun run cli setup
```

The wizard walks through four steps:
1. **Site identity** — title, description, domain (with sensible defaults)
2. **Server ports** — public site (default 3000) and author interface (default 4000)
3. **Passphrase** — hashed with bcrypt, never stored in plain text
4. **Confirm** — review and apply

This creates `data/grip.sqlite` (your database) and `grip.toml` (your config). Both are gitignored.

### Serve

```sh
bun start
```

- Public site: http://localhost:3000
- Author interface: http://localhost:4000 — log in with the passphrase you set

### Publish a post

Write a Markdown file with optional front matter, then:

```sh
bun run cli post my-article.md
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

The post is saved as a draft. Log in to the author interface at http://localhost:4000 to publish it.

### Publish a micronote

```sh
bun run cli micro "Had a good thought today. Writing it down."
```

Short notes, no file required. Published immediately.

---

## CLI Reference

| Command | Description |
|---|---|
| `bun run cli setup` | Interactive wizard: configure site, set passphrase, init database |
| `bun start` | Start both public (:3000) and author (:4000) servers |
| `bun run cli post <file.md>` | Create an article from a Markdown file (saved as draft) |
| `bun run cli micro "text"` | Publish a micronote immediately |
| `bun run cli rebuild` | Rebuild all projection tables by replaying the event store |
| `bun run cli status` | Print the last 20 events with type, ID and timestamp |

---

## Production Deployment

For a production setup you need a Linux server, a domain name, and Caddy for TLS.

GRIP ships with a one-command installer that handles everything up to the setup wizard:

```sh
curl -fsSL https://raw.githubusercontent.com/woollover/grip/main/install.sh \
  | sudo bash -s https://github.com/woollover/grip
```

Then run the wizard and configure Caddy. See [`docs/deploy.md`](docs/deploy.md) for the full step-by-step guide.

To enable fediverse federation after deploying, see [`docs/activitypub.md`](docs/activitypub.md).

Deployment files at the project root:
- `grip.service` — systemd unit file
- `Caddyfile.example` — Caddy reverse proxy config

---

## Honesty About Status

GRIP is currently a proof of concept. It is functional but not battle-hardened.

**What works (PoC quality):**
- Event store model and projection rebuilding
- Two-server architecture
- Post and micronote publishing via CLI
- Passphrase auth on the author interface
- Theme presets

**What is not yet production-ready:**
- No automated backup tooling (back up `data/grip.sqlite` yourself — it is just a file)
- No search
- Error handling is minimal in the current build
- No test suite beyond manual verification
- ActivityPub: does not sign GET requests ("authorized fetch" mode on some Mastodon instances)

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

This is the only restriction, and it targets the only scenario the manifesto explicitly warns against: someone taking this tool of sovereignty and turning it into a new platform that captures others. The license and the philosophy say the same thing.

If you fork GRIP and run it for yourself, you owe nothing to anyone. It is yours.

See `LICENSE` for the full text.

---

*The manifesto lives in `MANIFESTO.md`.*
