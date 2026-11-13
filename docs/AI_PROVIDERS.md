# Optional AI providers

Local OCR and all finance workflows run without AI. No provider is configured by default. The application never sends the whole database. AI currently receives only the recognized text of the selected document; its output is validated and remains an editable proposal.

## Configure in the Slovak UI

1. Open **AI modely**, choose provider and enter a configuration name and an exact model ID available to your account/server. Model IDs are deliberately not guessed or hardcoded.
2. For cloud providers, enter your API key and explicitly permit sending data. For Ollama use a loopback URL such as http://localhost:11434; compatible APIs accept loopback HTTP or HTTPS. Non-loopback insecure HTTP and URLs containing credentials/query/fragment are refused.
3. Set structured-output capability, timeout, attempts, output-token cap and total token budget. Optionally enter input/output prices in EUR micro-units per million tokens and a total cost budget. A price budget requires both prices. Prices are user-supplied estimates, not live provider quotes.
4. Save, then test using the synthetic non-personal invoice. A live test is a real provider request and can incur its configured usage. No such paid request is run by the automated tests.
5. Assign primary and optional fallback models to each task. Multiple providers/configurations can coexist. Fallback is off unless explicitly enabled.
6. In **Dokumenty**, select the task, check the displayed provider chain and explicitly approve sending this document's text before running AI. The same approval must cover every cloud fallback recipient. Review the source/amount/date and confirm manually.

Tasks: classification, contract extraction, receipt items, financial analysis and summary. Current analysis is scoped to the selected document, never an undisclosed database export. Contract details without reliable proposals remain manual fields.

## Secrets and limits

Electron safeStorage encrypts secrets using the OS facility. Linux basic_text/no keychain is explicitly rejected; configure a working Secret Service/KWallet session. Windows uses the OS-backed facility. Keys never return to renderer state/export and are not logged. Keys restored on a different computer may require re-entry. Full backups contain encrypted secrets and sensitive documents; store backups on a protected separate disk.

Before every attempt, token/cost reservations are made atomically. Known response usage reconciles reservations; unknown usage and failed/ambiguous requests retain conservative reservations. Retryable transient HTTP errors can retry up to the configured cap. This may count more than a provider bills, avoiding an unbounded retry loophole. Remote tokenizers, hidden reasoning and price changes mean these are guardrails, not an exact bill. No automatic reset of limits occurs; increase the configured budget explicitly if needed.

## Implemented transports (checked 2026-11-13)

| Provider | Protocol |
| --- | --- |
| OpenAI | POST /v1/responses, text.format JSON schema, strict output, store:false |
| Anthropic | POST /v1/messages, anthropic-version 2026-10-21, output_config.format JSON schema |
| Gemini | POST /v1beta/interactions, Api-Revision 2026-05-20, response_format JSON schema, store:false |
| Ollama | POST /api/chat, format schema, stream:false |
| OpenAI compatible | POST /chat/completions under configured base URL, strict response_format JSON schema |

Official references: [OpenAI structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs?api-mode=responses), [Anthropic Messages](https://platform.claude.com/docs/en/api/messages/create), [Gemini structured output](https://aistudio.google.com/docs/structured-output), [Ollama chat](https://docs.ollama.com/api/chat). API/model availability can change; failures are surfaced without financial writes. A compatible server must actually support the schema format.

Tests inject deterministic transports for all five adapters, routing/fallback, missing keys, invalid JSON, budgets, consent denial and untrusted document instructions. No tools/actions are supplied to any provider, and document text cannot change app permissions. Live provider interoperability remains dependent on the user's chosen model, access and explicit configuration.
