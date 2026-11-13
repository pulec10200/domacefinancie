# Troubleshooting

Native module ABI mismatch: `npm rebuild better-sqlite3` before host-Node tests; `npx electron-builder install-app-deps` before Electron launch. Never fix ABI errors by deleting user data.

Electron executable missing: run `npx install-electron`. npm 11/12 may request approval of native installation scripts; review the exact package before approving.

OCR languages missing: run `npm run setup:ocr` once online, then rebuild the installer. Failed OCR preserves the archived original. Use Spracovať znovu after fixing the cause; use Prerušiť spracovanie for a stuck running job. Never edit the database manually to discard errors.

Folder inaccessible: confirm it exists, is synchronized locally and is readable. Files still being copied wait for stabilization; unsupported files are ignored by folder scan.

No notifications: the application must be running and OS notifications allowed. Enable the optional tray mode to keep the app running after closing its window; fully quitting still stops reminders. Overdue items are visible at the next launch.

AI key storage unavailable: activate a supported OS keychain/session. The app refuses plaintext fallback. Local OCR/Ollama do not need cloud keys. A restored encrypted key can require re-entry on a different computer.

AI service unavailable: check the exact model ID, server/API access, schema capability and limits. No finance entry is created by a failed AI call; local processing remains usable.
