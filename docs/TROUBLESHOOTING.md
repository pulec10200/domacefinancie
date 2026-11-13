# Troubleshooting

Native module ABI mismatch: `npm rebuild better-sqlite3` before host-Node tests; `npx electron-builder install-app-deps` before Electron launch. Never fix ABI errors by deleting user data.

Electron executable missing: run `npx install-electron`. npm 11/12 may request approval of native installation scripts; review the exact package before approving.

OCR languages missing: run `npm run setup:ocr` once online, then rebuild the installer. Failed OCR preserves the archived original. Source processing retries are not exposed in the GUI yet; create a backup before any manual database maintenance.

Folder inaccessible: confirm it exists, is synchronized locally and is readable. Files still being copied wait for stabilization; unsupported files are ignored by folder scan.

No notifications: the application must be running and OS notifications allowed. No background service exists. Overdue items are visible at the next launch.

GitHub integration: the connected plugin returned Unknown tool during initial setup. Local code is unaffected. README describes first repository creation and push.
