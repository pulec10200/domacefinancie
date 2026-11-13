# Release process

Run tests, typecheck, lint, source build and relevant Electron E2E tests. Download/bundle OCR assets. Run scripts/build-linux.sh on Linux or scripts/build-windows.ps1 on Windows. Outputs are under release/. Create checksums with node scripts/checksums.mjs.

The GitHub Actions workflow builds artifacts on Linux and Windows. It does not publish a release or sign software. After clean-machine QA, manually create a GitHub Release and upload only installers and SHA256SUMS.txt. Do not publish a build solely because the workflow was green.

Windows signing: obtain an appropriate code-signing certificate or configure a supported trusted signing provider; supply CSC_LINK and CSC_KEY_PASSWORD only via protected CI secrets according to electron-builder documentation. Never commit certificates/passwords. Confirm the result with Windows signature verification before labeling it signed. Linux packages here are unsigned; detached signing may be added using a separately controlled release key.

Verify installation, offline first launch, upgrades preserving existing data and complete document backup restoration on clean Windows 10/11 and Ubuntu/Debian machines. Those checks remain pending. Development dependency audit findings need review before production release. Production dependency audit at implementation time reported zero known vulnerabilities; this is time-dependent, not a security guarantee.

Installer scripts explicitly pass --publish never. electron-builder 26 otherwise infers publishing in GitHub Actions and requests a release token. CI intentionally has read-only repository permissions and uploads candidate artifacts without publishing a release.
