# Data model

Migration 1: accounts, transactions, obligation_rules, payables, payment_allocations, documents, processing_jobs, notifications, settings, audit_events. Migration 2: document_confirmations.

Accounts have integer opening balances. Each transfer is one transaction referencing a distinct destination account; reporting derives both sides. Financial inputs must be safe integers. Payment allocation references one expense transaction and one payable, with an atomic remaining-amount guard. Recurrences are idempotent by (rule_id, due). Document import is idempotent by content SHA-256; confirmation is idempotent by document_id. All entities use UUIDs except migration versions and audit sequence numbers.

Documents are independent of payables and transactions. Their confirmation link stores the generated entity ID; this polymorphic ID does not yet have a foreign-key constraint. Household, budget, asset, contract and extraction schemas remain pending; do not claim the requested complete entity model exists.

Migrations are transactional and reject newer unknown schema versions. No migration deletes user data. Back up before future migrations and test older-schema fixtures.
