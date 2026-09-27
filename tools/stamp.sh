#!/usr/bin/env bash
# Stamp every local <script src> with a content hash so no browser ever runs stale JS.
# Run it after editing any .js; deploy.sh runs it too.
set -euo pipefail
cd "$(dirname "$0")/.."
for js in $(grep -o 'src="[^"?]*\.js' index.html | sed 's/src="//'); do
  v=$(md5sum "$js" | cut -c1-8)
  sed -i "s|src=\"$js\(?v=[0-9a-f]*\)\?\"|src=\"$js?v=$v\"|" index.html
done
grep -o 'src="[^"]*"' index.html | sed 's/src=//'
