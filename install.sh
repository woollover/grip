#!/usr/bin/env bash
set -euo pipefail

# ── Colours & helpers ─────────────────────────────────────────────────────────
BOLD='\033[1m'
DIM='\033[2m'
GREEN='\033[32m'
CYAN='\033[36m'
YELLOW='\033[33m'
RED='\033[31m'
RESET='\033[0m'

say()  { echo -e "  $*"; }
ok()   { echo -e "  ${GREEN}✓${RESET}  $*"; }
info() { echo -e "  ${CYAN}→${RESET}  $*"; }
warn() { echo -e "  ${YELLOW}⚠${RESET}  $*"; }
die()  { echo -e "  ${RED}✗${RESET}  $*" >&2; exit 1; }
hr()   { echo -e "  ${DIM}$(printf '─%.0s' {1..54})${RESET}"; }

# ── Config ────────────────────────────────────────────────────────────────────
GRIP_USER="grip"
GRIP_DIR="/opt/grip"
GITHUB_REPO="woollover/grip"

# ── Banner ────────────────────────────────────────────────────────────────────
echo
echo -e "  ${BOLD}${YELLOW}✨  GRIP Installer${RESET}"
echo -e "  ${DIM}Your sovereign personal web space — let's get it running.${RESET}"
echo
hr
echo

# ── Check: running as root ────────────────────────────────────────────────────
if [[ $EUID -ne 0 ]]; then
  die "Please run this script as root (or with sudo)."
fi

# ── Step 1: System packages ───────────────────────────────────────────────────
hr
say "${BOLD}Step 1 — System packages${RESET}"
hr
echo
info "Making sure curl and tar are available…"
apt-get update -qq
apt-get install -y -qq curl tar
ok "System packages ready."
echo

# ── Step 2: grip user ─────────────────────────────────────────────────────────
hr
say "${BOLD}Step 2 — Dedicated user${RESET}"
hr
echo
if id "$GRIP_USER" &>/dev/null; then
  ok "User '${GRIP_USER}' already exists — skipping."
else
  info "Creating a dedicated '${GRIP_USER}' system user…"
  useradd -r -M -d "$GRIP_DIR" -s /bin/bash "$GRIP_USER"
  ok "User '${GRIP_USER}' created."
fi
info "Granting '${GRIP_USER}' permission to restart its own service…"
echo "${GRIP_USER} ALL=(ALL) NOPASSWD: /bin/systemctl restart grip" > /etc/sudoers.d/grip
chmod 440 /etc/sudoers.d/grip
ok "Sudoers rule added."
echo

# ── Step 3: Download latest release ───────────────────────────────────────────
hr
say "${BOLD}Step 3 — Download GRIP${RESET}"
hr
echo

ARCH=$(uname -m)
case "$ARCH" in
  x86_64)  ASSET="grip-linux-x64.tar.gz" ;;
  aarch64) ASSET="grip-linux-arm64.tar.gz" ;;
  *) die "Unsupported architecture: ${ARCH}. Build from source instead." ;;
esac

info "Detected architecture: ${ARCH}"
info "Fetching latest release from github.com/${GITHUB_REPO}…"

DOWNLOAD_URL=$(curl -fsSL "https://api.github.com/repos/${GITHUB_REPO}/releases/latest" \
  | grep -o "\"browser_download_url\": \"[^\"]*${ASSET}\"" \
  | cut -d'"' -f4)

if [[ -z "$DOWNLOAD_URL" ]]; then
  die "Could not find a release asset for ${ASSET}. Check github.com/${GITHUB_REPO}/releases"
fi

info "Downloading ${ASSET}…"
curl -fsSL "$DOWNLOAD_URL" -o /tmp/grip.tar.gz
ok "Downloaded."
echo

# ── Step 4: Extract ───────────────────────────────────────────────────────────
hr
say "${BOLD}Step 4 — Install${RESET}"
hr
echo

mkdir -p "$GRIP_DIR"
info "Extracting to ${GRIP_DIR}…"
tar -xzf /tmp/grip.tar.gz -C "$GRIP_DIR"
chmod +x "$GRIP_DIR/grip"
chown -R "$GRIP_USER:$GRIP_USER" "$GRIP_DIR"
rm /tmp/grip.tar.gz
ok "GRIP installed at ${GRIP_DIR}."
echo

