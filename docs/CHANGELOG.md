# Changelog

## 0.1.0 — 2026-11-13
Initial local-first desktop implementation, core SQLite finance workflow, document archive/processing/confirmation, local OCR, folder source, notification scheduler and candidate packaging. Original full product requirements remain partially implemented; see STATUS.md. No hosted repository or public release has been created.

### Follow-up
Complete backup and GUI restore now validate checksums, database integrity and archived originals, preserve the current data profile, and activate a restored profile atomically. Corruption/path-traversal tests cover rejection without switching data. Connected hosting target: pulec10200/domacefinancie.
