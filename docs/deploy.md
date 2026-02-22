# Deploying GRIP

This guide walks you through deploying GRIP on a Linux VPS from scratch. No prior server experience is assumed. Take your time — there is no rush.

---

## What You Need Before Starting

1. **A Linux VPS** running Ubuntu 22.04 LTS. Any provider works (Hetzner, DigitalOcean, Linode, Vultr…). A $5/month plan with 1 GB RAM is more than enough.

2. **A domain name** you own (e.g. `example.com`), with access to its DNS settings at your registrar.

3. **SSH access** to your VPS — either a root password or an SSH key.

4. **Two DNS A records** pointing at your VPS's IP address:
   - `example.com` → your VPS IP
   - `author.example.com` → your VPS IP *(this is your private writing interface)*

   DNS changes can take a few minutes to a few hours to propagate. You can continue while you wait.

---

## Step 1 — Log In to Your VPS

From your local machine:

```bash
ssh root@your-vps-ip
```

You should see a prompt like `root@your-hostname:~#`. You are now inside your server.

---

## Step 2 — Update the System

```bash
apt update && apt upgrade -y
```

Let it finish before continuing.

---

## Step 3 — Run the Installer

GRIP ships with a single script that handles everything: creating a dedicated user, installing Bun, cloning the repo, installing dependencies, copying your config template, and registering the systemd service.

```bash
curl -fsSL https://raw.githubusercontent.com/yourusername/grip/main/install.sh \
  | bash -s https://github.com/yourusername/grip
```

Or, if you have already cloned the repo onto the server:

```bash
bash /opt/grip/install.sh https://github.com/yourusername/grip
```

The script will talk you through each step with colour output. It is safe to re-run — it skips anything already done.

**What the installer does:**
- Installs `git`, `curl`, and `unzip` via apt
- Creates a dedicated `grip` system user
- Clones your GRIP repo to `/opt/grip` (or updates it if already present)
- Installs Bun for the `grip` user
- Runs `bun install` to fetch dependencies
- Creates `grip.toml` from `grip.toml.example` if not present
- Copies `grip.service` to `/etc/systemd/system/` and enables it

---

## Step 4 — Run the Setup Wizard

The installer stops before the wizard deliberately — you may want to edit `grip.toml` first.

**Optional: edit your config**

```bash
nano /opt/grip/grip.toml
```

Set your `domain`, `title`, and `description`. Save with `Ctrl+O`, exit with `Ctrl+X`.

**Run the wizard:**

```bash
su - grip -c 'cd /opt/grip && bun run src/cli/index.ts setup'
```

The wizard walks you through four steps:

1. **Site identity** — title, description, domain (pre-filled from `grip.toml`)
2. **Server ports** — public site port (3000) and author interface port (4000)
3. **Passphrase** — your login password for the author interface; choose something long and memorable; it is hashed with bcrypt and never stored in plain text
4. **Confirm** — review and apply

The wizard creates the SQLite database at `data/grip.sqlite` and writes your settings into it. Both the database and `grip.toml` are gitignored — they stay on your server only.

---

## Step 5 — Install and Configure Caddy

Caddy acts as a reverse proxy and handles HTTPS automatically via Let's Encrypt.

**Install Caddy:**

```bash
apt install -y debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | \
  gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | \
  tee /etc/apt/sources.list.d/caddy-stable.list
apt update && apt install caddy -y
```

**Configure Caddy:**

```bash
cp /opt/grip/Caddyfile.example /etc/caddy/Caddyfile
nano /etc/caddy/Caddyfile
```

Replace every occurrence of `example.com` with your actual domain. The file should look like this:

```
example.com {
    reverse_proxy localhost:3000
}

author.example.com {
    reverse_proxy localhost:4000
}
```

Save and validate:

```bash
caddy validate --config /etc/caddy/Caddyfile
```

You should see: `Valid configuration`.

---

## Step 6 — Start Everything

```bash
systemctl enable --now caddy
systemctl start grip
```

Check both are running:

```bash
systemctl status caddy
systemctl status grip
```

Both should show `active (running)`. If either shows `failed`, see [Troubleshooting](#troubleshooting) below.

---

## Step 7 — Verify

From the server:

```bash
curl -I http://localhost:3000   # public site
curl -I http://localhost:4000   # author interface
```

Both should return `HTTP/1.1 200 OK` or a redirect. Then from your browser:

- `https://example.com` — your public site
- `https://author.example.com` — the author login page

If you see a browser HTTPS warning, Caddy may still be obtaining its certificate (takes up to a minute). Refresh after a moment.

---

## Updating GRIP

```bash
cd /opt/grip
git pull
bun install
systemctl restart grip
```

Your database and content are never touched by an update. If the release notes mention a projection change, also run:

```bash
su - grip -c 'cd /opt/grip && bun run src/cli/index.ts rebuild'
systemctl restart grip
```

The `rebuild` command replays all events and rebuilds the projection tables from scratch. Your original events are immutable and untouched.

---

## Troubleshooting

### View GRIP logs

```bash
journalctl -u grip -f          # live
journalctl -u grip -n 100      # last 100 lines
```

```bash
journalctl -u caddy -n 100     # Caddy logs
```

### "Connection refused" on port 3000 or 4000

GRIP is not running. Check its status and look for an error line:

```bash
systemctl status grip
journalctl -u grip -n 50
```

If you see a missing module error, re-run `bun install` then `systemctl restart grip`.

### Caddy shows "certificate obtain error"

DNS is not yet pointing at your server. Check with:

```bash
dig +short example.com
```

This should return your VPS IP. If it doesn't, correct the DNS records at your registrar and wait a few minutes.

### Login always fails

Passphrases are case-sensitive. If you've forgotten yours, run the setup wizard again — it will let you set a new one:

```bash
su - grip -c 'cd /opt/grip && bun run src/cli/index.ts setup'
```

### GRIP starts then immediately exits

Check whether the database exists:

```bash
ls -lh /opt/grip/data/
```

If `grip.sqlite` is missing, run the setup wizard again. If it's present but GRIP still crashes, the journal output will show the exact error.

### Port already in use

```bash
ss -tlnp | grep 3000
ss -tlnp | grep 4000
```

Stop the conflicting service, or change the ports in `grip.toml` and update the Caddyfile accordingly.
