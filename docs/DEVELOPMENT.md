# Development

Use Node.js 26 and the committed package-lock.json. npm ci installs the Electron runtime and rebuilds native SQLite for Electron. npm test rebuilds SQLite for host Node; npm run test:e2e rebuilds it back for Electron. If starting development after unit tests, run `npx electron-builder install-app-deps` first.

Download OCR languages with npm run setup:ocr. Network is needed during setup, never to recognize a document once language files are present. Generated language manifest includes hashes and official tessdata download URLs. Packaged assets are copied to resources/ocr. Do not edit downloaded model bytes.

Commands: npm run dev, npm test, npm run typecheck, npm run lint, npm run build, npm run test:e2e. Headless Linux requires xvfb-run. E2E uses FINANCE_TEST_DATA with NODE_ENV=test to set an isolated temporary Electron userData directory before acquiring its single-instance lock.

No cloud credentials are needed. Source documentation is English; renderer strings are Slovak. CSS is currently handcrafted rather than Tailwind. This is a deliberate initial dependency reduction and may be replaced incrementally without changing service APIs.
