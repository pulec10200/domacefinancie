#!/usr/bin/env bash
set -euo pipefail
if [[ "${1:-}" == '--isolated' ]]; then
  ip link set lo up
  exec runuser -u "$2" --preserve-environment -- npm run test:packaged
fi
: "${FINANCE_PACKAGED_EXECUTABLE:?Set the installed executable}"
runner_user=$(id -un)
script=$(realpath "$0")
xvfb-run -a sudo env PATH="$PATH" DISPLAY="${DISPLAY:-}" XAUTHORITY="${XAUTHORITY:-}" FINANCE_PACKAGED_EXECUTABLE="$FINANCE_PACKAGED_EXECUTABLE" unshare --net bash "$script" --isolated "$runner_user"
