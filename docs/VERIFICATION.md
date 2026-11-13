# Verification report — 2026-11-13

Actually executed in this Linux development environment:

- npm test: 23 tests passed in three suites. Includes money parsing, account balances, income/expense, idempotent transfers, calendar recurrence, annual bills, partial allocation/overpayment, invalid dates, persisted data reopening, version-1 to version-2 migration, SQLite backup reopening, image import/deduplication, invalid/empty files, job crash recovery, unsupported eKasa provider, invoice/receipt confirmation and a real offline OCR run with bundled Slovak/English models, complete database/archive restoration with path rebasing, checksum corruption rejection, traversal rejection and legacy-manifest rejection.
- npm run typecheck: passed.
- npm run lint: passed after correcting script globals.
- npm run build: passed.
- xvfb-run -a npm run test:e2e: one real Electron UI test passed (account creation and absence of renderer require), with isolated temporary userData.
- npm audit --omit=dev: zero known production vulnerabilities at check time. Full dependency installation reported 15 moderate development-tree findings; no unsafe force upgrade was applied.

Initial attempts exposed and corrected SQL placeholder errors, PDF.js API changes, renderer entry configuration, native ABI setup and E2E profile isolation. The first .deb build failed because homepage metadata was absent; candidate packaging was retried after configuration correction. Do not equate installer creation with installer QA.

Linux distribution candidates: npm run dist:linux successfully created .deb and AppImage; node scripts/checksums.mjs generated SHA-256 sums and scripts/verify-installation.sh verified both. These are unsigned development candidates; installation on a clean system remains untested.

Not performed: Windows runtime/NSIS build, clean-machine installation, signed release, clean-machine archive-restore UI QA, paid AI service tests or authorized automatic eKasa calls. Full original product acceptance has not passed. Current module gaps are listed in STATUS.md.

First GitHub Actions run: unit/integration tests (23), typecheck, lint, source build and Electron UI test passed on both ubuntu-24.04 and windows-2025. Installer creation reached .deb/AppImage and NSIS respectively, then electron-builder's implicit publishing failed due to the intentionally absent publication token. Scripts were corrected to use --publish never; a repeat CI run verifies final artifact upload.
