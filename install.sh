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
REPO_URL="${1:-}"

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

# ── Check: repo URL ───────────────────────────────────────────────────────────
if [[ -z "$REPO_URL" ]]; then
  die "Usage: bash install.sh <repo-url>\n     e.g.  bash install.sh https://github.com/you/grip"
fi

# ── Step 1: System packages ───────────────────────────────────────────────────
hr
say "${BOLD}Step 1 — System packages${RESET}"
hr
echo
info "Making sure git and curl are available…"
apt-get update -qq
apt-get install -y -qq git curl unzip
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
  useradd -r -m -d "/home/$GRIP_USER" -s /bin/bash "$GRIP_USER"
  ok "User '${GRIP_USER}' created."
fi
echo

# ── Step 3: Clone or update repo ─────────────────────────────────────────────
hr
say "${BOLD}Step 3 — GRIP source code${RESET}"
hr
echo
if [[ -d "$GRIP_DIR/.git" ]]; then
  info "GRIP already lives at ${GRIP_DIR} — pulling latest changes…"
  git -C "$GRIP_DIR" pull --ff-only
  ok "Repository updated."
else
  info "Cloning GRIP into ${GRIP_DIR}…"
  git clone "$REPO_URL" "$GRIP_DIR"
  ok "Repository cloned."
fi
chown -R "$GRIP_USER:$GRIP_USER" "$GRIP_DIR"
ok "Ownership set to '${GRIP_USER}'."
echo

# ── Step 4: Install Bun ───────────────────────────────────────────────────────
hr
say "${BOLD}Step 4 — Bun runtime${RESET}"
hr
echo
install_bun_for_user() {
  local user="$1"
  local home
  home=$(eval echo "~$user")
  if su - "$user" -c 'export PATH="$HOME/.bun/bin:$PATH"; command -v bun' &>/dev/null; then
    local ver
    ver=$(su - "$user" -c 'export PATH="$HOME/.bun/bin:$PATH"; bun --version')
    ok "Bun ${ver} already installed for '${user}'."
  else
    info "Installing Bun for '${user}'…"
    su - "$user" -c 'curl -fsSL https://bun.sh/install | bash' 2>&1 | grep -E 'install|Done|bun' | while read -r line; do
      say "  ${DIM}${line}${RESET}"
    done
    local ver
    ver=$(su - "$user" -c 'export PATH="$HOME/.bun/bin:$PATH"; bun --version')
    ok "Bun ${ver} installed for '${user}'."
  fi
}
install_bun_for_user "$GRIP_USER"
echo

# ── Step 5: Install dependencies ─────────────────────────────────────────────
hr
say "${BOLD}Step 5 — Dependencies${RESET}"
hr
echo
info "Running bun install in ${GRIP_DIR}…"
su - "$GRIP_USER" -c "
  export PATH=\"\$HOME/.bun/bin:\$PATH\"
  cd '$GRIP_DIR'
  bun install --frozen-lockfile 2>&1 | tail -3
"
ok "All dependencies installed."
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

# ── Step 7: systemd service ───────────────────────────────────────────────────
hr
say "${BOLD}Step 7 — Systemd service${RESET}"
hr
echo
info "Installing grip.service…"
cp "$GRIP_DIR/grip.service" /etc/systemd/system/grip.service
systemctl daemon-reload
systemctl enable grip --now 2>/dev/null || systemctl enable grip
ok "Service installed and enabled (starts automatically on boot)."
echo

# ── Done ──────────────────────────────────────────────────────────────────────
hr
echo
echo -e "  ${BOLD}${GREEN}✨  Installation complete!${RESET}"
echo
say "GRIP is installed. One step left before you can start:"
echo
say "  ${BOLD}Run the setup wizard:${RESET}"
say "  ${CYAN}su - $GRIP_USER -c 'cd $GRIP_DIR && bun run src/cli/index.ts setup'${RESET}"
echo
say "The wizard will:"
say "  ${DIM}• Ask for your site title, description and domain${RESET}"
say "  ${DIM}• Set your author passphrase${RESET}"
say "  ${DIM}• Initialise the database${RESET}"
echo
say "After the wizard, start GRIP:"
say "  ${CYAN}systemctl start grip${RESET}"
echo
say "Then point Caddy at it (see ${DIM}Caddyfile.example${RESET})."
echo
hr
echo
