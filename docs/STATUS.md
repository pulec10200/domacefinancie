# Actual implementation status

Date: 2026-11-13. Initial development implementation. The original three-phase product is not complete.

## Implemented
- React/TypeScript Slovak desktop UI with empty/loading/error states.
- Sandboxed Electron renderer, explicit bridge, input schemas, main-frame IPC restriction and CSP.
- SQLite WAL persistence, foreign keys, two versioned transactional migrations and audit events for core entity changes.
- EUR accounts, expenses, income, idempotent atomic transfers, integer monetary inputs.
- Monthly/quarterly/semiannual/annual and one-off obligation rules, month-end clamping, end dates, payable generation and partial payments.
- Current and next month actuals and unpaid obligations.
- PDF/image validation, 30 MB file limit, pixel limits, SHA-256 deduplication, immutable archive.
- Persistent jobs, restart recovery, local QR on images, manual eKasa state, local Slovak/English OCR and PDF text-first/scanned-page processing.
- User confirmation of documents into a payable or expense with idempotent linking. No automated financial writes from OCR.
- Local folder watcher with five-second write stabilization and periodic rescans; original source files stay intact.
- Notifications while app runs, once per payable per day at default reminder intervals and for overdue payments.
- Complete backup with SHA-256 manifest, SQLite/foreign-key integrity checks and archive validation; confirmed restore into a new profile with the original data preserved.

## Not implemented / not production complete
- Budget management, assets, separate contracts/insurance entities and their UI.
- Category hierarchy and editing/deleting/cancelling financial records.
- Household separation, non-EUR currencies, amount schedules/exceptions and invoice matching to an existing recurring obligation.
- AI adapters, provider/model configuration, secrets storage, routing, token limits and extraction confidence/provenance field model.
- Deterministic structured amount/date proposals: document confirmation currently requires manual entry from OCR/original.
- Side-by-side embedded document preview and correction history. Originals open using the OS viewer.
- Automatic authorized eKasa API, QR from PDF pages, receipt item reconciliation and field-level sources.
- Configurable reminder offsets, launch on login, tray/background mode and scheduler running while the app is closed.
- Retry controls, cancellation/time limits, isolated document processing worker and resource-hardening for hostile documents.
- Direct Google Drive, OneDrive, email, banking or cloud connectors.
- Windows execution, installer testing on clean Windows/Linux machines, signing and clean-machine GitHub distribution QA.
- Commercial license selection and complete third-party license bundle.

Dependencies are pinned in package-lock.json. Native dependencies require rebuild when switching Node tests and Electron. See the final verification report for actual commands run. Tests and source builds do not establish clean-machine installer compatibility.

Next implementation priorities: add structured extraction/provenance and matching; budgets/assets/contracts modules; AI adapters and consent routing; full offline pipeline E2E tests; Windows and clean-machine packaging QA.
