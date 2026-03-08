# GRIP Reader — Implementation Notes

## What was built

A personal feed reader integrated into the GRIP author panel. It lets you subscribe to RSS/Atom/JSON feeds and follow ActivityPub profiles, caching everything locally in SQLite. There is no algorithmic sorting, no notification badges, no engagement metrics — just chronological content, pulled on demand.

---

## Architecture overview

```
src/reader/
  rss.ts        — RSS 2.0 / Atom 1.0 / JSON Feed parser (zero deps)
  ap.ts         — ActivityPub outbox reader + Follow/Unfollow activities
  store.ts      — SQLite CRUD for reader tables

src/server/author/routes/
  reader.tsx    — Author panel routes and UI (render + handlers)

src/activitypub/
  inbox.ts      — Extended: Accept handling + push-delivery storage

src/core/
  db.ts         — Extended: 3 new tables added to the schema

tests/reader/
  rss.test.ts   — 31 tests covering RSS 2.0, Atom, JSON Feed, stripHtml
  store.test.ts — 20 tests covering CRUD, deduplication, pagination
```

---

## Database schema

Three new tables, added to the existing `initSchema` in `db.ts`:

**`rss_subscriptions`** — RSS feed subscriptions
- `url` UNIQUE — the feed URL
- `title`, `description`, `site_url` — metadata fetched from the feed
- `last_fetched_at` — timestamp of last successful fetch

**`ap_following`** — ActivityPub actors you follow or read
- `actor_url` UNIQUE — the AP actor document URL
- `username`, `display_name`, `domain`, `avatar_url`, `inbox_url` — resolved from the actor document
- `follow_state` — `'none'` (polling only) | `'pending'` | `'accepted'` | `'rejected'`
- `follows_us` — 1 if this actor is in `ap_followers` (i.e. they follow you back)

**`reader_items`** — Cached feed items from all sources
- `source_type` — `'rss'` or `'ap'`
- `source_id` — FK to the subscription
- `guid` — canonical item identifier for deduplication
- Unique index on `(source_type, source_id, guid)` — prevents duplicate inserts silently via `INSERT OR IGNORE`
- Index on `published_at DESC` for fast chronological queries

---

## RSS parser

Written from scratch, no external dependencies. Handles:
- **RSS 2.0**: `<item>` splitting, CDATA sections, `<content:encoded>`, `<dc:creator>`, RFC 822 dates
- **Atom 1.0**: `<entry>` splitting, `<link href>` attribute extraction, `<content>` with CDATA, ISO 8601 dates
- **JSON Feed** (jsonfeed.org): direct JSON parse, `content_html`/`content_text`, `authors` array

Detection order:
1. Content-Type contains `json` → try JSON Feed
2. XML content contains `w3.org/2005/Atom` → Atom
3. Default → RSS 2.0

The parser uses a split-on-tag-boundaries approach rather than a full XML parser. Each item/entry segment is extracted between `<item>…</item>` or `<entry>…</entry>` markers, then fields are extracted with targeted regexes that handle CDATA. This is robust enough for real-world public feeds and is entirely self-contained.

---

## ActivityPub reader

Two distinct modes:

### Without AP configured (polling only)
- You can still subscribe to any public AP actor
- Their outbox is fetched over plain HTTPS GET
- `follow_state` is stored as `'none'` — no Follow activity is sent
- The remote server is unaware you're reading
- This is the "read without a fediverse account" mode

### With AP configured
- A formal `Follow` activity is sent to the actor's inbox
- `follow_state` starts as `'pending'`, transitions to `'accepted'` when the remote server sends `Accept`
- New posts are pushed to your inbox by the remote server and stored automatically in `reader_items`
- `follows_us` is set to 1 if they're in your `ap_followers` table

**Actor resolution** supports two input formats:
- Full HTTPS URL: `https://mastodon.social/users/foo`
- WebFinger handle: `@foo@mastodon.social` or `foo@mastodon.social`

WebFinger lookup hits `/.well-known/webfinger?resource=acct:…`, extracts the `self` link with type `application/activity+json`, then fetches the actor document.

**Outbox fetching** follows the AP paging model:
1. Fetch the actor's `outbox` URL → `OrderedCollection` with `first` page URL
2. Fetch the first page → `OrderedCollectionPage` with `orderedItems`
3. Extract `Create { object: Note }` activities that are public and not replies
4. Replies (`inReplyTo` present) are skipped — this keeps the reader clean

---

## Nav restructure

The author nav is now grouped into three logical sections, separated by thin vertical dividers:

```
GRIP  |  Write: Articles · Micro · Pages · Media  |  Read: Reader  |  Settings · Contacts · Replies  |  Logout
```

Group labels (`Write`, `Read`) are rendered as tiny uppercase spans with low opacity — visible enough to orient, invisible enough not to clutter.

CSS classes added to `layout.tsx`:
- `.nav-group-label` — tiny uppercase group label
- `.nav-div` — 1px vertical separator

---

