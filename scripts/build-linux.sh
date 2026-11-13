#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
npm ci
npm run setup:ocr
npm test
npm run typecheck
npm run lint
npm run dist:linux
node scripts/checksums.mjs
