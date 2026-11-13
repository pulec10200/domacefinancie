#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../release"
sha256sum -c SHA256SUMS.txt
printf '%s\n' 'Checksums passed. Manually verify first launch, offline OCR, persistence and upgrade on a clean machine.'
