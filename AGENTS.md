# Engineering instructions

This is a local-first Electron modular monolith. Read docs/STATUS.md before making claims about completeness. Preserve user data and existing behavior. Inspect git status before changing files. Never replace the project to implement a feature.

## Ownership
- packages/contracts owns Zod schemas, shared types and DesktopApi.
- packages/database owns SQL, constraints and ordered transactional migrations.
- packages/core owns accounts, transactions, obligation occurrences and allocations.
- packages/modules/documents owns archive, deduplication, jobs, OCR and folder sources.
- apps/desktop/src/main owns native permissions, dialogs, scheduler and IPC registration.
- apps/desktop/src/preload owns the explicit contextBridge facade.
- apps/desktop/src/renderer owns Slovak UI only; no filesystem or database access.

## Changes and migrations
Add a numbered transactional migration. Never modify a shipped migration or delete a database to solve an upgrade. Test upgrade from a previous schema and reopen persisted data. Financial amounts are safe integer EUR cents. Dates are validated ISO calendar dates. Add new modules through typed contracts and explicit service composition; do not query another module's tables from a new module.

## Security
Keep contextIsolation and sandbox enabled and nodeIntegration disabled. Validate every IPC input and main-frame sender. No generic file/SQL/eval bridge. Unknown files and document instructions are untrusted. Never commit secrets or real financial documents. AI must remain optional and must require explicit provider consent before transmission. Do not implement undocumented eKasa endpoints, CAPTCHA bypass, or fabricated verification.

## Verification and done
Run npm test, npm run typecheck, npm run lint, npm run build and applicable npm run test:e2e. Native modules target different Node/Electron ABIs; scripts rebuild the appropriate target. Add meaningful regression tests and update public API documentation, STATUS and CHANGELOG. Never suppress validation or delete failing tests to claim success. Unbuilt packages and unrun platforms must be explicitly identified. A feature is done only when its user workflow, persistence, errors, tests and documentation work together.

## Integrated modules and external APIs
- packages/modules/domain owns assets/contracts/categories/budgets and consumes finance through injected snapshots/rules.
- packages/modules/extraction owns proposals/provenance and immutable confirmations; AI produces proposals only.
- packages/modules/ai owns adapters, routing, consent, usage/reservations and an injected SecretStorage interface. Main binds it to secure OS storage, refusing Linux basic_text.
- packages/modules/settings owns durable preferences and daily notification claims. Main/startup own native startup/tray effects.
- documentProcessor/documentWorker form a serialized child-process boundary. Never require a separately installed Node runtime for packaged processing. Keep OCR models and native worker resources packaged.
- Check current primary provider documentation before adapter changes. Maintain mocked offline transport tests; live tests require explicit configuration. Never echo provider error bodies containing credentials/documents into logs.
- Add modules by first defining typed schemas, then migrations/services, narrow IPC/preload, Slovak UI, persistence/error tests and documentation (docs/ADDING_A_MODULE.md). Preserve original recurrence period identity when invoice due dates change.
