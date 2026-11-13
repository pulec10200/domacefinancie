# ADR 0003 — Integrated domain, extraction and optional AI modules

Date: 2026-11-13. Status: accepted.

The first delivery must integrate finance, documents and automation while preserving the existing schema and service behavior. Migration 3 adds domain/extraction/AI tables without rewriting migrations 1/2. Shared primitives and typed contract modules avoid renderer SQL and allow additive future modules. Main coordinates cross-service confirmation in a transaction; DomainService consumes finance snapshots through callbacks.

OCR/QR/PDF work moves into a separate Electron embedded-Node child process. A serialized RPC queue, explicit deadlines, a JS heap cap and persistent SQLite jobs permit cancellation/restart without blocking the window. Native canvas is used instead of production libvips after an Electron child-process compatibility failure. This is process isolation and resource hardening, not an OS security boundary.

AI transports are injectable and schema-validated; output is only provenance-bearing suggestions. SecretStorage is injected and main binds it to secure OS storage. Provider-wide and per-document consent both apply, including fallback. Atomically reserved budgets constrain failed/retried calls. No default cloud configuration or automatic database upload exists.

Full backups restore into a new verified profile with atomic activation. Configurable external data location uses the same mechanism. Unique pre-migration SQLite snapshots add schema-upgrade recovery without replacing external document backups.

Consequences: one modular desktop product, testable offline, with simple explicit contracts; manual handling of genuinely missing/conflicting document fields; unsigned release candidates until the owner provides signing credentials; remote source connectors remain separate future adapters.
