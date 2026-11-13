# Windows installation

Windows source execution and NSIS creation have been tested on a GitHub-hosted Windows runner. Clean-machine NSIS installation remains untested. The workflow also checks the packaged executable before uploading candidates.

When a verified NSIS .exe is available, download it, compare its SHA-256 against SHA256SUMS.txt and run it. Unsigned builds may display Windows security warnings; this project currently has no signing certificate.

From source on a development machine: install Git and Node.js 26 plus native build tools (Visual Studio Build Tools with C++ and Python for node-gyp when required). Open a terminal in the project and run `npm ci`, `npm run setup:ocr`, `npm run dev`. Build with `npm run dist:win`. Installed users do not require developer tools.

Application data belongs under the normal Electron userData folder in AppData, independent of the repository. Never delete this folder during an upgrade.
