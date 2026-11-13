# Domáce Financie

Local-first household finance application for Windows and Linux. Slovak interface, local SQLite database and bundled Slovak/English OCR. **Integrated release candidate 1.0.0-rc.1**, unsigned.

Accounts, income/expenses/transfers, categories/budgets, assets, contracts/insurance, recurring obligations and partial payments; current/next month cash flow; document archive, QR/OCR, editable sourced suggestions and invoice matching; optional multi-provider AI with consent, encrypted keys and task routing; automatic folder imports, reminders/background mode; verified backup/restore and export.

No cloud account or AI key is required. Automatic eKasa is not enabled: official manual verification, separate user attestations and local OCR are provided. See [actual status and boundaries](docs/STATUS.md), [verification evidence](docs/VERIFICATION.md) and [eKasa findings](docs/integrations/EKASA.md).

## Install

Open the latest successful [GitHub Actions build](https://github.com/pulec10200/domacefinancie/actions), then download **desktop-Windows** or **desktop-Linux** under Artifacts. Extract the ZIP; choose the NSIS .exe on Windows or .deb/AppImage on Linux. Installed users do not need Node.js, Python or a compiler. Follow the [Slovak first-use guide](docs/FIRST_USE.sk.md), [Windows](docs/INSTALL_WINDOWS.md) or [Linux](docs/INSTALL_LINUX.md) instructions. Check SHA256SUMS.txt; unsigned builds can trigger OS warnings.

## Run from source

Install Git and Node.js 26. Native development builds may require Python 3 and a C++ compiler (Visual Studio Build Tools on Windows, make/g++ on Linux).

```sh
npm ci
npm run setup:ocr
npm run dev
```

Internet is needed for initial dependency/runtime/language downloads. Installed OCR works offline. No financial demo data is inserted. All finance amounts are EUR cents.

## Validate and build

```sh
npm test
npm run typecheck
npm run lint
npm run build
npm run test:e2e
npm run dist:linux
# On Windows:
npm run dist:win
node scripts/checksums.mjs
```

Headless Linux uses `xvfb-run -a npm run test:e2e`. Tests are synthetic. Native SQLite switches ABI between Node tests and Electron; scripts rebuild the correct target. After `npm test`, run `npx electron-builder install-app-deps` before development. Packaged tests require an explicit FINANCE_PACKAGED_EXECUTABLE and never substitute source Electron. CI also installs candidates and runs the same workflows from the installed executable.

## Documentation and future changes

- [First use in Slovak](docs/FIRST_USE.sk.md), [AI configuration](docs/AI_PROVIDERS.md), [synced folders](docs/integrations/LOCAL_FOLDERS.md)
- [Development](docs/DEVELOPMENT.md), [release](docs/RELEASE.md), [troubleshooting](docs/TROUBLESHOOTING.md)
- [Architecture](docs/ARCHITECTURE.md), [data model](docs/DATA_MODEL.md), [API](docs/API_CONTRACTS.md), [adding a module](docs/ADDING_A_MODULE.md)
- [Document pipeline](docs/DOCUMENT_PIPELINE.md), [changelog](docs/CHANGELOG.md), [original requirements](docs/PRODUCT_REQUIREMENTS.sk.md)

Read AGENTS.md before changing code. Keep financial documents, databases, credentials and authentication files out of this public repository. API keys use secure OS storage; full backups contain private documents and must be protected. No commercial application license was selected on the owner's behalf. Dependency/Electron/OCR notices accompany builds; see docs/RELEASE.md for distribution limits.