## Push delivery (inbox integration)

`src/activitypub/inbox.ts` was extended with two new handlers:

**`handleAccept`** — when a remote server accepts your Follow request, updates `follow_state` to `'accepted'` in `ap_following`.

**`handleCreateFromFollowed`** — when a `Create { Note }` arrives from an actor in your `ap_following` table, the Note is stored in `reader_items`. Only public, non-reply Notes are stored.

**`handleFollow` also now** calls `syncFollowsUs(db, actorUri, true)` to keep the `follows_us` field in sync when someone follows you.

---

## Manifesto challenge

Each decision was evaluated against the eight principles:

| Principle | Assessment |
|-----------|------------|
| **Sovereignty** | ✅ You own your reading list. No external service decides what you see. |
| **Freedom of expression** | ✅ No filtering, no blocking of content at the reader level. |
| **Authorship over performance** | ✅ No like counts, no boost counts, no follower counts for people you follow. The `follows_us` field is informational only (not a vanity metric). |
| **Time is real** | ✅ Items are stored locally with their original `published_at`. They never disappear unless you delete the subscription. |
| **Local first, network optional** | ✅ All fetched content is cached in SQLite. Reading is fully offline once fetched. Fetches are on-demand, not automatic. The reader works even if the remote server goes down. |
| **Simplicity over scale** | ✅ Zero new npm dependencies. Custom RSS parser. No background scheduler. No algorithmic ranking. Manual refresh only. |
| **Human pace** | ✅ No infinite scroll, no auto-refresh, no notification badges, no urgency signals. You fetch when you want to read. |
| **Extensible, never captured** | ✅ Standard protocols (RSS, AP) that will work for decades. OPML import/export is a natural future extension. |

**One tension acknowledged**: Following AP actors creates a social graph (they know you follow them). This was a conscious choice — the "polling only" mode (`follow_state: none`) exists precisely for those who want to read without creating a social presence.

---

## Tech choices rationale

**No XML library dependency** — RSS/Atom have predictable, well-documented structures. A split-on-tag-boundaries approach with CDATA handling covers ~99% of real feeds. Avoiding a dependency means the parser will still work without any npm install in a decade.

**`INSERT OR IGNORE` deduplication** — the unique index on `(source_type, source_id, guid)` means refresh operations are idempotent. Items that already exist are silently skipped. No "mark as read" state is tracked — this keeps the schema minimal and the UX honest.

**Manual refresh only** — no background polling scheduler. A scheduler would require process management, error handling for network failures, and would create implicit urgency. If you want to read, you refresh. This is the human pace principle in practice.

**AP outbox = first page only** — fetching the entire history of an actor's outbox could be thousands of requests and megabytes of data. The first page (the 20–40 most recent public posts) is sufficient for a personal reader. Older posts arrive over time as you follow someone.

**`follow_state: 'none'` mode** — AP reading without a federated identity is a deliberate design choice. You can read others' public streams without them knowing, without creating an account on another server, and without any federation setup. This is closer to RSS (pull, anonymous) than to social following (push, identified).

---

## Routes added

| Method | Path | Description |
|--------|------|-------------|
| GET | `/reader` | Combined feed, paginated, chronological |
| GET | `/reader/rss` | RSS subscriptions list |
| POST | `/reader/rss` | Subscribe to a feed URL |
| POST | `/reader/rss/:id/refresh` | Re-fetch a feed |
| POST | `/reader/rss/:id/delete` | Remove subscription + items |
| GET | `/reader/ap` | AP following list |
| POST | `/reader/ap` | Follow an actor (URL or @handle) |
| POST | `/reader/ap/:id/refresh` | Re-fetch actor's outbox |
| POST | `/reader/ap/:id/unfollow` | Unfollow + remove items |

---

## Tests: 51 passing

```
tests/reader/rss.test.ts    — 31 tests
  RSS 2.0: metadata, items, CDATA, entities, content:encoded, dc:creator, date fallback
  Atom 1.0: metadata, link href, guid, dates, summary fallback, author
  JSON Feed: content_html/text, authors, missing title
  stripHtml: tag removal, whitespace collapse
  Format detection: auto-detect without Content-Type

tests/reader/store.test.ts  — 20 tests
  RSS: add, get by ID/URL, update, delete cascade, uniqueness
  AP: add, get, state update, follows_us detection, delete cascade, uniqueness
  Items: insert, dedup, ordering, filter by type/source, pagination, source_name join
```

Run with: `bun test tests/reader/`

---

## What is not implemented (intentional scope limits)

- **OPML import/export** — natural next step for RSS portability
- **Background auto-fetch** — intentionally absent (human pace)
- **Mark as read** — kept minimal; the reader is a reading tool, not a task list
- **Full-text search** — future extension; SQLite FTS5 would be the right tool
- **Announce/Boost handling** — AP boosts from followed actors are not stored; only original posts
- **HTTP caching (`ETag`, `Last-Modified`)** — could reduce bandwidth on refreshes; low priority
