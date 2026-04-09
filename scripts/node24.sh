#!/usr/bin/env bash
set -euo pipefail

# Avoid permission issues in ~/.npm cache by forcing a writable temp cache.
export npm_config_cache="/tmp/.npm-cache"

exec npx -y node@24 "$@"
