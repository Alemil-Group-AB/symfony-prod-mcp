#!/usr/bin/env bash
set -euo pipefail

# Simple helper to install the remote runner.
# Run this on the production server as root (or with sudo).

SRC_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
install -m 0755 "${SRC_DIR}/symfony-diag" /usr/local/bin/symfony-diag

if [[ ! -f /etc/symfony-diag.env ]]; then
  install -m 0640 "${SRC_DIR}/symfony-diag.env.example" /etc/symfony-diag.env
  echo "Created /etc/symfony-diag.env (edit it to match your app path)."
else
  echo "/etc/symfony-diag.env already exists; not overwriting."
fi

echo "Installed /usr/local/bin/symfony-diag"
