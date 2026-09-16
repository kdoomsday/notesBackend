#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VERSION="$(node -p "require('$ROOT/package.json').version")"
PKG_NAME="notes-web"
PKG_DIR="${PKG_NAME}-${VERSION}"
TARBALL="$ROOT/dist/releases/${PKG_NAME}-${VERSION}.tar.gz"

STAGE="$(mktemp -d)"
trap 'rm -rf "$STAGE"' EXIT

cd "$ROOT"

echo "==> building ($PKG_NAME $VERSION)"
npm run build

echo "==> staging archive"
mkdir -p "$STAGE/$PKG_DIR" "$ROOT/dist/releases"

cp -a dist "$STAGE/$PKG_DIR/dist"
cp -a web "$STAGE/$PKG_DIR/web"
cp package.json package-lock.json "$STAGE/$PKG_DIR/"
cp notes-web.service install.sh "$STAGE/$PKG_DIR/"

echo "==> installing production dependencies"
(
  cd "$STAGE/$PKG_DIR"
  npm ci --omit=dev --ignore-scripts --no-audit --no-fund
  chmod +x install.sh
)

echo "==> creating $TARBALL"
tar -C "$STAGE" -czf "$TARBALL" "$PKG_DIR"
shasum -a 256 "$TARBALL"

echo "==> done"
echo "deploy: extract $TARBALL on the target box and run: sudo ./install.sh"