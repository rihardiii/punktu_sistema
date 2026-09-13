#!/bin/sh
set -e

# TrueNAS bind-mounts a dataset into /data, and it arrives owned by whichever
# user owns that dataset on the host. Make sure the directory exists and is
# writable, then drop to an unprivileged user so the app never runs as root.
#
# If the container was already started as a non-root user (TrueNAS commonly
# uses `user: "568:568"`, the `apps` account), this does nothing and simply
# hands over — the dataset must then already be owned by that uid.

DB_DIR="$(dirname "${PUNKTI_DB:-/data/punkti.sqlite}")"
mkdir -p "$DB_DIR"

if [ "$(id -u)" = "0" ]; then
  if ! chown -R node:node "$DB_DIR" 2>/dev/null; then
    echo "[entrypoint] warning: could not chown $DB_DIR"
    echo "[entrypoint] if the app cannot write, fix the dataset owner or set user: in compose"
  fi

  if command -v setpriv >/dev/null 2>&1; then
    exec setpriv --reuid=node --regid=node --init-groups "$@"
  fi

  echo "[entrypoint] warning: setpriv not found, continuing as root"
fi

exec "$@"
