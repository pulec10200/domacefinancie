# Public contracts

packages/contracts/index.ts composes DesktopApi from finance, domain, extraction, AI and settings interfaces. Inputs are Zod-validated at main/service boundaries. Mutation errors reject their promise and are displayed in the Slovak UI. Money is integer cents, dates are real ISO calendar dates and identifiers are UUIDs.

| API group | Public operations and behavior |
| --- | --- |
| Finance | snapshot; add/update/archive account; add/update/void/restore transaction; addRule, changeRule, stopRule; pay, cancelPayable. Snapshots expose calculated account balances, active transactions plus retained history, payables/paid totals and current/next month summaries. A requestId makes posts/payments idempotent. |
| Domain | domainSnapshot, saveAsset, saveContract, saveCategory, saveBudget, archiveEntity. Upserts accept optional IDs. Archiving can be reversed. Category cycles and impossible contract periods are rejected. |
| Confirmation | confirmDocument creates a payable/expense or matches an existing expected payable; confirmContract creates an independent contract and optional rule atomically. documentId is the idempotency boundary. Running documents must be cancelled or finish first. |
| Extraction | extractions, previewDocument(documentId,page), retryDocument, cancelDocument; receiptItems/saveReceiptItems; recordManualVerification. Original field values remain immutable; confirmations append history. Manual eKasa attestation never becomes automatic Verified status. |
| AI | aiState (no secret), saveAI, saveAIRoute, testAI (synthetic text only), runDocumentAI(documentId,task,approvedProviders). Each selected cloud provider, including fallback, requires configuration consent and explicit document approval. Strict AI output only creates proposals. |
| Preferences | settings, savePreferences, chooseDataDirectory. Login startup availability is explicit; data movement uses native confirmation and a verified fresh profile. |
| Native file actions | importDocument/watchFolder/backup/exportData/restoreBackup use native dialogs. openDocument resolves a known UUID into the archive; openEkasa opens a fixed official HTTPS URL. Restore requires native confirmation and restarts. |

There is no generic SQL, filesystem, shell, eval, HTTP proxy or arbitrary IPC bridge. Preload exposes only the methods listed in DesktopApi; sender validation permits only the active main frame. Native paths never come from untrusted document instructions.

Future DocumentSourceAdapter contracts live in contracts/sources.ts. Only LocalFolderSource is implemented; remote accountReference/folder IDs do not imply an authorized live connector.
