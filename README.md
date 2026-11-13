# Domáce Financie

Local-first household finance application for Windows and Linux. The interface is Slovak; engineering documentation is English.

**Development release 0.1.0. This is an initial implementation, not the complete product described in PRODUCT_REQUIREMENTS.sk.md.** See [actual implementation status](docs/STATUS.md).

Implemented: SQLite persistence and transactional migrations; accounts; income/expenses/transfers; recurring and one-off obligations; partial payments; current/next month dashboard; document archive and deduplication; persistent processing jobs; local image OCR and PDF text extraction with scanned-page OCR; manual document confirmation into payable or expense; folder watcher; running-app desktop notifications; verified backup creation and confirmed restoration preserving the old data profile.

## Run from source
Install Node.js 26 and Git. Linux native builds may require Python 3, make and a C++ compiler. Python is a development build tool only, not an application runtime.

```sh
npm ci
npm run setup:ocr
npm run dev
```

Internet is needed for the initial dependency/runtime/language downloads. OCR language assets are local and bundled with installers. No financial demo data is inserted. All amounts are EUR cents.

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
```
Linux headless desktop tests use `xvfb-run -a npm run test:e2e`. Windows packages must be built and tested on Windows. Tests contain synthetic data only.

## Your first GitHub project
Repository: https://github.com/pulec10200/domacefinancie. It was created by the owner as a public repository. Never add financial documents, databases, API keys or authentication files to Git.

For later changes, use Git to commit small reviewed changes and push to main or use pull requests. Source code and the build workflow belong in Git; generated installers belong in release artifacts.

## Documentation
- [Linux installation](docs/INSTALL_LINUX.md), [Windows installation](docs/INSTALL_WINDOWS.md)
- [Development](docs/DEVELOPMENT.md), [release](docs/RELEASE.md), [troubleshooting](docs/TROUBLESHOOTING.md)
- [Architecture](docs/ARCHITECTURE.md), [data model](docs/DATA_MODEL.md), [API](docs/API_CONTRACTS.md)
- [Document pipeline](docs/DOCUMENT_PIPELINE.md), [eKasa findings](docs/integrations/EKASA.md)
- [AI status](docs/AI_PROVIDERS.md), [remaining work](docs/STATUS.md)

No commercial license has been selected. Do not assume permission to redistribute third-party components without their licenses; dependency notices must be reviewed before commercial release.
