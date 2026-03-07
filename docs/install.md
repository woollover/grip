# Installing GRIP — Step by Step

This guide takes you from "I just bought a server" to "I'm writing my first post" in under 30 minutes. No prior Linux experience required.

---

## What you'll need

- A server running Ubuntu 22.04 (any VPS provider: Hetzner, DigitalOcean, Linode, Vultr — even the cheapest $4–6/month plan works fine)
- A domain name (e.g. `myname.com`) pointing to that server
- About 20 minutes

---

## Step 1 — Buy a server

Any provider works. Look for:

- **OS:** Ubuntu 22.04 LTS
- **RAM:** 1 GB minimum
- **Disk:** 20 GB

After creating the server, the provider will show you:

- An **IP address** (looks like `95.217.12.45`)
- A **root password** or the option to use an SSH key

Write down the IP address.

---

## Step 2 — Point your domain to the server

Go to your domain registrar (wherever you bought your domain) and create two DNS records:

| Type | Name         | Value (your server IP) |
| ---- | ------------ | ---------------------- |
| A    | `@` or blank | `95.217.12.45`         |
| A    | `author`     | `95.217.12.45`         |

This makes:

- `yourdomain.com` — your public site
- `author.yourdomain.com` — your private writing panel

DNS changes can take a few minutes to a few hours to propagate. You can continue with the rest of the setup while waiting.

---

## Step 3 — Log in to your server

Open a terminal on your computer:

- **Mac:** press `Cmd+Space`, type "Terminal", press Enter
- **Windows:** press `Win+R`, type "cmd", press Enter
- **Linux:** you know what to do

Then type (replace with your actual IP):

```
ssh root@95.217.12.45
```

If asked "Are you sure you want to continue connecting?" type `yes` and press Enter.

Enter your password when prompted. You won't see anything as you type — that's normal.

---

## Step 4 — Run the installer

Once logged in, paste this single command and press Enter:

```bash
bash <(curl -fsSL https://raw.githubusercontent.com/woollover/grip/main/install.sh)
```

The installer will:

- Create a dedicated `grip` user
- Download the latest GRIP release to `/opt/grip`
- Set up the background service

This takes about 2–3 minutes. You'll see a stream of text — that's normal.

---

## Step 5 — Run the setup wizard

When the installer finishes, run:

```bash
su - grip -c '/opt/grip/grip setup'
```

The wizard will ask you a few questions:

**Site title** — the name of your site (e.g. `Maria's Notes`)

**Description** — one sentence about your site (e.g. `Thoughts on books, travel, and coffee`)

**Domain** — your domain without `https://` (e.g. `myname.com`)

**Ports** — just press Enter twice to keep the defaults (3000 and 4000)

**Passphrase** — choose a strong passphrase. Use 4 distinct words. This is the only password protecting your writing panel. Write it down somewhere safe.

**ActivityPub** — press Enter to skip for now. You can enable this later to connect with Mastodon.

---

## Step 6 — Install Caddy (the web server)

Caddy sits in front of GRIP and handles HTTPS automatically. Paste these commands one by one:

```bash
apt install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | tee /etc/apt/sources.list.d/caddy-stable.list
apt update && apt install caddy -y
```

---

## Step 7 — Configure Caddy

Open the Caddy config file:

```bash
nano /etc/caddy/Caddyfile
```

Delete everything in there and paste this (replace `myname.com` with your actual domain):

```
myname.com {
    reverse_proxy localhost:3000
}

author.myname.com {
    reverse_proxy localhost:4000
}
```

Save and exit: press `Ctrl+X`, then `Y`, then `Enter`.

Apply the new config:

```bash
systemctl reload caddy
```

---

## Step 8 — Start GRIP

```bash
systemctl start grip
systemctl enable grip
```

The second command makes GRIP start automatically if the server ever reboots.

---

## Step 9 — Verify everything works

Check that GRIP is running:

```bash
systemctl status grip
```

You should see `active (running)` in green.

Now open your browser and go to `https://author.myname.com` — you should see the GRIP login page.

Log in with the passphrase you set in Step 5. You're in.

---

## Step 10 — Write your first post

In the writing panel:

1. Click **Micro** to write a short note (like a tweet, but yours)
2. Click **Articles** to write a long-form piece
3. Click **Pages** for static content like About or Contact

Your public site is at `https://myname.com`.

---

## Keeping GRIP updated

When a new version is available, re-run the installer — it replaces the binary and static files without touching your data:

```bash
bash <(curl -fsSL https://raw.githubusercontent.com/woollover/grip/main/install.sh)
systemctl restart grip
```

---

## Troubleshooting

**Can't reach the site?**

- Check DNS has propagated: `dig myname.com` — should show your server IP
- Check GRIP is running: `systemctl status grip`
- Check Caddy is running: `systemctl status caddy`

**Login not working?**

- The passphrase is case-sensitive
- To reset it, run the setup wizard again: `su - grip -c '/opt/grip/grip setup'`

**Something broke after an update?**

```bash
su - grip -c '/opt/grip/grip rebuild'
systemctl restart grip
```

**View logs:**

```bash
journalctl -u grip -f
```

---

## Backup

Everything is in one file: `/opt/grip/data/grip.sqlite`

To back it up:

```bash
cp /opt/grip/data/grip.sqlite /opt/grip/data/grip.sqlite.backup
```

For off-site backups, you can `scp` or `rsync` this file to your local machine regularly. Also back up `/opt/grip/media/` if you've uploaded images.
