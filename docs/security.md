# Security in GRIP

This document explains how GRIP handles security: what it protects against, what mechanisms it uses, and — equally important — what it does not protect against. Read this before trusting GRIP with content that matters to you.

---

## 1. The Threat Model

GRIP is designed for a single owner. It is not a multi-user system. It is not a public API. It is not a SaaS product.

The practical threat model is:

- **An unauthenticated person on the internet** should not be able to write, edit, delete, or administer anything.
- **The owner (you)** should be the only person who can log in to the author interface.
- **A casual attacker** who finds the author URL should be slowed down by rate limiting and blocked by authentication.

What GRIP does not try to protect against:
- A nation-state or well-resourced adversary with physical or network access to the server.
- A compromised hosting provider.
- Legal demands directed at the server or domain registrar.
- Social engineering of yourself.

If your threat model extends into those areas, you need more than a web publishing system. You need a lawyer, a threat consultant, and possibly a different country.

---

## 2. Authentication

GRIP uses a single passphrase for the author interface. There are no user accounts, no roles, no invite system.

**How the passphrase is stored:**

Your passphrase is hashed using `bcryptjs` with a cost factor of 12 before it is ever written anywhere. The cost factor of 12 means each verification attempt takes roughly 250–400 ms of CPU time on a modern machine. This makes brute-force attacks expensive even if someone obtains the hash.

The raw passphrase is never stored — not in the database, not in a log file, not in `grip.toml`. Only the bcrypt hash is persisted, in the `config` table of the SQLite database.

If you forget your passphrase, there is no "forgot password" flow. You reset it by running `grip setup` again.

**What a strong passphrase looks like:**

Use a passphrase, not a password. Four or more random common words (e.g. "correct horse battery staple") are far harder to guess than a short string of characters with symbols. Use a password manager if you have one.

---

## 3. Session Management

When you log in successfully, GRIP creates a session. Here is exactly how it works:

1. **Token generation**: 32 bytes are read from the operating system's cryptographically secure random number generator (`crypto.getRandomValues`). These are hex-encoded to produce a 64-character token string.

2. **Storage**: The token is stored in the `config` table of the SQLite database, not in a separate sessions table. There is one active session at a time.

3. **Cookie**: The token is sent to your browser as an `HttpOnly` cookie with `SameSite=Strict`. `HttpOnly` means JavaScript running in your browser cannot read the cookie, which prevents it from being stolen by XSS attacks. `SameSite=Strict` means the cookie is never sent with cross-site requests, which defends against CSRF attacks.

4. **Expiry**: Sessions expire after 7 days. After that, you must log in again.

5. **Logout**: Logging out deletes the token from the database and clears the cookie. There is no way to use that token again once it is gone.

There is no "remember me" option that extends the session indefinitely. The 7-day limit is deliberate.

---

## 4. Rate Limiting

To defend against brute-force login attempts, GRIP tracks failed logins per IP address in memory.

The rules:
- **5 consecutive failed login attempts** from the same IP address triggers a **15-minute lockout** for that IP.
- During a lockout, the login form returns an error immediately without checking the passphrase.
- The lockout counter is stored in memory only. If GRIP restarts, the counter resets.

Limitations to be aware of:
- Because the counter is in-memory, a restart clears the lockout. An attacker who can cause GRIP to restart (e.g. through a crash exploit) could theoretically cycle through more attempts.
- IPv6 addresses are tracked individually. If an attacker rotates through many IP addresses, rate limiting will not stop them — but bcrypt's inherent slowness still limits the total attempts per second to a very low number.
- This is an application-level defense. For SSH brute-forcing, use `fail2ban` at the OS level (see the Hardening section below).

---

## 5. Auth Audit Log

Every login attempt — successful or not — is recorded as an `AuthAttempt` event in GRIP's immutable event store.

Each event records:
- The timestamp (encoded in the ULID event ID)
- Whether the attempt succeeded or failed
- The IP address of the requester

Because the event store is append-only, these records cannot be deleted or modified through the normal application. They will survive a projection rebuild. If you suspect someone has been trying to access your GRIP, run:

```bash
bun run src/cli/index.ts status
```

This shows the last 20 events, including auth attempts. For a full audit, query the database directly:

```bash
sqlite3 data/grip.db "SELECT id, payload FROM events WHERE json_extract(payload, '$.type') = 'AuthAttempt' ORDER BY id DESC LIMIT 50;"
```

---

## 6. The Author Interface

The author interface runs on port 4000. By default this port is not exposed to the internet — Caddy proxies it at `author.example.com`. The Caddyfile controls who can reach it.

**Recommended: restrict by IP address.**

If you always author from the same IP address (your home, your VPN), add an IP allowlist to the author block in your Caddyfile:

```
author.example.com {
    @blocked not remote_ip 203.0.113.42
    respond @blocked 403

    reverse_proxy localhost:4000
}
```

Replace `203.0.113.42` with your actual IP address. Anyone else who hits `author.example.com` will receive a 403 Forbidden before GRIP even sees the request.

