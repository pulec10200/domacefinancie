# Windows installation

Download desktop-Windows from the latest successful Actions run, extract the ZIP and verify SHA256SUMS.txt with `Get-FileHash -Algorithm SHA256 '<installer.exe>'` or scripts/verify-installation.ps1. Run the NSIS installer and select your installation location. Node.js/Python/build tools are not required for installed users. Builds are unsigned; no verified publisher identity is claimed.

The workflow builds on windows-2025, tests source and unpacked executables, installs the NSIS package into a disposable directory and repeats the desktop workflows from that installed executable. This is Windows Server runner evidence, not exhaustive Windows 10/11 hardware qualification. See VERIFICATION.md for the actual result of the current run.

Data is under the normal Electron userData directory in AppData, independent of installation/source. Never delete it during upgrade. In Settings, create a verified backup before updating. Install the new version over the old application; schema upgrades preserve records and create a SQLite safety snapshot. Keep full database/archive backups on a separate protected disk. Optional API keys may require re-entry if moved to another computer.

Source development requires Git, Node.js 26 and C++/Python build tools when native compilation is needed. Run `npm ci`, `npm run setup:ocr`, `npm run dev`; build with `npm run dist:win`. See FIRST_USE.sk.md for normal use.
