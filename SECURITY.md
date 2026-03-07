# Security

> For a detailed operator security guide covering authentication internals, rate limiting, hardening, and audit logging, see [`docs/security.md`](docs/security.md).

## Security Model

GRIP is a single-author, self-hosted publishing system. The threat model is:

- **The author** is fully trusted. There is no multi-user access control.
- **Visitors** to the public site (port 3000) are untrusted. The public server is read-only and serves no forms, no user input, and no client-side JavaScript.
- **The author panel** (port 4000) is protected by a bcrypt-hashed passphrase and a session cookie. It must be served over HTTPS in production (Caddy handles this).
- **Fediverse actors** (ActivityPub) are partially trusted: all inbound payloads are signature-verified; all outbound fetches are SSRF-protected and URL-validated.

There is no "admin vs user" distinction — there is only the owner and everyone else.

---

## What Data Is Stored

All data lives in one file: `data/grip.sqlite`.

| Table | Contents |
|-------|----------|
| `events` | Append-only log of every action (articles, notes, pages, media, settings) |
| `articles` | Projection of published/draft articles |
| `micro_posts` | Projection of micronotes |
| `pages` | Projection of static pages |
| `media` | Metadata for uploaded files |
| `config` | Site settings (title, description, domain, session token hash) |
| `ap_followers` | Fediverse contacts (actor URL, inbox URL, follow date) |
| `ap_replies` | Inbound fediverse replies to notes |

**No user data is collected.** No analytics, no tracking, no cookies on the public site.

**Media files** are stored under `media/` on disk. Back up both `data/grip.sqlite` and `media/`.

---

## Implemented Security Controls

### Authentication
- Passphrase hashed with bcrypt (cost factor 12)
- Session token stored as a bcrypt hash; compared with `timingSafeEqual` (constant-time) to prevent timing attacks
- Session cookie: `HttpOnly`, `SameSite=Strict`, 7-day expiry
- Brute-force protection: 5 failed attempts locks the account for 15 minutes (tracked per IP)

### Author Panel (port 4000)
- All routes require a valid session cookie
- `/preview` endpoint is auth-gated (prevents unauthenticated Markdown rendering)
- X-Forwarded-For parsed to first IP only (prevents header injection attacks)

### Input and Output
- All SQL queries use parameterized statements — no SQL injection risk
- Markdown is author-written, not visitor-submitted — no XSS surface from user input
- Uploaded file MIME types are derived from extension against an explicit allowlist; client-supplied `Content-Type` is ignored
- Unknown file extensions are rejected at upload time
- Non-inline file types (PDFs, plain text) are served with `Content-Disposition: attachment`

### HTTP Headers
Both servers set:
- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Content-Security-Policy` (public site: `script-src 'none'`; author: `unsafe-inline` for HTMX)

### ActivityPub
- All inbound requests are verified with HTTP Signatures (RSA-2048)
- Signed GET requests used for all outbound actor fetches (required by "authorized fetch" servers like Mastodon)
- SSRF protection: all outbound AP URLs are validated — must be `https:`, must not resolve to loopback, RFC-1918, or link-local addresses
- Fetched actor `id` is verified to match the announced `actor` field (prevents actor spoofing)

---

## Known Limitations

- **No retry queue**: if an ActivityPub delivery fails (contact inbox unreachable), the post is not retried.
- **No rate limiting** on the public server beyond the login brute-force protection.
- **No automated backup**: `data/grip.sqlite` must be backed up manually.
- **No test suite**: security controls are verified by code review and manual testing, not automated tests.
- **ActivityPub replies** contain external user content (display names, message text). This content is stored as-is and moderated by the owner via the Replies panel.

---

## Hardening Recommendations

1. **Run behind Caddy** with HTTPS. See `docs/caddy.md`.
2. **Restrict the author panel by IP** in the Caddyfile if your IP is stable:
   ```caddy
   author.yourdomain.com {
       @allowed remote_ip 203.0.113.1
       handle @allowed { reverse_proxy localhost:4000 }
       respond 403
   }
   ```
3. **Use a strong passphrase** — four or more unrelated words. The brute-force lock only protects against online attacks; offline attacks against a stolen database depend on passphrase strength.
4. **Back up regularly**: `data/grip.sqlite` and `media/` are your entire site.
5. **Keep Bun updated**: `bun upgrade` — GRIP has no runtime dependencies that phone home.

---

## Reporting Vulnerabilities

GRIP is personal software. There is no bug bounty and no security team.

If you find a security issue:

1. Open an issue at [github.com/woollover/grip](https://github.com/woollover/grip/issues) marked `[security]`
2. Or reach out directly via the contact details on the site

Please describe the issue clearly — what the vulnerability is, how to reproduce it, and what impact it has. There is no SLA, but genuine reports will be taken seriously.

---

## License

GRIP is released under the AGPL-3.0. See `LICENSE`.
