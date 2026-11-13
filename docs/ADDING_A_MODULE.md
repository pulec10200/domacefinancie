# Adding a module

1. Inspect AGENTS.md, contracts and regression tests.
2. Define Zod schemas and typed operations in packages/contracts.
3. Add a versioned database migration and older-schema upgrade test.
4. Add a service in packages/modules with explicit dependencies on other public services.
5. Register a narrow, sender-validated IPC operation in main and expose it in DesktopApi/preload.
6. Add Slovak UI with error, pending and empty states.
7. Add persistence and behavior tests; run typecheck, lint, unit/integration and relevant Electron E2E checks.
8. Update architecture/API/status/changelog documentation. Do not refactor unrelated modules.
