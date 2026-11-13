# eKasa investigation

Checked 2026-11-13. No undocumented endpoint was implemented.

Official sources:
- Current law version effective 2026-02-28: https://static.slov-lex.sk/static/SK/ZZ/2025/384/20260228.html
- Financial Administration manual verification guidance: https://podpora.financnasprava.sk/437196-Over-doklad
- Official verification application linked from that guidance: https://opd.financnasprava.sk/

Section 18(11) requires an verifier to notify the Financial Directorate of the accessing IP address before use, submit truthful verification results, and comply with published service/communication conditions. Section 19(6) defers the authority's procedure under 18(11) until a date specified and published by the Directorate. The commencement date and complete current automation conditions have not been established by this investigation; do not infer blanket authorization or a currently enforceable registration procedure from 18(11) alone.

Public consumer verification is documented. A supported third-party automation API, authentication/registration procedure, independent desktop licensing, rate limits and item-level access were not confirmed in the reviewed sources. This is not proof that such access does not exist. Obtain current official technical documentation and applicable service conditions before enabling an automatic adapter.

Implemented: EkasaProvider typed interface; ManualEkasaProvider always reports RequiresManualVerification; local QR extraction on images and PDF page rasters; fixed official URL for manual verification; independent OCR fallback. QR, service response and OCR are retained separately in receipt_details. User manual-check attestations (matched/not_found/mismatch) are retained in extraction confirmation history and do not overwrite automatic eKasa status. Decoded QR never establishes authenticity. Offline tests cover Verified, NotFound and Unavailable adapter results and disagreement between verified and OCR totals; those fixtures are not live Financial Administration responses.

Activation prerequisites: confirm authoritative service terms and commencement notice; obtain supported endpoint/authentication and registration requirements; resolve dynamic client IP handling; document limits and item availability; add transport tests and consent controls. No CAPTCHA bypass, scraping of internal APIs or proxy rotation is allowed.
