# ADR 0001: Local modular monolith

Accepted 2026-11-13. Use Electron/React/TypeScript and SQLite with strict main/preload/renderer boundaries. Avoid a local HTTP server and cloud dependency. Native SQLite provides transactional durability; host-Node tests and Electron packaging need separate ABI rebuilds. Document jobs persist in the same database and recover on startup. Prefer immutable original archives and explicit user confirmation over irreversible automated writes. Remaining large modules will extend these contracts without rewriting core.
