# Changelog

## 0.1.0 — 2026-11-13
Initial local-first desktop implementation, core SQLite finance workflow, document archive/processing/confirmation, local OCR, folder source, notification scheduler and candidate packaging. Original full product requirements remain partially implemented; see STATUS.md. No hosted repository or public release has been created.

### Follow-up
Complete backup and GUI restore now validate checksums, database integrity and archived originals, preserve the current data profile, and activate a restored profile atomically. Corruption/path-traversal tests cover rejection without switching data. Connected hosting target: pulec10200/domacefinancie.

Packaged-runtime smoke testing revealed a missing libvips library in the initial ASAR layout. Native image/PDF and OCR worker/core packages are now explicitly unpacked. The packaged Linux executable passes account creation and real local-image OCR; equivalent Windows coverage runs in CI.
