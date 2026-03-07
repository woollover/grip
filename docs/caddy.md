# Caddy Setup

Caddy is the reverse proxy that sits in front of GRIP. It handles:
- HTTPS certificates (automatic, free via Let's Encrypt)
- Routing your domain to the right GRIP server
- HTTP → HTTPS redirects (automatic)
- Security response headers

---

## Installation

```bash
apt install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | \
  gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | \
  tee /etc/apt/sources.list.d/caddy-stable.list
apt update && apt install caddy -y
```

---

## Minimal config

Edit `/etc/caddy/Caddyfile`:

```caddy
yourdomain.com {
    reverse_proxy localhost:3000
}

author.yourdomain.com {
    reverse_proxy localhost:4000
}
```

Replace `yourdomain.com` with your actual domain. Save, then:

```bash
caddy validate --config /etc/caddy/Caddyfile   # check for errors
systemctl reload caddy
```

Caddy will automatically obtain TLS certificates for both domains on the first request. This requires DNS to already be pointing at the server.

---

## Recommended config with security headers

```caddy
(security) {
    header {
        Strict-Transport-Security "max-age=31536000; includeSubDomains"
        X-Frame-Options "DENY"
        X-Content-Type-Options "nosniff"
        Referrer-Policy "strict-origin-when-cross-origin"
        -Server
    }
}

yourdomain.com {
    import security
    reverse_proxy localhost:3000
}

author.yourdomain.com {
    import security
    reverse_proxy localhost:4000
}
```

The `(security)` block is a reusable snippet. `import security` includes it in each site block.

`-Server` removes the `Server: Caddy` header from responses.

---

## Restricting the author panel by IP

If your home or office IP is stable, you can block everyone else from reaching the author panel:

```caddy
author.yourdomain.com {
    @allowed remote_ip 203.0.113.1   # replace with your IP
    handle @allowed {
        reverse_proxy localhost:4000
    }
    respond 403
}
```

To allow multiple IPs:
```caddy
@allowed remote_ip 203.0.113.1 198.51.100.5
```

To find your current IP: `curl ifconfig.me` on your local machine.

> Note: if your IP changes (most home connections do), you'll lock yourself out. Use this only if you have a static IP or are willing to update the config when needed.

---

## ActivityPub and WebFinger

No extra Caddy config is needed. The public server (port 3000) already handles `/.well-known/webfinger`, `/activitypub/*`, and all other routes. Caddy simply proxies everything to it.

The only requirement is that your domain resolves correctly and HTTPS is working — both of which Caddy handles automatically.

---

## Useful commands

```bash
# Check Caddy is running
systemctl status caddy

# Reload config after changes (no downtime)
systemctl reload caddy

# Full restart (avoid unless needed)
systemctl restart caddy

# View logs
journalctl -u caddy -f

# Validate config before applying
caddy validate --config /etc/caddy/Caddyfile

# See where certificates are stored
ls /var/lib/caddy/certificates/
```

---

## Troubleshooting

**Certificate not obtained:**
- DNS must resolve before Caddy can get a certificate. Check with `dig yourdomain.com`
- Caddy needs ports 80 and 443 open. Check: `ufw allow 80 && ufw allow 443`

**`address already in use` error:**
- Another process is using port 80 or 443. Find it: `ss -tlnp | grep ':80\|:443'`

**GRIP unreachable after Caddy starts:**
- Make sure GRIP is running: `systemctl status grip`
- Check GRIP is listening on port 3000: `ss -tlnp | grep 3000`

**Author panel unreachable:**
- If you added an IP restriction, your IP may have changed
- Remove or update the `remote_ip` line and reload Caddy
