#!/usr/bin/env bash
set -euo pipefail

# Simple wrapper to run gitleaks locally if available, else use docker
if command -v gitleaks >/dev/null 2>&1; then
  echo "Running gitleaks (local binary)..."
  gitleaks detect --source . --verbose
else
  echo "Running gitleaks via Docker..."
  docker run --rm -v "$(pwd)":/path zricethezav/gitleaks:latest detect --source=/path --verbose
fi