# ── Step 5: Data directories ──────────────────────────────────────────────────
hr
say "${BOLD}Step 5 — Data directories${RESET}"
hr
echo
info "Creating data and media directories…"
mkdir -p "$GRIP_DIR/data" "$GRIP_DIR/media"
chown -R "$GRIP_USER:$GRIP_USER" "$GRIP_DIR/data" "$GRIP_DIR/media"
ok "Directories ready."
echo

# ── Step 6: Config file ───────────────────────────────────────────────────────
hr
say "${BOLD}Step 6 — Configuration file${RESET}"
hr
echo
if [[ -f "$GRIP_DIR/grip.toml" ]]; then
  ok "grip.toml already exists — leaving it untouched."
else
  cp "$GRIP_DIR/grip.toml.example" "$GRIP_DIR/grip.toml"
  chown "$GRIP_USER:$GRIP_USER" "$GRIP_DIR/grip.toml"
  ok "grip.toml created from template."
  warn "Open ${GRIP_DIR}/grip.toml and set your domain and site title before continuing."
fi
echo

# ── Step 7: Firewall ──────────────────────────────────────────────────────────
hr
say "${BOLD}Step 7 — Firewall${RESET}"
hr
echo
info "Configuring UFW firewall…"
apt-get install -y -qq ufw
ufw --force reset
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp   comment 'SSH'
ufw allow 80/tcp   comment 'HTTP (Caddy ACME)'
ufw allow 443/tcp  comment 'HTTPS'
ufw --force enable
ok "Firewall active. Ports 22, 80, 443 open. Ports 3000/4000 are internal only."
echo

# ── Step 8: systemd service ───────────────────────────────────────────────────
hr
say "${BOLD}Step 8 — Systemd service${RESET}"
hr
echo
info "Installing grip.service…"
cp "$GRIP_DIR/grip.service" /etc/systemd/system/grip.service
systemctl daemon-reload
systemctl enable grip
ok "Service installed and enabled (will start automatically on boot)."
warn "Not starting yet — the database isn't initialised until you run the setup wizard."
echo

# ── Step 9: Caddy ─────────────────────────────────────────────────────────────
hr
say "${BOLD}Step 9 — Caddy (reverse proxy + TLS)${RESET}"
hr
echo
if command -v caddy &>/dev/null; then
  ok "Caddy is already installed — skipping."
else
  info "Installing Caddy via official apt repository…"
  apt-get install -y -qq debian-keyring debian-archive-keyring apt-transport-https
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' \
    | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' \
    | tee /etc/apt/sources.list.d/caddy-stable.list > /dev/null
  apt-get update -qq
  apt-get install -y -qq caddy
  ok "Caddy installed."
fi
echo
if [[ -f "/etc/caddy/Caddyfile" ]]; then
  ok "Caddyfile already exists — leaving it untouched."
else
  info "Writing Caddyfile to /etc/caddy/Caddyfile…"
  cat > /etc/caddy/Caddyfile <<'CADDY'
# GRIP — edit YOUR_DOMAIN to match your actual domain, then:
#   systemctl restart caddy

YOUR_DOMAIN {
    reverse_proxy localhost:3000
}

# Uncomment to expose the author panel at a subdomain:
# author.YOUR_DOMAIN {
#     reverse_proxy localhost:4000
# }
CADDY
  ok "Caddyfile written. Edit /etc/caddy/Caddyfile and replace YOUR_DOMAIN with your real domain."
fi
echo

# ── Done ──────────────────────────────────────────────────────────────────────
hr
echo
echo -e "  ${BOLD}${GREEN}✨  Installation complete!${RESET}"
echo
say "Three steps to go live:"
echo
say "  ${BOLD}1. Run the setup wizard:${RESET}"
say "     ${CYAN}su - $GRIP_USER -c '$GRIP_DIR/grip setup'${RESET}"
say "     ${DIM}(sets your domain, site title, passphrase, and initialises the database)${RESET}"
echo
say "  ${BOLD}2. Start GRIP:${RESET}"
say "     ${CYAN}systemctl start grip${RESET}"
echo
say "  ${BOLD}3. Configure Caddy with your domain and restart it:${RESET}"
say "     ${CYAN}nano /etc/caddy/Caddyfile${RESET}   ${DIM}# replace YOUR_DOMAIN${RESET}"
say "     ${CYAN}systemctl restart caddy${RESET}"
echo
say "${DIM}Caddy will obtain a TLS certificate from Let's Encrypt automatically.${RESET}"
echo
hr
echo
