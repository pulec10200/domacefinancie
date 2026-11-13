#!/usr/bin/env bash
set -euo pipefail
if [[ "${1:-}" == '--isolated' ]]; then
  ip link set lo up
  exec runuser -u "$2" -- env PATH="$PATH" FINANCE_PACKAGED_EXECUTABLE="$FINANCE_PACKAGED_EXECUTABLE" xvfb-run -a npm run test:packaged
fi
: "${FINANCE_PACKAGED_EXECUTABLE:?Set the installed executable}"
runner_user=$(id -un)
script=$(realpath "$0")
sudo env PATH="$PATH" FINANCE_PACKAGED_EXECUTABLE="$FINANCE_PACKAGED_EXECUTABLE" unshare --net bash "$script" --isolated "$runner_user"