**Alternative: keep port 4000 not publicly exposed at all.**

If you author exclusively from the same machine the server runs on, you do not need to expose the author interface through Caddy at all. Tunnel in via SSH when you need it:

```bash
ssh -L 4000:localhost:4000 root@your-vps-ip
```

Then open `http://localhost:4000` in your browser. The author interface is never on the public internet this way.

---

## 7. Markdown Rendering and HTML Injection

GRIP renders Markdown using `markdown-it`. It is configured with `html: false`.

This means if a piece of content contains raw HTML tags (e.g. `<script>`, `<iframe>`, `<img src=x onerror=...>`), they are escaped and rendered as visible text, not interpreted as HTML. An attacker who somehow gets content into your event store cannot use it to execute JavaScript in your readers' browsers.

Note: since only you can author content (single-owner system), this is primarily a defense against mistakes and future what-ifs, not an active threat.

---

## 8. No Third-Party Dependencies Phoning Home

GRIP vendors all front-end assets locally. PicoCSS and HTMX are downloaded once and stored in `public/static/`. No page served by GRIP loads resources from a CDN or external domain.

This means:
- No third party can track your readers.
- No external service outage can break your site's CSS or JavaScript.
- Your site works completely offline.

If you add custom fonts or other assets, follow the same principle: download them, put them in `public/static/`, and reference them with a local path. Never link to `fonts.googleapis.com`, `cdn.jsdelivr.net`, or any other external host.

---

## 9. SQLite Security

GRIP uses SQLite in WAL (Write-Ahead Logging) mode. This provides:

- **Concurrent reads** without blocking writes.
- **Crash safety**: if the process dies mid-write, the database rolls back to a consistent state on next open.

The database schema uses `STRICT` tables, which means SQLite enforces column types at the storage level. This eliminates a class of bugs where a poorly-typed value sneaks into the database and causes unexpected behavior later.

GRIP does not use an ORM. All SQL is written explicitly, with parameterized queries. There is no query builder that could silently construct a dangerous query. If you read the source, you can see exactly what SQL is executed and when.

The `events` table has no `UPDATE` or `DELETE` permissions granted to the application layer. The application connection has `INSERT` on events and full read/write on the projection tables. This is enforced at the application level, not at the SQLite file permission level — SQLite does not support per-table user permissions the way a server database does.

---

## 10. What GRIP Does Not Protect Against

Be honest with yourself about these limitations:

- **Physical access to the server**: if someone has a shell on the machine, they can read the SQLite file, read the bcrypt hash, and own everything. Secure your SSH access.
- **A compromised hosting provider**: your VPS provider's staff can access your disk. If this concerns you, look into full-disk encryption and whether your provider supports it.
- **Compromised Bun or OS packages**: if an attacker modifies Bun itself or a system library, all bets are off. Keep your OS updated (`apt upgrade`) and watch for Bun security advisories.
- **Compromised domain or DNS**: if someone hijacks your domain, they can redirect your site. Use a registrar that supports 2FA and DNSSEC.
- **The server's network traffic**: GRIP sends data over TLS (via Caddy), but the TLS endpoint is the server itself. Traffic on the server's internal loopback between GRIP and Caddy is unencrypted, but nothing outside the machine can see it.
- **You**: the most common way into any system is social engineering or reuse of a weak passphrase. Use a strong, unique passphrase.

---

## 11. Hardening Recommendations

The systemd service file (`grip.service`) already includes a set of sandboxing directives that restrict what the GRIP process can do even if it is compromised:

- `NoNewPrivileges=true` — the process cannot escalate to root.
- `PrivateTmp=true` — the process gets its own isolated `/tmp`.
- `ProtectSystem=strict` — the filesystem is read-only except for explicitly allowed paths.
- `ProtectHome=true` — home directories of other users are invisible.

Beyond what the service file already does, consider:

1. **Firewall**: close all ports except 22 (SSH), 80 (HTTP, for Caddy's ACME challenge), and 443 (HTTPS). Ports 3000 and 4000 should never be reachable from outside.

   ```bash
   ufw allow 22
   ufw allow 80
   ufw allow 443
   ufw enable
   ```

2. **fail2ban for SSH**: install `fail2ban` to automatically ban IPs that repeatedly fail SSH login attempts.

   ```bash
   apt install fail2ban -y
   systemctl enable --now fail2ban
   ```

3. **SSH key only**: disable password-based SSH login. Edit `/etc/ssh/sshd_config`, set `PasswordAuthentication no`, and restart SSH.

4. **Unattended upgrades**: enable automatic security patches.

   ```bash
   apt install unattended-upgrades -y
   dpkg-reconfigure --priority=low unattended-upgrades
   ```

5. **Regular backups of `data/grip.db`**: this file is your entire history. Back it up off-site. A daily `rsync` or `rclone` to a remote location is sufficient. The SQLite file is safe to copy while GRIP is running in WAL mode.
