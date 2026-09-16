#!/usr/bin/env bash
set -euo pipefail

APP_NAME="notes-web"
RUN_USER="notes-user"
INSTALL_DIR="/opt/${APP_NAME}"
SERVICE_FILE="/etc/systemd/system/${APP_NAME}.service"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

die() {
  echo "error: $*" >&2
  exit 1
}

[ "$(id -u)" -eq 0 ] || die "must be run as root (e.g. sudo ./install.sh)"

NODE_BIN="$(command -v node || true)"
[ -n "$NODE_BIN" ] || die "Node.js (>=20) not found in PATH"

# Create dedicated system user (shared across applications).
if ! id "$RUN_USER" &>/dev/null; then
  useradd --system --shell /usr/sbin/nologin "$RUN_USER"
fi

# Deploy application files.
mkdir -p "$INSTALL_DIR"
cp -a \
  "$SCRIPT_DIR/dist" \
  "$SCRIPT_DIR/web" \
  "$SCRIPT_DIR/node_modules" \
  "$SCRIPT_DIR/package.json" \
  "$SCRIPT_DIR/package-lock.json" \
  "$INSTALL_DIR/"
chown -R "$RUN_USER:$RUN_USER" "$INSTALL_DIR"

# Generate the systemd unit once; preserve any manual edits on updates.
if [ ! -f "$SERVICE_FILE" ]; then
  sed "s|__NODE_BIN__|${NODE_BIN}|g" "$SCRIPT_DIR/notes-web.service" > "$SERVICE_FILE"
fi

systemctl daemon-reload
systemctl enable "$APP_NAME" >/dev/null
systemctl restart "$APP_NAME"
systemctl --no-pager --full status "$APP_NAME" || true

echo
echo "installed $APP_NAME at $INSTALL_DIR"
echo "override settings via: systemctl edit $APP_NAME"