# Implementation status — 1.0.0-rc.1

Updated 2026-11-13. The three requested product phases are integrated into one local desktop application. This is an unsigned release candidate; platform-specific validation evidence is recorded in VERIFICATION.md.

## Delivered modules

- Finance: EUR accounts, income, expenses, atomic idempotent transfers, editable records, reversible transaction cancellation and account archiving, category hierarchy, monthly category budgets including descendants.
- Assets: property, vehicles, financial/other assets, identifiers, ownership and values; linked contract and transaction costs/income.
- Contracts: independent insurance/loan/rental/service records, original document links, insurance period, anniversary, premium due, notice period and insured amount. Optional obligation creation when confirming a contract document.
- Obligations: one-off, monthly, quarterly, semiannual, annual and custom month intervals; end dates, future amount changes and per-occurrence exceptions; planned income; partial payment allocations; unpaid cancellation and future-rule stopping. Matching an invoice to an expected payable replaces the estimate without creating a duplicate.
- Dashboard: current/next month actuals, expected income, mandatory/unpaid expenses, overdue liabilities and projected balance; upcoming items and document-review count.
- Documents: immutable SHA-256 archive, duplicates, folder watcher/rescans, persistent jobs and restart recovery; PDF text-first and scanned multi-page OCR, image QR and PDF page QR; bundled local Slovak/English recognition; preview beside editable suggestions, sources, conflicts, user correction history and receipt item reconciliation. Confirmation is required for financial writes.
- AI: OpenAI, Anthropic, Gemini, Ollama and compatible endpoint adapters; multiple configurations, task routing, optional approved fallback, strict JSON validation, timeouts/attempts, token/cost reservation and usage. OS-encrypted keys; insecure plaintext fallback is refused. Local processing remains the default.
- Automation: configurable reminder intervals, daily deduplication, overdue handling, optional background tray and launch at login. Reminders require a running application; missed liabilities remain visible after startup.
- Data: three transactional migrations, automatic pre-upgrade SQLite safety copy, full JSON export without keys, complete verified database/archive backup and GUI restoration into a new profile preserving originals; configurable data location.
- Delivery: Linux .deb/AppImage and Windows NSIS build scripts, CI, packaged/installed application test commands, checksums, dependency license notices and engineering/user documentation.

## Explicit boundaries

- Automatic eKasa access is not enabled: supported third-party terms/API could not be confirmed. The permitted alternative is implemented: typed adapter, official manual verification, user attestation recorded separately, and complete local OCR fallback. A QR code alone is never marked Verified. See integrations/EKASA.md.
- Real paid AI requests require the user's own model IDs, credentials and explicit consent. Adapters are tested with deterministic offline transports; no live cloud qualification or billing accuracy guarantee is claimed. Costs use user-entered prices and conservative reservations when usage is unknown.
- Remote Drive/OneDrive/email connectors and banking are future integrations. Synced local folders work now; independent source configuration contracts exist without fake functional UI.
- One local household and EUR are supported. Future household boundaries are modeled; multi-user authentication and currency conversion are out of scope.
- Document processing has a separate process, heap/time/page/pixel limits and cancellation. It is not an operating-system security sandbox. Only import documents you intend to process; a parser exploit is not ruled out by these controls.
- No signing certificate was supplied. Installers are unsigned. Public commercial licensing, signing and broader hardware/distribution QA remain release-owner decisions, not hidden product features.
