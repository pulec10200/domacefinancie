# Public contracts

packages/contracts/index.ts defines DesktopApi, Zod inputs and response types.

- snapshot(): accounts with calculated balances, transactions, payables with paid totals, documents and two monthly summaries.
- addAccount(AccountInput): validates name, account type, EUR and integer opening amount.
- addTransaction(TransactionInput): positive cents, valid calendar date, account IDs, kind, request UUID. A request UUID is idempotent.
- addRule(RuleInput): name, amount, start/end and month interval (0 = once).
- pay(PaymentInput): records a transaction plus allocation atomically; overpayment is rejected.
- confirmDocument(ConfirmationInput): creates one payable or one expense and records document confirmation atomically.
- importDocument(), watchFolder(), backup(): paths come only from native dialogs.
- openDocument(id): UUID lookup into the managed archive; no arbitrary renderer path.
- openEkasa(): opens only the fixed official HTTPS verification URL.

Return values for mutation calls are intentionally ignored by renderer. Errors reject the promise and display a UI alert. There is no generic SQL, filesystem, shell, HTTP proxy or arbitrary IPC bridge.

- restoreBackup(): native backup-folder selection, checksum/DB integrity validation, explicit native confirmation, restore into a new preserved profile and application restart. Legacy version-1 manifests lack hashes and are rejected.
