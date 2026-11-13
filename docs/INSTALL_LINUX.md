# Linux installation

This is a development build. Clean Ubuntu/Debian installation has not been tested.

For a built .deb, install through your software manager or run `sudo apt install ./domace-financie_0.1.0_amd64.deb` in the folder containing it. For AppImage, mark the file executable and open it. AppImage may need your distribution's FUSE compatibility package. Do not disable sandboxing to work around system configuration errors; diagnose user-namespace/sandbox support instead.

Source development: install Git, Node.js 26, Python 3, make and g++; open this repository folder, then run `npm ci`, `npm run setup:ocr`, `npm run dev`. Python/compiler are needed for native dependency compilation, not for installed application users.

App data normally lives below ~/.config/domace-financie. Always back up before upgrades. Do not remove that folder to fix a build error. Reminder delivery requires the application to be running.
