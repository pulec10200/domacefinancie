# Verification — 1.0.0-rc.1, 2026-11-13

## Executed locally on Linux

- npm test: **59 tests passed in 7 suites**. Coverage includes balances, integer overflow rollback, transfers/idempotence, annual/month-end recurrence, partial payments, previous-schema upgrade/reopening, real offline OCR and missing-model failure/retry without original loss, QR results (Verified/NotFound/Unavailable) with injected eKasa adapters, PDF text/preview, duplicates/invalid/incomplete files, restart recovery, retained originals, extraction conflicts/corrections, hierarchical budgets, asset/contract attribution, rule amount/skip history, actual invoice due dates without duplicate recurring periods, secret-free export, reminders, five mocked AI adapters, consent/fallback, invalid JSON and limits, complete/tampered/relocated backup restoration.
- npm run typecheck, npm run lint and npm run format:check: passed.
- npm run build: passed, including generated production dependency notices.
- Four source Electron workflows passed: account/receipt OCR and idempotent confirmation; watched PDF invoice → proposals/preview → payable → dashboard/reminder → restart persistence; native-dialog backup/restore with fresh-profile activation. The fourth workflow creates assets/contracts, a category hierarchy/budget and two AI configurations with explicit routing and no cloud consent.
- Linux packaged execution passed all four workflows (21.1 seconds). .deb and AppImage were built, and both SHA-256 checks passed. The final missing-model preflight change is covered by its regression test. A later repeat exposed a test teardown race after successful restore assertions: the test closed the new window before renderer startup completed. Waiting for visible restored account UI fixed it; five consecutive restore runs passed.
- npm audit --omit=dev: **0 known production dependency vulnerabilities** at check time. Installation reported 15 moderate development-tree findings; no force upgrade was applied.

## Remote/installed verification

The previous 0.1.0 [run 43419601569](https://github.com/pulec10200/domacefinancie/actions/runs/43419601569) passed Linux/Windows builds and packaged OCR, but does not validate the new version. The 1.0.0-rc.1 workflow adds the full desktop workflows and actual .deb/NSIS installation; Linux installed execution is isolated from external networking. Initial integrated run 43476970152 passed service/type/lint checks and three desktop workflows on both platforms, but failed the restore test teardown race described above. Run 43477827525 passed source and packaged Linux workflows, but its installed test selected a documentation directory with the same basename instead of the executable. Installer discovery now requires a regular executable file. Final installed results are recorded after completion. Configured checks alone are not evidence of a pass.

## Limits

Paid/live AI calls were not performed; deterministic transports are intentional and require no API subscription. Authorized automatic eKasa calls were not performed; the production adapter uses manual official verification and OCR. Native notification invocation is captured in E2E while durable eligibility/deduplication is covered by service tests; OS permission settings and desktop delivery vary. Tests run in disposable profiles and do not modify personal finance data.

No signing certificate, broad Windows 10/11 hardware matrix, other Linux distribution matrix or AppImage FUSE qualification is claimed. Windows Server/Ubuntu runner installation and genuine old-schema migration provide specific evidence rather than universal OS compatibility. No external legal/commercial license audit is claimed.
