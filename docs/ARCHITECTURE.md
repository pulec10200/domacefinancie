# Architecture

Electron main owns native permissions and composition. A sandboxed renderer calls a narrow typed DesktopApi through contextBridge; main validates sender and payload. No local HTTP server or central service is required. SQLite WAL/foreign keys store one local household, financial history, document state and optional AI configuration.

## Ownership and dependencies

- contracts: primitives, Zod input schemas and Finance/Domain/Extraction/AI/Settings API types; source adapter configuration contracts.
- database: ordered migrations, upgrade safety snapshots, integrity checks and secret-free export.
- core: accounts, transactions, rules/changes, payable generation and allocations. Transfers are single ledger rows, never two independent posts.
- domain: assets, contracts, category hierarchy and budgets. It consumes finance snapshots and rule listings through injected public callbacks.
- documents: immutable archive, format/size validation, jobs, preview, QR/OCR, receipt item records and folder sources.
- extraction: field provenance, deterministic labelled proposals, AI suggestions and immutable user-confirmation events.
- ai: provider transports, strict output validation, configuration/routes, OS-secret interface, consent and budget enforcement. It cannot write finance tables.
- settings: preferences and notification claims. startup/main: native login/tray configuration and scheduling.
- backups: version-2 manifest, verified copy and atomic profile activation. Archive relocation uses the document service.

Main coordinates contract/document confirmation and service writes inside one SQLite transaction. It does not expose generic SQL, shell, filesystem or HTTP operations to the renderer. Existing legacy finance document-confirmation SQL is retained for compatibility; new integrations use document service operations.

DocumentProcessor forks Electron in embedded Node mode and communicates by bounded typed RPC. It restarts on demand after failure and marks interrupted jobs without losing originals. A single worker serializes parsing/preview; queue claims are immediate SQLite transactions across main/worker connections. OCR engine workers live inside this process. Pure JS image-size validation and native canvas decoding avoid libvips in the production process. This separation protects UI responsiveness, not OS privileges.

Dates are validated calendar ISO dates; local dates are used for defaults and reminders. Calendar recurrence computes every occurrence from its original day, clamping month ends without drift. Monetary writes are safe integer EUR cents; ledger guards reject precision overflow transactionally.

BackupService uses a verified manifest and a fresh UUID profile. Only an atomic active-profile.json pointer switches profiles. Prior data remains intact. External profiles support configurable data location; moving data creates a verified backup first. On migration, a separate SQLite safety snapshot preserves the previous schema; full off-device backups remain necessary.

See decisions/0003-integrated-modules.md for the module/extraction/AI/worker decisions, API_CONTRACTS.md for operation contracts, and STATUS.md for operational limits.
