# Linux installation

Download desktop-Linux from the latest successful Actions run and extract the ZIP. Compare SHA256SUMS.txt using `sha256sum -c SHA256SUMS.txt`. On Ubuntu/Debian, open the .deb with your software manager or run `sudo apt install ./domace-financie_1.0.0-rc.1_amd64.deb` in its directory. An AppImage alternative is provided: mark it executable and open it; FUSE compatibility depends on the distribution. Do not disable sandboxing as a workaround for system configuration problems.

Installed users do not need Node.js, Python or a compiler. Runtime OCR models are bundled. The workflow installs the .deb on ubuntu-24.04 and exercises the installed executable in a network namespace with loopback only, in addition to source/packaged checks. See VERIFICATION.md for the actual current result. AppImage FUSE mounting and other distributions are not covered by that test.

Data normally lives below ~/.config/domace-financie. Settings can move data into a fresh verified profile at another location. Never remove application data to fix a build error. Create a full backup on a separate disk before upgrades. Reminders require the app/background process to run. Linux cloud-key storage needs a working Secret Service or KWallet; insecure basic_text fallback is rejected. Local OCR/finance do not require keys.

Source development: install Git, Node.js 26, Python 3, make and g++; run `npm ci`, `npm run setup:ocr`, `npm run dev`. Build .deb/AppImage with `npm run dist:linux`. Native SQLite is rebuilt for the appropriate Node/Electron target by the test scripts.
