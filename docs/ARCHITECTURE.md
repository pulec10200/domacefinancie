# Architecture

Electron main owns all privileged I/O. The sandboxed renderer calls DesktopApi through preload. Zod validates payloads inside services. SQLite stores financial records and persistent processing state in app.getPath('userData'). No local HTTP server or central service is started.

Core owns finance SQL. DocumentService owns archive/jobs SQL. Current composition is intentionally small. Future cross-module operations must use explicit service contracts instead of renderer queries. Main composes both services, native dialogs and running-app scheduler. Optional AI and network integrations are not required for the current workflows.

Date calculations use UTC ISO calendar dates. Current UI defaults also use UTC; local-date selection near midnight is a known limitation. Calendar recurrence anchors to the original day and clamps short months without drifting. Annual bills appear in their due month only. Payment allocations reduce remaining liabilities independently of transaction posting dates.

Document parsing currently runs in main with OCR worker threads. Moving PDF/QR work into a dedicated restricted worker is required before treating hostile-document isolation as complete.

BackupService writes a verified version-2 manifest and restores into profiles/<UUID>. An atomic active-profile.json pointer selects the restored database/archive at restart. Existing data is never overwritten; a crash before activation leaves the original profile active. Archived absolute paths are rebased through the document module before activation.
