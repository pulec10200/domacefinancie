import Database from "better-sqlite3";
export function openDatabase(path: string) {
  const db = new Database(path);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.pragma("busy_timeout = 5000");
  db.exec(
    "CREATE TABLE IF NOT EXISTS schema_migrations(version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL)",
  );
  const current = (
    db
      .prepare("SELECT COALESCE(MAX(version),0) AS v FROM schema_migrations")
      .get() as { v: number }
  ).v;
  if (current > 2) throw Error("Database is newer than this application");
  if (current < 1)
    db.transaction(() => {
      db.exec(`
 CREATE TABLE accounts(id TEXT PRIMARY KEY,name TEXT NOT NULL,type TEXT NOT NULL,currency TEXT NOT NULL CHECK(currency='EUR'),opening INTEGER NOT NULL);
 CREATE TABLE transactions(id TEXT PRIMARY KEY,account_id TEXT NOT NULL REFERENCES accounts(id),target_id TEXT REFERENCES accounts(id),kind TEXT NOT NULL CHECK(kind IN ('income','expense','transfer')),amount INTEGER NOT NULL CHECK(amount>0),date TEXT NOT NULL,description TEXT NOT NULL,category TEXT NOT NULL,request_id TEXT NOT NULL UNIQUE,CHECK(kind!='transfer' OR (target_id IS NOT NULL AND target_id!=account_id)));
 CREATE TABLE obligation_rules(id TEXT PRIMARY KEY,name TEXT NOT NULL,amount INTEGER NOT NULL CHECK(amount>0),start TEXT NOT NULL,end TEXT,interval INTEGER NOT NULL);
 CREATE TABLE payables(id TEXT PRIMARY KEY,rule_id TEXT REFERENCES obligation_rules(id),name TEXT NOT NULL,due TEXT NOT NULL,amount INTEGER NOT NULL CHECK(amount>0),UNIQUE(rule_id,due));
 CREATE TABLE payment_allocations(id TEXT PRIMARY KEY,payable_id TEXT NOT NULL REFERENCES payables(id),transaction_id TEXT NOT NULL UNIQUE REFERENCES transactions(id),amount INTEGER NOT NULL CHECK(amount>0));
 CREATE TABLE documents(id TEXT PRIMARY KEY,name TEXT NOT NULL,path TEXT NOT NULL UNIQUE,hash TEXT NOT NULL UNIQUE,status TEXT NOT NULL,ekasa TEXT NOT NULL DEFAULT 'NotAttempted',text TEXT,error TEXT);
 CREATE TABLE processing_jobs(id TEXT PRIMARY KEY,document_id TEXT NOT NULL UNIQUE REFERENCES documents(id),status TEXT NOT NULL,attempts INTEGER NOT NULL DEFAULT 0);
 CREATE TABLE notifications(id TEXT PRIMARY KEY,payable_id TEXT NOT NULL REFERENCES payables(id),due TEXT NOT NULL,UNIQUE(payable_id,due));
 CREATE TABLE settings(key TEXT PRIMARY KEY,value TEXT NOT NULL);
 CREATE TABLE audit_events(id INTEGER PRIMARY KEY,action TEXT NOT NULL,entity_id TEXT NOT NULL,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
 CREATE INDEX transactions_date ON transactions(date);
 CREATE INDEX payables_due ON payables(due);
 `);
      db.prepare("INSERT INTO schema_migrations VALUES(1,?)").run(
        new Date().toISOString(),
      );
    })();
  if (current < 2)
    db.transaction(() => {
      db.exec(
        `CREATE TABLE document_confirmations(document_id TEXT PRIMARY KEY REFERENCES documents(id),kind TEXT NOT NULL,entity_id TEXT NOT NULL);`,
      );
      db.prepare("INSERT INTO schema_migrations VALUES(2,?)").run(
        new Date().toISOString(),
      );
    })();
  return db;
}
export type FinanceDatabase = ReturnType<typeof openDatabase>;
export function inspectDatabase(path: string) {
  const db = new Database(path, { readonly: true, fileMustExist: true });
  try {
    if (db.pragma("integrity_check", { simple: true }) !== "ok")
      throw Error("Databáza v zálohe je poškodená.");
    if ((db.pragma("foreign_key_check") as unknown[]).length)
      throw Error("Databáza obsahuje neplatné väzby.");
    const version = (
      db
        .prepare("SELECT MAX(version) version FROM schema_migrations")
        .get() as { version: number }
    ).version;
    if (version < 1 || version > 2)
      throw Error("Nepodporovaná verzia databázy.");
  } finally {
    db.close();
  }
}
