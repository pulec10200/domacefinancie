# Development

Use Node.js 26 and the committed package-lock.json. npm ci installs the Electron runtime and rebuilds native SQLite for Electron. npm test rebuilds SQLite for host Node; npm run test:e2e rebuilds it back for Electron. If starting development after unit tests, run `npx electron-builder install-app-deps` first.

Download OCR languages with npm run setup:ocr. Network is needed during setup, never to recognize a document once language files are present. Generated language manifest includes hashes and official tessdata download URLs. Packaged assets are copied to resources/ocr. Do not edit downloaded model bytes.

Commands: npm run dev, npm test, npm run typecheck, npm run lint, npm run build, npm run test:e2e. Headless Linux requires xvfb-run. E2E uses FINANCE_TEST_DATA with NODE_ENV=test to set an isolated temporary Electron userData directory before acquiring its single-instance lock.

No cloud credentials are needed. Source documentation is English; renderer strings are Slovak. CSS is currently handcrafted rather than Tailwind. This is a deliberate initial dependency reduction and may be replaced incrementally without changing service APIs.

Packaged runtime smoke testing: set FINANCE_PACKAGED_EXECUTABLE to the absolute built executable and run npm run test:packaged (under xvfb-run on headless Linux). The command refuses to fall back to development Electron. It checks app.isPackaged, creates an account through the isolated renderer and recognizes a synthetic image using bundled OCR assets. Native library and worker directories are explicitly unpacked from ASAR for filesystem-based runtime loading.

Version 1.0 adds a separate documentWorker main build entry. Keep its shared chunks packaged; document processing forks the installed Electron binary in Node mode. Do not replace it with a system Node dependency. image-size + native canvas are production image handling; sharp and qrcode are development-only synthetic fixture tools. Builds generate assets/legal/THIRD_PARTY_NOTICES.txt, bundle the OCR license and expose no cloud credentials. Additional installed tests cover folder invoice/reminder/restart and GUI backup restoration.
