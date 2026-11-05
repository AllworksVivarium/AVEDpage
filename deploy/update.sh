#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."
exec 9>.git/aved-update.lock
flock -n 9 || exit 0
[[ "$(git branch --show-current)" == main ]] || { echo 'Update stopped: checkout must be on main.'; exit 1; }
[[ -z "$(git status --porcelain --untracked-files=no)" ]] || { echo 'Update stopped: tracked files have local edits.'; exit 1; }
git fetch origin main
if [[ "$(git rev-parse HEAD)" != "$(git rev-parse origin/main)" ]]; then
    git merge --ff-only origin/main
fi
# Repeat the build on each run, so a previous failed build is retried.
docker compose up -d --build
