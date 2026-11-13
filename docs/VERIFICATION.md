# Verification — 1.0.0-rc.1, 2026-11-13

**Final result: success on Linux and Windows.** [GitHub Actions run 43479699912](https://github.com/pulec10200/domacefinancie/actions/runs/43479699912) tested application source commit `1d4c42c8815e5567117b16e338d59e61fbd3f701`. Subsequent documentation-only commits do not change the tested application.

| Check | ubuntu-24.04 | windows-2025 |
| --- | --- | --- |
| Unit/integration tests | 59 passed, 7 suites | 59 passed, 7 suites |
| Typecheck, lint, build | Passed | Passed |
| Source desktop workflows | 4 passed | 4 passed |
| Packaged executable workflows | 4 passed | 4 passed |
| Actual package installation | .deb installed successfully | NSIS installed successfully |
| Installed executable workflows | 4 passed, external networking disabled | 4 passed |
| Distribution artifacts | .deb, AppImage, SHA-256, notices | NSIS .exe, SHA-256, notices |

The Linux installed test created a network namespace, enabled loopback only, switched to the ordinary runner user and started its virtual display within that namespace. All four workflows passed in 21.8 seconds. This proves the tested finance/OCR/import/restore/configuration flows do not require external internet; loopback is used by the test debugger. No live cloud AI request is part of these workflows.

## Tested behavior

The 59 tests cover balances, integer overflow rollback, idempotent transfers, annual/month-end recurrence, partial payments, previous-schema upgrade/reopening, real bundled offline OCR and missing-model failure/retry without original loss, QR results with injected eKasa adapters (Verified/NotFound/Unavailable), PDF text/preview, duplicates/invalid/incomplete files, restart recovery, retained originals, extraction conflicts/corrections, hierarchical budgets, asset/contract attribution, rule amount/skip history, actual invoice due dates without duplicate recurring periods, secret-free export, reminders, five mocked AI adapters, consent/fallback, invalid JSON/limits and complete/tampered/relocated backup restoration.

Each of the following runs from source, packaged executable and installed executable on both platforms:

1. Create account → image import → local OCR → explicit receipt confirmation → one expense and correct balance → repeat confirmation without duplication; sandboxed renderer exposes no require.
2. Watch folder → PDF invoice → amount/due-date proposals → original preview → user confirmation → payable/dashboard update → native reminder invocation → restart and retained data.
3. Native-dialog full backup → later account change → validated GUI restore into a new profile → restart → visible restored account and correct balance; original profile remains preserved.
4. Asset and linked contract → category hierarchy and budget → two AI configurations and explicit task route, no cloud consent or live API call.

## Local checks

npm test, typecheck, lint, format:check and build passed locally. Linux .deb/AppImage builds and SHA-256 verification passed. All four final packaged Linux workflows passed (21.2 seconds); restoration also passed five consecutive focused repetitions after correcting test startup/teardown coordination. Tests use disposable profiles and synthetic documents only.

npm audit --omit=dev reported **0 known production dependency vulnerabilities** at check time. Installation reported 15 moderate development-tree findings; no force upgrade was applied. Dependency advisories are time-dependent.

## Practical limits

- Live paid AI requests were not performed; deterministic transports intentionally require no subscription. Actual model availability, access and provider billing require explicit user configuration.
- Authorized automatic eKasa calls were not performed. Production uses official manual verification, separate user attestations and local OCR; injected verification responses do not claim real Financial Administration verification.
- E2E captures native notification invocation; service tests verify durable eligibility/deduplication. Actual desktop delivery also depends on OS notification permissions and a running app.
- These are Windows Server/Ubuntu hosted-runner installations. No exhaustive Windows 10/11 hardware matrix, other Linux distribution matrix or AppImage FUSE-mount qualification is claimed. Existing-schema migration is tested, not every installer/OS upgrade path.
- Installers are unsigned. No certificate or external commercial/license audit was supplied. Document parsing has process/heap/time/page/pixel limits, not an OS security sandbox.

Downloads: [Windows artifact](https://github.com/pulec10200/domacefinancie/actions/runs/43479699912/artifacts/14064667713), [Linux artifact](https://github.com/pulec10200/domacefinancie/actions/runs/43479699912/artifacts/14064204557). These are Actions artifact ZIPs; extract before installation. If retention expires, rerun the workflow from the repository.
