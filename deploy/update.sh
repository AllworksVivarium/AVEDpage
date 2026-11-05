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
revision=$(git rev-parse HEAD)
stamp=.git/aved-deployed-revision
if [[ -f "$stamp" && "$(cat "$stamp")" == "$revision" ]] && \
   [[ -n "$(docker compose ps --status running -q web)" ]] && \
   curl -fsS --max-time 3 http://127.0.0.1:4173/api/health >/dev/null; then
    echo "AVED already serving $revision; no restart required."
    exit 0
fi
# A failed build or health check never records a successful deployment.
docker compose up -d --build
healthy=false
for attempt in {1..30}; do
    if curl -fsS --max-time 3 http://127.0.0.1:4173/api/health >/dev/null; then
        healthy=true
        break
    fi
    sleep 0.5
done
[[ "$healthy" == true ]] || { echo 'Deployment health check failed.'; exit 1; }
printf '%s\n' "$revision" > "$stamp"
