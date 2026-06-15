#!/usr/bin/env bash
# =====================================================================
#  URL Shortener — Node Panel one-command installer (aaPanel / Ubuntu)
#
#  Usage (recommended — download then run, so prompts work):
#    curl -fsSL https://raw.githubusercontent.com/silent404s/url-shortener-node/main/install.sh -o install.sh
#    bash install.sh
#
#  Optional overrides via env:
#    REPO=...   PORT=3000   WEBROOT=/www/wwwroot
# =====================================================================
set -euo pipefail

REPO="${REPO:-https://github.com/silent404s/url-shortener-node.git}"
WEBROOT="${WEBROOT:-/www/wwwroot}"

c_green() { printf '\033[32m%s\033[0m\n' "$1"; }
c_red()   { printf '\033[31m%s\033[0m\n' "$1"; }
c_cyan()  { printf '\033[36m%s\033[0m\n' "$1"; }

c_cyan "== URL Shortener · Node Panel installer =="

# ---- 1. Prerequisites ----------------------------------------------
for cmd in git node npm openssl curl; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    c_red "ERROR: '$cmd' not found in PATH."
    echo   "Install Node.js 20 (with npm) + git first."
    echo   "On aaPanel: App Store > Node.js version manager, then open a new terminal."
    exit 1
  fi
done

if ! command -v pm2 >/dev/null 2>&1; then
  echo "pm2 not found — installing globally..."
  npm install -g pm2
fi

# ---- 2. Collect settings -------------------------------------------
read -rp "Domain for this panel (folder name, e.g. panel.example.com): " DOMAIN
[ -n "$DOMAIN" ] || { c_red "Domain is required."; exit 1; }

read -rp "Master URL [https://machdientu.de.com]: " MASTER_URL
MASTER_URL="${MASTER_URL:-https://machdientu.de.com}"

echo "License is OPTIONAL here — you can finish setup in the browser (/setup)."
read -rp "License Key (optional): " LICENSE_KEY
read -rp "License Secret (optional): " LICENSE_SECRET

read -rp "Local port for this panel [3000]: " PORT_IN
PORT_VAL="${PORT:-${PORT_IN:-3000}}"

TARGET="$WEBROOT/$DOMAIN"

# ---- 3. Clone or update --------------------------------------------
if [ -d "$TARGET/.git" ]; then
  echo "Existing install at $TARGET — updating..."
  git -C "$TARGET" pull
else
  echo "Cloning into $TARGET ..."
  git clone "$REPO" "$TARGET"
fi
cd "$TARGET"

# ---- 4. Dependencies -----------------------------------------------
echo "Installing dependencies..."
npm install --omit=dev

# ---- 5. Write .env --------------------------------------------------
SESSION_SECRET="$(openssl rand -base64 48)"
cat > .env <<EOF
NODE_ENV=production
PORT=$PORT_VAL
LOG_LEVEL=info
MASTER_URL=$MASTER_URL
MASTER_TIMEOUT_MS=20000
LICENSE_KEY=$LICENSE_KEY
LICENSE_SECRET=$LICENSE_SECRET
SESSION_SECRET=$SESSION_SECRET
SESSION_COOKIE=node_sid
SESSION_TTL_HOURS=24
OFFLINE_TOLERANCE_HOURS=24
PM2_NAME=node-$DOMAIN
APP_DIR=$TARGET
OTA_ENABLED=true
EOF
chmod 600 .env
c_green ".env written (SESSION_SECRET generated automatically)."

# ---- 6. Start with PM2 ---------------------------------------------
APP_NAME="node-$DOMAIN"
pm2 delete "$APP_NAME" >/dev/null 2>&1 || true
pm2 start src/server.js --name "$APP_NAME"
pm2 save

# ---- 7. Smoke test --------------------------------------------------
sleep 2
if curl -fsS "http://127.0.0.1:$PORT_VAL/login" >/dev/null 2>&1; then
  c_green "Panel is responding on 127.0.0.1:$PORT_VAL ✔"
else
  c_red "Panel not responding yet. Check logs: pm2 logs $APP_NAME"
fi

# ---- 8. Final manual step ------------------------------------------
echo
c_cyan "== Almost done — finish in the aaPanel UI =="
echo "1. Website > Add site: $DOMAIN  (PHP version: Static / Pure static)"
echo "2. Open the site > Reverse proxy > Add:"
echo "     Target URL : http://127.0.0.1:$PORT_VAL"
echo "     Send domain: \$host"
echo "3. SSL > Let's Encrypt > issue, then enable Force HTTPS"
echo
if [ -z "$LICENSE_KEY" ]; then
  echo "Then open:  https://$DOMAIN/setup   to finish setup in the browser"
  echo "            (enter your license, or register a new account)."
else
  echo "Then open:  https://$DOMAIN/   to sign in."
fi
echo
echo "Tip: run 'pm2 startup' once to keep the panel running after a reboot."
