# ActivityPub Federation

This guide explains how to make your GRIP micro-posts followable from Mastodon, Pixelfed, and any other fediverse application that supports ActivityPub.

Federation is **opt-in and disabled by default.** GRIP works fully without it. Turning it on does not change how you write — it only adds a broadcast layer so others can subscribe.

---

## What This Does

When enabled, your micro-posts become followable from the fediverse. Someone on Mastodon can search for `@you@yourdomain.com`, hit Follow, and your new notes will appear in their timeline — signed by your server, attributed to you, with no third-party intermediary.

**What GRIP does:**
- Publishes each new micro-post to all contact inboxes automatically
- Accepts Follow and Unfollow requests
- Optionally collects fediverse replies as comments (disabled by default)

**What GRIP does not do:**
- Accept or display replies unless you explicitly turn that on
- Show contact counts anywhere in your own interface
- Participate in likes, boosts, or other engagement mechanics
- Require the fediverse to function — disable ActivityPub and GRIP works exactly as before

---

## Setup

### 1. Enable in `grip.toml`

Add the following section to your `grip.toml`:

```toml
[activitypub]
enabled  = true
username = "me"          # your handle will be @me@yourdomain.com
```

`username` can be anything — your first name, a pseudonym, whatever you want your fediverse handle to be. It does not need to match anything else.

### 2. Restart GRIP

```sh
bun start
```

On startup, GRIP will generate an RSA-2048 key pair and store it in the database. You will see:

```
ActivityPub enabled as @me@yourdomain.com
```

That's it. Your fediverse identity is live.

### 3. Verify discovery

From any machine with `curl`:

```sh
curl "https://yourdomain.com/.well-known/webfinger?resource=acct:me@yourdomain.com"
```

Expected response:

```json
{
  "subject": "acct:me@yourdomain.com",
  "links": [
    {
      "rel": "self",
      "type": "application/activity+json",
      "href": "https://yourdomain.com/activitypub/actor"
    }
  ]
}
```

### 4. Test from Mastodon

On any Mastodon instance, search for `@me@yourdomain.com`. Your profile should appear. Hit Follow — GRIP will receive the request and send an Accept automatically.

---

## Optional: Collect Replies as Comments

By default, replies from fediverse users are silently discarded. If you want to read what people say back, add one line to your config:

```toml
[activitypub]
enabled        = true
username       = "me"
accept_replies = true
```

Restart GRIP. From this point, replies addressed to your notes are stored in the database and shown beneath each post on your `/micro` page.

**Reply content is stripped of all HTML before storage.** Only plain text is kept. This means no images, no formatting, and no risk of injected markup showing on your site.

### Moderating replies

You control what is visible. In the author interface at `http://localhost:4000`, navigate to **Replies**. You will see all collected replies across all posts. Use the Hide/Show toggle to control visibility. Hidden replies disappear from the public site immediately.

Hiding a reply does not delete it from the database — consistent with GRIP's immutable history principle. The record of what was said remains; only its public exposure changes.

---

## Understanding Your Fediverse Identity

Your ActivityPub actor lives at a permanent URL:

```
https://yourdomain.com/activitypub/actor
```

**This URL must never change.** Your fediverse identity is this URL — changing your domain means starting over with a new identity. Anyone who follows you will need to re-follow. Choose your domain and username before enabling this feature in production.

Your full handle is: `@{username}@{domain}`

---

## Endpoints

These are added to the public server (port 3000) when ActivityPub is enabled:

| Endpoint | Purpose |
|---|---|
| `GET /.well-known/webfinger` | Account discovery — how Mastodon finds you |
| `GET /activitypub/actor` | Your identity card (JSON-LD Person object) |
| `GET /activitypub/outbox` | Your last 20 micro-posts as ActivityStreams |
| `GET /activitypub/followers` | Contact count (no URIs exposed) |
| `GET /activitypub/notes/:id` | Individual micro-post as ActivityStreams Note |
| `POST /activitypub/inbox` | Receives Follow, Unfollow, and replies from the fediverse |

All GET endpoints serve HTML to browsers (redirecting to `/micro`) and ActivityStreams JSON to fediverse clients, based on the `Accept` header.

---

## Known Limitations (v1)

**Authorized fetch:** Some Mastodon instances run in "secure mode," which requires HTTP Signatures even on GET requests. GRIP v1 does not sign GET requests. Content may not be visible to contacts on those instances. This is a known gap — it will be addressed in a future update.

**No retry on delivery failure:** If a contact's server is unreachable when you post, that post will not be delivered to them. GRIP does not queue or retry. For a personal site with a handful of contacts this is acceptable; large-scale use is not what GRIP is designed for.

**Domain change = identity reset:** ActivityPub identity is tied to the actor URL. Changing domains means a new fediverse identity. Plan your domain before going live.

---

## Disabling ActivityPub

Comment out or remove the `[activitypub]` section from `grip.toml` and restart:

```toml
# [activitypub]
# enabled  = true
# username = "me"
```

GRIP will start normally with no ActivityPub routes registered. Your contact list and key pair remain in the database — re-enable at any time to resume federation.
