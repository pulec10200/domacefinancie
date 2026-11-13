# Document pipeline

Native selection or stabilized local-folder detection → file type/size validation → content hash → archive copy → transactional document/job insert → persistent queue → PDF text first or local image QR → manual eKasa state for decoded image QR → local OCR when required → needs_review → user-entered confirmed amount/date → payable or expense → completed.

Original bytes remain in Archive. Duplicate imports return the existing ID. Jobs in running state return to pending on startup. Processing errors preserve originals and create a failed state with a readable reason. Failed jobs currently have no UI retry control. An orphan archive file after a crash is reused only after its hash matches.

PDF text is extracted page by page, with scanned pages rasterized locally through @napi-rs/canvas and passed to Tesseract. Limits: 100 PDF pages, 12 million raster pixels per PDF page and 40 million image pixels. Images support PNG/JPEG/WebP. QR decoding currently covers images only. Confidence and extraction provenance are not yet stored as structured fields.

Folder mode supports externally synchronized Google Drive/rclone folders without accessing cloud accounts. Linux users may configure rclone copy from a remote to a dedicated local inbox; do not use destructive sync or delete flags. Verify your sync configuration separately. The application neither configures nor requires rclone. A rescan retries source imports and handles missed watcher events.

Automatic financial records are never created merely by OCR. User confirmation is required; one document can currently create only one financial record. Existing recurring bills are not automatically matched yet.
